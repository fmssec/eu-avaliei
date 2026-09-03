/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  // satori, resvg e sharp são binários/nativos: mantê-los fora do bundle do servidor.
  serverExternalPackages: ['@resvg/resvg-js', 'sharp', 'satori'],
  reactStrictMode: true,

  // `standalone` emite o servidor mais as dependências rastreadas — é o que a
  // imagem Docker copia, e sem isso ela carregaria o node_modules inteiro.
  //
  // Mas serve só para self-hosting: a Vercel faz o próprio empacotamento e
  // não quer esta opção. A variável que ela define em todo build decide.
  ...(process.env.VERCEL ? {} : { output: 'standalone' }),

  /**
   * Crawlers que recebem a metadata de forma bloqueante, com as tags `og:`
   * dentro do <head> do primeiro byte da resposta.
   *
   * Por padrão o Next faz streaming da metadata: navegadores recebem o shell
   * primeiro e as meta tags depois. Para um navegador isso é indiferente; para
   * um crawler de preview é a diferença entre o link virar card visual e virar
   * texto seco — e o preview é o canal de aquisição inteiro do produto.
   *
   * A lista padrão do Next já cobre WhatsApp, facebookexternalhit, Twitterbot,
   * Slackbot, Discordbot e LinkedInBot. Aqui ela é repetida e estendida para
   * que a cobertura seja explícita: Telegram hoje só casa por acidente (o UA
   * dele contém "TwitterBot"), e Mastodon, Bluesky, Threads, Signal, Viber,
   * Line e Pinterest não casam com nada.
   */
  htmlLimitedBots:
    /[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight|TelegramBot|Mastodon|Bluesky|Bluesky Cardyb|Threads|Signal|Viber|Line|Pinterest|Iframely|embedly|Snapchat|Nuzzel|Cardyb/i,
};

export default nextConfig;
