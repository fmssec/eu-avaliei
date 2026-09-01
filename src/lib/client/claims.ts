'use client';

/**
 * Cards anônimos e seus tokens de reivindicação (spec §7).
 *
 * O card é criado sem login e o token fica só aqui, no navegador de quem
 * criou. Ele é a credencial de edição e o que permite reivindicar o card
 * quando existirem contas — por isso nunca vai para a URL nem para o servidor
 * fora do header de edição.
 */

const KEY = 'eu-avaliei:claims';
const MAX = 100;

export interface Claim {
  slug: string;
  claimToken: string;
  title: string;
  createdAt: string;
}

function read(): Claim[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Claim[]) : [];
  } catch {
    // Janela privada, storage bloqueado, JSON corrompido: seguir sem histórico.
    return [];
  }
}

function write(claims: Claim[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(claims.slice(0, MAX)));
  } catch {
    // Falhar em salvar o histórico não pode impedir de compartilhar o card.
  }
}

export function saveClaim(claim: Claim): void {
  write([claim, ...read().filter((c) => c.slug !== claim.slug)]);
}

export function listClaims(): Claim[] {
  return read();
}

export function claimTokenFor(slug: string): string | null {
  return read().find((c) => c.slug === slug)?.claimToken ?? null;
}
