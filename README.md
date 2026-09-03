# Eu avaliei!

Avalie um filme, série, jogo ou livro e receba **uma imagem pronta para postar**. Sem login, sem cadastro, em menos de 30 segundos.

Cada avaliação também entra no seu catálogo pessoal — sem conta, sem servidor: fica guardado no seu navegador, neste aparelho. Não é rede social: sem perfil público, sem feed, sem seguidores. O catálogo é seu; a imagem é o que você compartilha.

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

Abre em `http://localhost:3000` e funciona sem nenhuma chave de API.

`npm run fonts` baixa as fontes em TTF para `public/fonts/` — o Satori não lê `woff2`, e elas ficam fora do git. O `npm run build` já faz isso sozinho, então em CI e deploy não há passo extra; rodar à parte só serve para o `npm run dev`.

### Com dados reais

Copie `.env.example` para `.env.local`. Cada fonte é independente — sem a chave, aquela categoria não aparece na busca.

| Categoria | Fonte | Precisa de |
|---|---|---|
| Livros | [Open Library](https://openlibrary.org/developers/api) | nada |
| Filmes e séries | [TMDB](https://developer.themoviedb.org) | `TMDB_API_KEY` e `MEDIA_PROVIDER=tmdb` |
| Jogos | [IGDB](https://api-docs.igdb.com/) | `TWITCH_CLIENT_ID` e `TWITCH_CLIENT_SECRET` |

### Com Docker

```bash
docker compose up --build
```

Instala dependências e baixa as fontes dentro da imagem. Lê o mesmo `.env.local`.

O site publicado também traz essas instruções em `/sobre` — quem chega pelo card compartilhado encontra o caminho para rodar a própria instância sem precisar ir ao GitHub.

### Publicar no Render

O repositório traz um [`render.yaml`](render.yaml): no painel do Render, **New → Blueprint**, aponte para o repositório e ele cria o serviço configurado. Só as chaves de API precisam ser digitadas — elas não vivem no git.

Duas coisas que valem saber:

- `NEXT_PUBLIC_SITE_URL` precisa existir no **build**, não só em runtime: a home é estática e a URL absoluta do `og:image` é fixada ali. O Render passa as variáveis do serviço como build args do Docker; trocar o valor exige um novo deploy.
- O plano gratuito hiberna após 15 minutos parado, e o primeiro visitante espera o container subir. Um ping a cada 10 minutos evita isso e cabe nas 750 horas mensais do plano.

### Verificar antes de publicar

```bash
npm run check:share -- http://localhost:3000
```

Confere peso de cada formato contra o teto do destino, ordem das meta tags no `<head>` e resposta da busca — o que estraga o compartilhamento sem gerar erro.

---

## O que faz

- **Busca federada** num campo só. Filmes, séries, livros e jogos misturados, ordenados por relevância.
- **Nota de 0 a 10** e seis eixos por categoria, em dois modos: média dos eixos ou nota independente.
- **Moldura pela nota**: cinco faixas de raridade, de Comum a Especial.
- **Arte própria**: anexar arquivo ou colar link no lugar da capa da base.
- **Quatro formatos**: Story 1080×1920, quadrado 1080×1080, preview de link 1200×630, X 1600×900.
- **Catálogo pessoal no aparelho**, com filtro por categoria, ordenação por nota e exportar/importar.
- **Tema claro e escuro**, mais o modo que segue o sistema.

---

## Como funciona

### Um renderizador, no servidor

`satori` compõe o card em SVG, `resvg` rasteriza, `sharp` encoda.

O preview do editor **é** esse renderizador: a `<img>` aponta para `/api/preview` com os mesmos parâmetros do arquivo final. Não existe uma segunda implementação em DOM para divergir — o que você vê editando é o que você compartilha.

### Nada é guardado no servidor

O card existe durante a criação e vira a imagem que você leva. O que fica depois é o seu catálogo — título, nota, eixos e a arte, no **IndexedDB do seu navegador**, com filtro por categoria e ordenação por nota.

Consequência: o link de compartilhamento aponta para o site, não para uma página por card. Pelo caminho principal — a share sheet do celular — a imagem viaja como arquivo e chega inteira. Pelos deep links de desktop, que só aceitam texto, a imagem é anexada à mão com os botões de copiar ou baixar.

### Orçamento de bytes por formato

Cada destino tem um teto, e a matriz da spec diz "PNG ou JPEG" de propósito: PNG enquanto couber, porque mantém texto pequeno mais nítido; JPEG quando a arte fotográfica não deixa. O encoder desce a escada de qualidade até caber e avisa no log se não conseguir.

| Formato | Teto |
|---|---|
| Story e quadrado | 2 MB |
| Preview de link | 250 KB |
| X | 5 MB |

### Preview na densidade da tela

Os previews são rasterizados na largura em CSS × densidade da tela, em JPEG. O arquivo compartilhado nunca passa por isso — sai em tamanho e formato originais.

Pedir menos pixels do que a tela usa borra o texto pequeno e transforma bordas de 1px em faixas visíveis; pedir demais custa megabytes para mostrar uma imagem de 400px.

### Compartilhamento

`navigator.share()` exige ativação transitória, e no iOS um `await` dentro do handler de clique a invalida. Por isso o arquivo é gerado quando a pessoa entra na personalização, e o clique só consome o que já está pronto.

O feature-detect é `navigator.canShare({ files })`, nunca `navigator.share` — o suporte a arquivos é separado. E o `share()` vai com `files` sozinho: no iOS, mandar `title` ou `text` junto faz o sistema descartar a imagem.

### Preview de link

O parser do WhatsApp lê só os primeiros KB do `<head>`, e o Next faz streaming de metadata por padrão — o que para um crawler significa preview vazio. `htmlLimitedBots` no `next.config.mjs` lista quem recebe resposta bloqueante, e as fontes usam `preload: false` para não empurrar as tags `og:` para baixo.

### Arte enviada pelo usuário

Arquivo e link convergem no mesmo endpoint: o servidor reprocessa a imagem e devolve URL própria. Reencodar descarta EXIF, que carrega geolocalização, e garante que o servido é imagem de verdade.

Buscar um link no servidor é aceitar URL arbitrária, o que é um SSRF esperando acontecer — `http://169.254.169.254/` devolve credenciais em qualquer nuvem. [`safe-fetch.ts`](src/lib/net/safe-fetch.ts) resolve o DNS, confere cada endereço contra faixas privadas e reservadas, revalida a cada redirecionamento e limita tempo e bytes.

### Restrições do Satori

O card foi desenhado em HTML/CSS e portado para o Satori, que aceita um subconjunto. O que não existe lá e como foi resolvido está em [`card.tsx`](src/lib/render/card.tsx): sem `display: grid`, sem `oklch()`, sem `text-wrap: balance`, e `bottom` não resolve dentro de fragmento.

### Contraste

A escala em `globals.css` tem 4,5:1 no pior caso, nos dois temas — os tons são usados em texto de 9px, onde o critério de "texto grande" não vale.

O card não muda com o tema: ele é o artefato compartilhável, e a chapa escura com moldura por raridade é a identidade do produto.

---

## Licenciamento das APIs

O TMDB é gratuito para uso **não comercial**, exige atribuição e limita o cache a 6 meses — o código respeita os três. Detalhes das quatro fontes e o que muda se houver receita em [docs/APIS-E-LICENCIAMENTO.md](docs/APIS-E-LICENCIAMENTO.md).

Capas e pôsteres são obra de terceiros, e nenhuma API licencia direito que não tem. É por isso que anexar a própria imagem existe, e por isso nenhuma arte de terceiro está versionada aqui.

---

## Mapa do código

```
src/lib/design.ts          tokens visuais, oklch convertido para hex
src/lib/formats.ts         matriz de formatos e tetos de bytes
src/lib/render/card.tsx    o card em JSX para o Satori, quatro variantes
src/lib/render/index.ts    satori → resvg → sharp
src/lib/media/             busca federada e ranqueamento por relevância
src/lib/share.ts           a cascata de compartilhamento
src/lib/net/safe-fetch.ts  busca de URL do usuário, protegida contra SSRF
src/lib/client/history.ts  catálogo pessoal no IndexedDB
src/lib/categories.ts      rótulos de categoria compartilhados
src/app/api/               preview, busca, uploads, eventos, proxy de arte
```

`eu-avaliei-formul-rio-de-design/` são os protótipos em HTML/CSS que serviram de referência visual, não código de produção.

---

## Licença

[MIT](LICENSE). Desenvolvido por Fz.
