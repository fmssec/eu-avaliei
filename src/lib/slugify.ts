/**
 * Normalização de texto para URL e nome de arquivo. Sem dependência de Node,
 * porque roda tanto no servidor (geração de slug) quanto no cliente (nome do
 * arquivo baixado).
 */

/** Remove os diacríticos combinantes deixados por NFD (U+0300–U+036F). */
const COMBINING = /[̀-ͯ]/g;

export function slugify(text: string, maxLength = 32): string {
  const slug = text
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, maxLength);
  return slug || 'card';
}

/** Variante sem separadores, usada no radical do slug de card. */
export function slugifyCompact(text: string, maxLength = 12): string {
  const slug = text
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, maxLength);
  return slug || 'card';
}
