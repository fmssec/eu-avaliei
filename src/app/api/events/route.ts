import { NextResponse } from 'next/server';
import { z } from 'zod';
import { store } from '@/lib/store';

export const runtime = 'nodejs';

/**
 * Instrumentação da tese (spec §6). A pergunta que `card_events` responde:
 * dos cards criados, quantos são efetivamente compartilhados, por qual canal,
 * e quantos cliques de volta cada canal gera. Sem isso não dá para saber se o
 * critério de sucesso do MVP foi atingido.
 */
const eventSchema = z.object({
  slug: z.string().min(1).max(64),
  event: z.enum(['created', 'rendered', 'shared', 'viewed', 'converted']),
  channel: z
    .enum(['webshare', 'whatsapp', 'x', 'telegram', 'clipboard', 'download', 'og'])
    .nullable()
    .default(null),
  format: z.string().max(24).nullable().default(null),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Evento inválido' }, { status: 400 });

  const card = await store.getCardBySlug(parsed.data.slug);
  if (!card) return NextResponse.json({ error: 'Card não encontrado' }, { status: 404 });

  await store.recordEvent({
    cardId: card.id,
    event: parsed.data.event,
    channel: parsed.data.channel,
    format: parsed.data.format,
    referrer: request.headers.get('referer'),
  });

  return new NextResponse(null, { status: 204 });
}
