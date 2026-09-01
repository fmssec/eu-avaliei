import { NextResponse } from 'next/server';
import { resolveMedia } from '@/lib/media';
import { createCardSchema, normalizeStats } from '@/lib/params';
import { deriveOverall } from '@/lib/overall';
import { store } from '@/lib/store';

export const runtime = 'nodejs';

/**
 * Cria um card. Sem login, por regra (spec §7): o card nasce anônimo e o
 * `claimToken` devolvido aqui vai para o localStorage do criador, que pode
 * reivindicá-lo depois. Exigir cadastro antes do primeiro card mataria a
 * conversão de um produto cujo valor inteiro é velocidade.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const parsed = createCardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const media = await resolveMedia(input.externalId);
  if (!media) {
    return NextResponse.json({ error: 'Mídia não encontrada' }, { status: 404 });
  }

  const stats = normalizeStats(input.stats);
  const overall = deriveOverall(input.overallMode, stats, input.overall);

  const { card, claimToken } = await store.createCard({
    media,
    overall,
    overallMode: input.overallMode,
    stats,
    frameId: input.frameId,
    themeId: input.themeId,
    caption: input.caption,
    artworkUrl: input.artworkUrl,
    authorHandle: input.authorHandle,
  });

  return NextResponse.json(
    { slug: card.slug, renderVersion: card.renderVersion, rarity: card.rarity, claimToken },
    { status: 201 },
  );
}
