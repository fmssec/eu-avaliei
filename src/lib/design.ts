/**
 * Tokens da identidade visual, extraídos de eu-avaliei-formul-rio-de-design/.
 *
 * As cores do design estão em oklch(). Satori e resvg não interpretam oklch,
 * então cada valor está aqui convertido para o hex sRGB equivalente. As duas
 * pontas — CSS do editor e renderizador server-side — leem deste arquivo, para
 * que não exista uma segunda fonte de verdade que possa divergir.
 */

export const COLOR = {
  bg: '#08080A',
  ink: '#F4F1EA',
  inkSoft: '#CFCCC5',
  inkDim: '#B9B6AF',
  muted: '#9A9792',
  muted2: '#8C8A85',
  muted3: '#77746E',
  muted4: '#6E6B66',
  muted5: '#5E5B57',
  line: '#1E1E22',
  line2: '#26262A',
  line3: '#2A2A2E',
  line4: '#3A3A3E',
  surface: '#0E0E11',
  surface2: '#111114',
  plate: '#101013',
  plateDark: '#0B0B0C',
  gold: '#E4B750', // oklch(0.80 0.13 85)
  ok: '#5BBD74', // oklch(0.72 0.14 150)
  warn: '#EB7A52', // oklch(0.70 0.15 40)
} as const;

export const FONT = {
  display: 'Archivo Black',
  sans: 'Barlow Condensed',
  mono: 'IBM Plex Mono',
} as const;

/** Faixas de raridade. Ordem decrescente: o primeiro `min` atingido vence. */
export const LEVELS = [
  {
    id: 'especial',
    min: 9.0,
    label: 'ESPECIAL',
    faixa: '9,0 – 10',
    edge: '#EB9AFD', // oklch(0.80 0.16 320)
    plate: 'linear-gradient(160deg,#1A1024 0%,#0C0B10 60%)',
  },
  {
    id: 'ouro',
    min: 8.0,
    label: 'OURO',
    faixa: '8,0 – 8,9',
    edge: '#E4B750', // oklch(0.80 0.13 85)
    plate: 'linear-gradient(160deg,#1A160D 0%,#0D0C0A 60%)',
  },
  {
    id: 'prata',
    min: 7.0,
    label: 'PRATA',
    faixa: '7,0 – 7,9',
    edge: '#BBC5D1', // oklch(0.82 0.02 250)
    plate: 'linear-gradient(160deg,#14161A 0%,#0C0C0E 60%)',
  },
  {
    id: 'bronze',
    min: 5.0,
    label: 'BRONZE',
    faixa: '5,0 – 6,9',
    edge: '#BB7B4E', // oklch(0.64 0.10 55)
    plate: 'linear-gradient(160deg,#181310 0%,#0D0B0A 60%)',
  },
  {
    id: 'comum',
    min: 0,
    label: 'COMUM',
    faixa: '0,0 – 4,9',
    edge: '#8F9298', // oklch(0.66 0.01 260)
    plate: '#101013',
  },
] as const;

export type Level = (typeof LEVELS)[number];
export type RarityId = Level['id'];

/** A nota é sempre normalizada para 0–10 antes de chegar aqui. */
export function levelFor(overall: number): Level {
  return LEVELS.find((l) => overall >= l.min) ?? LEVELS[LEVELS.length - 1];
}
