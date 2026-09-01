import { NextResponse } from 'next/server';
import { createCardSchema, normalizeStats } from '@/lib/params';
import { deriveOverall } from '@/lib/overall';
import { store } from '@/lib/store';

export const runtime = 'nodejs';

const patchSchema = createCardSchema.partial().omit({ externalId: true });

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const card = await store.getCardBySlug(slug);
  if (!card) return NextResponse.json({ error: 'Card não encontrado' }, { status: 404 });
  // O claimToken nunca sai daqui: é a credencial de edição.
  const { claimToken: _omit, ...safe } = card;
  return NextResponse.json(safe);
}

/**
 * Edita um card. O store incrementa `renderVersion` em toda edição, e a URL
 * canônica muda junto — é o único cache-bust que funciona no WhatsApp, que
 * guarda o scrape por 72h+ e não tem debugger oficial (spec §3.2).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const claimToken = request.headers.get('x-claim-token');
  if (!claimToken) {
    return NextResponse.json({ error: 'claim_token ausente' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const existing = await store.getCardBySlug(slug);
  if (!existing) return NextResponse.json({ error: 'Card não encontrado' }, { status: 404 });

  const input = parsed.data;
  const stats = input.stats ? normalizeStats(input.stats) : existing.stats;
  const mode = input.overallMode ?? existing.overallMode;
  const overall = deriveOverall(mode, stats, input.overall ?? existing.overall);

  const updated = await store.updateCard(slug, claimToken, {
    ...input,
    stats,
    overallMode: mode,
    overall,
  });
  if (!updated) {
    return NextResponse.json({ error: 'claim_token inválido' }, { status: 403 });
  }

  return NextResponse.json({
    slug: updated.slug,
    renderVersion: updated.renderVersion,
    rarity: updated.rarity,
  });
}
