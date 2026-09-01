# eu avaliei!

Gerador de cards de avaliação de mídia. Da busca ao card compartilhável em menos de 30 segundos.

O produto não é o tracker nem o catálogo — é a **imagem pronta para postar**. Toda decisão de arquitetura aqui responde a isso.

## Rodar

```bash
npm install
```

```bash
npm run fonts
```

```bash
npm run dev
```

`npm run fonts` baixa as seis fontes do design em TTF para `public/fonts/`. Ele precisa rodar antes do primeiro render: o Satori não lê `woff2`, e sem os arquivos o endpoint de render falha com uma mensagem dizendo isso. As fontes ficam fora do git (`.gitignore`), então em CI e em deploy este passo entra antes do build.

Sem `.env.local` o app roda inteiro com o provider de mídia `mock`, que serve os cinco títulos do arquivo de design. Para ligar o TMDB, copie `.env.example` para `.env.local` e preencha `TMDB_API_KEY` com um *read access token* v4, e `MEDIA_PROVIDER=tmdb`.

Verificação automatizada do que quebra o compartilhamento em silêncio:

```bash
npm run check:share -- http://localhost:3000
```

## Rodar em Docker

```bash
docker compose up --build
```

Sobe em `http://localhost:3000`. Não precisa de `npm install` nem de `npm run fonts` na máquina: as duas coisas acontecem dentro da imagem.

Com dados reais do TMDB, sem colocar a chave no `docker-compose.yml`:

```bash
MEDIA_PROVIDER=tmdb TMDB_API_KEY=seu_token docker compose up --build
```

Detalhes que valem saber:

- **Base Debian, não Alpine.** `sharp` e `@resvg/resvg-js` têm binários pré-compilados para `linux-x64-gnu`. Em musl o npm cairia em compilação a partir do fonte — lento e frágil justamente no caminho crítico do produto.
- **As fontes são baixadas durante o build da imagem** (`node scripts/fetch-fonts.mjs`), porque ficam fora do git e o Satori não lê `woff2`.
- **Os cards ficam num volume nomeado** (`card-data`). Sem ele, cada `docker compose up` começaria do zero. Para zerar de propósito: `docker compose down -v`.
- **Sem política de restart, de propósito.** `restart: unless-stopped` (ou `always`) faz o daemon subir o container sozinho toda vez que o Docker Desktop abre, e ele volta mesmo depois de um `docker stop`. Aqui o start é sempre manual.
- **`NEXT_PUBLIC_SITE_URL` está apontando para `http://localhost:3000`.** Em produção precisa ser o domínio real em HTTPS: o WhatsApp não busca `og:image` de página que não seja HTTPS.

Rodando o checklist contra o container:

```bash
npm run check:share -- http://localhost:3000
```

## O que está construído

O escopo do MVP da especificação, inteiro:

- **Busca federada** com debounce de 300ms, sem escolher categoria antes. Filmes e séries (TMDB), livros (Open Library, sem chave) e jogos (IGDB, precisa de credenciais Twitch), intercalados por fonte para que nenhuma categoria monopolize o topo.
- **Avaliação** com nota geral 0–10 e seis eixos, nos três modos: calculada, ponderada e manual.
- **Personalização**: molduras Craque e Pôster, cinco níveis de raridade, frase de até 80 caracteres, escala 0–10 ou 0–100, sobreposição das áreas seguras do Story.
- **Compartilhamento** nas cinco camadas: Web Share API L2, deep links, clipboard, download e a landing do card.
- **Formatos**: Story 1080×1920, quadrado 1080×1080, `og:image` 1200×630 e X 1600×900.
- **Preview de link do site** com `og:` e `twitter:` corretos, renderizado pelo mesmo renderizador.
- **Arte própria**: anexar arquivo do dispositivo ou colar um link, no lugar do pôster da base.
- **Tema claro e escuro**, com um terceiro estado — seguir o sistema — que é o padrão.
- **Layout que usa o desktop**: acima de 960px o card vira uma coluna fixa e grande ao lado dos controles. Continua mobile-first.
- **Sem login e sem conta.** Nada é guardado — nem do lado do servidor, nem do seu.
- **Instrumentação** do funil desde o primeiro commit, agora via stdout.

## O card não é guardado

A decisão que define a arquitetura atual: **nada é persistido.** O card existe
enquanto está sendo feito e vira a imagem que a pessoa leva embora.

Isso saiu de uma pergunta boa — por que o card precisa existir entre
requisições, se ele é gerado uma vez? A resposta original era: porque a landing
por card e o `og:image` por card são requisições de outras pessoas, depois. Mas
isso era uma escolha, não uma lei, e ela custava caro: exigia disco persistente,
o que eliminava toda hospedagem gratuita.

Medimos a alternativa de levar o card na URL: **48 caracteres hoje contra 392 a
493**. Link de 400 caracteres em conversa parece spam, e o link é o produto.

A saída foi outra: o link de compartilhamento aponta para o **site**, não para
o card. O que isso muda, honestamente:

| Caminho | Antes | Agora |
|---|---|---|
| Share sheet com arquivo (mobile) | imagem inteira | **igual** — é o caminho principal |
| Baixar / copiar | imagem inteira | **igual** |
| Deep link (desktop) | link virava o card via og:image | texto + link do site; a imagem vai anexada à mão |
| Métrica da tese | retorno por card | retorno **agregado**, via `?de={canal}` |

O preview de link que importa passou a ser o do site — daí `preload: false` nas
fontes: os nove `<link rel="preload">` do next/font empurravam o `og:image` para
o byte 3141 do `<head>`. Sem eles, 2481.

A instrumentação sobreviveu sem banco: os eventos saem em JSON de uma linha no
stdout, que toda hospedagem coleta de graça. `grep '[evento]' | jq` responde o
funil.

## Decisões de implementação

### Um renderizador só, no servidor

`satori` compõe o card em SVG, `resvg` rasteriza, `sharp` encoda. O preview do editor **é** esse renderizador — a `<img>` do editor aponta para `/api/preview` com os mesmos parâmetros. Não existe uma reprodução em DOM do card que precise ser mantida em sincronia; o que o usuário vê editando é literalmente o arquivo que ele compartilha.

O `og:image` obrigaria renderização de servidor de qualquer forma. Manter dois renderizadores que precisam produzir o mesmo pixel seria uma fonte permanente de bug.

### O que o subset de CSS do Satori custou

O porte de `Card.dc.html` exigiu quatro adaptações, todas documentadas em `src/lib/render/card.tsx`:

| Design | Satori | Solução |
|---|---|---|
| `display: grid` no craque | não existe | flex-wrap com largura de coluna calculada |
| cores em `oklch()` | não interpretadas | convertidas para hex em `src/lib/design.ts` |
| `text-wrap: balance` | não existe | removido |
| `repeating-linear-gradient` no placeholder | arriscado | chapa sólida |
| `bottom` em absoluto dentro de fragmento | não resolve | posicionar por `top` calculado |

A terceira linha da tabela custou uma sessão inteira de depuração: um degradê com `position:absolute` e `bottom: 0` dentro de um `<>` fragmento **não pinta** — sem erro, sem aviso, o elemento simplesmente não aparece. A mesma construção como filha direta da raiz funciona. Quando um estilo não tem efeito no Satori, medir o pixel é mais rápido que reler o CSS.

Duas armadilhas a mais, que custam meia hora de depuração cada: o Satori **quebra** em chaves de estilo com valor `undefined` (daí o helper `fill()`), e trata `texto {expressão}` como dois nós filhos, exigindo `display: flex` no pai — por isso strings interpoladas viram template literal.

**Consequência para o roadmap:** ornamentos elaborados de moldura entram como assets SVG/PNG compostos em camada. Não tente desenhá-los em CSS.

### O problema do WhatsApp

É o canal mais restritivo e é onde está a dor original. O que foi feito:

- **Orçamento de bytes por formato, não só no og:image.** A matriz da spec diz "PNG ou JPEG" de propósito: PNG enquanto couber, porque mantém o texto pequeno mais nítido, e JPEG quando não cabe. Um card com key art fotográfica em sangria total passa de 2,5 MB em PNG no 1080×1920 — acima do teto de 2 MB do Story; o mesmo card sai em 228 KB de JPEG. O og:image desce a escada de q85 a q42 até caber em 250 KB, e se nem o último degrau couber o log grita, porque significa card sem preview.
- **`<head>` minúsculo.** A landing tem um root layout **próprio** (`src/app/(card)/`), separado do editor, só para não carregar `next/font` — que injeta CSS inline no `<head>`. O `<head>` servido a um crawler tem 1,7 KB, com `og:image` no offset ~1050 e **zero** CSS ou JS inline antes dele.
- **Metadata bloqueante para crawlers.** O Next 15 faz streaming de metadata por padrão: um navegador recebe o shell primeiro e as meta tags depois. Para um crawler isso é o preview morto. `htmlLimitedBots` em `next.config.mjs` lista explicitamente quem recebe a resposta bloqueante — a lista padrão do Next cobre WhatsApp e Twitterbot, mas o Telegram só casava por acidente (o UA dele contém `TwitterBot`) e Mastodon, Bluesky, Threads e Signal não casavam com nada.
- **URL imutável e versionada.** Editar um card incrementa `render_version`, a URL canônica muda, e `/c/{slug}-v1` redireciona 308 para a versão atual. É o único cache-bust que funciona num cache de 72h+ sem debugger oficial.

### A ativação transitória do iOS

`navigator.share()` exige ativação transitória, e no iOS um `await` dentro do handler de clique a invalida. Se o blob fosse gerado ao clicar, a chamada seria rejeitada.

Por isso `useCardBlob` dispara o render assim que o usuário entra na personalização e guarda o `File` pronto. O clique em compartilhar chama `shareFile()` **sem nenhum `await` antes** — só consome o que já existe. O feature-detect é `navigator.canShare({ files })`, nunca `navigator.share`, e o `share()` vai com `files` sozinho, sem `title` nem `text`.

### Arte enviada pelo usuário

Arquivo e link terminam no mesmo lugar: `POST /api/uploads` reprocessa a imagem com sharp e guarda em disco. Reencodar não é só normalizar tamanho — descarta EXIF (que carrega geolocalização) e garante que o que servimos é imagem de verdade, não um arquivo com extensão de imagem.

Buscar o link **no servidor** significa aceitar uma URL arbitrária do usuário, que é um SSRF esperando acontecer: `http://169.254.169.254/` devolve credenciais em qualquer nuvem. `src/lib/net/safe-fetch.ts` resolve o DNS e confere cada endereço contra as faixas privadas e reservadas, revalida a cada salto de redirecionamento, e limita tempo e bytes.

A arte fica no **card**, não na mídia: `media` é registro compartilhado por todos os cards do mesmo título, e a imagem que uma pessoa anexou não pode vazar para o card de outra.

### Contraste, medido em vez de estimado

A paleta do arquivo de design reprovava onde mais importava: o cinza mais escuro ficava em **2,96:1** sobre o preto, e os intermediários entre 3,7 e 4,3:1 — todos usados em texto de **9px**, que é o oposto de "texto grande". A escala em `globals.css` foi recalculada para **4,5:1 no pior caso**, nos dois temas.

O card **não** muda com o tema. Ele é o artefato compartilhável, e a chapa escura com moldura por raridade é a identidade do produto — as cores dele vivem em `src/lib/design.ts`.

A landing do card segue só `prefers-color-scheme`, sem botão e sem script: o script que evita o flash de tema entraria no `<head>` antes das tags `og:`, que é exatamente o que quebra o preview do WhatsApp. Flash de tema é cosmético; preview quebrado é fatal.

### Pôsteres da base

Nunca referenciados direto da CDN de terceiro: quebram quando a URL muda e vazam o referrer. Tudo passa por `/api/artwork`, com allowlist de hosts — sem ela o endpoint seria um SSRF aberto.

## APIs e licenciamento

O TMDB é gratuito para uso **não comercial**, com atribuição, e limita o cache a 6 meses — o código respeita os três. Comercializar exige acordo escrito com eles.

O levantamento completo das quatro APIs, o que falta para ir ao ar e o risco de direito autoral sobre os pôsteres estão em [docs/APIS-E-LICENCIAMENTO.md](docs/APIS-E-LICENCIAMENTO.md).

## O que **não** está construído

Escopo é disciplina, e a especificação é explícita sobre o que dilui o produto. Ficou de fora de propósito:

- **Contas e login.** Os `claim_token` já são gerados e guardados; falta a tela de reivindicação.
- **Jogos, livros e álbuns.** A interface `MediaProvider` já isola isso, e `DEFAULT_AXES` já tem os eixos das quatro categorias. Falta um provider por fonte.
- **Eixos editáveis.** Hoje são os seis padrão da categoria. O modelo de dados (`stats` como `jsonb` com `key`/`label`/`weight`) já suporta.
- **Sticker 18:25 e feed 4:5.** A matriz em `src/lib/formats.ts` é o único lugar a tocar.
- **App nativo para Stories direto.** Fora do navegador por definição. É decisão de v2, com o dado do MVP na mão.
- **Perfil público e import de CSV.** v1.

## Decisões da especificação que este código já tomou

Três das seis decisões em aberto (§12) foram resolvidas pelo caminho, porque bloqueavam o código:

1. **Nome:** `eu avaliei!`, tirado do arquivo de design.
2. **Escala:** 0–10 com uma decimal é o padrão. O domínio interno é sempre 0–10; 0–100 é conversão de apresentação na borda (`src/lib/scale.ts`), então trocar o padrão é mudar um default, não uma migração.
3. **Fronteira de escopo:** a landing do card é uma página de artefato, não um perfil. Não há feed, seguidores nem timeline.

Continuam abertas, e não bloqueiam nada: app nativo, monetização e licença do projeto.

## Checklist de release

`npm run check:share` cobre 14 verificações mecânicas: peso e tipo do `og:image`, ordem das tags no `<head>`, ausência de inline antes delas, URL absoluta, cache imutável e o incremento de versão.

O resto continua manual, em aparelho real, todo release — e não há atalho:

- [ ] enviar o link numa conversa de WhatsApp de verdade e olhar o preview
- [ ] abrir a share sheet num iPhone e num Android
- [ ] olhar o card reduzido a 300px e julgar se ainda está legível
- [ ] conferir as áreas seguras do 9:16 num Story de verdade

## Mapa do código

```
src/lib/design.ts        tokens da identidade visual, oklch já convertido
src/lib/formats.ts       matriz de formatos; base tem a proporção exata do destino
src/lib/render/card.tsx  o card em JSX para Satori, quatro variantes
src/lib/render/index.ts  satori → resvg → sharp, com o orçamento de bytes
src/lib/share.ts         a cascata de compartilhamento, com as armadilhas do iOS
src/lib/store/           interface de persistência + implementação em arquivo
src/app/(app)/           editor
src/app/(card)/          landing do card, root layout próprio de <head> mínimo
src/app/api/             render, preview, busca, cards, eventos, proxy de arte
db/schema.sql            schema Postgres de destino
src/lib/net/safe-fetch.ts  busca de URL do usuário, com proteção contra SSRF
src/lib/uploads.ts       arte própria: reencode, EXIF descartado, dedupe por hash
docs/                    licenciamento das APIs, formulário do TMDB, ida ao ar
Dockerfile               build multi-stage; fontes baixadas dentro da imagem
```

O bundle de design original fica em `eu-avaliei-formul-rio-de-design/` e é a referência visual — os protótipos, não o código de produção.
