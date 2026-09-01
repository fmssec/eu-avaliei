// Baixa as fontes do design em TTF para public/fonts.
// Satori só aceita ttf/otf/woff — woff2 NÃO é suportado. A Google Fonts serve
// TTF para User-Agents antigos que não anunciam woff/woff2 (Android 2.2 devolve font/ttf;
// UAs de IE devolvem EOT e Chrome antigo devolve WOFF, por isso este UA específico).
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'fonts');
const LEGACY_UA =
  'Mozilla/5.0 (Linux; U; Android 2.2; en-us; Nexus One Build/FRF91) AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1';

/** [arquivo, família, peso] */
const FONTS = [
  ['ArchivoBlack-Regular.ttf', 'Archivo Black', 400],
  ['BarlowCondensed-Medium.ttf', 'Barlow Condensed', 500],
  ['BarlowCondensed-SemiBold.ttf', 'Barlow Condensed', 600],
  ['BarlowCondensed-Bold.ttf', 'Barlow Condensed', 700],
  ['IBMPlexMono-Regular.ttf', 'IBM Plex Mono', 400],
  ['IBMPlexMono-Medium.ttf', 'IBM Plex Mono', 500],
];

async function fontUrl(family, weight) {
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`;
  const res = await fetch(url, { headers: { 'User-Agent': LEGACY_UA } });
  if (!res.ok) throw new Error(`CSS ${family} ${weight}: HTTP ${res.status}`);
  const css = await res.text();
  // Com UA legado a Google devolve TTF, mas a URL é do tipo /l/font?kit=… (sem extensão).
  const match = css.match(/src:\s*url\((https:\/\/[^)]+)\)/);
  if (!match) throw new Error(`Sem URL de fonte no CSS de ${family} ${weight}`);
  return match[1];
}

/** Rejeita woff2 e formatos que o Satori não carrega. */
function assertUsable(bytes, file) {
  const tag = bytes.subarray(0, 4).toString('binary');
  if (tag === 'wOF2') throw new Error(`${file}: veio woff2, que o Satori não suporta`);
  const ok = tag === '\x00\x01\x00\x00' || tag === 'true' || tag === 'OTTO' || tag === 'wOFF';
  if (!ok) throw new Error(`${file}: assinatura de fonte não reconhecida (${JSON.stringify(tag)})`);
}

await mkdir(OUT, { recursive: true });

for (const [file, family, weight] of FONTS) {
  const dest = join(OUT, file);
  if (existsSync(dest) && !process.argv.includes('--force')) {
    console.log(`· ${file} já existe`);
    continue;
  }
  const src = await fontUrl(family, weight);
  const bytes = Buffer.from(await (await fetch(src)).arrayBuffer());
  assertUsable(bytes, file);
  await writeFile(dest, bytes);
  console.log(`✓ ${file} (${(bytes.length / 1024).toFixed(0)} KB)`);
}
