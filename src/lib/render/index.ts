import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';
import sharp from 'sharp';
import { FORMATS, type FormatId, type FormatSpec } from '../formats';
import type { ScaleMax } from '../scale';
import type { Category, FrameId } from '../types';
import { artworkDataUri } from './artwork';
import { CardArt } from './card';
import { loadFonts } from './fonts';

/**
 * Renderizador único, server-side, consumido por todos os canais (spec §4.1).
 *
 * Manter dois renderizadores que precisam produzir o mesmo pixel é fonte
 * permanente de bug, e o og:image obriga renderização de servidor de qualquer
 * jeito. Por isso o preview do editor também é uma <img> apontando para cá.
 */

export interface RenderRequest {
  format: FormatId;
  frame: FrameId;
  /** 0–10. */
  overall: number;
  scaleMax: ScaleMax;
  title: string;
  creator: string;
  year: number | null;
  category: Category;
  caption: string;
  author: string;
  stats: { label: string; value: number }[];
  /** URL do nosso proxy de arte, ou null. */
  artworkUrl?: string | null;
  showSafeArea?: boolean;
}

export interface RenderResult {
  body: Buffer;
  mime: string;
  ext: string;
  bytes: number;
  width: number;
  height: number;
}

const CATEGORY_LABEL: Record<Category, string> = {
  movie: 'FILME',
  series: 'SÉRIE',
  game: 'JOGO',
  book: 'LIVRO',
  album: 'ÁLBUM',
};

/**
 * Degraus de qualidade para caber no teto de bytes do destino.
 *
 * A spec pede q80–85 para o og:image, que é onde um pôster real cai. Os
 * degraus abaixo disso existem como rede: uma key art muito ruidosa em
 * 1200×630 chega a passar de 400 KB em q80, e um preview acima de ~300 KB é
 * um preview que o WhatsApp simplesmente não mostra.
 */
const JPEG_STEPS = [85, 80, 75, 70, 65, 58, 50, 42];

async function toSvg(req: RenderRequest, spec: FormatSpec): Promise<string> {
  const [baseW, baseH] = spec.base;
  const [fonts, artwork] = await Promise.all([
    loadFonts(),
    artworkDataUri(req.artworkUrl ?? null, Math.round(baseW * 2)),
  ]);

  return satori(
    CardArt({
      variant: spec.variant,
      frame: req.frame,
      overall: req.overall,
      scaleMax: req.scaleMax,
      title: req.title,
      creator: req.creator,
      year: req.year,
      categoryLabel: CATEGORY_LABEL[req.category] ?? 'MÍDIA',
      caption: req.caption,
      author: req.author,
      stats: req.stats,
      artwork,
      showSafeArea: req.showSafeArea && spec.safeArea !== undefined,
      width: baseW,
      height: baseH,
    }),
    { width: baseW, height: baseH, fonts },
  );
}

/** Desce a escada de qualidade até caber, ou entrega o menor que conseguiu. */
async function encodeJpeg(png: Buffer, maxBytes: number, label: string): Promise<Buffer> {
  let last: Buffer | null = null;
  for (const quality of JPEG_STEPS) {
    last = await sharp(png).jpeg({ quality, mozjpeg: true, chromaSubsampling: '4:2:0' }).toBuffer();
    if (last.byteLength <= maxBytes) return last;
  }

  // Esgotados os degraus, entrega o menor que conseguimos em vez de falhar:
  // uma imagem pesada é melhor que card nenhum. Mas isso precisa aparecer no
  // log, porque significa que aquele card vai falhar no destino.
  const body = last as Buffer;
  console.warn(
    `[render] ${label} acima do teto: ${body.byteLength} bytes > ${maxBytes}. ` +
      'O destino pode recusar esta imagem.',
  );
  return body;
}

/**
 * Encoda respeitando o teto de bytes do destino (spec §3.1).
 *
 * O teto vale para todos os formatos, não só para o og:image. Um card com key
 * art fotográfica em sangria total passa de 2,5 MB em PNG no 1080×1920 — acima
 * do limite de 2 MB do Story. A matriz da especificação diz "PNG ou JPEG"
 * justamente por isso: PNG enquanto couber, porque mantém o texto pequeno mais
 * nítido, e JPEG quando a arte fotográfica não deixa caber.
 */
async function encodeToBudget(
  png: Buffer,
  spec: FormatSpec,
): Promise<{ body: Buffer; mime: string; ext: string }> {
  if (spec.ext === 'jpg') {
    return {
      body: await encodeJpeg(png, spec.maxBytes, spec.id),
      mime: 'image/jpeg',
      ext: 'jpg',
    };
  }

  if (png.byteLength <= spec.maxBytes) {
    return { body: png, mime: 'image/png', ext: 'png' };
  }

  return {
    body: await encodeJpeg(png, spec.maxBytes, spec.id),
    mime: 'image/jpeg',
    ext: 'jpg',
  };
}

export async function renderCard(req: RenderRequest): Promise<RenderResult> {
  const spec = FORMATS[req.format];
  const svg = await toSvg(req, spec);

  // Upscale vetorial: a composição acontece no tamanho base e o resvg leva
  // até a largura final. Por isso `base` tem a proporção exata do destino.
  const png = Buffer.from(
    new Resvg(svg, {
      fitTo: { mode: 'width', value: spec.width },
      font: { loadSystemFonts: false },
    })
      .render()
      .asPng(),
  );

  const { body, mime, ext } = await encodeToBudget(png, spec);

  return {
    body,
    mime,
    ext,
    bytes: body.byteLength,
    width: spec.width,
    height: spec.height,
  };
}
