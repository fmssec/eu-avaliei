'use client';

import { useEffect } from 'react';

/**
 * Registra `viewed` quando um humano abre a landing.
 *
 * É a outra metade da instrumentação da tese: `shared` conta o envio, `viewed`
 * conta o clique de volta. A razão entre os dois é o critério de sucesso do
 * MVP — pelo menos 0,3 clique de volta por card compartilhado (spec §9).
 */
export function ViewBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    const body = JSON.stringify({ slug, event: 'viewed', channel: null, format: null });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/events', new Blob([body], { type: 'application/json' }));
        return;
      }
    } catch {
      // cai no fetch
    }
    void fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => undefined);
  }, [slug]);

  return null;
}
