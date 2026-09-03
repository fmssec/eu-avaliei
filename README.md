# Eu avaliei!

Avalie um filme, série, jogo ou livro e receba **uma imagem pronta para postar**. Sem login, sem cadastro, em menos de 30 segundos.

O produto não é um tracker nem um catálogo. Existem dezenas de trackers de mídia, e eles resolvem bem o problema de registrar o que você consumiu. O que ninguém resolve é a outra metade: transformar uma nota numa imagem que fique boa em Story do Instagram, em grupo de WhatsApp e em post no X — cada um com formato, peso e enquadramento próprios. Hoje isso é print de tela, e print de tela é feio.

**Toda decisão de arquitetura aqui responde a isso.**

---

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

Abre em `http://localhost:3000`. Funciona imediatamente, sem nenhuma chave de API — a busca cai num provedor de exemplo com cinco títulos.

`npm run fonts` baixa as seis fontes do design em TTF para `public/fonts/`. **Ele precisa rodar antes do primeiro render:** o Satori não lê `woff2`, e sem os arquivos o endpoint de render falha com uma mensagem dizendo isso. As fontes ficam fora do git, então em CI e em deploy este passo entra antes do build.

### Com dados reais

Copie `.env.example` para `.env.local` e preencha o que quiser usar. Cada fonte é independente: sem chave, aquela categoria simplesmente não aparece na busca.

| Categoria | Fonte | O que precisa |
|---|---|---|
| Livros | [Open Library](https://openlibrary.org/developers/api) | **nada** — já funciona |
| Filmes e séries | [TMDB](https://developer.themoviedb.org) | `TMDB_API_KEY` (token v4) e `MEDIA_PROVIDER=tmdb` |
| Jogos | [IGDB](https://api-docs.igdb.com/) | `TWITCH_CLIENT_ID` e `TWITCH_CLIENT_SECRET` |

### Com Docker

```bash
docker compose up --build
```

Não precisa de `npm install` nem de `npm run fonts` na máquina: as duas coisas acontecem dentro da imagem. Ela lê o mesmo `.env.local`.

### Verificar o que quebra em silêncio

```bash
npm run check:share -- http://localhost:3000
```

Confere peso das imagens contra o teto de cada destino, ordem das meta tags no `<head>`, e se a busca responde. São as coisas que estragam o compartilhamento sem dar erro nenhum.

---

## O que ele faz

- **Busca federada** num campo só, sem escolher categoria antes. Filmes, séries, livros e jogos vêm misturados e ranqueados por relevância.
- **Nota geral de 0 a 10** mais seis eixos por categoria, editáveis, em dois modos: média dos eixos ou nota independente.
- **Moldura pela nota**: cinco faixas de raridade, de Comum a Especial, cada uma com tratamento visual próprio.
- **Arte própria**: anexe um arquivo ou cole um link no lugar da capa da base.
- **Quatro formatos**: Story 1080×1920, quadrado 1080×1080, preview de link 1200×630 e X 1600×900.
- **Histórico no aparelho**, com exportar e importar.
- **Tema claro e escuro**, mais um terceiro estado que segue o sistema.

---

## As decisões que importam

### Um renderizador só, no servidor

`satori` compõe o card em SVG, `resvg` rasteriza, `sharp` encoda. O preview do editor **é** esse renderizador: a `<img>` aponta para `/api/preview` com os mesmos parâmetros do arquivo final. Não existe uma reprodução em DOM que precise ser mantida em sincronia — o que você vê editando é literalmente o que você compartilha.

### Nada é guardado no servidor

O card existe enquanto está sendo feito e vira a imagem que você leva embora. As avaliações ficam no **IndexedDB do seu navegador**, não numa conta nossa.

Isso saiu de uma pergunta boa: por que o card precisaria existir entre requisições? A resposta era "porque a página por card e o preview de link são requisições de outras pessoas, depois" — verdadeira, mas descrevendo uma escolha, não uma necessidade. E a escolha custava caro: exigia disco persistente, o que elimina praticamente toda hospedagem gratuita.

Medimos a alternativa de levar o card na URL: **48 caracteres contra 392 a 493**. Link de 400 caracteres em conversa parece spam, e o link é o produto. Então o link de compartilhamento aponta para o site, e a imagem viaja como arquivo.

O que muda na prática:

| Caminho | Resultado |
|---|---|
| Share sheet com arquivo (celular) | a imagem chega inteira — é o caminho principal |
| Baixar / copiar | a imagem chega inteira |
| Deep link (desktop) | texto + link do site; a imagem vai anexada à mão |

### O subset de CSS do Satori

O card foi desenhado em HTML/CSS e portado para o Satori, que aceita só um subconjunto. Quatro adaptações forçadas, documentadas em `src/lib/render/card.tsx`:

| Design | Satori | Solução |
|---|---|---|
| `display: grid` | não existe | flex-wrap com largura de coluna calculada |
| cores em `oklch()` | não interpretadas | convertidas para hex em `src/lib/design.ts` |
| `text-wrap: balance` | não existe | removido |
| `bottom` em absoluto dentro de fragmento | não resolve | posicionar por `top` calculado |

Três armadilhas a mais, cada uma com meia hora de depuração atrás: o Satori **quebra** em chaves de estilo com valor `undefined`; ele trata `texto {expressão}` como dois nós filhos, exigindo `display: flex` no pai; e um degradê com `position: absolute` e `bottom: 0` dentro de um fragmento **não pinta** — sem erro, sem aviso.

Quando um estilo não faz efeito no Satori, medir o pixel é mais rápido que reler o CSS.

### O problema do WhatsApp

É o destino mais restritivo e é onde estava a dor original:

- **Teto de bytes por formato.** A matriz da spec diz "PNG ou JPEG" de propósito: PNG enquanto couber, porque mantém texto pequeno mais nítido, e JPEG quando a arte fotográfica não deixa. Um card com key art em sangria total passa de 2,5 MB em PNG no 1080×1920 — acima do limite de 2 MB do Story; o mesmo card sai em 228 KB de JPEG.
- **`<head>` enxuto.** O parser de preview lê só os primeiros KB. As fontes usam `preload: false` porque os nove `<link rel="preload">` do `next/font` empurravam o `og:image` para o byte 3141; sem eles, 2481.
- **Metadata bloqueante para crawlers.** O Next 15 faz streaming de metadata por padrão — para um navegador é indiferente, para um crawler é o preview morto. `htmlLimitedBots` no `next.config.mjs` lista explicitamente quem recebe a resposta bloqueante.

### A ativação transitória do iOS

`navigator.share()` exige ativação transitória, e no iOS um `await` dentro do handler de clique a invalida. Se o arquivo fosse gerado ao clicar, a chamada seria rejeitada.

Por isso o render dispara quando a pessoa entra na personalização, e o clique em compartilhar só consome o que já está pronto — **sem nenhum `await` antes**. O feature-detect é `navigator.canShare({ files })`, nunca `navigator.share`, e o `share()` vai com `files` sozinho, sem `title` nem `text`.

### Resolução do preview

Os previews de tela são rasterizados na largura em CSS × densidade da tela, e saem em JPEG. O arquivo compartilhado nunca passa por isso — vem em tamanho e formato originais.

A conta importa: servir menos pixels do que a tela usa borra o texto pequeno e transforma uma borda de 1px numa faixa visível. Servir demais custa 1,8 MB para mostrar uma imagem de 400px.

### Contraste medido, não estimado

A paleta original reprovava onde mais importava: o cinza mais escuro ficava em **2,96:1** sobre o preto, e os intermediários entre 3,7 e 4,3:1 — todos usados em texto de **9px**, o oposto de "texto grande". A escala em `globals.css` foi recalculada para **4,5:1 no pior caso**, nos dois temas.

O card **não** muda com o tema: ele é o artefato compartilhável, e a chapa escura com moldura por raridade é a identidade do produto.

### Arte enviada pelo usuário

Arquivo e link terminam no mesmo lugar: o servidor reprocessa a imagem e devolve uma URL própria. Reencodar não é só normalizar tamanho — descarta EXIF, que carrega geolocalização, e garante que o que servimos é imagem de verdade, não um arquivo com extensão de imagem.

Buscar um link **no servidor** significa aceitar uma URL arbitrária, que é um SSRF esperando acontecer: `http://169.254.169.254/` devolve credenciais em qualquer nuvem. `src/lib/net/safe-fetch.ts` resolve o DNS e confere cada endereço contra as faixas privadas e reservadas, revalida a cada redirecionamento, e limita tempo e bytes.

---

## Licenciamento das APIs

O TMDB é gratuito para uso **não comercial**, exige atribuição e limita o cache a 6 meses — o código respeita os três. O levantamento completo das quatro fontes, o risco de direito autoral sobre as capas e o que muda se houver receita estão em [docs/APIS-E-LICENCIAMENTO.md](docs/APIS-E-LICENCIAMENTO.md).

**Capas e pôsteres são obra de terceiros**, e nenhuma API pode licenciar direito que ela própria não tem. É por isso que anexar a própria imagem existe, e por isso nenhuma arte de terceiro está versionada neste repositório.

---

## Mapa do código

```
src/lib/design.ts          tokens visuais, oklch já convertido para hex
src/lib/formats.ts         matriz de formatos; a base tem a proporção exata do destino
src/lib/render/card.tsx    o card em JSX para o Satori, quatro variantes
src/lib/render/index.ts    satori → resvg → sharp, com o orçamento de bytes
src/lib/media/             busca federada por fonte + ranqueamento por relevância
src/lib/share.ts           a cascata de compartilhamento, com as armadilhas do iOS
src/lib/net/safe-fetch.ts  busca de URL do usuário, com proteção contra SSRF
src/lib/client/history.ts  histórico no IndexedDB do aparelho
src/app/api/               render, preview, busca, uploads, eventos, proxy de arte
docs/                      licenciamento das APIs e o que falta para ir ao ar
```

O bundle de design original fica em `eu-avaliei-formul-rio-de-design/` — são os protótipos em HTML/CSS que serviram de referência visual, não código de produção.

---

## Licença

[MIT](LICENSE). Desenvolvido por Fz.
