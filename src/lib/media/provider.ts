import type { Media } from '../types';
import type { SearchHit } from './ranking';

/**
 * Interface única sobre as APIs de metadados (spec §5). Trocar de fonte, ou
 * somar categorias, é implementar isto — nada acima desta camada conhece
 * TMDB, IGDB, Open Library ou MusicBrainz.
 *
 * `search` devolve `SearchHit`, e não `Media`, porque o ranqueamento federado
 * precisa de um sinal de popularidade — e cada API publica esse número numa
 * escala própria. Normalizar é responsabilidade de quem conhece a escala, ou
 * seja, do provider.
 */
export interface MediaProvider {
  readonly name: string;
  search(query: string, signal?: AbortSignal): Promise<SearchHit[]>;
  byExternalId(externalId: string): Promise<Media | null>;
}
