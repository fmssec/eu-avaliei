import type { RarityId } from './design';

export type Category = 'movie' | 'series' | 'game' | 'book' | 'album';

export type MediaSource = 'tmdb' | 'igdb' | 'openlibrary' | 'musicbrainz' | 'mock';

/** Mídia externa já normalizada no schema interno (spec §6, tabela `media`). */
export interface Media {
  id: string;
  source: MediaSource;
  externalId: string;
  category: Category;
  title: string;
  originalTitle?: string;
  year: number | null;
  /** diretor / desenvolvedor / autor / artista */
  creator: string;
  /** URL no nosso proxy, nunca a CDN de terceiro. Null = sem arte disponível. */
  artworkUrl: string | null;
  fetchedAt: string;
}

export interface Stat {
  key: string;
  label: string;
  /** 0–10, sempre. */
  value: number;
}

/**
 * Como a nota geral se relaciona com os eixos (spec §2.3, reduzida a dois).
 *
 * `manual` existe de propósito: "filme tecnicamente medíocre que eu amo" é uma
 * opinião que gera compartilhamento, e um sistema que só tira média impede de
 * expressá-la.
 */
export type OverallMode = 'computed' | 'manual';

/**
 * `ficha` era `craque`. O visual se inspira em carta de jogador, mas o produto
 * não tem nada a ver com futebol, e o nome sugeria o contrário. Cards antigos
 * ainda trazem o valor velho — ver `normalizeFrameId`.
 */
export type FrameId = 'ficha' | 'poster';

export function normalizeFrameId(value: unknown): FrameId {
  return value === 'poster' ? 'poster' : 'ficha';
}
