'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import editorStyles from '@/components/editor.module.css';
import styles from './catalogo.module.css';
import { CatalogTile } from './CatalogTile';
import { CATEGORIES, CATEGORY_PLURAL } from '@/lib/categories';
import { formatScore } from '@/lib/scale';
import { useDevicePixelRatio } from '@/lib/client/display';
import {
  apagarAvaliacao,
  exportarHistorico,
  importarHistorico,
  limparHistorico,
  listarAvaliacoes,
  type SavedRating,
} from '@/lib/client/history';
import type { Category } from '@/lib/types';

type Ordem = 'recentes' | 'nota';

/**
 * O catálogo, como página própria — grade de cards, não uma lista de texto.
 *
 * Fica separada da tela de busca porque os dois modos de uso são diferentes:
 * busca é "eu sei o que quero avaliar agora"; catálogo é "deixa eu ver o que
 * já tenho". Misturar os dois na mesma tela empurrava o catálogo para depois
 * do exemplo, e crescia sem limite conforme a pessoa acumulava avaliações.
 */
export function CatalogoClient() {
  const [itens, setItens] = useState<SavedRating[] | null>(null);
  const [filtro, setFiltro] = useState<Category | 'todos'>('todos');
  const [ordem, setOrdem] = useState<Ordem>('recentes');
  const [toast, setToast] = useState<string | null>(null);
  const inputArquivo = useRef<HTMLInputElement>(null);
  const dpr = useDevicePixelRatio();

  const recarregar = () => void listarAvaliacoes().then(setItens);
  useEffect(recarregar, []);

  function notify(mensagem: string) {
    setToast(mensagem);
    setTimeout(() => setToast((atual) => (atual === mensagem ? null : atual)), 2600);
  }

  // Lista as 5 categorias sempre, mesmo com 0 itens — o filtro é uma escolha
  // estável do que o app cobre, não algo que aparece e some conforme os tipos
  // já avaliados mudam.
  const categorias = useMemo(() => {
    const contagem = new Map<Category, number>(CATEGORIES.map((c) => [c, 0]));
    for (const item of itens ?? []) {
      contagem.set(item.category, (contagem.get(item.category) ?? 0) + 1);
    }
    return CATEGORIES.map((c) => [c, contagem.get(c) ?? 0] as const);
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

  async function apagar(id: string) {
    await apagarAvaliacao(id);
    recarregar();
  }

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
      notify(`${n} ITEM${n === 1 ? '' : 'S'} IMPORTADO${n === 1 ? '' : 'S'}`);
    } catch {
      notify('ARQUIVO NÃO RECONHECIDO');
    }
  }

  // `null` = ainda lendo do IndexedDB. Não decide o estado vazio até saber.
  if (itens === null) {
    return (
      <main className={styles.page}>
        <header className={styles.top}>
          <a className={styles.wordmark} href="/">
            Eu avaliei!
          </a>
          <a className={styles.voltar} href="/">
            ← VOLTAR
          </a>
        </header>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <a className={styles.wordmark} href="/">
          Eu avaliei!
        </a>
        <a className={styles.voltar} href="/">
          ← VOLTAR
        </a>
      </header>

      {itens.length === 0 ? (
        <div className={styles.vazio}>
          <p className={styles.vazioTexto}>
            Seu catálogo está vazio. Avalie um filme, jogo, livro ou série — ao
            chegar no passo de compartilhamento, ele entra aqui sozinho.
          </p>
          <a className={styles.vazioCta} href="/">
            AVALIAR ALGO
          </a>
        </div>
      ) : (
        <>
          <div className={styles.resumo}>
            <span className={styles.total}>
              {itens.length} {itens.length === 1 ? 'ITEM' : 'ITENS'}
              {media !== null ? ` · MÉDIA ${formatScore(media)}` : ''}
            </span>
          </div>

          <div className={styles.controles}>
            <div className={styles.filtros} role="group" aria-label="Filtrar por tipo de mídia">
              <button
                type="button"
                aria-pressed={filtro === 'todos'}
                className={`${styles.chip} ${filtro === 'todos' ? styles.chipOn : ''}`}
                onClick={() => setFiltro('todos')}
              >
                TUDO {itens.length}
              </button>
              {categorias.map(([cat, n]) => (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={filtro === cat}
                  className={`${styles.chip} ${filtro === cat ? styles.chipOn : ''}`}
                  onClick={() => setFiltro(cat)}
                >
                  {CATEGORY_PLURAL[cat]} {n}
                </button>
              ))}
            </div>

            {visiveis.length > 1 ? (
              <div
                className={`${editorStyles.segmented} ${styles.ordenar}`}
                role="group"
                aria-label="Ordenar"
              >
                {(
                  [
                    ['recentes', 'RECENTES'],
                    ['nota', 'MELHOR NOTA'],
                  ] as [Ordem, string][]
                ).map(([id, rotulo]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={ordem === id}
                    className={`${editorStyles.segment} ${styles.ordenarBtn} ${
                      ordem === id ? editorStyles.segmentOn : ''
                    }`}
                    onClick={() => setOrdem(id)}
                  >
                    {rotulo}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {visiveis.length === 0 && filtro !== 'todos' ? (
            <p className={styles.vazioFiltro}>
              Nenhum item avaliado em {CATEGORY_PLURAL[filtro].toLowerCase()} ainda.
            </p>
          ) : null}

          <div className={styles.grid}>
            {visiveis.map((item) => (
              <CatalogTile key={item.id} rating={item} dpr={dpr} onApagar={apagar} />
            ))}
          </div>

          <div className={styles.acoes}>
            <button
              type="button"
              className={`${editorStyles.artButton} ${styles.acaoBtn}`}
              onClick={baixar}
            >
              EXPORTAR
            </button>
            <button
              type="button"
              className={`${editorStyles.artButton} ${styles.acaoBtn}`}
              onClick={() => inputArquivo.current?.click()}
            >
              IMPORTAR
            </button>
            <button
              type="button"
              className={`${editorStyles.artButton} ${styles.acaoBtn}`}
              onClick={async () => {
                await limparHistorico();
                recarregar();
                notify('CATÁLOGO APAGADO');
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

          <p className={styles.rodape}>
            O CATÁLOGO FICA NESTE APARELHO · TROCAR DE CELULAR OU LIMPAR O NAVEGADOR APAGA
          </p>
        </>
      )}

      {toast ? (
        <div className={editorStyles.toast} role="status">
          {toast}
        </div>
      ) : null}
    </main>
  );
}
