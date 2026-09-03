'use client';

import { useMemo } from 'react';
import { buildPreviewQuery } from '@/lib/params';
import { displayWidthFor } from '@/lib/client/display';
import { useResolvedArtwork } from '@/lib/client/useResolvedArtwork';
import type { SavedRating } from '@/lib/client/history';
import styles from './catalogo.module.css';

const TILE_CSS_WIDTH = 200;

/**
 * Um item do catálogo, como card de verdade — não uma linha de texto.
 *
 * A imagem vem do mesmo /api/preview que gera o arquivo compartilhado: o
 * título, a nota e os eixos já estão desenhados nela, então a grade não
 * precisa de legenda por baixo para ser lida.
 *
 * Itens com arte própria mostram um esqueleto até a arte ser reenviada ao
 * servidor (ver useResolvedArtwork) — sem isso, o primeiro render aconteceria
 * sem a foto, porque o servidor não enxerga o Blob que ela é aqui no aparelho.
 *
 * Sem `loading="lazy"` de propósito: dentro de um tile dimensionado por
 * `aspect-ratio` numa grade, o cálculo de proximidade da viewport do
 * navegador às vezes nunca decide que a imagem está perto o bastante para
 * carregar — o `<img>` fica parado para sempre com `complete: false`, sem
 * erro nenhum. Confirmado trocando para eager no mesmo elemento: carrega na
 * hora. Um catálogo pessoal não tem centenas de itens para justificar o
 * risco de tiles que nunca aparecem.
 */
export function CatalogTile({
  rating,
  dpr,
  onApagar,
}: {
  rating: SavedRating;
  dpr: number;
  onApagar: (id: string) => void;
}) {
  const artworkUrl = useResolvedArtwork(rating);
  const aindaResolvendoArte = Boolean(rating.artworkBlob) && artworkUrl === null;

  const query = useMemo(
    () =>
      buildPreviewQuery({
        format: 'story',
        frame: rating.frame,
        overall: rating.overall,
        scaleMax: rating.scaleMax,
        title: rating.title,
        creator: rating.creator,
        year: rating.year,
        category: rating.category,
        caption: rating.caption,
        author: rating.author,
        stats: rating.stats,
        artworkUrl,
        displayWidth: displayWidthFor(TILE_CSS_WIDTH, dpr, 'story'),
      }),
    [rating, artworkUrl, dpr],
  );

  return (
    <div className={styles.tile}>
      <a className={styles.tileOpen} href={`/?abrir=${encodeURIComponent(rating.id)}`}>
        {aindaResolvendoArte ? (
          <div className={styles.tileSkeleton} aria-hidden />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className={styles.tileImg}
            src={`/api/preview?${query}`}
            alt={`${rating.title} — nota ${rating.overall}`}
          />
        )}
      </a>
      <button
        type="button"
        className={styles.tileRemove}
        aria-label={`Remover ${rating.title} do catálogo`}
        onClick={() => onApagar(rating.id)}
      >
        ×
      </button>
    </div>
  );
}
