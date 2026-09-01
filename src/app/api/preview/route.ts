import { NextResponse } from 'next/server';
import { parsePreviewParams } from '@/lib/params';
import { renderCard } from '@/lib/render';

export const runtime = 'nodejs';

/**
 * Preview do card em edição. Mesma função de render usada pelo og:image e
 * pelos downloads — o preview é idêntico ao resultado final por construção,
 * não por coincidência (spec §4.1).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  let params;
  try {
    params = parsePreviewParams(searchParams);
  } catch {
    return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });
  }

  const started = Date.now();
  const result = await renderCard({
    format: params.format,
    frame: params.frame,
    overall: params.overall,
    scaleMax: params.scaleMax,
    title: params.title,
    creator: params.creator,
    year: params.year,
    category: params.category,
    caption: params.caption,
    author: params.author,
    stats: params.stats,
    artworkUrl: params.artworkUrl,
    showSafeArea: params.showSafeArea,
  });

  return new NextResponse(new Uint8Array(result.body), {
    headers: {
      'Content-Type': result.mime,
      'Content-Length': String(result.bytes),
      // A querystring é a chave: mesmos parâmetros, mesmo pixel.
      'Cache-Control': 'public, max-age=300',
      'Server-Timing': `render;dur=${Date.now() - started}`,
    },
  });
}
