import type { Media } from '../types';
import type { MediaProvider } from './provider';
import { proxiedArtwork } from './artwork';
import { normalizePopularity } from './ranking';

/**
 * Livros, via Open Library (spec §5).
 *
 * Sem chave e sem cadastro — é a única das quatro fontes que funciona no
 * primeiro `npm run dev`. Os dados são de domínio público.
 *
 * A Open Library é explícita sobre não ser backend comercial de alto tráfego:
 * eles pedem uso de baixo volume e voltado a descoberta. O cache em base
 * própria é o que mantém a gente desse lado da linha.
 */

const API = 'https://openlibrary.org';
const COVERS = 'https://covers.openlibrary.org/b/id';
const USER_AGENT = 'eu-avaliei/0.1 (gerador de cards de avaliacao)';

interface OpenLibraryDoc {
  key?: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  edition_count?: number;
  ratings_count?: number;
}

function toMedia(doc: OpenLibraryDoc): Media | null {
  // A chave vem como "/works/OL123W"; guardamos só o id.
  const workId = doc.key?.split('/').pop();
  if (!workId || !doc.title) return null;

  return {
    id: `openlibrary-${workId}`,
    source: 'openlibrary',
    externalId: workId,
    category: 'book',
    title: doc.title,
    year: doc.first_publish_year ?? null,
    creator: doc.author_name?.slice(0, 2).join(', ') ?? '',
    artworkUrl: doc.cover_i ? proxiedArtwork(`${COVERS}/${doc.cover_i}-L.jpg`) : null,
    fetchedAt: new Date().toISOString(),
  };
}

async function call<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    signal,
    next: { revalidate: 60 * 60 * 24 },
  });
  if (!res.ok) throw new Error(`Open Library ${path}: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export const openLibraryProvider: MediaProvider = {
  name: 'openlibrary',

  async search(query, signal) {
    const q = query.trim();
    if (!q) return [];

    // `fields` corta a resposta: sem isso cada resultado vem com dezenas de
    // campos que não usamos, e a busca fica lenta à toa.
    const data = await call<{ docs?: OpenLibraryDoc[] }>(
      `/search.json?q=${encodeURIComponent(q)}&limit=6&fields=key,title,author_name,first_publish_year,cover_i,edition_count,ratings_count`,
      signal,
    );
    return (data.docs ?? [])
      .map((doc) => {
        const media = toMedia(doc);
        return media
          ? {
              media,
              // Número de edições é o melhor sinal de canonicidade que a Open
              // Library dá: um clássico tem centenas, uma partitura tem uma.
              popularity: Math.max(
                normalizePopularity(doc.edition_count, 120),
                normalizePopularity(doc.ratings_count, 400),
              ),
            }
          : null;
      })
      .filter((h): h is { media: Media; popularity: number } => h !== null);
  },

  async byExternalId(externalId) {
    if (!/^OL\d+W$/.test(externalId)) return null;

    const work = await call<{
      title?: string;
      covers?: number[];
      first_publish_date?: string;
      authors?: { author?: { key?: string } }[];
    }>(`/works/${externalId}.json`);

    // O nome do autor não vem na obra, só a referência. Uma chamada extra por
    // autor, no máximo dois, e só quando o livro é efetivamente escolhido.
    const authorKeys = (work.authors ?? [])
      .map((a) => a.author?.key)
      .filter((k): k is string => typeof k === 'string')
      .slice(0, 2);

    const authors = await Promise.all(
      authorKeys.map((key) =>
        call<{ name?: string }>(`${key}.json`)
          .then((a) => a.name ?? '')
          .catch(() => ''),
      ),
    );

    const year = Number(work.first_publish_date?.match(/\d{4}/)?.[0]);

    return {
      id: `openlibrary-${externalId}`,
      source: 'openlibrary',
      externalId,
      category: 'book',
      title: work.title ?? 'Sem título',
      year: Number.isFinite(year) ? year : null,
      creator: authors.filter(Boolean).join(', '),
      artworkUrl: work.covers?.[0]
        ? proxiedArtwork(`${COVERS}/${work.covers[0]}-L.jpg`)
        : null,
      fetchedAt: new Date().toISOString(),
    };
  },
};
