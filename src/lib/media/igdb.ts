import type { Media } from '../types';
import type { MediaProvider } from './provider';
import { proxiedArtwork } from './artwork';
import { normalizePopularity } from './ranking';

/**
 * Jogos, via IGDB (spec §5).
 *
 * Diferente do TMDB e da Open Library, a IGDB exige um app registrado na
 * Twitch: TWITCH_CLIENT_ID e TWITCH_CLIENT_SECRET. Sem os dois, este provider
 * fica inerte e a busca simplesmente não devolve jogos — nada quebra.
 *
 * Vale notar para o roadmap: ao contrário do TMDB, a IGDB permite uso
 * comercial mediante parceria, o que a torna o caminho menos travado se o
 * produto for monetizado (ver docs/APIS-E-LICENCIAMENTO.md).
 */

const AUTH = 'https://id.twitch.tv/oauth2/token';
const API = 'https://api.igdb.com/v4';
// t_1080p (810×1080). O t_cover_big padrão tem 264×352 — esticado para o card
// de 1080 de largura vira ampliação de 4×, e o resultado é visivelmente mole.
const IMAGES = 'https://images.igdb.com/igdb/image/upload/t_1080p';

export function igdbConfigured(): boolean {
  return Boolean(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET);
}

/** Token de app da Twitch, guardado até perto de expirar. */
let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value;

  const params = new URLSearchParams({
    client_id: process.env.TWITCH_CLIENT_ID ?? '',
    client_secret: process.env.TWITCH_CLIENT_SECRET ?? '',
    grant_type: 'client_credentials',
  });

  const res = await fetch(`${AUTH}?${params}`, { method: 'POST' });
  if (!res.ok) throw new Error(`Twitch OAuth: HTTP ${res.status}`);

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: data.access_token,
    // Um minuto de folga para não usar um token que expira no meio do request.
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedToken.value;
}

interface IgdbGame {
  id: number;
  name?: string;
  first_release_date?: number;
  cover?: { image_id?: string };
  involved_companies?: { developer?: boolean; company?: { name?: string } }[];
  total_rating_count?: number;
  follows?: number;
}

/** A IGDB fala APICalypse, não JSON: o corpo do POST é a própria query. */
async function query(body: string, signal?: AbortSignal): Promise<IgdbGame[]> {
  const res = await fetch(`${API}/games`, {
    method: 'POST',
    headers: {
      'Client-ID': process.env.TWITCH_CLIENT_ID ?? '',
      Authorization: `Bearer ${await accessToken()}`,
      Accept: 'application/json',
    },
    body,
    signal,
  });
  if (!res.ok) throw new Error(`IGDB: HTTP ${res.status}`);
  return res.json() as Promise<IgdbGame[]>;
}

function toMedia(game: IgdbGame): Media {
  const developer =
    game.involved_companies?.find((c) => c.developer)?.company?.name ??
    game.involved_companies?.[0]?.company?.name ??
    '';

  return {
    id: `igdb-${game.id}`,
    source: 'igdb',
    externalId: String(game.id),
    category: 'game',
    title: game.name ?? 'Sem título',
    year: game.first_release_date
      ? new Date(game.first_release_date * 1000).getUTCFullYear()
      : null,
    creator: developer,
    artworkUrl: game.cover?.image_id
      ? proxiedArtwork(`${IMAGES}/${game.cover.image_id}.jpg`)
      : null,
    fetchedAt: new Date().toISOString(),
  };
}

const FIELDS =
  'fields name,first_release_date,cover.image_id,involved_companies.developer,involved_companies.company.name,total_rating_count,follows;';

export const igdbProvider: MediaProvider = {
  name: 'igdb',

  async search(term, signal) {
    const q = term.trim().replace(/"/g, '');
    if (!q || !igdbConfigured()) return [];
    // O limite de 4 req/s da IGDB é folgado para busca com debounce, e o cache
    // em base própria evita repetir a mesma consulta.
    const games = await query(`search "${q}"; ${FIELDS} limit 6;`, signal);
    return games.map((game) => ({
      media: toMedia(game),
      // `total_rating_count` é quantas avaliações o jogo tem; `follows`,
      // quantas pessoas o acompanham. Um indie conhecido passa de 500.
      popularity: Math.max(
        normalizePopularity(game.total_rating_count, 800),
        normalizePopularity(game.follows, 500),
      ),
    }));
  },

  async byExternalId(externalId) {
    const id = Number(externalId);
    if (!Number.isInteger(id) || !igdbConfigured()) return null;
    const [game] = await query(`where id = ${id}; ${FIELDS} limit 1;`);
    return game ? toMedia(game) : null;
  },
};
