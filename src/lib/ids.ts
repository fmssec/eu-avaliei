import { randomBytes, randomUUID } from 'node:crypto';
import { slugifyCompact } from './slugify';

const BASE62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function uuid(): string {
  return randomUUID();
}

/** Sufixo base62 sem viés de módulo (rejeita bytes fora do múltiplo de 62). */
function base62(length: number): string {
  let out = '';
  while (out.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (byte >= 248) continue; // 248 = 4 * 62; acima disso enviesaria
      out += BASE62[byte % 62];
      if (out.length === length) break;
    }
  }
  return out;
}

/**
 * Slug curto e url-safe: pedaço legível do título + sufixo aleatório.
 * O sufixo garante unicidade sem consultar o banco e impede enumerar cards.
 */
export function makeSlug(title: string): string {
  return `${slugifyCompact(title)}-${base62(6)}`;
}

/** Token de reivindicação de card anônimo. Fica no localStorage do criador. */
export function makeClaimToken(): string {
  return base62(32);
}
