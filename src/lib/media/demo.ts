import type { Media } from '../types';
import { proxiedArtwork } from './artwork';

/**
 * O exemplo da tela inicial.
 *
 * Existe para responder em três segundos a pergunta "o que esse site faz?",
 * sem exigir que a pessoa busque nada primeiro. O card do exemplo é renderizado
 * pelo renderizador de verdade, não é uma imagem estática — então ele nunca
 * fica desatualizado em relação ao produto.
 *
 * O `externalId` resolve em qualquer provider (ver `resolveMedia`), para que
 * o exemplo continue funcionando de ponta a ponta mesmo com as fontes reais
 * ligadas — e continue funcionando sem nenhuma chave configurada.
 */

export const DEMO_EXTERNAL_ID = 'demo:1';

/**
 * A capa vem da CDN do IGDB pelo nosso proxy, e não de um arquivo no
 * repositório: arte de terceiro versionada junto do código é exatamente o
 * risco descrito em docs/APIS-E-LICENCIAMENTO.md. Aqui ela é buscada e
 * cacheada como a de qualquer outro card.
 */
const DEMO_ARTWORK = proxiedArtwork(
  'https://images.igdb.com/igdb/image/upload/t_cover_big/co1r7f.jpg',
);

export const DEMO_MEDIA: Media = {
  id: 'demo-1',
  source: 'igdb',
  externalId: DEMO_EXTERNAL_ID,
  category: 'game',
  title: 'The Last of Us',
  year: 2013,
  creator: 'Naughty Dog',
  artworkUrl: DEMO_ARTWORK,
  fetchedAt: new Date(0).toISOString(),
};

/** Eixos de jogo (spec §2.2), já que o exemplo é um jogo. */
export const DEMO_STATS = [
  { label: 'Gameplay', value: 8.8 },
  { label: 'História', value: 9.8 },
  { label: 'Arte', value: 9.2 },
  { label: 'Trilha', value: 9.5 },
  { label: 'Rejogabilidade', value: 7.4 },
  { label: 'Performance', value: 8.1 },
];

export const DEMO_OVERALL = 8.8;
export const DEMO_CAPTION = 'joguei em 2013 e ainda penso na última hora';
export const DEMO_AUTHOR = '';

/** Fonte de preview do exemplo, para o editor e a tela inicial usarem a mesma. */
export const DEMO_PREVIEW_SOURCE = {
  frame: 'ficha' as const,
  overall: DEMO_OVERALL,
  scaleMax: 10 as const,
  title: DEMO_MEDIA.title,
  creator: DEMO_MEDIA.creator,
  year: DEMO_MEDIA.year,
  category: DEMO_MEDIA.category,
  caption: DEMO_CAPTION,
  author: DEMO_AUTHOR,
  stats: DEMO_STATS,
  artworkUrl: DEMO_MEDIA.artworkUrl,
};
