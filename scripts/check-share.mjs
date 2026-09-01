/**
 * Checklist de compartilhamento (spec §11), na parte que dá para automatizar.
 *
 * Uso:  node scripts/check-share.mjs http://localhost:3000
 *
 * Cria um card descartável, e verifica o que quebra o canal em silêncio: peso
 * do og:image, ordem das tags no <head>, ausência de CSS/JS inline antes
 * delas, URL absoluta, e o cache-bust da versão.
 *
 * O que NÃO dá para automatizar e continua sendo manual, todo release:
 *   · mandar o link numa conversa real de WhatsApp e olhar o preview;
 *   · abrir a share sheet num iPhone e num Android de verdade;
 *   · olhar o card reduzido a 300px e decidir se ainda está legível.
 */

const base = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');

const CRAWLER_UA = 'WhatsApp/2.23.20.0';
const results = [];

function check(label, ok, detail = '') {
  results.push({ label, ok, detail });
  console.log(`${ok ? '  ok  ' : ' FALHA'} ${label}${detail ? ` — ${detail}` : ''}`);
}

function kb(bytes) {
  return `${Math.round(bytes / 1024)} KB`;
}

async function main() {
  console.log(`\nChecklist de compartilhamento · ${base}\n`);

  // --- card de teste -------------------------------------------------------
  const search = await fetch(`${base}/api/search?q=ainda`).then((r) => r.json());
  const media = search.results?.[0];
  if (!media) throw new Error('A busca não devolveu nenhuma mídia. O servidor está no ar?');

  const created = await fetch(`${base}/api/cards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      externalId: media.externalId,
      overall: 8.4,
      overallMode: 'computed',
      frameId: 'ficha',
      caption: 'card de verificação',
      authorHandle: '@check',
      stats: ['Roteiro', 'Atuação', 'Direção', 'Trilha', 'Visual', 'Ritmo'].map((label) => ({
        label,
        value: 8.4,
      })),
    }),
  }).then((r) => r.json());

  const { slug, claimToken } = created;
  const url = `${base}/c/${slug}-v1`;

  // --- og:image ------------------------------------------------------------
  const og = await fetch(`${base}/api/render/${slug}.jpg?format=og&v=1`);
  const ogBytes = (await og.arrayBuffer()).byteLength;
  check('og:image é JPEG', og.headers.get('content-type') === 'image/jpeg', og.headers.get('content-type'));
  check('og:image abaixo de 250 KB', ogBytes <= 250_000, kb(ogBytes));
  check(
    'og:image com cache imutável',
    (og.headers.get('cache-control') ?? '').includes('immutable'),
    og.headers.get('cache-control') ?? '',
  );

  // --- <head> visto por um crawler ----------------------------------------
  const html = await fetch(url, { headers: { 'User-Agent': CRAWLER_UA } }).then((r) => r.text());
  const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>') + 7);

  const ogImageAt = head.indexOf('property="og:image"');
  const twitterAt = head.indexOf('name="twitter:card"');
  const inlineStyleAt = head.indexOf('<style');
  const inlineScriptAt = head.search(/<script(?![^>]*\bsrc=)/);

  check('tags og: presentes no <head> servido ao crawler', ogImageAt !== -1);
  check('twitter:card = summary_large_image', head.includes('content="summary_large_image"'));
  check(
    'og:image dentro dos primeiros 4 KB do <head>',
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
  check('twitter:card presente', twitterAt !== -1);

  const ogUrlMatch = head.match(/property="og:image" content="([^"]+)"/);
  const ogUrl = ogUrlMatch?.[1]?.replace(/&amp;/g, '&') ?? '';
  check('og:image é URL absoluta', /^https?:\/\//.test(ogUrl), ogUrl || 'ausente');
  check(
    'og:image em HTTPS (obrigatório em produção)',
    ogUrl.startsWith('https://') || ogUrl.includes('localhost'),
    ogUrl.startsWith('https://') ? 'https' : 'http — só aceitável em desenvolvimento',
  );

  // --- dimensões dos formatos ---------------------------------------------
  const expected = {
    story: [1080, 1920],
    square: [1080, 1080],
    og: [1200, 630],
    wide: [1600, 900],
  };
  for (const [format, [w, h]] of Object.entries(expected)) {
    const declared = head.includes(`property="og:image:width" content="${w}"`);
    if (format === 'og') check(`og:image declara ${w}×${h}`, declared);
  }

  // --- cache-bust por versão ----------------------------------------------
  const patched = await fetch(`${base}/api/cards/${slug}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-claim-token': claimToken },
    body: JSON.stringify({ caption: 'editado' }),
  }).then((r) => r.json());
  check(
    'editar o card incrementa render_version',
    patched.renderVersion === 2,
    `v${patched.renderVersion}`,
  );

  const redirected = await fetch(`${base}/c/${slug}-v1`, { redirect: 'follow' });
  check(
    'URL de versão antiga redireciona para a canônica',
    redirected.url.endsWith(`-v2`),
    redirected.url,
  );

  // --- resumo --------------------------------------------------------------
  const failed = results.filter((r) => !r.ok);
  console.log(
    `\n${results.length - failed.length}/${results.length} verificações passaram.`,
  );
  console.log(
    '\nAinda manual, em aparelho real, todo release:\n' +
      '  · enviar o link numa conversa de WhatsApp e conferir o preview\n' +
      '  · abrir a share sheet num iPhone e num Android\n' +
      '  · olhar o card reduzido a 300px e julgar a legibilidade\n' +
      '  · conferir as áreas seguras do 9:16 num Story de verdade\n',
  );
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('\nO checklist não pôde rodar:', error.message);
  process.exit(2);
});
