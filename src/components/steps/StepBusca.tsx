'use client';

import { useEffect, useMemo, useState } from 'react';
import { useDebounced } from '@/lib/client/useCardBlob';
import { displayWidthFor, useDevicePixelRatio } from '@/lib/client/display';
import { buildPreviewQuery } from '@/lib/params';
import {
  DEMO_AUTHOR,
  DEMO_CAPTION,
  DEMO_MEDIA,
  DEMO_OVERALL,
  DEMO_STATS,
} from '@/lib/media/demo';
import type { Media } from '@/lib/types';
import { CATEGORY_LABEL } from '@/lib/categories';
import { contarAvaliacoes } from '@/lib/client/history';
import styles from '../editor.module.css';

/** O que cada passo faz, em uma linha. Explica o produto sem exigir leitura. */
const COMO_FUNCIONA = [
  ['1 BUSCA', 'acha o título'],
  ['2 NOTA', 'nota geral + 6 eixos'],
  ['3 ESTILO', 'a moldura vem da nota'],
  ['4 ENVIAR', 'imagem pronta pra postar'],
];

/**
 * Passo 1 — campo único, sem escolher categoria antes (spec §7). A busca é
 * federada e os resultados vêm misturados: pedir o tipo primeiro seria uma
 * tela a mais contra o alvo de 30 segundos.
 *
 * Com o campo vazio, a tela mostra um card de exemplo em vez de espaço morto.
 * Ele é renderizado pelo renderizador de verdade, com os mesmos parâmetros de
 * um card real — então nunca fica desatualizado em relação ao produto, e a
 * pergunta "o que esse site faz?" se responde sem precisar buscar nada.
 *
 * O catálogo mora numa página própria (`/catalogo`): aqui só um link, e só
 * quando existe pelo menos um item — sem isso seria um link morto para quem
 * está usando o site pela primeira vez.
 */
export function StepBusca({
  onPick,
  onDemo,
}: {
  onPick: (media: Media) => void;
  onDemo: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Media[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [totalCatalogo, setTotalCatalogo] = useState(0);
  const settled = useDebounced(query.trim(), 300);
  const dpr = useDevicePixelRatio();

  useEffect(() => {
    void contarAvaliacoes().then(setTotalCatalogo);
  }, []);

  const demoQuery = useMemo(
    () =>
      buildPreviewQuery({
        format: 'story',
        frame: 'ficha',
        overall: DEMO_OVERALL,
        scaleMax: 10,
        title: DEMO_MEDIA.title,
        creator: DEMO_MEDIA.creator,
        year: DEMO_MEDIA.year,
        category: DEMO_MEDIA.category,
        caption: DEMO_CAPTION,
        author: DEMO_AUTHOR,
        stats: DEMO_STATS,
        artworkUrl: DEMO_MEDIA.artworkUrl,
        // Aparece a 158 CSS px; a densidade da tela decide quantos pixels reais.
        displayWidth: displayWidthFor(158, dpr, 'story'),
      }),
    [dpr],
  );

  useEffect(() => {
    if (settled.length < 2) {
      setResults([]);
      setState('idle');
      return;
    }

    const controller = new AbortController();
    setState('loading');

    fetch(`/api/search?q=${encodeURIComponent(settled)}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<{ results: Media[] }>;
      })
      .then((data) => {
        setResults(data.results);
        setState('idle');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setResults([]);
        setState('error');
      });

    return () => controller.abort();
  }, [settled]);

  const searching = query.trim().length > 0;

  return (
    <section className={styles.step}>
      <div className={styles.stepHead}>
        <span className={styles.stepLabel}>1 · BUSCA</span>
        {totalCatalogo > 0 ? (
          <a className={styles.catalogoLink} href="/catalogo">
            MEU CATÁLOGO · {totalCatalogo}
          </a>
        ) : null}
      </div>

      <div className={styles.field}>
        <input
          className={styles.searchInput}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="filme, série, jogo, livro, álbum"
          autoComplete="off"
          aria-label="Buscar mídia"
        />
      </div>

      {searching ? (
        <div className={styles.results}>
          {results.map((media) => (
            <button
              key={media.id}
              type="button"
              className={styles.result}
              onClick={() => onPick(media)}
            >
              {media.artworkUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className={styles.thumb} src={media.artworkUrl} alt="" loading="lazy" />
              ) : (
                <span className={styles.thumb} aria-hidden />
              )}
              <span className={styles.resultBody}>
                <span className={styles.resultTitle}>{media.title}</span>
                <span className={styles.resultMeta}>
                  {[media.creator, media.year].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className={styles.chip}>{CATEGORY_LABEL[media.category]}</span>
            </button>
          ))}

          {state === 'loading' && results.length === 0 ? (
            <div className={styles.empty}>BUSCANDO…</div>
          ) : null}
          {state === 'error' ? <div className={styles.empty}>BUSCA INDISPONÍVEL</div> : null}
          {state === 'idle' && settled.length >= 2 && results.length === 0 ? (
            <div className={styles.empty}>NADA ENCONTRADO</div>
          ) : null}
        </div>
      ) : (
        <div className={styles.demo}>
          <div className={styles.demoHead}>
            <span className={styles.fieldLabel}>EXEMPLO</span>
            <span className={styles.demoTag}>{DEMO_MEDIA.title.toUpperCase()}</span>
          </div>

          <div className={styles.demoBody}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className={styles.demoCard}
              src={`/api/preview?${demoQuery}`}
              width={1080}
              height={1920}
              alt={`Exemplo de card: ${DEMO_MEDIA.title}`}
            />

            <ol className={styles.demoSteps}>
              {COMO_FUNCIONA.map(([step, what]) => (
                <li key={step} className={styles.demoStep}>
                  <span className={styles.demoStepName}>{step}</span>
                  <span className={styles.demoStepWhat}>{what}</span>
                </li>
              ))}
            </ol>
          </div>

          <button type="button" className={styles.primary} onClick={onDemo}>
            MEXER NESTE EXEMPLO
          </button>
          <div className={styles.footNote}>OU BUSQUE UM TÍTULO ACIMA</div>
        </div>
      )}
    </section>
  );
}
