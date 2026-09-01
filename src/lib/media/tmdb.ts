import type { Category, Media } from '../types';
import type { MediaProvider } from './provider';
import { proxiedArtwork } from './artwork';
import { normalizePopularity } from './ranking';

const API = 'https://api.themoviedb.org/3';
// w1280: o card tem 1080 de largura, e w780 obrigaria a ampliar.
const IMG = 'https://image.tmdb.org/t/p/w1280';
const LANG = 'pt-BR';

interface TmdbResult {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  popularity?: number;
  vote_count?: number;
}

function token(): string {
  const key = process.env.TMDB_API_KEY;
  if (!key) {
    throw new Error(
      'TMDB_API_KEY ausente. Defina-a ou use MEDIA_PROVIDER=mock.',
    );
  }
  return key;
}

async function call<T>(path: string, params: Record<string, string>, signal?: AbortSignal): Promise<T> {
  const url = new URL(API + path);
  url.searchParams.set('language', LANG);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token()}`, Accept: 'application/json' },
    signal,
    // O cache do Next evita bater no rate limit do TMDB em buscas repetidas.
    next: { revalidate: 60 * 60 * 24 },
  });
  if (!res.ok) throw new Error(`TMDB ${path}: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

function yearOf(r: TmdbResult): number | null {
  const date = r.release_date || r.first_air_date;
  const year = date ? Number(date.slice(0, 4)) : NaN;
  return Number.isFinite(year) && year > 0 ? year : null;
}

function toMedia(r: TmdbResult, category: Category, creator: string): Media {
  return {
    id: `tmdb-${category}-${r.id}`,
    source: 'tmdb',
    externalId: `${category === 'series' ? 'tv' : 'movie'}:${r.id}`,
    category,
    title: r.title || r.name || 'Sem título',
    originalTitle: r.original_title || r.original_name,
    year: yearOf(r),
    creator,
    artworkUrl: r.poster_path ? proxiedArtwork(IMG + r.poster_path) : null,
    fetchedAt: new Date().toISOString(),
  };
}

/** Diretor (filme) ou criador (série). Uma chamada extra, só ao abrir o item. */
async function creatorOf(kind: 'movie' | 'tv', id: number): Promise<string> {
  try {
    if (kind === 'movie') {
      const credits = await call<{ crew?: { job?: string; name?: string }[] }>(
        `/movie/${id}/credits`,
        {},
      );
      return credits.crew?.find((c) => c.job === 'Director')?.name ?? '';
    }
    const show = await call<{ created_by?: { name?: string }[] }>(`/tv/${id}`, {});
    return show.created_by?.map((c) => c.name).filter(Boolean).join(', ') ?? '';
  } catch {
    // Sem crédito é degradação aceitável; o card ainda funciona sem o criador.
    return '';
  }
}

export const tmdbProvider: MediaProvider = {
  name: 'tmdb',

  async search(query, signal) {
    const q = query.trim();
    if (!q) return [];
    const data = await call<{ results?: TmdbResult[] }>(
      '/search/multi',
      { query: q, include_adult: 'false', page: '1' },
      signal,
    );
    return (data.results ?? [])
      .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
      .slice(0, 8)
      // Na lista o criador fica vazio: buscar o diretor de 8 resultados seriam
      // 8 chamadas extras por tecla digitada. Ele é resolvido na seleção.
      .map((r) => ({
        media: toMedia(r, r.media_type === 'tv' ? 'series' : 'movie', ''),
        // O TMDB publica `popularity` numa escala aberta; algo acima de ~200
        // já é um lançamento em alta. Combinado com a contagem de votos, que
        // separa o que é popular do que é só recente.
        popularity: Math.max(
          normalizePopularity(r.popularity, 200),
          normalizePopularity(r.vote_count, 5000),
        ),
      }));
  },

  async byExternalId(externalId) {
    const [kind, rawId] = externalId.split(':');
    if (kind !== 'movie' && kind !== 'tv') return null;
    const id = Number(rawId);
    if (!Number.isInteger(id)) return null;

    const [detail, creator] = await Promise.all([
      call<TmdbResult>(`/${kind}/${id}`, {}),
      creatorOf(kind, id),
    ]);
    return toMedia(detail, kind === 'tv' ? 'series' : 'movie', creator);
  },
};
