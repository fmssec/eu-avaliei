/**
 * Checklist de compartilhamento (spec §11), na parte que dá para automatizar.
 *
 * Uso:  node scripts/check-share.mjs https://euavaliei.com.br
 *
 * O que ele verifica mudou junto com o produto. Não existe mais página por
 * card, então não há og:image por card para conferir — o preview de link que
 * importa agora é o do site, que é o que aparece em toda conversa onde alguém
 * cola o endereço. O resto continua: peso da imagem, ordem das tags no <head>,
 * e os quatro formatos dentro do teto de bytes.
 *
 * O que NÃO dá para automatizar e continua sendo manual, todo release:
 *   · abrir a share sheet num iPhone e num Android de verdade;
 *   · mandar o link do site numa conversa e olhar o preview;
 *   · olhar o card reduzido a 300px e decidir se ainda está legível.
 */

const base = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');

const CRAWLER_UA = 'WhatsApp/2.23.20.0';
const results = [];

function check(label, ok, detail = '') {
  results.push({ label, ok, detail });
  console.log(`${ok ? '  ok  ' : ' FALHA'} ${label}${detail ? ` — ${detail}` : ''}`);
}

function peso(bytes) {
  return bytes < 1_000_000
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / 1_000_000).toFixed(2)} MB`;
}

/** Um card qualquer, com arte, para exercitar o caminho mais pesado. */
const CARD =
  'fr=ficha&o=8.8&sm=10&t=The+Last+of+Us&cr=Naughty+Dog&y=2013&cat=game' +
  '&cap=joguei+em+2013+e+ainda+penso+na+%C3%BAltima+hora&a=%40fz' +
  '&s=Gameplay%3A8.8%7EHist%C3%B3ria%3A9.8%7EArte%3A9.2%7ETrilha%3A9.5%7ERejogabilidade%3A7.4%7EPerformance%3A8.1' +
  '&art=%2Fapi%2Fartwork%3Fsrc%3Dhttps%253A%252F%252Fimages.igdb.com%252Figdb%252Fimage%252Fupload%252Ft_cover_big%252Fco1r7f.jpg';

/** Tetos da matriz de formatos (spec §3.1). */
const FORMATOS = {
  story: { limite: 2_000_000, rotulo: '2 MB', dim: [1080, 1920] },
  square: { limite: 2_000_000, rotulo: '2 MB', dim: [1080, 1080] },
  og: { limite: 250_000, rotulo: '250 KB', dim: [1200, 630] },
  wide: { limite: 5_000_000, rotulo: '5 MB', dim: [1600, 900] },
};

async function main() {
  console.log(`\nChecklist de compartilhamento · ${base}\n`);

  // --- os quatro formatos, com arte real -----------------------------------
  for (const [formato, { limite, rotulo }] of Object.entries(FORMATOS)) {
    const res = await fetch(`${base}/api/preview?f=${formato}&${CARD}`);
    const bytes = (await res.arrayBuffer()).byteLength;
    check(
      `${formato} dentro do teto de ${rotulo}`,
      res.ok && bytes > 0 && bytes <= limite,
      `${res.status} · ${peso(bytes)}`,
    );
  }

  // --- preview de link do site ---------------------------------------------
  const html = await fetch(base, { headers: { 'User-Agent': CRAWLER_UA } }).then((r) => r.text());
  const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>') + 7);

  const ogImageAt = head.indexOf('property="og:image"');
  const inlineStyleAt = head.indexOf('<style');
  const inlineScriptAt = head.search(/<script(?![^>]*\bsrc=)/);

  check('tags og: no <head> servido ao crawler', ogImageAt !== -1);
  check('twitter:card = summary_large_image', head.includes('content="summary_large_image"'));
  check(
    'og:image nos primeiros 4 KB do <head>',
    ogImageAt !== -1 && ogImageAt < 4096,
    ogImageAt === -1 ? 'ausente' : `offset ${ogImageAt} de ${head.length} bytes`,
  );
  check(
    'sem <style> inline antes das tags og:',
    inlineStyleAt === -1 || inlineStyleAt > ogImageAt,
    inlineStyleAt === -1 ? 'nenhum <style> no head' : `<style> em ${inlineStyleAt}`,
  );
  check(
    'sem <script> inline antes das tags og:',
    inlineScriptAt === -1 || inlineScriptAt > ogImageAt,
    inlineScriptAt === -1 ? 'nenhum script inline' : `script inline em ${inlineScriptAt}`,
  );

  const ogUrl =
    head.match(/property="og:image" content="([^"]+)"/)?.[1]?.replace(/&amp;/g, '&') ?? '';
  check('og:image é URL absoluta', /^https?:\/\//.test(ogUrl), ogUrl.slice(0, 70) || 'ausente');
  check(
    'og:image em HTTPS (obrigatório em produção)',
    ogUrl.startsWith('https://') || ogUrl.includes('localhost'),
    ogUrl.startsWith('https://') ? 'https' : 'http — só aceitável em desenvolvimento',
  );

  // O preview do site é a imagem que aparece em toda conversa: o teto de
  // 250 KB do WhatsApp vale para ela igual valia para a de cada card.
  if (ogUrl) {
    const res = await fetch(ogUrl).catch(() => null);
    if (res?.ok) {
      const bytes = (await res.arrayBuffer()).byteLength;
      check(
        'imagem de preview do site abaixo de 250 KB',
        bytes <= 250_000,
        `${res.headers.get('content-type')} · ${peso(bytes)}`,
      );
    } else {
      check('imagem de preview do site acessível', false, res ? `HTTP ${res.status}` : 'sem resposta');
    }
  }

  // --- busca ----------------------------------------------------------------
  const busca = await fetch(`${base}/api/search?q=the+last+of+us`).then((r) => r.json());
  check('busca responde com resultados', (busca.results ?? []).length > 0, `${(busca.results ?? []).length} itens`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} verificações passaram.`);
  console.log(
    '\nAinda manual, em aparelho real, todo release:\n' +
      '  · abrir a share sheet num iPhone e num Android\n' +
      '  · colar o link do site numa conversa e conferir o preview\n' +
      '  · olhar o card reduzido a 300px e julgar a legibilidade\n' +
      '  · conferir as áreas seguras do 9:16 num Story de verdade\n',
  );
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('\nO checklist não pôde rodar:', error.message);
  process.exit(2);
});
