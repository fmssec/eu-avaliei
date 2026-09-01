import type { Media } from '../types';

/**
 * Ranqueamento de busca federada.
 *
 * Intercalar por fonte era simples e errado: buscar "hollow knight" trazia seis
 * livros — partituras, artbooks, guias — misturados com o jogo, porque cada
 * fonte contribuía a mesma quantidade independentemente de acertar a intenção.
 *
 * Quatro sinais, nesta ordem de peso:
 *
 *   1. **Semelhança do título** — o mais forte. "Hollow Knight" exato vence
 *      "Hollow Knight Piano Music" sem precisar de mais nada.
 *   2. **Popularidade** — desempata o que a semelhança não resolve: o jogo e o
 *      artbook têm o mesmo título. Cada fonte publica isso numa escala
 *      diferente (TMDB em centenas, IGDB em contagem de avaliações, Open
 *      Library em edições), então o provider normaliza para 0–1 antes de
 *      chegar aqui — comparar os números crus não significaria nada.
 *   3. **Posição na fonte** — cada API já ordena por relevância própria, e
 *      essa ordem carrega informação que não temos como recalcular.
 *   4. **Completude** — ter capa, ano e autor indica o registro canônico, e
 *      não uma edição perdida. Também rende um card melhor.
 */

export interface SearchHit {
  media: Media;
  /** Popularidade já normalizada em 0–1 pelo provider que a produziu. */
  popularity?: number;
}

const WEIGHTS = {
  title: 0.55,
  popularity: 0.24,
  sourceRank: 0.13,
  completeness: 0.08,
};

/**
 * Penalidade por resultado já escolhido da mesma fonte.
 *
 * Sem ela, uma consulta que casa bem com uma fonte só ocuparia todas as vagas
 * e as outras categorias sumiriam — que é a falha oposta à do intercalado. É
 * leve de propósito: empurra a variedade sem deixar um resultado ruim subir na
 * frente de um bom.
 */
const SAME_SOURCE_PENALTY = 0.07;

/**
 * Piso de relevância: abaixo disto o resultado não é sobre o que foi buscado.
 *
 * Sem ele, uma consulta com poucos acertos era completada com o que a fonte
 * devolveu por desencargo — buscar "bacurau" trazia "Os Sete Pilares de Uma
 * Pregação Impactante" na quinta posição. Melhor devolver três resultados bons
 * do que dez com sete inúteis.
 */
const MIN_RELEVANCE = 0.3;

export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Bigramas da string, para o coeficiente de Dice. */
function bigrams(text: string): Map<string, number> {
  const out = new Map<string, number>();
  for (let i = 0; i < text.length - 1; i++) {
    const pair = text.slice(i, i + 2);
    out.set(pair, (out.get(pair) ?? 0) + 1);
  }
  return out;
}

/**
 * Similaridade 0–1 entre a consulta e o título.
 *
 * Dice sobre bigramas tolera erro de digitação e ordem de palavras, mas sozinho
 * ele pune título longo que começa igual — "Hollow Knight Piano Music" tiraria
 * nota parecida com "Hollow Knight". Por isso os casos exato e prefixo são
 * tratados antes, com desconto proporcional ao excesso de texto.
 */
export function titleSimilarity(query: string, title: string): number {
  const q = normalizeForMatch(query);
  const t = normalizeForMatch(title);
  if (!q || !t) return 0;
  if (q === t) return 1;

  if (t.startsWith(q)) {
    // Quanto mais sobra depois do trecho buscado, menor a chance de ser o que
    // a pessoa quis: "hollow knight" vs "hollow knight piano music".
    return 0.72 + 0.23 * (q.length / t.length);
  }
  if (t.includes(q)) {
    return 0.58 + 0.2 * (q.length / t.length);
  }

  const a = bigrams(q);
  const b = bigrams(t);
  let shared = 0;
  for (const [pair, count] of a) {
    const other = b.get(pair);
    if (other) shared += Math.min(count, other);
  }
  const total = [...a.values()].reduce((s, n) => s + n, 0) +
    [...b.values()].reduce((s, n) => s + n, 0);
  return total === 0 ? 0 : (2 * shared) / total;
}

/**
 * Comprime uma contagem crua em 0–1.
 *
 * Escala logarítmica porque a diferença entre 10 e 100 avaliações importa muito
 * mais que entre 10.000 e 100.000. `saturation` é a contagem a partir da qual
 * a fonte considera algo "muito popular".
 */
export function normalizePopularity(count: number | undefined, saturation: number): number {
  if (!count || count <= 0) return 0;
  return Math.min(1, Math.log10(1 + count) / Math.log10(1 + saturation));
}

/**
 * Quão bem o resultado responde à consulta, por título ou por autor.
 *
 * O autor entra porque buscar "tarantino" ou "machado de assis" é um caso real,
 * e nele a semelhança de título é zero — sem esta linha o piso de relevância
 * descartaria justamente os acertos. Vale um pouco menos que o título, porque
 * quem digita o nome da obra é mais específico do que quem digita o autor.
 */
export function relevanceOf(query: string, media: Media): number {
  const byTitle = titleSimilarity(query, media.title);
  const byCreator = media.creator ? 0.85 * titleSimilarity(query, media.creator) : 0;
  return Math.max(byTitle, byCreator);
}

function completeness(media: Media): number {
  let score = 0;
  if (media.artworkUrl) score += 0.5;
  if (media.year) score += 0.3;
  if (media.creator) score += 0.2;
  return score;
}

export interface ScoredHit extends SearchHit {
  score: number;
}

/** Pontua sem aplicar diversidade — a penalidade por fonte vem na seleção. */
export function scoreHits(query: string, hits: SearchHit[][]): ScoredHit[] {
  const scored: ScoredHit[] = [];

  for (const fromOneSource of hits) {
    const size = fromOneSource.length;
    fromOneSource.forEach((hit, index) => {
      const relevance = relevanceOf(query, hit.media);
      if (relevance < MIN_RELEVANCE) return;

      // Decai com a posição, sem zerar: o último resultado de uma fonte ainda
      // pode vencer o primeiro de outra se o título casar muito melhor.
      const sourceRank = size <= 1 ? 1 : 1 - index / size;

      scored.push({
        ...hit,
        score:
          WEIGHTS.title * relevance +
          WEIGHTS.popularity * (hit.popularity ?? 0) +
          WEIGHTS.sourceRank * sourceRank +
          WEIGHTS.completeness * completeness(hit.media),
      });
    });
  }

  return scored;
}

/**
 * Ordena e seleciona, penalizando repetição de fonte a cada escolha.
 *
 * Seleção gulosa em vez de um sort simples: a penalidade depende do que já foi
 * escolhido, então a ordem precisa ser decidida um item por vez.
 */
export function rankResults(query: string, hits: SearchHit[][], limit: number): Media[] {
  const pool = scoreHits(query, hits);
  const taken = new Map<string, number>();
  const out: Media[] = [];
  const used = new Set<ScoredHit>();
  const seenTitles = new Set<string>();

  while (out.length < limit) {
    let best: ScoredHit | null = null;
    let bestScore = -Infinity;

    for (const hit of pool) {
      if (used.has(hit)) continue;
      const already = taken.get(hit.media.source) ?? 0;
      const adjusted = hit.score * (1 - SAME_SOURCE_PENALTY * already);
      if (adjusted > bestScore) {
        bestScore = adjusted;
        best = hit;
      }
    }

    if (!best) break;
    used.add(best);

    // Duplicata dentro da mesma fonte (reedições de livro, por exemplo) só
    // ocupa vaga. Entre fontes diferentes o mesmo título é legítimo: o filme e
    // o livro de "Dom Casmurro" são coisas distintas.
    const key = `${best.media.source}:${normalizeForMatch(best.media.title)}`;
    if (seenTitles.has(key)) continue;
    seenTitles.add(key);

    taken.set(best.media.source, (taken.get(best.media.source) ?? 0) + 1);
    out.push(best.media);
  }

  return out;
}
