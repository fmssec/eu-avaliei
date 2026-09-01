'use client';

import { useMemo } from 'react';
import { FORMATS, FORMAT_IDS, type FormatId } from '@/lib/formats';
import { formatScore, type ScaleMax } from '@/lib/scale';
import {
  canShareFiles,
  copyImage,
  deepLink,
  downloadBlob,
  shareFile,
  trackShare,
} from '@/lib/share';
import type { PreparedCard } from '@/lib/client/useCardBlob';
import type { Media } from '@/lib/types';
import type { SavedCard } from '../Editor';
import styles from '../editor.module.css';

interface Props {
  media: Media;
  previewQuery: string;
  format: FormatId;
  onFormat: (format: FormatId) => void;
  prepared: PreparedCard | null;
  preparing: boolean;
  saved: SavedCard | null;
  caption: string;
  overall: number;
  scaleMax: ScaleMax;
  onBack: () => void;
  onNotify: (message: string) => void;
}

const PREVIEW_CLASS: Record<FormatId, string> = {
  story: styles.previewTall,
  square: styles.previewSquare,
  og: styles.previewWide,
  wide: styles.previewWide,
};

function kb(bytes: number): string {
  return bytes < 1_000_000
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / 1_000_000).toFixed(1)} MB`;
}

/**
 * Passo 4 — a cascata de compartilhamento (spec §3.3).
 *
 * O botão primário chama `navigator.share()` sem nenhum `await` antes: o blob
 * já foi gerado durante a edição. Se ele fosse gerado aqui, o iOS invalidaria
 * a ativação transitória e rejeitaria a chamada.
 */
export function StepShare({
  media,
  previewQuery,
  format,
  onFormat,
  prepared,
  preparing,
  saved,
  caption,
  overall,
  scaleMax,
  onBack,
  onNotify,
}: Props) {
  const spec = FORMATS[format];

  /** URL canônica versionada: editar o card muda a URL e fura o cache do WhatsApp. */
  const cardUrl = useMemo(() => {
    if (!saved || typeof window === 'undefined') return null;
    return `${window.location.origin}/c/${saved.slug}-v${saved.renderVersion}`;
  }, [saved]);

  /**
   * O texto que acompanha o link nos deep links.
   *
   * Começa pela marca — "Eu avaliei: Pulp Fiction" se lê como frase, e é o que
   * a pessoa do outro lado vê antes de qualquer coisa. Termina com o convite:
   * cada card compartilhado precisa ser também um caminho para quem recebeu
   * fazer o seu, senão o compartilhamento não gera o próximo usuário.
   */
  const shareText = useMemo(() => {
    const nota = formatScore(overall, scaleMax);
    const linhas = [`Eu avaliei: ${media.title} — ${nota}`];
    if (caption) linhas.push(`"${caption}"`);
    return linhas.join('\n');
  }, [media.title, overall, scaleMax, caption]);

  /** Convite anexado ao texto onde o destino aceita mensagem longa. */
  const shareInvite = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `Veja a avaliação e faça a sua em ${window.location.host}`;
  }, []);

  const canNativeShare = prepared ? canShareFiles(prepared.file) : false;

  const handleShare = () => {
    if (!prepared) return;
    // Chamada síncrona, dentro do gesto. Nada de `await` acima desta linha.
    void shareFile(prepared.file).then((result) => {
      if (result.ok) {
        if (saved) trackShare(saved.slug, 'shared', 'webshare', format);
        return;
      }
      if (result.cancelled) return;
      onNotify('SHARE SHEET INDISPONÍVEL · USE OS DESTINOS ABAIXO');
    });
  };

  const handleDeepLink = (channel: 'whatsapp' | 'x' | 'telegram') => {
    if (!cardUrl) {
      onNotify('SALVANDO O CARD…');
      return;
    }
    if (saved) trackShare(saved.slug, 'shared', channel, format);
    // O X conta a URL no limite de caracteres e a anexa sozinho, então o
    // convite iria só ocupar espaço lá.
    const texto = channel === 'x' ? shareText : `${shareText}\n\n${shareInvite}`;
    window.open(deepLink(channel, texto, cardUrl), '_blank', 'noopener,noreferrer');
  };

  const handleCopy = () => {
    if (!prepared) return;
    void copyImage(prepared.blob).then((result) => {
      if (result.ok) {
        if (saved) trackShare(saved.slug, 'shared', 'clipboard', format);
        onNotify('IMAGEM COPIADA');
      } else {
        onNotify('SEU NAVEGADOR NÃO PERMITE COPIAR IMAGEM');
      }
    });
  };

  const handleDownload = () => {
    if (!prepared) return;
    downloadBlob(prepared.blob, prepared.file.name);
    if (saved) trackShare(saved.slug, 'shared', 'download', format);
  };

  const overBudget = prepared !== null && prepared.bytes > spec.maxBytes;

  return (
    <section className={styles.step}>
      <div className={styles.stepHead}>
        <span className={styles.stepLabel}>4 · COMPARTILHAMENTO</span>
        <button type="button" className={styles.back} onClick={onBack}>
          ← EDITAR
        </button>
      </div>

      <div className={styles.previewWrap}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={`${styles.preview} ${PREVIEW_CLASS[format]}`}
          src={`/api/preview?${previewQuery}`}
          alt="Prévia do card"
        />
      </div>

      <div className={styles.segmented} role="group" aria-label="Formato">
        {FORMAT_IDS.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={format === id}
            className={`${styles.segment} ${format === id ? styles.segmentOn : ''}`}
            onClick={() => onFormat(id)}
          >
            {FORMATS[id].width}×{FORMATS[id].height}
          </button>
        ))}
      </div>

      <div className={styles.status}>
        <span className={`${styles.dot} ${prepared ? '' : styles.dotPending}`} />
        <span>
          {prepared
            ? `IMAGEM PRONTA · ${spec.width}×${spec.height} · ${kb(prepared.bytes)}`
            : preparing
              ? 'PREPARANDO A IMAGEM…'
              : 'NÃO FOI POSSÍVEL GERAR A IMAGEM'}
          {overBudget ? ' · PODE FICAR PESADA PARA ALGUNS APLICATIVOS' : ''}
        </span>
      </div>

      <button
        type="button"
        className={styles.primary}
        disabled={!prepared}
        onClick={handleShare}
      >
        {canNativeShare ? 'ABRIR SHARE SHEET' : 'COMPARTILHAR'}
      </button>
      <div className={styles.footNote}>
        {canNativeShare
          ? 'ABRE A LISTA DE APLICATIVOS DO SEU APARELHO'
          : 'ESTE NAVEGADOR NÃO ABRE A LISTA DE APLICATIVOS — USE OS DESTINOS ABAIXO'}
      </div>

      <div className={styles.destinations}>
        <button
          type="button"
          className={styles.destination}
          disabled={!cardUrl}
          onClick={() => handleDeepLink('whatsapp')}
        >
          <span className={styles.destinationLabel}>WhatsApp</span>
          <span className={styles.destinationVia}>MENSAGEM COM O LINK</span>
        </button>
        <button
          type="button"
          className={styles.destination}
          disabled={!cardUrl}
          onClick={() => handleDeepLink('x')}
        >
          <span className={styles.destinationLabel}>X</span>
          <span className={styles.destinationVia}>POST COM O LINK</span>
        </button>
        <button
          type="button"
          className={styles.destination}
          disabled={!cardUrl}
          onClick={() => handleDeepLink('telegram')}
        >
          <span className={styles.destinationLabel}>Telegram</span>
          <span className={styles.destinationVia}>MENSAGEM COM O LINK</span>
        </button>
        <button
          type="button"
          className={styles.destination}
          disabled={!prepared}
          onClick={handleCopy}
        >
          <span className={styles.destinationLabel}>Copiar imagem</span>
          <span className={styles.destinationVia}>PARA COLAR EM QUALQUER LUGAR</span>
        </button>
        <button
          type="button"
          className={styles.destination}
          disabled={!prepared}
          onClick={handleDownload}
        >
          <span className={styles.destinationLabel}>Baixar</span>
          <span className={styles.destinationVia}>{`${spec.ext.toUpperCase()} · ${spec.label}`}</span>
        </button>
      </div>

      <div className={`${styles.footNote} ${styles.spacer}`}>
        {cardUrl ? (
          <>
            SEU CARD ESTÁ NO AR EM {cardUrl.replace(/^https?:\/\//, '')}
            <br />
            GUARDADO NESTE NAVEGADOR — VOCÊ PODE EDITAR DEPOIS
          </>
        ) : (
          'SALVANDO O CARD…'
        )}
      </div>
    </section>
  );
}
