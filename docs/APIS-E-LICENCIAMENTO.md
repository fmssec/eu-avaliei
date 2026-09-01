# APIs, licenciamento e o que falta para ir ao ar

Levantamento feito em **31 de agosto de 2026**. Termos de uso mudam — reconfira nas fontes antes de assinar contrato ou faturar.

Isto é um resumo do que os termos dizem, não parecer jurídico. Onde há risco real, está marcado.

---

## 1. Resposta curta

| Pergunta | Resposta |
|---|---|
| Posso colocar na internet de graça? | **Sim.** TMDB é gratuita para uso não comercial, com atribuição. |
| Posso comercializar depois? | **Sim, mas não com a chave gratuita.** O TMDB exige acordo escrito e chave comercial. |
| Existe "fair use" se eu não cobrar? | **Não como você espera.** Não cobrar te mantém dentro dos *termos da API*. Não resolve o direito autoral dos pôsteres, e "fair use" é doutrina dos EUA — o Brasil funciona diferente. |
| O que mais preciso? | Domínio com HTTPS, chave do TMDB, Postgres no lugar do store em arquivo, atribuição visível e processo de remoção. |

---

## 2. TMDB — filmes e séries (o que o MVP usa)

Fonte: [API Terms of Use](https://www.themoviedb.org/api-terms-of-use)

### O que a licença gratuita permite

Uso **não comercial**, com atribuição. O texto é explícito:

> "The license in Paragraph 1.A above does not permit any commercial use of TMDB, the TMDB APIs, or TMDB Content."

### Obrigações que o código já cumpre

| Obrigação | Onde está implementada |
|---|---|
| Aviso textual exato | `attributionFor()` em `src/lib/media/index.ts`, exibido na landing do card |
| Cache de no máximo 6 meses | `MEDIA_CACHE_MAX_AGE_DAYS = 150` + `refreshIfStale()` |
| Não usar o TMDB como hospedagem de imagem | Pôsteres passam pelo nosso proxy com cache próprio |

O aviso exigido, palavra por palavra:

> "This [website, program, service, application, product] uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB."

**Ainda falta:** o logo do TMDB. Os termos exigem o logo, menos proeminente que a sua própria marca. Isso é um asset a colocar no rodapé — não está feito.

### O ponto de atenção que ninguém comenta

O cache "para sempre" que a especificação pedia **violaria os termos**. Por isso o limite de 150 dias com revalidação na leitura. Não é otimização: é condição da licença.

E este item merece leitura atenta antes de qualquer decisão comercial:

> "Make derivatives of the TMDB APIs or TMDB Content."

Compor um pôster dentro de um card gerado é, na leitura mais conservadora, criar um derivado. É o mecanismo central do produto. Ver §5.

### Comercializar

Processo: escrever para `sales@themoviedb.org` e assinar acordo. O TMDB **não publica preço** na [página de API for Business](https://www.themoviedb.org/api-for-business) — é "contact us".

Relatos de desenvolvedores em fóruns citam **US$ 149/mês** para empresas abaixo de US$ 1 mi de receita anual. **Trate como não confirmado** até receber a proposta deles por escrito.

---

## 3. Outras fontes, para quando o v1 abrir categorias

### IGDB — jogos
Fonte: [api-docs.igdb.com](https://api-docs.igdb.com/)

- Gratuita para uso **não comercial**, sob o Twitch Developer Services Agreement.
- Uso comercial **é possível** via parceria comercial — mais aberto que o TMDB nesse ponto.
- Limite: **4 requisições por segundo**, até 8 conexões abertas. O cache em base própria já resolve.

### MusicBrainz + Cover Art Archive — álbuns
Fonte: [About / Data License](https://musicbrainz.org/doc/About/Data_License)

Licença **dividida**, e a distinção importa:

- **Dados centrais:** CC0 — domínio público. Uso comercial livre, sem pedir licença.
- **Dados suplementares:** CC BY-NC-SA 3.0 — **não comercial**, com atribuição e obrigação de compartilhar derivados na mesma licença.

Sem limite de taxa no Cover Art Archive; a API do MusicBrainz pede 1 req/s. As capas em si continuam sendo obra das gravadoras (§5).

### Open Library — livros
Fonte: [openlibrary.org/developers/api](https://openlibrary.org/developers/api)

Dados em domínio público, código AGPLv3. Mas eles são explícitos sobre a intenção: as APIs **não são feitas para servir de backend comercial de alto tráfego**, e sim para projetos open source, ferramentas educacionais e uso de baixo volume.

Para volume comercial, o caminho é baixar o dump e servir da sua própria base — o que a licença permite.

---

## 4. O que falta para ir ao ar de fato

Em ordem de bloqueio:

1. **Domínio com HTTPS.** Não é opcional: o WhatsApp não busca `og:image` de página que não seja HTTPS. É o item que sozinho mata o canal principal.
2. **`NEXT_PUBLIC_SITE_URL`** apontando para o domínio real. O `og:image` precisa ser URL absoluta.
3. **Chave do TMDB** (gratuita) e `MEDIA_PROVIDER=tmdb`.
4. **Postgres no lugar do store em arquivo.** O `.data/db.json` é um processo só, sem backup e sem concorrência entre instâncias. Serve para validar a tese num container; não serve para tráfego real. O schema está pronto em `db/schema.sql` — falta uma segunda implementação de `Store`.
5. **Logo do TMDB no rodapé**, exigido pelos termos.
6. **E-mail de contato e processo de remoção.** Se um estúdio pedir a retirada de uma arte, precisa existir um caminho. Sem isso, a próxima carta não é um pedido.
7. **Hospedagem.** A imagem Docker está pronta: qualquer VPS com Docker serve. Vercel também roda, mas renderização de imagem é a variável de custo lá.

Não bloqueiam, mas valem antes de divulgar: rate limit no `/api/preview` (hoje qualquer um pode gerar render infinito e o custo é seu), e um painel para ler o funil de `card_events`.

---

## 5. O risco que nenhuma API resolve

**Os pôsteres e capas são de terceiros — dos estúdios e gravadoras, não do TMDB.**

Nenhuma API pode te licenciar direito que ela própria não tem. O TMDB serve a arte; quem detém o copyright é o estúdio. Trocar de API não muda isso.

Sobre "fair use": é doutrina do direito norte-americano, com quatro fatores e análise caso a caso. O Brasil **não tem cláusula geral equivalente** — a Lei 9.610/98 traz uma lista fechada de limitações (art. 46), bem mais estreita que o *fair use*. Não cobrar pesa a favor na análise, mas não torna o uso automaticamente lícito, nem lá nem aqui.

### O que reduz o risco de verdade

Aqui vale uma observação sobre o próprio design: **o card já funciona sem o pôster.** O que o diferencia é a tipografia, o OVR, os seis eixos e a moldura por raridade — a arte da mídia é um elemento, não o produto. Isso abre caminhos que não existiriam se o pôster fosse o centro:

- **Monetizar o que é seu.** Molduras premium, exportação em alta resolução, remoção da marca — o valor cobrado está no que você produziu, não na arte de terceiro.
- **Tornar o pôster opcional**, ou deixar o usuário subir a própria imagem.
- **Considerar uma variante tipográfica** como padrão do plano pago.

A especificação já dizia isto no §5, e continua valendo: **consulta jurídica antes de qualquer monetização direta sobre a imagem.** O parágrafo de "no derivatives" do TMDB é o que um advogado vai querer ler primeiro.

---

## Fontes

- [TMDB — API Terms of Use](https://www.themoviedb.org/api-terms-of-use)
- [TMDB — API for Business](https://www.themoviedb.org/api-for-business)
- [IGDB — API docs](https://api-docs.igdb.com/)
- [MusicBrainz — About / Data License](https://musicbrainz.org/doc/About/Data_License)
- [Cover Art Archive — API](https://musicbrainz.org/doc/Cover_Art_Archive/API)
- [Open Library — APIs](https://openlibrary.org/developers/api)
