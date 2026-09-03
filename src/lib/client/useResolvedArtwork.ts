'use client';

import { useEffect, useRef, useState } from 'react';
import { resolveCatalogArtwork } from './artworkCache';
import type { SavedRating } from './history';

/**
 * Versão em hook de `resolveCatalogArtwork`, para usar por item numa grade.
 *
 * Cada tile resolve a própria arte de forma independente — um upload lento ou
 * que falhe não trava os demais. Enquanto resolve, ou se o item não tem arte,
 * devolve o que já se sabe de imediato (a URL da fonte, ou null).
 */
export function useResolvedArtwork(rating: SavedRating): string | null {
  const [url, setUrl] = useState<string | null>(rating.artworkBlob ? null : rating.artworkUrl);
  const idRef = useRef(rating.id);

  useEffect(() => {
    idRef.current = rating.id;
    if (!rating.artworkBlob) {
      setUrl(rating.artworkUrl);
      return;
    }

    let cancelado = false;
    setUrl(null);
    void resolveCatalogArtwork(rating).then((resolved) => {
      // O item pode ter trocado (troca de tile na mesma posição da lista)
      // antes do reenvio terminar; um resultado atrasado não pode vazar.
      if (!cancelado && idRef.current === rating.id) setUrl(resolved);
    });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rating.id, rating.artworkBlob]);

  return url;
}
