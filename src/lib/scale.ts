/**
 * A nota vive no domínio 0–10 em todo o sistema. A escala 0–100 é só
 * apresentação — converter na borda evita dois domínios circulando juntos.
 */
export type ScaleMax = 10 | 100;

export function isScaleMax(v: unknown): v is ScaleMax {
  return v === 10 || v === 100;
}

/** Formata uma nota 0–10 no padrão brasileiro (vírgula decimal) ou em 0–100. */
export function formatScore(value: number, max: ScaleMax = 10): string {
  const v = clampScore(value);
  return max === 100 ? String(Math.round(v * 10)) : v.toFixed(1).replace('.', ',');
}

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(10, Math.max(0, value));
}

/** Arredonda para uma casa decimal, o passo do slider. */
export function roundScore(value: number): number {
  return Math.round(clampScore(value) * 10) / 10;
}
