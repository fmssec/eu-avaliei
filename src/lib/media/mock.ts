import type { Media } from '../types';
import type { MediaProvider } from './provider';

/**
 * Provider de desenvolvimento. Os títulos são os do arquivo de design, para
 * que o app rode de ponta a ponta sem chave de API.
 */
const CATALOG: Omit<Media, 'fetchedAt'>[] = [
  {
    id: 'mock-1',
    source: 'mock',
    externalId: '1',
    category: 'movie',
    title: 'Ainda Estou Aqui',
    year: 2024,
    creator: 'Walter Salles',
    artworkUrl: null,
  },
  {
    id: 'mock-2',
    source: 'mock',
    externalId: '2',
    category: 'movie',
    title: 'Bacurau',
    year: 2019,
    creator: 'Kleber Mendonça Filho',
    artworkUrl: null,
  },
  {
    id: 'mock-3',
    source: 'mock',
    externalId: '3',
    category: 'movie',
    title: 'Cidade de Deus',
    year: 2002,
    creator: 'Fernando Meirelles',
    artworkUrl: null,
  },
  {
    id: 'mock-4',
    source: 'mock',
    externalId: '4',
    category: 'series',
    title: 'Cangaço Novo',
    year: 2023,
    creator: 'Eduardo Nunes',
    artworkUrl: null,
  },
  {
    id: 'mock-5',
    source: 'mock',
    externalId: '5',
    category: 'movie',
    title: 'O Som ao Redor',
    year: 2012,
    creator: 'Kleber Mendonça Filho',
    artworkUrl: null,
  },
  {
    id: 'mock-6',
    source: 'mock',
    externalId: '6',
    category: 'series',
    title: 'Senna',
    year: 2024,
    creator: 'Vicente Amorim',
    artworkUrl: null,
  },
];

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function stamp(m: Omit<Media, 'fetchedAt'>): Media {
  return { ...m, fetchedAt: new Date().toISOString() };
}

export const mockProvider: MediaProvider = {
  name: 'mock',

  async search(query) {
    const q = normalize(query.trim());
    if (!q) return [];
    return CATALOG.filter(
      (m) => normalize(m.title).includes(q) || normalize(m.creator).includes(q),
    ).map((m) => ({ media: stamp(m) }));
  },

  async byExternalId(externalId) {
    const found = CATALOG.find((m) => m.externalId === externalId);
    return found ? stamp(found) : null;
  },
};
