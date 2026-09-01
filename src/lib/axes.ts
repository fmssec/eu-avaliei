import type { Category } from './types';
import { slugify } from './slugify';

/**
 * Eixos padrão por categoria (spec §2.2). São ponto de partida editável, não
 * regra: o usuário renomeia, remove e adiciona até o limite de 6.
 */
export const MAX_STATS = 6;

export const DEFAULT_AXES: Record<Category, readonly string[]> = {
  movie: ['Roteiro', 'Atuação', 'Direção', 'Trilha', 'Visual', 'Ritmo'],
  series: ['Roteiro', 'Atuação', 'Direção', 'Trilha', 'Visual', 'Ritmo'],
  game: ['Gameplay', 'História', 'Arte', 'Trilha', 'Rejogabilidade', 'Performance'],
  book: ['Escrita', 'Personagens', 'Enredo', 'Ritmo', 'Impacto', 'Ambientação'],
  album: ['Produção', 'Letra', 'Coesão', 'Vocais', 'Instrumental', 'Repetibilidade'],
};

/** Abreviações de 3 letras usadas nas variantes estreitas (wide e poster). */
const ABBR: Record<string, string> = {
  Roteiro: 'ROT',
  Atuação: 'ATU',
  Direção: 'DIR',
  Trilha: 'TRI',
  Visual: 'VIS',
  Ritmo: 'RIT',
  Gameplay: 'GMP',
  História: 'HIS',
  Arte: 'ART',
  Rejogabilidade: 'REJ',
  Performance: 'PER',
  Escrita: 'ESC',
  Personagens: 'PSG',
  Enredo: 'ENR',
  Impacto: 'IMP',
  Ambientação: 'AMB',
  Produção: 'PRD',
  Letra: 'LET',
  Coesão: 'COE',
  Vocais: 'VOC',
  Instrumental: 'INS',
  Repetibilidade: 'REP',
};

export function abbreviate(label: string): string {
  return ABBR[label] ?? label.slice(0, 3).toUpperCase();
}

/** Chave est\u00e1vel do eixo, usada em `stats[].key`. */
export function slugifyAxis(label: string): string {
  return slugify(label, 24);
}
