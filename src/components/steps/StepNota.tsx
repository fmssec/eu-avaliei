'use client';

import type { Level } from '@/lib/design';
import { formatScore, type ScaleMax } from '@/lib/scale';
import type { Media, OverallMode } from '@/lib/types';
import type { EditableStat } from '../Editor';
import styles from '../editor.module.css';

const MODES: { id: OverallMode; label: string }[] = [
  { id: 'computed', label: 'MÉDIA DOS EIXOS' },
  { id: 'manual', label: 'NOTA INDEPENDENTE' },
];

interface Props {
  media: Media;
  overall: number;
  scaleMax: ScaleMax;
  level: Level;
  mode: OverallMode;
  stats: EditableStat[];
  onOverall: (value: number) => void;
  onStat: (index: number, patch: Partial<EditableStat>) => void;
  onMode: (mode: OverallMode) => void;
  onBack: () => void;
  onNext: () => void;
}

/**
 * Passo 2 — a nota geral em destaque, porque é o controle mais tocado do app
 * (spec §7). Tudo abaixo dela é opcional: dá para ir direto para o próximo
 * passo sem encostar em nenhum eixo.
 */
export function StepNota({
  media,
  overall,
  scaleMax,
  level,
  mode,
  stats,
  onOverall,
  onStat,
  onMode,
  onBack,
  onNext,
}: Props) {
  return (
    <section className={styles.step}>
      <div className={styles.stepHead}>
        <span className={styles.stepLabel}>2 · AVALIAÇÃO</span>
        <button type="button" className={styles.back} onClick={onBack}>
          ← TROCAR
        </button>
      </div>

      <div>
        <div className={styles.mediaTitle}>{media.title}</div>
        <div className={styles.resultMeta}>
          {[media.creator, media.year].filter(Boolean).join(' · ')}
        </div>
      </div>

      <div className={styles.overallRow}>
        <div className={styles.overallValue} style={{ color: level.edge }}>
          {formatScore(overall, scaleMax)}
        </div>
        <div className={styles.overallSide}>
          <span className={styles.resultMeta}>NOTA GERAL</span>
          <span className={styles.rarityTag} style={{ color: level.edge }}>
            {level.label}
          </span>
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={10}
        step={0.1}
        value={overall}
        onChange={(e) => onOverall(Number(e.target.value))}
        aria-label="Nota geral"
        aria-valuetext={formatScore(overall, scaleMax)}
      />

      <div className={styles.segmented} role="group" aria-label="Como a nota geral é definida">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={mode === m.id}
            className={`${styles.segment} ${mode === m.id ? styles.segmentOn : ''}`}
            onClick={() => onMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className={styles.statList}>
        {stats.map((stat, index) => (
          <div key={stat.label} className={styles.statRow}>
            <span className={styles.statLabel}>{stat.label}</span>
            <input
              className="mini"
              type="range"
              min={0}
              max={10}
              step={0.1}
              value={stat.value}
              onChange={(e) => onStat(index, { value: Number(e.target.value) })}
              aria-label={stat.label}
              aria-valuetext={formatScore(stat.value, scaleMax)}
            />
            <span className={styles.statValue}>{formatScore(stat.value, scaleMax)}</span>
          </div>
        ))}
      </div>

      <div className={styles.spacer} />
      <button type="button" className={styles.primary} onClick={onNext}>
        PERSONALIZAR
      </button>
    </section>
  );
}
