import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

/**
 * Arte enviada pelo usuário — arquivo do dispositivo ou link.
 *
 * Os dois caminhos convergem aqui: a imagem é reprocessada pelo sharp antes de
 * ser guardada. Isso não é só normalização de tamanho. Reencodar descarta EXIF
 * (que carrega geolocalização), joga fora qualquer payload escondido em campo
 * de metadado, e garante que o que servimos é uma imagem de verdade — não um
 * arquivo com extensão de imagem.
 *
 * Guardar em disco, e não embutir no card, também é o que permite o link
 * `/api/uploads/{id}` ser reusado por todos os formatos sem reenviar nada.
 */

export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
/** Suficiente para o pôster no Story em 1080 de largura, com folga. */
const STORED_MAX_EDGE = 1600;
const STORED_QUALITY = 86;

const DIR = join(process.cwd(), '.data', 'uploads');

/** Id = sha256 do conteúdo processado. Dedupe de graça, e não é enumerável. */
export type UploadId = string;

const ID_PATTERN = /^[0-9a-f]{32}$/;

export function isUploadId(value: string): value is UploadId {
  return ID_PATTERN.test(value);
}

/** URL pública de um upload. É o valor guardado em `cards.artwork_url`. */
export function uploadUrl(id: UploadId): string {
  return `/api/uploads/${id}.jpg`;
}

const UPLOAD_URL_PATTERN = /^\/api\/uploads\/([0-9a-f]{32})\.jpg$/;

/** Extrai o id de uma URL de upload, ou null se não for uma. */
export function uploadIdFromUrl(url: string): UploadId | null {
  return url.match(UPLOAD_URL_PATTERN)?.[1] ?? null;
}

/**
 * Caminho em disco. O id vem sempre do padrão hexadecimal validado, então não
 * há como um `..` chegar aqui — mas a checagem fica explícita porque este é o
 * ponto em que entrada do usuário viraria caminho de arquivo.
 */
export function uploadPath(id: string): string {
  if (!isUploadId(id)) throw new Error('Id de upload inválido');
  return join(DIR, `${id}.jpg`);
}

export interface StoredUpload {
  id: UploadId;
  url: string;
  bytes: number;
  width: number;
  height: number;
}

/**
 * Reencoda e guarda. Aceita qualquer formato que o sharp leia; devolve sempre
 * JPEG, que é o que os formatos de saída do card usam.
 */
export async function storeUpload(input: Buffer): Promise<StoredUpload> {
  let pipeline: ReturnType<typeof sharp>;
  let meta: Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>;

  try {
    // `limitInputPixels` barra a decompression bomb: um PNG de 20 KB pode
    // declarar 50000×50000 e estourar a memória do processo ao ser aberto.
    pipeline = sharp(input, { limitInputPixels: 100_000_000 });
    meta = await pipeline.metadata();
  } catch {
    throw new Error('Não foi possível ler a imagem');
  }

  if (!meta.width || !meta.height) throw new Error('Imagem sem dimensões');

  const processed = await pipeline
    .rotate() // aplica a orientação do EXIF antes de descartá-lo
    .resize({
      width: STORED_MAX_EDGE,
      height: STORED_MAX_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .flatten({ background: '#101013' }) // JPEG não tem alfa; o fundo é o da chapa
    .jpeg({ quality: STORED_QUALITY, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  const id = createHash('sha256').update(processed.data).digest('hex').slice(0, 32);

  await mkdir(DIR, { recursive: true });
  const path = uploadPath(id);

  // Mesmo conteúdo, mesmo id: não reescreve.
  const exists = await stat(path).then(
    () => true,
    () => false,
  );
  if (!exists) await writeFile(path, processed.data);

  return {
    id,
    url: uploadUrl(id),
    bytes: processed.data.byteLength,
    width: processed.info.width,
    height: processed.info.height,
  };
}

export async function readUpload(id: string): Promise<Buffer | null> {
  try {
    return await readFile(uploadPath(id));
  } catch {
    return null;
  }
}
