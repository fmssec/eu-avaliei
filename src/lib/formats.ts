/**
 * Matriz de formatos (spec §3.1).
 *
 * O Satori compõe o card no tamanho `base`; o resvg faz o upscale vetorial até
 * a largura de destino. Por isso `base` precisa ter EXATAMENTE a proporção do
 * destino — a altura final é derivada, nunca informada duas vezes.
 */

export type Variant = 'tall' | 'square' | 'wide';

export interface FormatSpec {
  id: FormatId;
  label: string;
  /** Dimensões finais em px. */
  width: number;
  height: number;
  variant: Variant;
  /** Tamanho de composição no Satori. Mesma proporção de width/height. */
  base: readonly [number, number];
  ext: 'png' | 'jpg';
  mime: 'image/png' | 'image/jpeg';
  /** Teto de bytes da spec. `og` é o único em que o teto manda no encoder. */
  maxBytes: number;
  /** Áreas cobertas pela UI do Instagram, em px do destino. */
  safeArea?: { top: number; bottom: number };
}

export const FORMATS = {
  story: {
    id: 'story',
    label: 'Story / Status',
    width: 1080,
    height: 1920,
    variant: 'tall',
    base: [360, 640],
    ext: 'png',
    mime: 'image/png',
    maxBytes: 2_000_000,
    safeArea: { top: 250, bottom: 300 },
  },
  square: {
    id: 'square',
    label: 'Feed quadrado',
    width: 1080,
    height: 1080,
    variant: 'square',
    base: [400, 400],
    ext: 'png',
    mime: 'image/png',
    maxBytes: 2_000_000,
  },
  og: {
    id: 'og',
    label: 'Preview de link',
    width: 1200,
    height: 630,
    variant: 'wide',
    base: [400, 210],
    ext: 'jpg',
    mime: 'image/jpeg',
    maxBytes: 250_000,
  },
  wide: {
    id: 'wide',
    label: 'X / Twitter',
    width: 1600,
    height: 900,
    variant: 'wide',
    base: [400, 225],
    ext: 'jpg',
    mime: 'image/jpeg',
    maxBytes: 5_000_000,
  },
} as const satisfies Record<string, FormatSpec>;

export type FormatId = 'story' | 'square' | 'og' | 'wide';

export const FORMAT_IDS = Object.keys(FORMATS) as FormatId[];

export function isFormatId(v: unknown): v is FormatId {
  return typeof v === 'string' && v in FORMATS;
}

export function formatOf(id: FormatId): FormatSpec {
  return FORMATS[id];
}
