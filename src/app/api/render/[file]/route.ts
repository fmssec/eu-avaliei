import { NextResponse } from 'next/server';
import { isFormatId, type FormatId } from '@/lib/formats';
import { refreshIfStale } from '@/lib/media';
import { renderCard } from '@/lib/render';
import { store } from '@/lib/store';
import { isScaleMax } from '@/lib/scale';

export const runtime = 'nodejs';

/**
 * Render de um card salvo (spec §4.3):
 *   GET /api/render/{slug}.{ext}?format=story|square|og|wide&v={renderVersion}
 *
 * A URL carrega a versão, então a resposta é imutável e nunca precisa
 * revalidar. Editar o card incrementa a versão e produz uma URL nova — que é
 * o que faz o WhatsApp buscar o preview de novo.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;
  const dot = file.lastIndexOf('.');
  const slug = dot === -1 ? file : file.slice(0, dot);

  const { searchParams } = new URL(request.url);
  const requested = searchParams.get('format') ?? 'story';
  if (!isFormatId(requested)) {
    return NextResponse.json({ error: 'Formato desconhecido' }, { status: 400 });
  }
  const format: FormatId = requested;

  const card = await store.getCardBySlug(slug);
  if (!card) return NextResponse.json({ error: 'Card não encontrado' }, { status: 404 });

  const media = await refreshIfStale(card.media);

  const rawScale = Number(searchParams.get('scale'));
  const scaleMax = isScaleMax(rawScale) ? rawScale : 10;

  const result = await renderCard({
    format,
    frame: card.frameId,
    overall: card.overall,
    scaleMax,
    title: media.title,
    creator: media.creator,
    year: media.year,
    category: media.category,
    caption: card.caption,
    author: card.authorHandle ?? '@anônimo',
    stats: card.stats,
    // A arte que o usuário anexou vence a da fonte externa.
    artworkUrl: card.artworkUrl ?? media.artworkUrl,
    showSafeArea: searchParams.get('safe') === '1',
  });

  if (format === 'og') {
    // Sinal de que um crawler puxou o preview. Com CDN na frente isto vira um
    // piso, não a contagem real — o número honesto de alcance vem de `viewed`.
    void store.recordEvent({ cardId: card.id, event: 'rendered', channel: 'og', format });
  }

  return new NextResponse(new Uint8Array(result.body), {
    headers: {
      'Content-Type': result.mime,
      'Content-Length': String(result.bytes),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Disposition': `inline; filename="${slug}-${format}.${result.ext}"`,
    },
  });
}
