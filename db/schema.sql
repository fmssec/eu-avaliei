-- Schema do "eu avaliei!" (spec §6).
--
-- O MVP roda com o store em arquivo (src/lib/store/file.ts) para não exigir
-- infra. Este schema é o destino: quando o Postgres entrar, basta uma segunda
-- implementação da interface `Store` — nada acima daquela camada muda.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Cache de mídia externa, normalizado. A mídia é buscada uma vez na API de
-- origem e nunca mais: reduz custo, latência e dependência (spec §5).
CREATE TABLE media (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source          text NOT NULL CHECK (source IN ('tmdb','igdb','openlibrary','musicbrainz','mock')),
  external_id     text NOT NULL,
  category        text NOT NULL CHECK (category IN ('movie','series','game','book','album')),
  title           text NOT NULL,
  original_title  text,
  year            int,
  creator         text NOT NULL DEFAULT '',
  -- URL no nosso proxy, nunca a CDN de terceiro: ela quebra e vaza referrer.
  artwork_url     text,
  raw             jsonb,
  fetched_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handle        text UNIQUE NOT NULL,
  display_name  text,
  avatar_url    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cards (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text UNIQUE NOT NULL,
  -- NULL = anônimo. Criar card não exige login, por regra de produto.
  user_id         uuid REFERENCES users(id) ON DELETE SET NULL,
  -- Permite reivindicar um card anônimo depois. Vive no localStorage de quem criou.
  claim_token     text,
  media_id        uuid NOT NULL REFERENCES media(id) ON DELETE RESTRICT,
  overall         numeric(3,1) NOT NULL CHECK (overall >= 0 AND overall <= 10),
  overall_mode    text NOT NULL CHECK (overall_mode IN ('computed','manual')),
  -- [{ key, label, value }]
  stats           jsonb NOT NULL DEFAULT '[]'::jsonb,
  frame_id        text NOT NULL DEFAULT 'ficha',
  theme_id        text NOT NULL DEFAULT 'default',
  caption         text NOT NULL DEFAULT '',
  -- Arte própria do usuário (/api/uploads/{id}.jpg). Fica no card e não na
  -- mídia de propósito: `media` é um registro compartilhado por todos os cards
  -- do mesmo título, e a imagem que uma pessoa anexou não pode vazar para o
  -- card de outra. NULL = usa media.artwork_url.
  artwork_url     text,
  author_handle   text,
  -- Derivada de overall, materializada para permitir query por raridade.
  rarity          text NOT NULL CHECK (rarity IN ('comum','bronze','prata','ouro','especial')),
  -- Toda edição incrementa. A URL canônica carrega a versão, e é isso que
  -- fura o cache de 72h+ do WhatsApp (spec §3.2).
  render_version  int NOT NULL DEFAULT 1,
  is_public       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cards_user_created_idx ON cards (user_id, created_at DESC);
CREATE INDEX cards_rarity_idx ON cards (rarity);

-- Instrumentação da tese: onde os cards realmente vão parar.
--
-- Não é opcional. É o único jeito de responder se a tese está certa: dos cards
-- criados, quantos são efetivamente compartilhados, por qual canal, e quantos
-- cliques de volta cada canal gera. O critério de sucesso do MVP (criado →
-- compartilhado acima de 40%, e 0,3 clique de volta por card) só é verificável
-- com esta tabela populada desde o dia zero.
CREATE TABLE card_events (
  id          bigserial PRIMARY KEY,
  card_id     uuid NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  event       text NOT NULL CHECK (event IN ('created','rendered','shared','viewed','converted')),
  channel     text CHECK (channel IN ('webshare','whatsapp','x','telegram','clipboard','download','og')),
  format      text,
  referrer    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX card_events_card_idx ON card_events (card_id, created_at DESC);
CREATE INDEX card_events_funnel_idx ON card_events (event, channel, created_at DESC);

CREATE TABLE frames (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  family      text NOT NULL,
  -- Gating por raridade: NULL = disponível em qualquer nota.
  min_rarity  text CHECK (min_rarity IN ('comum','bronze','prata','ouro','especial')),
  is_premium  boolean NOT NULL DEFAULT false,
  -- Caminhos dos SVG/PNG por nível de raridade. Ornamentos elaborados são
  -- assets pré-produzidos, compostos em camada — o Satori não os desenha em
  -- CSS, porque o subset dele não dá conta (spec §4.2).
  assets      jsonb NOT NULL DEFAULT '{}'::jsonb
);

INSERT INTO frames (id, name, family, min_rarity, is_premium) VALUES
  ('ficha', 'Ficha', 'ficha', NULL, false),
  ('poster', 'Pôster', 'poster', NULL, false);

-- O funil que responde a tese, pronto para rodar.
CREATE VIEW card_funnel AS
SELECT
  count(*) FILTER (WHERE event = 'created')                      AS criados,
  count(DISTINCT card_id) FILTER (WHERE event = 'shared')        AS cards_compartilhados,
  count(*) FILTER (WHERE event = 'shared')                       AS compartilhamentos,
  count(*) FILTER (WHERE event = 'viewed')                       AS visitas_de_volta,
  round(
    count(DISTINCT card_id) FILTER (WHERE event = 'shared')::numeric
      / NULLIF(count(*) FILTER (WHERE event = 'created'), 0), 3
  )                                                              AS taxa_criado_para_compartilhado,
  round(
    count(*) FILTER (WHERE event = 'viewed')::numeric
      / NULLIF(count(*) FILTER (WHERE event = 'shared'), 0), 3
  )                                                              AS cliques_de_volta_por_share
FROM card_events;
