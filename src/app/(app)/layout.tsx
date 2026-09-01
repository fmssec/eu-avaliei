import type { Metadata, Viewport } from 'next';
import { Archivo_Black, Barlow_Condensed, IBM_Plex_Mono } from 'next/font/google';
import '../globals.css';

/**
 * As fontes são auto-hospedadas pelo next/font: nenhuma requisição a
 * fonts.googleapis.com em runtime. O renderizador carrega os mesmos arquivos
 * em TTF de public/fonts (Satori não lê woff2).
 */
const display = Archivo_Black({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const sans = Barlow_Condensed({
  weight: ['500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  weight: ['400', '500'],
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Eu avaliei!',
  description: 'Da busca ao card compartilhável em menos de 30 segundos.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#08080A' },
    { media: '(prefers-color-scheme: light)', color: '#F5F2EB' },
  ],
  width: 'device-width',
  initialScale: 1,
};

/**
 * Aplica o tema salvo antes da primeira pintura.
 *
 * Sem isto a página pinta no tema padrão e troca depois que o React hidrata —
 * o flash branco em quem escolheu escuro é exatamente o que mais incomoda.
 * Precisa ser síncrono e inline, então é o único script inline do app.
 */
const THEME_SCRIPT = `try{var t=localStorage.getItem('eu-avaliei:theme');if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
