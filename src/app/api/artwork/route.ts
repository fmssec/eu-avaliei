import { NextResponse } from 'next/server';
import { isAllowedArtworkHost } from '@/lib/media/artwork';

export const runtime = 'nodejs';

const TIMEOUT_MS = 8_000;
const MAX_BYTES = 8_000_000;

/**
 * Proxy de pôsteres e capas (spec §4.3).
 *
 * Nunca referenciamos a CDN de terceiro direto: quebra quando a URL muda e
 * vaza o referrer do nosso domínio. A allowlist de hosts existe para que este
 * endpoint não vire um SSRF aberto.
 */
export async function GET(request: Request) {
  const src = new URL(request.url).searchParams.get('src');
  if (!src || !isAllowedArtworkHost(src)) {
    return NextResponse.json({ error: 'Origem de arte não permitida' }, { status: 400 });
  }

  try {
    const upstream = await fetch(src, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: 'image/*' },
      next: { revalidate: 60 * 60 * 24 * 30 },
    });
    if (!upstream.ok) {
      return NextResponse.json({ error: 'Arte indisponível' }, { status: 502 });
    }

    const type = upstream.headers.get('content-type') ?? '';
    if (!type.startsWith('image/')) {
      return NextResponse.json({ error: 'Resposta não é imagem' }, { status: 502 });
    }

    const bytes = Buffer.from(await upstream.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: 'Arte grande demais' }, { status: 502 });
    }

    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': type,
        'Content-Length': String(bytes.byteLength),
        'Cache-Control': 'public, max-age=2592000, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Falha ao buscar arte' }, { status: 502 });
  }
}
