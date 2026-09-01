import { NextResponse } from 'next/server';
import { safeFetchImage, UnsafeUrlError } from '@/lib/net/safe-fetch';
import { storeUpload, UPLOAD_MAX_BYTES } from '@/lib/uploads';

export const runtime = 'nodejs';

/**
 * Arte própria do usuário: arquivo do dispositivo ou link.
 *
 * `multipart/form-data` com o campo `file`, ou JSON `{ "url": "https://…" }`.
 * Os dois caminhos terminam no mesmo lugar — a imagem é reprocessada e
 * guardada, e o card passa a referenciar `/api/uploads/{id}.jpg`.
 *
 * Buscar o link no servidor (em vez de deixar o renderizador buscar na hora)
 * é o que permite validar a origem uma vez só, e faz o card continuar
 * funcionando quando o link original sair do ar.
 */

/**
 * Limite por IP. Escrever em disco a pedido de qualquer um é vetor de abuso:
 * sem teto, encher o volume é questão de minutos. Em memória serve para uma
 * instância; com várias, isto migra para Redis junto com o resto do estado.
 */
const RATE_LIMIT = { max: 20, windowMs: 10 * 60 * 1000 };
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT.windowMs);
  recent.push(now);
  hits.set(ip, recent);

  // Poda oportunista: sem isso o Map cresce sem fim.
  if (hits.size > 5_000) {
    for (const [key, times] of hits) {
      if (times.every((t) => now - t >= RATE_LIMIT.windowMs)) hits.delete(key);
    }
  }
  return recent.length > RATE_LIMIT.max;
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'desconhecido';
}

export async function POST(request: Request) {
  if (rateLimited(clientIp(request))) {
    return NextResponse.json(
      { error: 'Muitos envios seguidos. Tente de novo em alguns minutos.' },
      { status: 429 },
    );
  }

  const contentType = request.headers.get('content-type') ?? '';

  try {
    let bytes: Buffer;

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('file');
      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'Envie um arquivo no campo "file"' }, { status: 400 });
      }
      if (file.size > UPLOAD_MAX_BYTES) {
        return NextResponse.json({ error: 'Imagem acima de 10 MB' }, { status: 413 });
      }
      // O type declarado pelo cliente não é confiável; quem decide se é imagem
      // de verdade é o sharp, ao tentar decodificar.
      bytes = Buffer.from(await file.arrayBuffer());
    } else {
      const body = (await request.json()) as { url?: unknown };
      if (typeof body.url !== 'string' || !body.url.trim()) {
        return NextResponse.json({ error: 'Informe uma URL de imagem' }, { status: 400 });
      }
      const fetched = await safeFetchImage(body.url.trim(), { maxBytes: UPLOAD_MAX_BYTES });
      bytes = fetched.body;
    }

    const stored = await storeUpload(bytes);
    return NextResponse.json(stored, { status: 201 });
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : 'Falha ao processar a imagem';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
