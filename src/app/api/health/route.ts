import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Sinal de vida para o health check da hospedagem.
 *
 * Deliberadamente barato: não renderiza card, não consulta API externa, não
 * toca em disco. Num plano de 0,1 vCPU, um health check que renderizasse
 * consumiria a CPU que o usuário precisa — e mediria a coisa errada, já que
 * um render lento não significa serviço fora do ar.
 */
export function GET() {
  return NextResponse.json(
    { ok: true, at: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
