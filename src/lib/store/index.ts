import type { Card, CardEvent, CardEventName, CardWithMedia, Media, ShareChannel } from '../types';

export interface NewCard {
  media: Media;
  overall: number;
  overallMode: Card['overallMode'];
  stats: Card['stats'];
  frameId: Card['frameId'];
  themeId: string;
  caption: string;
  artworkUrl: string | null;
  authorHandle: string | null;
}

export interface CardPatch {
  overall?: number;
  overallMode?: Card['overallMode'];
  stats?: Card['stats'];
  frameId?: Card['frameId'];
  themeId?: string;
  caption?: string;
  artworkUrl?: string | null;
  authorHandle?: string | null;
  isPublic?: boolean;
}

export interface NewEvent {
  cardId: string;
  event: CardEventName;
  channel?: ShareChannel | null;
  format?: string | null;
  referrer?: string | null;
}

export interface Store {
  createCard(input: NewCard): Promise<{ card: Card; claimToken: string }>;
  getCardBySlug(slug: string): Promise<CardWithMedia | null>;
  /**
   * Editar um card SEMPRE incrementa `renderVersion`. A URL canônica muda
   * junto, que é o único jeito de furar o cache do WhatsApp (spec §3.2).
   */
  updateCard(slug: string, claimToken: string, patch: CardPatch): Promise<Card | null>;
  upsertMedia(media: Media): Promise<Media>;
  recordEvent(input: NewEvent): Promise<void>;
  listEvents(cardId?: string): Promise<CardEvent[]>;
}

export { fileStore as store } from './file';
