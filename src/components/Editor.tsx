'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_AXES, MAX_STATS } from '@/lib/axes';
import {
  DEMO_CAPTION,
  DEMO_MEDIA,
  DEMO_OVERALL,
  DEMO_PREVIEW_SOURCE,
  DEMO_STATS,
} from '@/lib/media/demo';
import { levelFor } from '@/lib/design';
import { FORMATS, type FormatId } from '@/lib/formats';
import { buildPreviewQuery } from '@/lib/params';
import { deriveOverall } from '@/lib/overall';
import { roundScore, type ScaleMax } from '@/lib/scale';
import { slugify } from '@/lib/slugify';
import { saveClaim } from '@/lib/client/claims';
import { useCardBlob, useDebounced } from '@/lib/client/useCardBlob';
import type { FrameId, Media, OverallMode } from '@/lib/types';
import styles from './editor.module.css';
import { StepBusca } from './steps/StepBusca';
import { StepNota } from './steps/StepNota';
import { StepEstilo } from './steps/StepEstilo';
import { StepShare } from './steps/StepShare';
import { ThemeToggle } from './ThemeToggle';

export type Step = 'busca' | 'nota' | 'estilo' | 'share';

export interface EditableStat {
  label: string;
  value: number;
}

export interface SavedCard {
  slug: string;
  renderVersion: number;
  claimToken: string;
}

const STEPS: { id: Step; label: string }[] = [
  { id: 'busca', label: '1 BUSCA' },
  { id: 'nota', label: '2 NOTA' },
  { id: 'estilo', label: '3 ESTILO' },
  { id: 'share', label: '4 ENVIAR' },
];

/** Estatísticas nascem na nota geral: ninguém precisa preencher seis sliders. */
function seedStats(media: Media, overall: number): EditableStat[] {
  return DEFAULT_AXES[media.category].slice(0, MAX_STATS).map((label) => ({ label, value: overall }));
}

export function Editor() {
  const [step, setStep] = useState<Step>('busca');
  const [media, setMedia] = useState<Media | null>(null);
  const [overall, setOverall] = useState(8.0);
  const [mode, setMode] = useState<OverallMode>('computed');
  const [stats, setStats] = useState<EditableStat[]>([]);
  const [frame, setFrame] = useState<FrameId>('ficha');
  const [caption, setCaption] = useState('');
  const [author, setAuthor] = useState('');
  const [scaleMax, setScaleMax] = useState<ScaleMax>(10);
  const [shareFormat, setShareFormat] = useState<FormatId>('story');
  const [showSafeArea, setShowSafeArea] = useState(false);
  /** Arte anexada pelo usuário. Vence a arte da fonte de metadados. */
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null);

  const [saved, setSaved] = useState<SavedCard | null>(null);
  const [dirtySinceSave, setDirtySinceSave] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const notify = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast((current) => (current === message ? null : current)), 2600);
  }, []);

  /**
   * Abre o exemplo já preenchido, no passo da nota.
   *
   * Cai direto no controle mais tocado do app: a pessoa arrasta a nota, vê a
   * moldura mudar de raridade e entende o produto sem ler nada. O exemplo é um
   * card comum daí em diante — dá para editar, salvar e compartilhar.
   */
  const startDemo = useCallback(() => {
    setMedia(DEMO_MEDIA);
    setArtworkUrl(null);
    setStats(DEMO_STATS.map((s) => ({ ...s })));
    setOverall(DEMO_OVERALL);
    setMode('computed');
    setCaption(DEMO_CAPTION);
    setSaved(null);
    setDirtySinceSave(false);
    setStep('nota');
  }, []);

  const pickMedia = useCallback((picked: Media) => {
    setMedia(picked);
    setArtworkUrl(null);
    setStats(seedStats(picked, 8.0));
    setOverall(8.0);
    setMode('computed');
    setSaved(null);
    setDirtySinceSave(false);
    setStep('nota');
  }, []);

  /**
   * Mexer na nota geral no modo calculado arrasta as estatísticas junto. É o
   * caminho de quem quer só dar uma nota e sair — o ajuste fino é opcional.
   */
  const changeOverall = useCallback(
    (value: number) => {
      const v = roundScore(value);
      setOverall(v);
      setDirtySinceSave(true);
      if (mode === 'computed') {
        setStats((current) => current.map((s) => ({ ...s, value: v })));
      }
    },
    [mode],
  );

  const changeStat = useCallback(
    (index: number, patch: Partial<EditableStat>) => {
      setDirtySinceSave(true);
      setStats((current) => {
        const next = current.map((s, i) => (i === index ? { ...s, ...patch } : s));
        if (mode !== 'manual') setOverall(deriveOverall(mode, asStats(next), overall));
        return next;
      });
    },
    [mode, overall],
  );

  const changeMode = useCallback(
    (next: OverallMode) => {
      setMode(next);
      setDirtySinceSave(true);
      if (next !== 'manual') setOverall(deriveOverall(next, asStats(stats), overall));
    },
    [stats, overall],
  );

  const previewSource = useMemo(
    () => ({
      frame,
      overall,
      scaleMax,
      title: media?.title ?? '',
      creator: media?.creator ?? '',
      year: media?.year ?? null,
      category: media?.category ?? ('movie' as const),
      caption,
      author,
      stats,
      artworkUrl: artworkUrl ?? media?.artworkUrl ?? null,
    }),
    [frame, overall, scaleMax, media, caption, author, stats, artworkUrl],
  );

  /** Debounce de 250ms: o preview acompanha o slider sem render por pixel. */
  const settled = useDebounced(previewSource, 250);

  const previewQuery = useMemo(
    () => buildPreviewQuery({ ...settled, format: shareFormat, showSafeArea }),
    [settled, shareFormat, showSafeArea],
  );

  const editorPreviewQuery = useMemo(
    () => buildPreviewQuery({ ...settled, format: 'story', showSafeArea }),
    [settled, showSafeArea],
  );

  // Só pré-gera quando o usuário já está perto de compartilhar.
  const prepping = step === 'estilo' || step === 'share';
  const { prepared, preparing } = useCardBlob(
    prepping ? previewQuery : '',
    shareFormat,
    media ? slugify(media.title) : 'card',
  );

  /**
   * Persiste o card ao chegar no compartilhamento. Sem login: o card nasce
   * anônimo e o claim_token vai para o localStorage (spec §7).
   */
  const persist = useCallback(async () => {
    if (!media || saving) return;
    if (saved && !dirtySinceSave) return;

    setSaving(true);
    try {
      const payload = {
        overall,
        overallMode: mode,
        frameId: frame,
        themeId: 'default',
        caption,
        artworkUrl,
        authorHandle: author.trim() || null,
        stats,
      };

      if (saved) {
        // Editar incrementa renderVersion no servidor: URL nova, scrape novo.
        const res = await fetch(`/api/cards/${saved.slug}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-claim-token': saved.claimToken },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('patch');
        const data = (await res.json()) as { renderVersion: number };
        setSaved({ ...saved, renderVersion: data.renderVersion });
      } else {
        const res = await fetch('/api/cards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, externalId: media.externalId }),
        });
        if (!res.ok) throw new Error('post');
        const data = (await res.json()) as {
          slug: string;
          renderVersion: number;
          claimToken: string;
        };
        setSaved(data);
        saveClaim({
          slug: data.slug,
          claimToken: data.claimToken,
          title: media.title,
          createdAt: new Date().toISOString(),
        });
      }
      setDirtySinceSave(false);
    } catch {
      notify('NÃO FOI POSSÍVEL SALVAR O CARD');
    } finally {
      setSaving(false);
    }
  }, [
    media,
    saving,
    saved,
    dirtySinceSave,
    overall,
    mode,
    frame,
    caption,
    artworkUrl,
    author,
    stats,
    notify,
  ]);

  useEffect(() => {
    if (step === 'share') void persist();
  }, [step, persist]);

  const level = levelFor(overall);

  /**
   * O que o painel de preview do desktop mostra: o exemplo enquanto ninguém
   * escolheu nada, e o card ao vivo daí em diante. No mobile ele não existe —
   * o preview continua embutido nos passos, para não custar altura de tela.
   */
  const paneQuery = media
    ? step === 'share'
      ? previewQuery
      : editorPreviewQuery
    : buildPreviewQuery({ ...DEMO_PREVIEW_SOURCE, format: 'story' });

  const paneFormat = media && step === 'share' ? shareFormat : 'story';
  const paneSpec = FORMATS[paneFormat];

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <a className={styles.brand} href="/" aria-label="Ir para a página inicial">
          <span className={styles.wordmark}>Eu avaliei!</span>
          <span className={styles.tagline}>DA BUSCA AO CARD EM MENOS DE 30 SEGUNDOS</span>
        </a>
        <ThemeToggle />
      </header>

      <div className={styles.workspace}>
        <aside className={styles.previewPane} aria-hidden={!media && step !== 'busca'}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={styles.previewLarge}
            style={{ aspectRatio: `${paneSpec.width} / ${paneSpec.height}` }}
            src={`/api/preview?${paneQuery}`}
            alt={media ? 'Prévia do seu card' : 'Exemplo de card'}
          />
          <div className={styles.previewMeta}>
            <span>{media ? 'SEU CARD' : 'EXEMPLO'}</span>
            <span>
              {paneSpec.width}×{paneSpec.height} · {level.label}
            </span>
          </div>
        </aside>

        <div className={styles.controls}>
          {step === 'busca' ? <StepBusca onPick={pickMedia} onDemo={startDemo} /> : null}

          {step === 'nota' && media ? (
        <StepNota
          media={media}
          overall={overall}
          scaleMax={scaleMax}
          level={level}
          mode={mode}
          stats={stats}
          onOverall={changeOverall}
          onStat={changeStat}
          onMode={changeMode}
          onBack={() => setStep('busca')}
          onNext={() => setStep('estilo')}
        />
      ) : null}

      {step === 'estilo' && media ? (
        <StepEstilo
          previewQuery={editorPreviewQuery}
          frame={frame}
          caption={caption}
          author={author}
          scaleMax={scaleMax}
          showSafeArea={showSafeArea}
          artworkUrl={artworkUrl}
          mediaArtworkUrl={media.artworkUrl}
          onArtwork={(url) => {
            setArtworkUrl(url);
            setDirtySinceSave(true);
          }}
          onNotify={notify}
          onFrame={(f) => {
            setFrame(f);
            setDirtySinceSave(true);
          }}
          onCaption={(c) => {
            setCaption(c);
            setDirtySinceSave(true);
          }}
          onAuthor={(a) => {
            setAuthor(a);
            setDirtySinceSave(true);
          }}
          onScaleMax={setScaleMax}
          onSafeArea={setShowSafeArea}
          onBack={() => setStep('nota')}
          onNext={() => setStep('share')}
        />
      ) : null}

      {step === 'share' && media ? (
        <StepShare
          media={media}
          previewQuery={previewQuery}
          format={shareFormat}
          onFormat={setShareFormat}
          prepared={prepared}
          preparing={preparing || saving}
          saved={saved}
          caption={caption}
          overall={overall}
          scaleMax={scaleMax}
          onBack={() => setStep('estilo')}
          onNotify={notify}
        />
      ) : null}

          <nav className={styles.stepNav}>
            {STEPS.map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={s.id !== 'busca' && !media}
                className={`${styles.stepNavItem} ${step === s.id ? styles.stepNavItemOn : ''}`}
                onClick={() => setStep(s.id)}
              >
                {s.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <footer className={styles.footer}>
        <span>DESENVOLVIDO POR FZ</span>
        <span>SEM LOGIN, SEM CADASTRO</span>
      </footer>

      {toast ? (
        <div className={styles.toast} role="status">
          {toast}
        </div>
      ) : null}
    </main>
  );
}

function asStats(stats: EditableStat[]) {
  return stats.map((s) => ({ key: s.label, label: s.label, value: s.value }));
}
