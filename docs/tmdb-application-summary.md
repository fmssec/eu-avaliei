# Formulário de solicitação da API do TMDB

Texto pronto para colar em <https://www.themoviedb.org/settings/api/request>.

O formulário é lido por uma pessoa. Pedidos vagos ("um app de filmes") são recusados ou ficam parados. O texto abaixo é específico sobre o que o app faz, quanto chama a API e como cumpre os termos — que é exatamente o que eles querem confirmar.

**Escreva em inglês.** O time do TMDB é americano.

---

## Campos curtos

| Campo | Valor |
|---|---|
| **Type of Use** | `Personal` — enquanto não houver receita. No momento em que houver, é obrigatório trocar para o licenciamento comercial. |
| **Application Name** | `eu avaliei!` |
| **Application URL** | O domínio real em HTTPS. **Não** deixe em branco nem coloque `localhost`. |

---

## Application Summary

> eu avaliei! is a free, non-commercial web app that turns a personal media rating into a shareable image. A user searches for a film or series, gives it an overall score from 0 to 10 plus up to six sub-scores (writing, acting, directing, score, visuals, pacing), picks a frame style, and gets back a ready-to-post image in several formats: 1080x1920 for Instagram Stories and WhatsApp Status, 1080x1080 for square feeds, and 1200x630 for link previews.
>
> There are dozens of media trackers already, and I am not building another one. There is no feed, no followers, no timeline, and no watchlist. The single output of the product is the image. The problem it solves is that sharing a rating today means an ugly screenshot.
>
> How the app uses the TMDB API: a debounced /search/multi call as the user types, and one /movie/{id} or /tv/{id} call plus a credits lookup when they pick a result, to get the director or creator. That is all. Results are normalized into my own schema and cached, so a title that has already been looked up is not requested again. There is no bulk download, no mirroring of the database, and no attempt to expose TMDB data through an API of my own.
>
> Poster images are served through my own proxy with a host allowlist rather than being hotlinked, so I do not use TMDB as an image host and no referrer leaks to your CDN. Users can also attach their own image or a link instead of using the TMDB poster, which many do for short films and festival titles that are not in the database.
>
> Compliance with the API Terms of Use is built into the code rather than left as a policy note. Cached metadata expires after 150 days and is revalidated on read, so nothing is retained beyond the 6-month limit. The required attribution notice ("This site uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB") is displayed on every card page, alongside the TMDB logo.
>
> The app is free, has no ads, no paid tier, and no revenue of any kind. If that ever changes, I will contact you for a commercial license before monetizing.

---

## Antes de enviar

- [ ] O domínio precisa estar **no ar e em HTTPS**. Formulário com URL que não abre costuma ser recusado.
- [ ] O aviso de atribuição já aparece na landing do card — implementado em `attributionFor()`.
- [ ] **Falta o logo do TMDB.** Os termos exigem, e o texto acima afirma que ele está lá. Coloque antes de enviar, senão a solicitação afirma algo que não é verdade.
- [ ] O teto de cache de 150 dias já está no código (`MEDIA_CACHE_MAX_AGE_DAYS`).

## Se a resposta demorar

O `Type of Use: Personal` costuma ser aprovado rápido, às vezes na hora. Se travar, o canal é o fórum de suporte deles ou `sales@themoviedb.org` — e o segundo só faz sentido quando a conversa já for sobre licença comercial.

Ver [APIS-E-LICENCIAMENTO.md](APIS-E-LICENCIAMENTO.md) para o que muda quando houver receita.
