'use client';

import { atualizarArtworkUrl, type SavedRating } from './history';

/**
 * Resolve a arte de um item do catálogo para uma URL que o SERVIDOR consegue
 * buscar.
 *
 * O renderizador roda no servidor e não enxerga `blob:` — esse esquema só
 * existe dentro da aba que criou o objeto. Para exibir o card de um item com
 * arte própria (grade do catálogo, ou reabrir no editor), o Blob guardado
 * precisa primeiro ser reenviado para /api/uploads, que devolve uma URL de
 * verdade.
 *
 * O reenvio é barato de repetir — o upload deduplica por hash de conteúdo,
 * então o mesmo arquivo nunca grava duas vezes — mas ainda é uma requisição
 * de rede. `artworkUploadedAt` evita repeti-la a cada exibição: só considera
 * reenviar quando o cache do servidor (TTL de 6h) já pode ter expirado.
 *
 * Mas o relógio sozinho não é suficiente: /tmp é efêmero e some inteiro num
 * reinício do servidor (deploy, crash, escala) — um evento que o relógio do
 * cliente não tem como prever. Por isso a URL em cache passa por uma checagem
 * HEAD antes de ser aceita; se o arquivo não estiver mais lá, cai para o
 * reenvio em vez de mostrar o card sem foto por até 5h até o cache expirar
 * sozinho.
 */
const CACHE_SAFETY_MARGIN_MS = 5 * 60 * 60 * 1000; // 5h, sob o TTL real de 6h

function cacheDentroDoPrazo(rating: SavedRating): boolean {
  if (!rating.artworkUploadedAt) return false;
  const idade = Date.now() - new Date(rating.artworkUploadedAt).getTime();
  return idade < CACHE_SAFETY_MARGIN_MS;
}

async function uploadAindaExiste(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

async function reenviar(rating: SavedRating): Promise<string | null> {
  if (!rating.artworkBlob) return rating.artworkUrl;
  try {
    const form = new FormData();
    form.append('file', rating.artworkBlob, 'arte.jpg');
    const res = await fetch('/api/uploads', { method: 'POST', body: form });
    if (!res.ok) return rating.artworkUrl;

    const data = (await res.json()) as { url?: string };
    if (!data.url) return rating.artworkUrl;

    void atualizarArtworkUrl(rating.id, data.url);
    return data.url;
  } catch {
    // Sem rede ou servidor fora do ar: mostra sem a foto própria em vez de
    // travar a grade inteira por causa de um item.
    return rating.artworkUrl;
  }
}

export async function resolveCatalogArtwork(rating: SavedRating): Promise<string | null> {
  if (!rating.artworkBlob) return rating.artworkUrl;

  if (cacheDentroDoPrazo(rating) && rating.artworkUrl) {
    if (await uploadAindaExiste(rating.artworkUrl)) return rating.artworkUrl;
    // O relógio dizia que ainda valia, mas o arquivo não está mais lá — o
    // servidor deve ter reiniciado. Cai para reenviar como se o cache tivesse
    // expirado de verdade.
  }

  return reenviar(rating);
}
