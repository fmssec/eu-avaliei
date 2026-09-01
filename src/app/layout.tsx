import type { Metadata, Viewport } from 'next';
import { Archivo_Black, Barlow_Condensed, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

/**
 * As fontes são auto-hospedadas pelo next/font: nenhuma requisição a
 * fonts.googleapis.com em runtime. O renderizador carrega os mesmos arquivos
 * em TTF de public/fonts (Satori não lê woff2).
 *
 * `preload: false` nas três: os nove <link rel="preload"> que o next/font
 * emitia ocupavam 1767 bytes no <head> **antes** das tags og:, empurrando o
 * og:image para o byte 3141. Como o preview deste link é o que aparece em toda
 * conversa onde alguém cola o endereço, manter as meta tags perto do início
 * vale mais que ganhar alguns milissegundos no carregamento da fonte — que já
 * usa `display: swap` e portanto não bloqueia a pintura.
 */
const display = Archivo_Black({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  preload: false,
});

const sans = Barlow_Condensed({
  weight: ['500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  preload: false,
});

const mono = IBM_Plex_Mono({
  weight: ['400', '500'],
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  preload: false,
});

/**
 * O preview do site agora é o preview que importa.
 *
 * Antes cada card tinha a própria landing com o próprio og:image. Sem card
 * persistido, o link que acompanha um compartilhamento aponta para cá — então
 * esta é a imagem que aparece em toda conversa onde alguém colar o endereço.
 *
 * Ela é o card do exemplo, renderizado pelo renderizador de verdade em 1200×630.
 * Não é arquivo estático de propósito: assim nunca fica desatualizada, e a arte
 * de terceiro não entra no repositório.
 */
const OG_IMAGE =
  '/api/preview?f=og&fr=ficha&o=8.8&sm=10&t=The+Last+of+Us&cr=Naughty+Dog&y=2013' +
  '&cat=game&cap=joguei+em+2013+e+ainda+penso+na+%C3%BAltima+hora&a=' +
  '&s=Gameplay%3A8.8%7EHist%C3%B3ria%3A9.8%7EArte%3A9.2%7ETrilha%3A9.5%7ERejogabilidade%3A7.4%7EPerformance%3A8.1' +
  '&art=%2Fapi%2Fartwork%3Fsrc%3Dhttps%253A%252F%252Fimages.igdb.com%252Figdb%252Fimage%252Fupload%252Ft_cover_big%252Fco1r7f.jpg';

const TITULO = 'Eu avaliei!';
const DESCRICAO =
  'Avalie um filme, série, jogo ou livro e receba uma imagem pronta para postar. Sem login, em menos de 30 segundos.';

export const metadata: Metadata = {
  // Resolve as URLs relativas de og:image para absolutas, que é o que os
  // crawlers exigem. Em produção precisa ser o domínio real em HTTPS.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: TITULO,
  description: DESCRICAO,
  openGraph: {
    type: 'website',
    siteName: TITULO,
    locale: 'pt_BR',
    title: TITULO,
    description: DESCRICAO,
    images: [{ url: OG_IMAGE, width: 1200, height: 630, type: 'image/jpeg' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITULO,
    description: DESCRICAO,
    images: [OG_IMAGE],
  },
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
