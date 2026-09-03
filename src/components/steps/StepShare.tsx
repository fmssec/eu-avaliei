'use client';

import { useMemo, useState } from 'react';
import { FORMATS, FORMAT_IDS, type FormatId } from '@/lib/formats';
import { formatScore, type ScaleMax } from '@/lib/scale';
import {
  canShareFiles,
  copyImage,
  deepLink,
  downloadBlob,
  shareFile,
  siteLink,
  track,
} from '@/lib/share';
import type { PreparedCard } from '@/lib/client/useCardBlob';
import type { Media } from '@/lib/types';
import styles from '../editor.module.css';

interface Props {
  media: Media;
  previewQuery: string;
  format: FormatId;
  onFormat: (format: FormatId) => void;
  prepared: PreparedCard | null;
  preparing: boolean;
  caption: string;
  overall: number;
  scaleMax: ScaleMax;
  onBack: () => void;
  onNotify: (message: string) => void;
  onSalvar: () => Promise<void>;
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
 * O botão primário chama `navigator.share()` sem nenhum `await` antes: o
 * arquivo já foi gerado durante a edição. Se fosse gerado aqui, o iOS
 * invalidaria a ativação transitória e rejeitaria a chamada.
 *
 * Salvar em Minhas avaliações é uma escolha à parte de compartilhar — dá pra
 * fazer as duas, só uma, ou nenhuma. Pelo caminho principal do compartilhamento
 * — a share sheet com arquivo — isso não muda nada: a imagem viaja inteira.
 * Pelos deep links, que só aceitam texto, o que vai é o convite com o
 * endereço do site, e a imagem precisa ser anexada com "copiar" ou "baixar".
 */
export function StepShare({
  media,
  previewQuery,
  format,
  onFormat,
  prepared,
  preparing,
  caption,
  overall,
  scaleMax,
  onBack,
  onNotify,
  onSalvar,
}: Props) {
  const spec = FORMATS[format];
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const [salvando, setSalvando] = useState(false);

  const shareText = useMemo(() => {
    const nota = formatScore(overall, scaleMax);
    const linhas = [`Eu avaliei: ${media.title} — ${nota}`];
    if (caption) linhas.push(`"${caption}"`);
    return linhas.join('\n');
  }, [media.title, overall, scaleMax, caption]);

  const canNativeShare = prepared ? canShareFiles(prepared.file) : false;

  const handleShare = () => {
    if (!prepared) return;
    // Chamada síncrona, dentro do gesto. Nada de `await` acima desta linha.
    void shareFile(prepared.file).then((result) => {
      if (result.ok) {
        track('shared', 'webshare', format, media.category);
        return;
      }
      if (result.cancelled) return;
      onNotify('NÃO FOI POSSÍVEL ABRIR A LISTA DE APLICATIVOS');
    });
  };

  const handleDeepLink = (channel: 'whatsapp' | 'x' | 'telegram') => {
    track('shared', channel, format, media.category);
    const convite = `Faça a sua também:`;
    const texto = `${shareText}\n\n${convite}`;
    window.open(
      deepLink(channel, texto, siteLink(origin, channel)),
      '_blank',
      'noopener,noreferrer',
    );
    onNotify('ANEXE A IMAGEM: USE COPIAR OU BAIXAR');
  };

  const handleCopy = () => {
    if (!prepared) return;
    void copyImage(prepared.blob).then((result) => {
      if (result.ok) {
        track('shared', 'clipboard', format, media.category);
        onNotify('IMAGEM COPIADA');
      } else {
        onNotify('SEU NAVEGADOR NÃO PERMITE COPIAR IMAGEM');
      }
    });
  };

  const handleDownload = () => {
    if (!prepared) return;
    downloadBlob(prepared.blob, prepared.file.name);
    track('shared', 'download', format, media.category);
  };

  const handleSalvar = () => {
    setSalvando(true);
    void onSalvar()
      .then(() => onNotify('SALVO EM MINHAS AVALIAÇÕES'))
      .catch(() => onNotify('NÃO FOI POSSÍVEL SALVAR'))
      .finally(() => setSalvando(false));
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
        className={styles.secondary}
        disabled={salvando}
        onClick={handleSalvar}
      >
        {salvando ? 'SALVANDO…' : 'SALVAR EM MINHAS AVALIAÇÕES'}
      </button>

      <button type="button" className={styles.primary} disabled={!prepared} onClick={handleShare}>
        {canNativeShare ? 'COMPARTILHAR IMAGEM' : 'COMPARTILHAR'}
      </button>
      <div className={styles.footNote}>
        {canNativeShare
          ? 'A IMAGEM VAI INTEIRA PARA O APLICATIVO QUE VOCÊ ESCOLHER'
          : 'NESTE NAVEGADOR, BAIXE OU COPIE A IMAGEM E ANEXE NA CONVERSA'}
      </div>

      <div className={styles.destinations}>
        <button type="button" className={styles.destination} onClick={handleDownload} disabled={!prepared}>
          <span className={styles.destinationLabel}>Baixar imagem</span>
          <span className={styles.destinationVia}>{spec.label}</span>
        </button>
        <button type="button" className={styles.destination} onClick={handleCopy} disabled={!prepared}>
          <span className={styles.destinationLabel}>Copiar imagem</span>
          <span className={styles.destinationVia}>PARA COLAR NA CONVERSA</span>
        </button>
        <button
          type="button"
          className={styles.destination}
          onClick={() => handleDeepLink('whatsapp')}
        >
          <span className={styles.destinationLabel}>WhatsApp</span>
          <span className={styles.destinationVia}>ABRE COM O TEXTO PRONTO</span>
        </button>
        <button type="button" className={styles.destination} onClick={() => handleDeepLink('x')}>
          <span className={styles.destinationLabel}>X</span>
          <span className={styles.destinationVia}>ABRE COM O TEXTO PRONTO</span>
        </button>
        <button
          type="button"
          className={styles.destination}
          onClick={() => handleDeepLink('telegram')}
        >
          <span className={styles.destinationLabel}>Telegram</span>
          <span className={styles.destinationVia}>ABRE COM O TEXTO PRONTO</span>
        </button>
      </div>

      <div className={`${styles.footNote} ${styles.spacer}`}>
        SEM SALVAR, O CARD NÃO FICA GUARDADO EM LUGAR NENHUM — SÓ A IMAGEM QUE
        VOCÊ BAIXOU OU COMPARTILHOU
      </div>
    </section>
  );
}
