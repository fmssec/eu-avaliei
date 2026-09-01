import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * Busca de URL fornecida pelo usuário, com proteção contra SSRF.
 *
 * Deixar o servidor buscar uma URL arbitrária é entregar a ele um cliente HTTP
 * que fala de dentro da rede: `http://169.254.169.254/` devolve credenciais em
 * qualquer nuvem, `http://localhost:5432` alcança o banco, e um redirecionamento
 * leva para lá mesmo quando o host digitado parecia inofensivo.
 *
 * Por isso: só http(s), cada endereço resolvido é conferido contra as faixas
 * privadas e reservadas, cada salto de redirecionamento é revalidado, e há teto
 * de tempo e de bytes.
 */

const MAX_REDIRECTS = 3;
const DEFAULT_TIMEOUT_MS = 8_000;
const USER_AGENT =
  'eu-avaliei/0.1 (+https://github.com/; gerador de cards de avaliacao)';

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

function ipv4IsPrivate(ip: string): boolean {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;

  if (a === 0) return true; // 0.0.0.0/8 — "este host"
  if (a === 10) return true; // rede privada
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local — metadados de nuvem
  if (a === 172 && b >= 16 && b <= 31) return true; // rede privada
  if (a === 192 && b === 168) return true; // rede privada
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 192 && b === 0) return true; // IETF protocol assignments
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true; // multicast e reservado
  return false;
}

function ipv6IsPrivate(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v === '::' || v === '::1') return true;

  // ::ffff:1.2.3.4 — IPv4 disfarçado de IPv6.
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipv4IsPrivate(mapped[1]);

  if (v.startsWith('fe80') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb')) {
    return true; // link-local
  }
  if (/^f[cd]/.test(v)) return true; // unique local
  if (v.startsWith('ff')) return true; // multicast
  return false;
}

export function ipIsPrivate(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return ipv4IsPrivate(ip);
  if (kind === 6) return ipv6IsPrivate(ip);
  return true; // não parseou: trata como inseguro
}

/** Rejeita se qualquer endereço do host cair em faixa privada ou reservada. */
async function assertPublicHost(hostname: string): Promise<void> {
  if (isIP(hostname)) {
    if (ipIsPrivate(hostname)) throw new UnsafeUrlError('Endereço de rede interna');
    return;
  }

  let addresses: { address: string }[];
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new UnsafeUrlError('Host não encontrado');
  }

  if (addresses.length === 0) throw new UnsafeUrlError('Host sem endereço');
  // Um único endereço interno já basta para recusar.
  if (addresses.some((a) => ipIsPrivate(a.address))) {
    throw new UnsafeUrlError('Endereço de rede interna');
  }
}

function assertHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError('URL inválida');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new UnsafeUrlError('Só http e https são aceitos');
  }
  return url;
}

export interface SafeFetchResult {
  body: Buffer;
  contentType: string;
  finalUrl: string;
}

/**
 * Busca a URL e devolve o corpo, respeitando o teto de bytes. Os
 * redirecionamentos são seguidos à mão para que cada destino seja revalidado —
 * seguir automático deixaria o primeiro host aprovar um segundo host interno.
 */
export async function safeFetchImage(
  rawUrl: string,
  { maxBytes, timeoutMs = DEFAULT_TIMEOUT_MS }: { maxBytes: number; timeoutMs?: number },
): Promise<SafeFetchResult> {
  let url = assertHttpUrl(rawUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(url.hostname);

    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Accept: 'image/*',
        // Sem User-Agent descritivo, vários hosts respondem 403 ou 400 — a
        // Wikimedia é o caso mais comum. Identificar-se também é o que a
        // etiqueta dessas APIs pede de quem busca do lado servidor.
        'User-Agent': USER_AGENT,
      },
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) throw new UnsafeUrlError('Redirecionamento sem destino');
      url = assertHttpUrl(new URL(location, url).toString());
      continue;
    }

    if (!res.ok) throw new UnsafeUrlError(`A origem respondeu ${res.status}`);

    const contentType = res.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
    if (!contentType.startsWith('image/')) {
      throw new UnsafeUrlError('O link não aponta para uma imagem');
    }

    // Content-Length é dica, não garantia: o corpo é lido com corte próprio.
    const declared = Number(res.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > maxBytes) {
      throw new UnsafeUrlError('Imagem grande demais');
    }

    const body = await readCapped(res, maxBytes);
    return { body, contentType, finalUrl: url.toString() };
  }

  throw new UnsafeUrlError('Redirecionamentos demais');
}

/** Lê o corpo abortando ao passar do teto, em vez de bufferizar tudo antes. */
async function readCapped(res: Response, maxBytes: number): Promise<Buffer> {
  if (!res.body) throw new UnsafeUrlError('Resposta sem corpo');

  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = res.body.getReader();

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new UnsafeUrlError('Imagem grande demais');
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  return Buffer.concat(chunks);
}
