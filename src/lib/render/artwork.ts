import sharp from 'sharp';
import { isAllowedArtworkHost } from '../media/artwork';
import { readUpload, uploadIdFromUrl } from '../uploads';

/**
 * Satori não faz requisição de rede: a arte precisa chegar já embutida como
 * data: URI. Este módulo busca o original (host em allowlist), reduz para o
 * tamanho de composição e devolve um JPEG pequeno.
 *
 * O cache é em memória e por processo — suficiente para o MVP, e o lugar
 * óbvio para trocar por R2/MinIO quando o volume justificar (spec §8).
 */

const MAX_ENTRIES = 200;
const MAX_SOURCE_BYTES = 8_000_000;
const FETCH_TIMEOUT_MS = 5_000;

const cache = new Map<string, string>();

function remember(key: string, value: string): string {
  cache.set(key, value);
  if (cache.size > MAX_ENTRIES) {
    // Map preserva ordem de inserção: o primeiro é o mais antigo.
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return value;
}

/** Extrai a URL original de uma URL do nosso proxy (`/api/artwork?src=…`). */
export function originalArtworkUrl(proxied: string | null): string | null {
  if (!proxied) return null;
  if (!proxied.startsWith('/api/artwork')) {
    return isAllowedArtworkHost(proxied) ? proxied : null;
  }
  const src = new URLSearchParams(proxied.split('?')[1] ?? '').get('src');
  return src && isAllowedArtworkHost(src) ? src : null;
}

/**
 * Arte enviada pelo usuário: lida direto do disco.
 *
 * Ela já foi validada e reencodada no upload, então aqui basta redimensionar
 * para o tamanho de composição. Um round-trip HTTP contra o próprio servidor
 * seria só latência a mais no caminho crítico do render.
 */
async function uploadedDataUri(id: string, targetWidth: number): Promise<string | null> {
  const key = `upload:${id}@${targetWidth}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const bytes = await readUpload(id);
  if (!bytes) return null;

  try {
    const jpeg = await sharp(bytes)
      .resize({ width: targetWidth, withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    return remember(key, `data:image/jpeg;base64,${jpeg.toString('base64')}`);
  } catch {
    return null;
  }
}

/** Busca e normaliza a arte. Devolve null se ela não estiver disponível. */
export async function artworkDataUri(
  proxiedUrl: string | null,
  targetWidth: number,
): Promise<string | null> {
  if (proxiedUrl) {
    const uploadId = uploadIdFromUrl(proxiedUrl);
    if (uploadId) return uploadedDataUri(uploadId, targetWidth);
  }

  const src = originalArtworkUrl(proxiedUrl);
  if (!src) return null;

  const key = `${src}@${targetWidth}`;
  const hit = cache.get(key);
  if (hit) return hit;

  try {
    const res = await fetch(src, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: 'image/*' },
    });
    if (!res.ok) return null;

    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.byteLength > MAX_SOURCE_BYTES) return null;

    const jpeg = await sharp(bytes)
      .resize({ width: targetWidth, withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();

    return remember(key, `data:image/jpeg;base64,${jpeg.toString('base64')}`);
  } catch {
    // Arte indisponível degrada para a chapa vazia; nunca derruba o render.
    return null;
  }
}
