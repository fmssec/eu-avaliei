import type { Media } from '../types';
import type { MediaProvider } from './provider';
import { mockProvider } from './mock';
import { tmdbProvider } from './tmdb';
import { openLibraryProvider } from './openlibrary';
import { igdbConfigured, igdbProvider } from './igdb';
import { DEMO_EXTERNAL_ID, DEMO_MEDIA } from './demo';
import { rankResults, type SearchHit } from './ranking';

export type { MediaProvider } from './provider';

/**
 * Provedores ativos, por categoria.
 *
 * A busca é federada e sem escolher categoria antes (spec §7): o campo é um
 * só, e o que aparece depende do que está configurado.
 *
 *   · filmes e séries — TMDB, precisa de TMDB_API_KEY
 *   · livros          — Open Library, não precisa de nada
 *   · jogos           — IGDB, precisa de TWITCH_CLIENT_ID e TWITCH_CLIENT_SECRET
 *
 * Sem nenhuma chave, sobra o mock, e o app continua funcionando de ponta a
 * ponta. Álbuns (MusicBrainz) são o próximo, e entram como mais um arquivo
 * neste diretório mais uma linha aqui.
 */
export function activeProviders(): MediaProvider[] {
  const providers: MediaProvider[] = [];

  if (process.env.MEDIA_PROVIDER === 'tmdb' && process.env.TMDB_API_KEY) {
    providers.push(tmdbProvider);
  }
  if (process.env.BOOKS_ENABLED !== 'false') {
    providers.push(openLibraryProvider);
  }
  if (igdbConfigured()) {
    providers.push(igdbProvider);
  }

  // Sem nenhuma fonte real configurada, o mock mantém o app navegável.
  return providers.length > 0 ? providers : [mockProvider];
}

/** Compatibilidade: o primeiro provider ativo. */
export function mediaProvider(): MediaProvider {
  return activeProviders()[0];
}

/**
 * Busca federada, ordenada por relevância entre as fontes.
 *
 * Um provider fora do ar não pode derrubar a busca inteira — quem falha some
 * do resultado, e os outros continuam. O ranqueamento vive em ./ranking.ts.
 */
export async function searchAll(query: string, signal?: AbortSignal): Promise<Media[]> {
  const providers = activeProviders();
  const results = await Promise.allSettled(providers.map((p) => p.search(query, signal)));

  const perSource: SearchHit[][] = [];
  for (const [index, result] of results.entries()) {
    if (result.status === 'fulfilled') {
      perSource.push(result.value);
    } else if (!(result.reason instanceof DOMException && result.reason.name === 'AbortError')) {
      console.error(`[search] ${providers[index]?.name} falhou:`, result.reason);
    }
  }

  return rankResults(query, perSource, 10);
}

/**
 * Resolve um externalId para mídia, tentando cada provider ativo.
 *
 * O exemplo da home vem antes de tudo: ele não pertence a nenhuma API, e a
 * demonstração precisa poder ser salva e compartilhada de verdade.
 */
export async function resolveMedia(externalId: string): Promise<Media | null> {
  if (externalId === DEMO_EXTERNAL_ID) {
    return { ...DEMO_MEDIA, fetchedAt: new Date().toISOString() };
  }

  for (const provider of activeProviders()) {
    try {
      const media = await provider.byExternalId(externalId);
      if (media) return media;
    } catch (error) {
      console.error(`[resolveMedia] ${provider.name} falhou:`, error);
    }
  }
  return null;
}

/**
 * Teto de cache dos metadados de terceiros.
 *
 * Os termos de uso do TMDB proíbem guardar qualquer informação obtida da API
 * por mais de 6 meses. A especificação pedia "buscada uma vez e nunca mais",
 * o que violaria isso — 150 dias deixa margem para o refresh acontecer antes
 * do prazo. Não é otimização: é condição da licença.
 */
export const MEDIA_CACHE_MAX_AGE_DAYS = 150;

export function isMediaStale(media: Media): boolean {
  // O mock e o exemplo não vêm de API de terceiro: não expiram.
  if (media.source === 'mock') return false;
  const age = Date.now() - new Date(media.fetchedAt).getTime();
  return age > MEDIA_CACHE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Devolve a mídia revalidada quando o cache passou do teto da licença.
 * Se a origem estiver fora do ar, mantém o que temos: um card antigo continua
 * renderizando, e a tentativa se repete no próximo acesso.
 */
export async function refreshIfStale(media: Media): Promise<Media> {
  if (!isMediaStale(media)) return media;
  try {
    const fresh = await resolveMedia(media.externalId);
    return fresh ?? media;
  } catch {
    return media;
  }
}

/**
 * Atribuição exigida pela fonte dos dados.
 *
 * O texto do TMDB não é livre: os termos de uso especificam a frase, e ela
 * precisa aparecer de forma destacada na aplicação, junto do logo deles.
 */
export function attributionFor(source: string): string | null {
  switch (source) {
    case 'tmdb':
      return 'Este site usa o TMDB e as APIs do TMDB, mas não é endossado, certificado ou aprovado pelo TMDB.';
    case 'openlibrary':
      return 'Dados de livros por Open Library.';
    case 'igdb':
      return 'Dados de jogos por IGDB.';
    default:
      return null;
  }
}
