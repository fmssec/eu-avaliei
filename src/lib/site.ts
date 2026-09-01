import { headers } from 'next/headers';

/**
 * Origem absoluta do site.
 *
 * O og:image precisa ser URL absoluta e publicamente acessível, senão o
 * WhatsApp não busca a imagem (spec §3.2). Em produção isto vem do env; em
 * desenvolvimento é derivado do header da requisição.
 */
export async function siteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  if (configured) return configured;

  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}
