/**
 * Pôsteres e capas nunca são referenciados direto da CDN de terceiro: isso
 * quebra quando a URL muda e vaza o referrer do nosso domínio para eles
 * (spec §4.3). Tudo passa por /api/artwork, que faz cache e revalida o host.
 */
const ALLOWED_HOSTS = new Set([
  'image.tmdb.org',
  'images.igdb.com',
  'covers.openlibrary.org',
  'coverartarchive.org',
  'archive.org',
]);

export function isAllowedArtworkHost(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && ALLOWED_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

export function proxiedArtwork(originalUrl: string): string {
  return `/api/artwork?src=${encodeURIComponent(originalUrl)}`;
}

/**
 * URL de arte aceitável para um card: nosso proxy de fonte externa, ou uma
 * imagem que o próprio usuário enviou. Qualquer outra coisa é recusada — este
 * valor vem do cliente e acaba virando `<img src>` no renderizador.
 */
export function isAcceptableArtworkUrl(url: string): boolean {
  if (/^\/api\/uploads\/[0-9a-f]{32}\.jpg$/.test(url)) return true;
  if (url.startsWith('/api/artwork?')) {
    const src = new URLSearchParams(url.slice(url.indexOf('?') + 1)).get('src');
    return !!src && isAllowedArtworkHost(src);
  }
  return isAllowedArtworkHost(url);
}
