import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SatoriOptions } from 'satori';

/**
 * Fontes carregadas uma vez na inicialização, nunca por request (spec §4.3).
 *
 * Satori aceita ttf/otf/woff — woff2 NÃO. Os arquivos vêm de
 * `npm run fonts`, que baixa TTF da Google Fonts.
 */
type FontList = SatoriOptions['fonts'];

const FILES: { file: string; name: string; weight: 400 | 500 | 600 | 700 }[] = [
  { file: 'ArchivoBlack-Regular.ttf', name: 'Archivo Black', weight: 400 },
  { file: 'BarlowCondensed-Medium.ttf', name: 'Barlow Condensed', weight: 500 },
  { file: 'BarlowCondensed-SemiBold.ttf', name: 'Barlow Condensed', weight: 600 },
  { file: 'BarlowCondensed-Bold.ttf', name: 'Barlow Condensed', weight: 700 },
  { file: 'IBMPlexMono-Regular.ttf', name: 'IBM Plex Mono', weight: 400 },
  { file: 'IBMPlexMono-Medium.ttf', name: 'IBM Plex Mono', weight: 500 },
];

let cached: Promise<FontList> | null = null;

export function loadFonts(): Promise<FontList> {
  cached ??= Promise.all(
    FILES.map(async ({ file, name, weight }) => {
      const path = join(process.cwd(), 'public', 'fonts', file);
      try {
        return { name, weight, style: 'normal' as const, data: await readFile(path) };
      } catch {
        throw new Error(`Fonte ausente: public/fonts/${file}. Rode "npm run fonts".`);
      }
    }),
  );
  return cached;
}
