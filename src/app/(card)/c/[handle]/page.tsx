import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { FORMATS, FORMAT_IDS } from '@/lib/formats';
import { formatScore } from '@/lib/scale';
import { attributionFor, refreshIfStale } from '@/lib/media';
import { siteOrigin } from '@/lib/site';
import { store } from '@/lib/store';
import { levelFor } from '@/lib/design';
import type { CardWithMedia } from '@/lib/types';
import { ViewBeacon } from './ViewBeacon';

/**
 * Landing do card — o motor de aquisição (spec §3.3, camada 5).
 *
 * Cada card compartilhado é um anúncio com link, e o que faz o link virar
 * imagem no WhatsApp e no X é esta página. Ela é renderizada no servidor
 * porque crawlers não executam JavaScript.
 */

export const dynamic = 'force-dynamic';

/** `{slug}-v{n}` → slug e versão. Sem versão, a página redireciona para a atual. */
function parseHandle(handle: string): { slug: string; version: number | null } {
  const match = handle.match(/^(.*)-v(\d+)$/);
  return match
    ? { slug: match[1], version: Number(match[2]) }
    : { slug: handle, version: null };
}

async function load(handle: string): Promise<CardWithMedia | null> {
  const { slug } = parseHandle(handle);
  const card = await store.getCardBySlug(slug);
  if (!card) return null;
  // Os termos do TMDB limitam o cache a 6 meses. Revalidar na leitura mantém
  // a licença em dia sem precisar de job agendado.
  return { ...card, media: await refreshIfStale(card.media) };
}

function ogImageUrl(origin: string, card: CardWithMedia): string {
  return `${origin}/api/render/${card.slug}.jpg?format=og&v=${card.renderVersion}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const card = await load(handle);
  if (!card) return { title: 'Card não encontrado · eu avaliei!' };

  const origin = await siteOrigin();
  const nota = formatScore(card.overall);
  // O preview do link também começa pela marca: é a primeira coisa lida em
  // qualquer conversa onde o card for colado.
  const title = `Eu avaliei: ${card.media.title} — ${nota}`;
  const description = card.caption
    ? `${card.caption} · Faça a sua avaliação também.`
    : `${levelFor(card.overall).label} · Faça a sua avaliação também.`;
  const image = ogImageUrl(origin, card);
  const canonical = `${origin}/c/${card.slug}-v${card.renderVersion}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'website',
      url: canonical,
      title,
      description,
      siteName: 'eu avaliei!',
      locale: 'pt_BR',
      // JPEG, 1200×630, abaixo de 250 KB — o encoder garante o teto.
      images: [{ url: image, width: 1200, height: 630, type: 'image/jpeg' }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

export default async function CardPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const { version } = parseHandle(handle);
  const card = await load(handle);
  if (!card) notFound();

  // A URL canônica sempre carrega a versão. É ela que muda quando o card é
  // editado, e é a única forma de fazer o WhatsApp buscar o preview de novo.
  if (version !== card.renderVersion) {
    permanentRedirect(`/c/${card.slug}-v${card.renderVersion}`);
  }

  const nota = formatScore(card.overall);
  const level = levelFor(card.overall);
  const subtitle = [card.media.creator, card.media.year].filter(Boolean).join(' · ');
  // Com arte própria do usuário, a atribuição da fonte externa não se aplica
  // à imagem — mas os metadados ainda vieram de lá, então ela permanece.
  const attribution = attributionFor(card.media.source);
  const shot = `/api/render/${card.slug}.png?format=story&v=${card.renderVersion}`;

  return (
    <div className="page">
      <ViewBeacon slug={card.slug} />

      <div className="top">
        <a className="wordmark" href="/">
          Eu avaliei!
        </a>
        <span className="meta">{level.label}</span>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="cardShot"
        src={shot}
        width={FORMATS.story.width}
        height={FORMATS.story.height}
        alt={`Card de ${card.media.title}, nota ${nota}`}
      />

      <div>
        <h1 className="title">
          <span className="eyebrow">Eu avaliei:</span>
          {card.media.title} — {nota}
        </h1>
        <p className="subtitle">{subtitle}</p>
      </div>

      <a className="cta" href="/">
        FAZER A MINHA AVALIAÇÃO
      </a>

      <div className="section">
        <span className="label">BAIXAR</span>
        <div className="downloads">
          {FORMAT_IDS.map((id) => {
            const spec = FORMATS[id];
            return (
              <a
                key={id}
                className="download"
                href={`/api/render/${card.slug}.${spec.ext}?format=${id}&v=${card.renderVersion}`}
                download={`${card.slug}-${id}.${spec.ext}`}
              >
                {spec.width}×{spec.height} · {spec.ext.toUpperCase()}
              </a>
            );
          })}
        </div>
      </div>

      <div className="foot">
        <p className="note">
          {card.caption ? `“${card.caption}”` : null}
          {card.caption ? <br /> : null}
          {/* Texto exigido pelos termos de uso do TMDB, palavra por palavra —
              não pode ser reescrito nem abreviado. */}
          {attribution ? (
            <>
              {attribution}
              <br />
            </>
          ) : null}
          DESENVOLVIDO POR FZ
        </p>
      </div>
    </div>
  );
}
