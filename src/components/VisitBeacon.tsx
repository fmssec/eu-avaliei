'use client';

import { useEffect } from 'react';
import { track, type ShareChannel } from '@/lib/share';

const CANAIS: ShareChannel[] = [
  'webshare',
  'whatsapp',
  'x',
  'telegram',
  'clipboard',
  'download',
  'site',
];

/**
 * Registra a visita e de onde ela veio.
 *
 * Sem página por card, a atribuição por card acabou — o que sobra é agregado.
 * O `?de=` posto nos links de compartilhamento é o que separa "chegou por um
 * card que alguém mandou" de tráfego direto, e é com ele que o critério de
 * sucesso do MVP continua mensurável.
 */
export function VisitBeacon() {
  useEffect(() => {
    const de = new URLSearchParams(window.location.search).get('de');
    const canal = CANAIS.includes(de as ShareChannel) ? (de as ShareChannel) : null;
    track('viewed', canal, null);
  }, []);

  return null;
}
