import { z } from 'zod';
import { FORMAT_IDS, type FormatId } from './formats';
import { clampScore, roundScore, type ScaleMax } from './scale';
import type { Category, FrameId, OverallMode, Stat } from './types';
import { MAX_STATS, slugifyAxis } from './axes';
import { isAcceptableArtworkUrl } from './media/artwork';

/**
 * Codec dos parâmetros de preview.
 *
 * O preview do editor é uma <img> apontando para /api/preview, então o estado
 * do card em edição precisa caber numa querystring — e ser validado na volta,
 * porque essa querystring é entrada pública.
 */

const CATEGORIES = ['movie', 'series', 'game', 'book', 'album'] as const;
const FRAMES = ['ficha', 'poster'] as const;
const MODES = ['computed', 'manual'] as const;

/** "Roteiro:8.6~Atuação:9.4" — separador que não aparece em nome de eixo. */
const STAT_SEP = '~';

export function encodeStats(stats: { label: string; value: number }[]): string {
  return stats
    .slice(0, MAX_STATS)
    .map((s) => `${s.label.replace(/[:~]/g, ' ')}:${clampScore(s.value).toFixed(1)}`)
    .join(STAT_SEP);
}

function decodeStats(raw: string): { label: string; value: number }[] {
  if (!raw) return [];
  return raw
    .split(STAT_SEP)
    .slice(0, MAX_STATS)
    .map((chunk) => {
      const at = chunk.lastIndexOf(':');
      const label = (at === -1 ? chunk : chunk.slice(0, at)).trim().slice(0, 24);
      const value = at === -1 ? 0 : Number(chunk.slice(at + 1));
      return { label: label || 'Eixo', value: roundScore(Number.isFinite(value) ? value : 0) };
    });
}

const score = z.coerce.number().transform(roundScore);

export const previewParamsSchema = z.object({
  f: z.enum(FORMAT_IDS as [FormatId, ...FormatId[]]).default('story'),
  // Aceita o valor legado 'craque' para não quebrar links de cards antigos.
  fr: z.preprocess((v) => (v === 'craque' ? 'ficha' : v), z.enum(FRAMES)).default('ficha'),
  o: score.default(8.4),
  sm: z.coerce.number().transform((n): ScaleMax => (n === 100 ? 100 : 10)).default(10),
  t: z.string().trim().min(1).max(120).default('Sem título'),
  cr: z.string().trim().max(80).default(''),
  y: z
    .string()
    .optional()
    .transform((v) => {
      const n = Number(v);
      return v && Number.isInteger(n) && n > 1800 && n < 2200 ? n : null;
    }),
  cat: z.enum(CATEGORIES).default('movie'),
  cap: z.string().trim().max(80).default(''),
  a: z.string().trim().max(32).default('@anônimo'),
  s: z.string().max(400).default(''),
  art: z.string().max(600).optional(),
  safe: z.string().optional(),
});

export interface PreviewParams {
  format: FormatId;
  frame: FrameId;
  overall: number;
  scaleMax: ScaleMax;
  title: string;
  creator: string;
  year: number | null;
  category: Category;
  caption: string;
  author: string;
  stats: { label: string; value: number }[];
  artworkUrl: string | null;
  showSafeArea: boolean;
}

export function parsePreviewParams(search: URLSearchParams): PreviewParams {
  const p = previewParamsSchema.parse(Object.fromEntries(search));
  return {
    format: p.f,
    frame: p.fr,
    overall: p.o,
    scaleMax: p.sm,
    title: p.t,
    creator: p.cr,
    year: p.y,
    category: p.cat,
    caption: p.cap,
    author: p.a,
    stats: decodeStats(p.s),
    // Mesma regra do card: o preview também renderiza o que vier em `art`.
    artworkUrl: p.art && isAcceptableArtworkUrl(p.art) ? p.art : null,
    showSafeArea: p.safe === '1',
  };
}

export interface PreviewSource {
  format: FormatId;
  frame: FrameId;
  overall: number;
  scaleMax: ScaleMax;
  title: string;
  creator: string;
  year: number | null;
  category: Category;
  caption: string;
  author: string;
  stats: { label: string; value: number }[];
  artworkUrl?: string | null;
  showSafeArea?: boolean;
}

export function buildPreviewQuery(src: PreviewSource): string {
  const q = new URLSearchParams({
    f: src.format,
    fr: src.frame,
    o: src.overall.toFixed(1),
    sm: String(src.scaleMax),
    t: src.title,
    cr: src.creator,
    cat: src.category,
    cap: src.caption,
    a: src.author,
    s: encodeStats(src.stats),
  });
  if (src.year) q.set('y', String(src.year));
  if (src.artworkUrl) q.set('art', src.artworkUrl);
  if (src.showSafeArea) q.set('safe', '1');
  return q.toString();
}

/** Corpo aceito por POST /api/cards. */
export const createCardSchema = z.object({
  externalId: z.string().min(1).max(64),
  overall: z.number().transform(roundScore),
  overallMode: z.enum(MODES),
  frameId: z.preprocess((v) => (v === 'craque' ? 'ficha' : v), z.enum(FRAMES)),
  themeId: z.string().max(32).default('default'),
  caption: z.string().max(80).default(''),
  // A arte vem do cliente, então é validada contra o formato que o servidor
  // emite. Aceitar string livre aqui viraria <img src> arbitrário no render.
  artworkUrl: z
    .string()
    .max(600)
    .nullable()
    .default(null)
    .refine((v) => v === null || isAcceptableArtworkUrl(v), {
      message: 'Origem de arte não permitida',
    }),
  authorHandle: z.string().max(32).nullable().default(null),
  stats: z
    .array(
      z.object({
        label: z.string().min(1).max(24),
        value: z.number(),
      }),
    )
    .max(MAX_STATS)
    .default([]),
});

export function normalizeStats(raw: { label: string; value: number }[]): Stat[] {
  return raw.slice(0, MAX_STATS).map((s) => ({
    key: slugifyAxis(s.label),
    label: s.label,
    value: roundScore(s.value),
  }));
}

export type { OverallMode };
