'use client';

import { useState } from 'react';
import type { ScaleMax } from '@/lib/scale';
import type { FrameId } from '@/lib/types';
import { ArtworkPicker } from '../ArtworkPicker';
import styles from '../editor.module.css';

const FRAMES: { id: FrameId; label: string }[] = [
  { id: 'ficha', label: 'Ficha' },
  { id: 'poster', label: 'Pôster' },
];

interface Props {
  previewQuery: string;
  frame: FrameId;
  caption: string;
  author: string;
  scaleMax: ScaleMax;
  showSafeArea: boolean;
  artworkUrl: string | null;
  mediaArtworkUrl: string | null;
  onArtwork: (url: string | null) => void;
  onNotify: (message: string) => void;
  onFrame: (frame: FrameId) => void;
  onCaption: (caption: string) => void;
  onAuthor: (author: string) => void;
  onScaleMax: (max: ScaleMax) => void;
  onSafeArea: (show: boolean) => void;
  onBack: () => void;
  onNext: () => void;
}

/**
 * Passo 3 — no máximo três decisões visíveis (spec §7). Moldura, frase e o
 * botão de avançar; escala, assinatura e áreas seguras ficam atrás de
 * "mais opções", porque quase ninguém precisa delas na primeira vez.
 */
export function StepEstilo({
  previewQuery,
  frame,
  caption,
  author,
  scaleMax,
  showSafeArea,
  artworkUrl,
  mediaArtworkUrl,
  onArtwork,
  onNotify,
  onFrame,
  onCaption,
  onAuthor,
  onScaleMax,
  onSafeArea,
  onBack,
  onNext,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className={styles.step}>
      <div className={styles.stepHead}>
        <span className={styles.stepLabel}>3 · PERSONALIZAÇÃO</span>
        <button type="button" className={styles.back} onClick={onBack}>
          ← NOTA
        </button>
      </div>

      <div className={styles.previewWrap}>
        {/*
          O preview é o renderizador de verdade, não uma reprodução em DOM.
          É por isso que ele é idêntico ao arquivo compartilhado (spec §4.1).
        */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={`${styles.preview} ${styles.previewTall}`}
          src={`/api/preview?${previewQuery}`}
          alt="Prévia do card"
        />
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>MOLDURA</span>
        <div className={styles.frameRow}>
          {FRAMES.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={frame === f.id}
              className={`${styles.frameOption} ${frame === f.id ? styles.frameOptionOn : ''}`}
              onClick={() => onFrame(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <ArtworkPicker
        value={artworkUrl}
        fallbackUrl={mediaArtworkUrl}
        onChange={onArtwork}
        onNotify={onNotify}
      />

      <div className={styles.field}>
        <span className={styles.fieldLabel}>
          FRASE <span>{caption.length}/80</span>
        </span>
        <input
          className={styles.textInput}
          value={caption}
          maxLength={80}
          placeholder="opcional"
          onChange={(e) => onCaption(e.target.value.slice(0, 80))}
          aria-label="Frase do card"
        />
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>
          ASSINATURA <span>{author ? `${author.length}/32` : 'OPCIONAL'}</span>
        </span>
        <input
          className={styles.textInput}
          value={author}
          maxLength={32}
          placeholder="seu @ ou nome — deixe vazio para não assinar"
          onChange={(e) => onAuthor(e.target.value.slice(0, 32))}
          aria-label="Assinatura do card"
        />
      </div>

      <button
        type="button"
        className={styles.disclosure}
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? '− MENOS OPÇÕES' : '+ MAIS OPÇÕES (ESCALA, ÁREAS SEGURAS)'}
      </button>

      {expanded ? (
        <>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>ESCALA</span>
            <div className={styles.segmented}>
              {([10, 100] as ScaleMax[]).map((max) => (
                <button
                  key={max}
                  type="button"
                  aria-pressed={scaleMax === max}
                  className={`${styles.segment} ${scaleMax === max ? styles.segmentOn : ''}`}
                  onClick={() => onScaleMax(max)}
                >
                  {max === 10 ? '0–10' : '0–100'}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>ÁREAS SEGURAS DO STORY</span>
            <div className={styles.segmented}>
              <button
                type="button"
                aria-pressed={!showSafeArea}
                className={`${styles.segment} ${!showSafeArea ? styles.segmentOn : ''}`}
                onClick={() => onSafeArea(false)}
              >
                OCULTAR
              </button>
              <button
                type="button"
                aria-pressed={showSafeArea}
                className={`${styles.segment} ${showSafeArea ? styles.segmentOn : ''}`}
                onClick={() => onSafeArea(true)}
              >
                MOSTRAR 250/300
              </button>
            </div>
            <div className={styles.hint}>
              MOSTRA ONDE A INTERFACE DO INSTAGRAM COBRE O CARD NO STORY
            </div>
          </div>
        </>
      ) : null}

      <div className={styles.spacer} />
      <button type="button" className={styles.primary} onClick={onNext}>
        AVANÇAR
      </button>
    </section>
  );
}
