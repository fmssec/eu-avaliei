import { NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';

/**
 * Instrumentação da tese, sem banco.
 *
 * A pergunta continua a mesma da spec §6: dos cards criados, quantos são
 * efetivamente compartilhados, por qual canal, e quanto retorno cada canal
 * gera. O que mudou é a granularidade — sem card persistido, não há como
 * atribuir uma visita a um card específico, então a medição é agregada.
 *
 * Os eventos saem em JSON de uma linha no stdout, que é o que toda hospedagem
 * coleta de graça. `grep` e `jq` já respondem o funil; quando o volume pedir
 * mais, é apontar um coletor para o mesmo fluxo.
 */
const eventSchema = z.object({
  event: z.enum(['created', 'shared', 'viewed', 'converted']),
  channel: z
    .enum(['webshare', 'whatsapp', 'x', 'telegram', 'clipboard', 'download', 'site'])
    .nullable()
    .default(null),
  format: z.string().max(24).nullable().default(null),
  /** Categoria da mídia avaliada, para saber o que as pessoas realmente usam. */
  category: z.string().max(16).nullable().default(null),
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

  // Prefixo fixo para separar do resto do log: `grep '[evento]' | jq`.
  console.log(
    '[evento]',
    JSON.stringify({
      ...parsed.data,
      referrer: request.headers.get('referer'),
      at: new Date().toISOString(),
    }),
  );

  return new NextResponse(null, { status: 204 });
}
