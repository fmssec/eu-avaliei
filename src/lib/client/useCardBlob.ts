'use client';

import { useEffect, useRef, useState } from 'react';
import { FORMATS, type FormatId } from '../formats';

/**
 * Pré-gera o arquivo do card enquanto o usuário ainda está editando.
 *
 * Isto não é otimização, é requisito de correção: `navigator.share()` exige
 * ativação transitória do usuário, e no iOS um `await` dentro do handler de
 * clique a invalida. Se o blob só fosse gerado ao clicar em "compartilhar", a
 * chamada seria rejeitada. O clique só consome o que já está pronto.
 */

export interface PreparedCard {
  file: File;
  blob: Blob;
  bytes: number;
  format: FormatId;
}

export function useCardBlob(previewQuery: string, format: FormatId, filenameStem: string) {
  const [prepared, setPrepared] = useState<PreparedCard | null>(null);
  const [preparing, setPreparing] = useState(false);
  const latest = useRef(0);

  useEffect(() => {
    const token = ++latest.current;
    const controller = new AbortController();

    setPreparing(true);
    setPrepared(null);

    // `previewQuery` já carrega o formato: é a mesma URL da <img> do preview,
    // então o arquivo compartilhado é literalmente o que o usuário viu.
    fetch(`/api/preview?${previewQuery}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`render ${res.status}`);
        const blob = await res.blob();
        // Uma resposta atrasada de um estado antigo não pode sobrescrever o atual.
        if (token !== latest.current) return;
        // O tipo vem da resposta, não da matriz de formatos: um card com arte
        // fotográfica pesada sai em JPEG mesmo onde o padrão é PNG.
        const mime = blob.type || FORMATS[format].mime;
        const ext = mime === 'image/png' ? 'png' : 'jpg';
        const file = new File([blob], `${filenameStem}.${ext}`, { type: mime });
        setPrepared({ file, blob, bytes: blob.size, format });
      })
      .catch(() => {
        if (token === latest.current) setPrepared(null);
      })
      .finally(() => {
        if (token === latest.current) setPreparing(false);
      });

    return () => controller.abort();
  }, [previewQuery, format, filenameStem]);

  return { prepared, preparing };
}

/** Adia a propagação de um valor. Usado no preview (250ms) e na busca (300ms). */
export function useDebounced<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return settled;
}
