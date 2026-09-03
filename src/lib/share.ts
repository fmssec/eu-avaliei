'use client';

import type { FormatId } from './formats';

/**
 * Cascata de compartilhamento (spec §3.3), em ordem de capacidade.
 *
 * As armadilhas tratadas aqui são as confirmadas na spec, e cada uma já quebrou
 * produto em produção:
 *   · o feature-detect correto é `canShare({ files })` — o suporte a arquivos é
 *     separado do suporte a texto, e `navigator.share` existir não basta;
 *   · no iOS Safari, mandar `files` junto com `title`/`text` faz o sistema
 *     compartilhar só o texto e descartar a imagem;
 *   · `share()` exige ativação transitória, e um `await` dentro do handler de
 *     clique a invalida no iOS — por isso o blob é pré-gerado (ver useCardBlob).
 */

export type ShareChannel =
  | 'webshare'
  | 'whatsapp'
  | 'x'
  | 'telegram'
  | 'clipboard'
  | 'download'
  | 'site';

export interface ShareResult {
  ok: boolean;
  channel: ShareChannel | null;
  /** Verdadeiro quando o usuário fechou a share sheet sem escolher destino. */
  cancelled?: boolean;
}

type ShareNavigator = Navigator & {
  canShare?: (data?: ShareData) => boolean;
  share?: (data?: ShareData) => Promise<void>;
};

/** Camada 1 — a share sheet nativa cobre a maior parte do caso de uso. */
export function canShareFiles(file: File): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as ShareNavigator;
  return typeof nav.canShare === 'function' && nav.canShare({ files: [file] });
}

/**
 * Compartilha o arquivo. NÃO recebe título nem texto de propósito: no iOS isso
 * faz a imagem ser ignorada. Precisa ser chamada direto do handler de clique,
 * sem nenhum `await` antes.
 *
 * Este é o caminho em que o card chega inteiro do outro lado — a imagem viaja
 * como arquivo, não como preview de link.
 */
export async function shareFile(file: File): Promise<ShareResult> {
  const nav = navigator as ShareNavigator;
  if (!nav.share || !canShareFiles(file)) return { ok: false, channel: null };

  try {
    await nav.share({ files: [file] });
    return { ok: true, channel: 'webshare' };
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === 'AbortError';
    return { ok: false, channel: 'webshare', cancelled: aborted };
  }
}

/**
 * Camada 2 — deep links. Nenhum deles aceita anexar imagem por URL: são
 * texto + link.
 *
 * O link aponta para o site, não para o card: sem card persistido não existe
 * página por card para linkar. A consequência é que, por este caminho, quem
 * recebe vê o texto e o link — a imagem precisa ser anexada à mão, com os
 * botões de copiar ou baixar.
 */
export function deepLink(
  channel: 'whatsapp' | 'x' | 'telegram',
  text: string,
  url: string,
): string {
  switch (channel) {
    case 'whatsapp':
      // \n\n, não espaço: o link precisa cair numa linha própria, abaixo de
      // todo o texto — grudado no fim da última linha ele lê como parte da
      // frase, não como o convite separado que é.
      return `https://wa.me/?text=${encodeURIComponent(`${text}\n\n${url}`)}`;
    case 'x':
      return `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    case 'telegram':
      return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  }
}

/**
 * URL do site marcada com a origem.
 *
 * Sem página por card, a atribuição vira agregada: o `de=` é o que separa
 * "chegou por um card compartilhado no WhatsApp" de tráfego direto, e é o que
 * mantém o critério de sucesso do MVP mensurável.
 */
export function siteLink(origin: string, channel: ShareChannel): string {
  return `${origin}/?de=${channel}`;
}

/** Camada 4 — clipboard. Fallback universal, principalmente no desktop. */
export async function copyImage(blob: Blob): Promise<ShareResult> {
  try {
    if (!('clipboard' in navigator) || typeof ClipboardItem === 'undefined') {
      return { ok: false, channel: 'clipboard' };
    }
    // O clipboard só aceita PNG de forma confiável entre navegadores.
    const png = blob.type === 'image/png' ? blob : new Blob([blob], { type: 'image/png' });
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
    return { ok: true, channel: 'clipboard' };
  } catch {
    return { ok: false, channel: 'clipboard' };
  }
}

/** Camada 4 — download. Último recurso, e o caminho de "baixar em todos os formatos". */
export function downloadBlob(blob: Blob, filename: string): ShareResult {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Um tick depois: revogar cedo demais cancela o download em alguns navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return { ok: true, channel: 'download' };
}

/** Registra o evento sem bloquear a interação — o envio pode falhar em silêncio. */
export function track(
  event: 'created' | 'shared' | 'viewed' | 'converted',
  channel: ShareChannel | null,
  format: FormatId | null,
  category: string | null = null,
): void {
  const body = JSON.stringify({ event, channel, format, category });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/events', new Blob([body], { type: 'application/json' }));
      return;
    }
  } catch {
    // cai no fetch abaixo
  }
  void fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => undefined);
}
