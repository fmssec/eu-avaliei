import type { Category } from './types';

/** Rótulo de cada categoria, em maiúsculas, como aparece em chip e no card. */
export const CATEGORY_LABEL: Record<Category, string> = {
  movie: 'FILME',
  series: 'SÉRIE',
  game: 'JOGO',
  book: 'LIVRO',
  album: 'ÁLBUM',
};

/** Plural, para contagens no catálogo. */
export const CATEGORY_PLURAL: Record<Category, string> = {
  movie: 'FILMES',
  series: 'SÉRIES',
  game: 'JOGOS',
  book: 'LIVROS',
  album: 'ÁLBUNS',
};

export const CATEGORIES: Category[] = ['movie', 'series', 'game', 'book', 'album'];
