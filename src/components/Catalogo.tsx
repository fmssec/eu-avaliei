'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatScore } from '@/lib/scale';
import { levelFor } from '@/lib/design';
import { CATEGORY_LABEL, CATEGORY_PLURAL } from '@/lib/categories';
import type { Category } from '@/lib/types';
import {
  apagarAvaliacao,
  exportarHistorico,
  importarHistorico,
  limparHistorico,
  listarAvaliacoes,
  type SavedRating,
} from '@/lib/client/history';
import styles from './editor.module.css';

/**
 * O catálogo do que a pessoa já consumiu e avaliou, neste aparelho.
 *
 * Começou como lista simples de "últimas avaliações". Virou catálogo porque o
 * uso é outro: com dezenas de itens, o que se quer não é ver os últimos, é
 * encontrar um — daí filtro por categoria e ordenação por nota.
 *
 * Continua sendo um catálogo **pessoal**: não há perfil público, nem feed, nem
 * seguidores. Isso não é limitação técnica, é escopo.
 */

type Ordem = 'recentes' | 'nota';

export function Catalogo({
  onAbrir,
  onNotify,
}: {
  onAbrir: (rating: SavedRating) => void;
  onNotify: (message: string) => void;
}) {
  const [itens, setItens] = useState<SavedRating[] | null>(null);
  const [filtro, setFiltro] = useState<Category | 'todos'>('todos');
  const [ordem, setOrdem] = useState<Ordem>('recentes');
  const inputArquivo = useRef<HTMLInputElement>(null);

  const recarregar = () => void listarAvaliacoes().then(setItens);
  useEffect(recarregar, []);

  /** Só as categorias que a pessoa realmente tem viram filtro. */
  const categorias = useMemo(() => {
    const contagem = new Map<Category, number>();
    for (const i of itens ?? []) contagem.set(i.category, (contagem.get(i.category) ?? 0) + 1);
    return [...contagem.entries()].sort((a, b) => b[1] - a[1]);
  }, [itens]);

  const visiveis = useMemo(() => {
    const base = (itens ?? []).filter((i) => filtro === 'todos' || i.category === filtro);
    return ordem === 'nota'
      ? [...base].sort((a, b) => b.overall - a.overall)
      : [...base].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [itens, filtro, ordem]);

  const media = useMemo(() => {
    if (!visiveis.length) return null;
    return visiveis.reduce((soma, i) => soma + i.overall, 0) / visiveis.length;
  }, [visiveis]);

  // `null` = ainda lendo do IndexedDB. Não renderiza nada até saber, para não
  // piscar um estado vazio em quem já tem catálogo.
  if (itens === null || itens.length === 0) return null;

  async function baixar() {
    const blob = await exportarHistorico();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eu-avaliei-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function importar(arquivo: File | undefined) {
    if (!arquivo) return;
    try {
      const n = await importarHistorico(arquivo);
      recarregar();
      onNotify(`${n} ITEM${n === 1 ? '' : 'S'} IMPORTADO${n === 1 ? '' : 'S'}`);
    } catch {
      onNotify('ARQUIVO NÃO RECONHECIDO');
    }
  }

  return (
    <section className={styles.catalogo}>
      <div className={styles.demoHead}>
        <span className={styles.fieldLabel}>MEU CATÁLOGO</span>
        <span className={styles.demoTag}>
          {itens.length} {itens.length === 1 ? 'ITEM' : 'ITENS'}
          {media !== null ? ` · MÉDIA ${formatScore(media)}` : ''}
        </span>
      </div>

      {categorias.length > 1 ? (
        <div className={styles.catalogoFiltros} role="group" aria-label="Filtrar por categoria">
          <button
            type="button"
            aria-pressed={filtro === 'todos'}
            className={`${styles.catalogoChip} ${filtro === 'todos' ? styles.catalogoChipOn : ''}`}
            onClick={() => setFiltro('todos')}
          >
            TUDO {itens.length}
          </button>
          {categorias.map(([cat, n]) => (
            <button
              key={cat}
              type="button"
              aria-pressed={filtro === cat}
              className={`${styles.catalogoChip} ${filtro === cat ? styles.catalogoChipOn : ''}`}
              onClick={() => setFiltro(cat)}
            >
              {CATEGORY_PLURAL[cat]} {n}
            </button>
          ))}
        </div>
      ) : null}

      {visiveis.length > 1 ? (
        <div className={styles.segmented} role="group" aria-label="Ordenar">
          {(
            [
              ['recentes', 'MAIS RECENTES'],
              ['nota', 'MELHOR NOTA'],
            ] as [Ordem, string][]
          ).map(([id, rotulo]) => (
            <button
              key={id}
              type="button"
              aria-pressed={ordem === id}
              className={`${styles.segment} ${ordem === id ? styles.segmentOn : ''}`}
              onClick={() => setOrdem(id)}
            >
              {rotulo}
            </button>
          ))}
        </div>
      ) : null}

      <div className={styles.catalogoLista}>
        {visiveis.map((r) => {
          const nivel = levelFor(r.overall);
          return (
            <div key={r.id} className={styles.catalogoItem}>
              <button type="button" className={styles.catalogoAbrir} onClick={() => onAbrir(r)}>
                <span className={styles.catalogoNota} style={{ color: nivel.edge }}>
                  {formatScore(r.overall, r.scaleMax)}
                </span>
                <span className={styles.resultBody}>
                  <span className={styles.catalogoTitulo}>{r.title}</span>
                  <span className={styles.resultMeta}>
                    {[r.creator, r.year].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className={styles.chip}>{CATEGORY_LABEL[r.category]}</span>
              </button>
              <button
                type="button"
                className={styles.catalogoApagar}
                aria-label={`Remover ${r.title} do catálogo`}
                onClick={async () => {
                  await apagarAvaliacao(r.id);
                  recarregar();
                }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      <div className={styles.catalogoAcoes}>
        <button type="button" className={styles.artButton} onClick={baixar}>
          EXPORTAR
        </button>
        <button
          type="button"
          className={styles.artButton}
          onClick={() => inputArquivo.current?.click()}
        >
          IMPORTAR
        </button>
        <button
          type="button"
          className={styles.artButton}
          onClick={async () => {
            await limparHistorico();
            recarregar();
            onNotify('CATÁLOGO APAGADO');
          }}
        >
          APAGAR TUDO
        </button>
      </div>

      <input
        ref={inputArquivo}
        type="file"
        accept="application/json"
        hidden
        onChange={(e) => {
          void importar(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      <div className={styles.hint}>
        O CATÁLOGO FICA NESTE APARELHO · TROCAR DE CELULAR OU LIMPAR O NAVEGADOR APAGA
      </div>
    </section>
  );
}
