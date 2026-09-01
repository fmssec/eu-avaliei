import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Card, CardEvent, CardWithMedia, Media } from '../types';
import { levelFor } from '../design';
import { normalizeFrameId } from '../types';
import { makeClaimToken, makeSlug, uuid } from '../ids';
import { roundScore } from '../scale';
import type { CardPatch, NewCard, NewEvent, Store } from './index';

/**
 * Persistência em arquivo, para o app rodar sem infra durante o MVP.
 *
 * O schema é o mesmo de db/schema.sql: quando o Postgres entrar, é só uma
 * segunda implementação de `Store` — nada acima desta camada muda.
 */

const DIR = join(process.cwd(), '.data');
const FILE = join(DIR, 'db.json');

interface Snapshot {
  media: Record<string, Media>;
  cards: Record<string, Card>;
  events: CardEvent[];
  nextEventId: number;
}

const EMPTY: Snapshot = { media: {}, cards: {}, events: [], nextEventId: 1 };

let cache: Snapshot | null = null;
/** Serializa as escritas: sem isso dois requests concorrentes se sobrescrevem. */
let queue: Promise<unknown> = Promise.resolve();

async function load(): Promise<Snapshot> {
  if (cache) return cache;
  try {
    cache = JSON.parse(await readFile(FILE, 'utf8')) as Snapshot;
  } catch {
    cache = structuredClone(EMPTY);
  }
  return cache;
}

async function flush(snap: Snapshot): Promise<void> {
  await mkdir(DIR, { recursive: true });
  // Escrita em temporário + rename: um crash no meio não corrompe o arquivo.
  const tmp = `${FILE}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(snap, null, 2), 'utf8');
  await rename(tmp, FILE);
}

function serialize<T>(fn: (snap: Snapshot) => Promise<T> | T): Promise<T> {
  const run = queue.then(async () => {
    const snap = await load();
    const result = await fn(snap);
    await flush(snap);
    return result;
  });
  // A fila não pode morrer por causa de uma falha isolada.
  queue = run.catch(() => undefined);
  return run;
}

function mediaKey(m: Media): string {
  return `${m.source}:${m.externalId}`;
}

export const fileStore: Store = {
  async upsertMedia(media) {
    return serialize((snap) => {
      const key = mediaKey(media);
      const existing = snap.media[key];
      const saved: Media = { ...media, id: existing?.id ?? media.id ?? uuid() };
      snap.media[key] = saved;
      return saved;
    });
  },

  async createCard(input) {
    return serialize((snap) => {
      const key = mediaKey(input.media);
      const media: Media = { ...input.media, id: snap.media[key]?.id ?? input.media.id ?? uuid() };
      snap.media[key] = media;

      const now = new Date().toISOString();
      const claimToken = makeClaimToken();
      const overall = roundScore(input.overall);

      let slug = makeSlug(input.media.title);
      while (snap.cards[slug]) slug = makeSlug(input.media.title);

      const card: Card = {
        id: uuid(),
        slug,
        userId: null,
        claimToken,
        mediaId: key,
        overall,
        overallMode: input.overallMode,
        stats: input.stats,
        frameId: input.frameId,
        themeId: input.themeId,
        caption: input.caption,
        artworkUrl: input.artworkUrl,
        rarity: levelFor(overall).id,
        renderVersion: 1,
        isPublic: true,
        authorHandle: input.authorHandle,
        createdAt: now,
        updatedAt: now,
      };
      snap.cards[slug] = card;

      snap.events.push({
        id: snap.nextEventId++,
        cardId: card.id,
        event: 'created',
        channel: null,
        format: null,
        referrer: null,
        createdAt: now,
      });

      return { card, claimToken };
    });
  },

  async getCardBySlug(slug) {
    const snap = await load();
    const card = snap.cards[slug];
    if (!card) return null;
    const media = snap.media[card.mediaId];
    if (!media) return null;
    // Cards criados antes da renomeação ainda guardam 'craque'.
    return { ...card, frameId: normalizeFrameId(card.frameId), media } satisfies CardWithMedia;
  },

  async updateCard(slug, claimToken, patch) {
    return serialize((snap) => {
      const card = snap.cards[slug];
      if (!card || !card.claimToken || card.claimToken !== claimToken) return null;

      const overall = patch.overall === undefined ? card.overall : roundScore(patch.overall);
      const updated: Card = {
        ...card,
        ...patch,
        overall,
        rarity: levelFor(overall).id,
        // Toda edição publica uma URL nova. É o cache-bust do WhatsApp.
        renderVersion: card.renderVersion + 1,
        updatedAt: new Date().toISOString(),
      };
      snap.cards[slug] = updated;
      return updated;
    });
  },

  async recordEvent(input: NewEvent) {
    await serialize((snap) => {
      snap.events.push({
        id: snap.nextEventId++,
        cardId: input.cardId,
        event: input.event,
        channel: input.channel ?? null,
        format: input.format ?? null,
        referrer: input.referrer ?? null,
        createdAt: new Date().toISOString(),
      });
    });
  },

  async listEvents(cardId) {
    const snap = await load();
    return cardId ? snap.events.filter((e) => e.cardId === cardId) : snap.events;
  },
};
