import { NextResponse } from 'next/server';
import { searchAll } from '@/lib/media';

export const runtime = 'nodejs';

/** Busca federada, sem escolher categoria antes (spec §7). */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json({ results: [] });

  try {
    const results = await searchAll(q, request.signal);
    return NextResponse.json(
      { results },
      { headers: { 'Cache-Control': 'public, max-age=300' } },
    );
  } catch (error) {
    console.error('[search]', error);
    return NextResponse.json({ error: 'Busca indisponível' }, { status: 502 });
  }
}
