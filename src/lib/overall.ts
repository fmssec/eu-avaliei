import { roundScore } from './scale';
import type { OverallMode, Stat } from './types';

/**
 * Relação entre nota geral e estatísticas (spec §2.3).
 *
 * Dois modos, não três: no `manual` a nota geral não deriva de nada, e no
 * `computed` é a média dos eixos. O modo ponderado saiu — pedir peso por eixo
 * é uma decisão a mais numa tela que precisa caber em trinta segundos.
 */
export function deriveOverall(mode: OverallMode, stats: Stat[], manual: number): number {
  if (mode === 'manual' || stats.length === 0) return roundScore(manual);
  return roundScore(stats.reduce((a, s) => a + s.value, 0) / stats.length);
}
