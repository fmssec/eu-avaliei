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
import { useCardBlob, useDebounced } from '@/lib/client/useCardBlob';
import { displayWidthFor, useDevicePixelRatio } from '@/lib/client/display';
import { track } from '@/lib/share';
import {
  buscarAvaliacao,
  idDaAvaliacao,
  salvarAvaliacao,
  type SavedRating,
} from '@/lib/client/history';
import { resolveCatalogArtwork } from '@/lib/client/artworkCache';
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

const STEPS: { id: Step; label: string }[] = [
  { id: 'busca', label: '1 BUSCA' },
  { id: 'nota', label: '2 NOTA' },
  { id: 'estilo', label: '3 ESTILO' },
  { id: 'share', label: '4 ENVIAR' },
];

/**
 * Larguras em CSS que os previews ocupam na tela, por contexto.
 *
 * A largura real pedida ao renderizador sai daqui multiplicada pela densidade
 * da tela — servir menos pixels do que o dispositivo usa borra o texto pequeno
 * e transforma a borda do painel numa faixa visível.
 *
 * O arquivo que vai ser compartilhado NUNCA passa por isso: ele vem de
 * `shareQuery`, sem o parâmetro, em tamanho real.
 */
const CSS_PAINEL = 400;
const CSS_PREVIEW_EMBUTIDO = 220;

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
    setStep('nota');
  }, []);

  const pickMedia = useCallback((picked: Media) => {
    setMedia(picked);
    setArtworkUrl(null);
    setStats(seedStats(picked, 8.0));
    setOverall(8.0);
    setMode('computed');
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
      if (mode === 'computed') {
        setStats((current) => current.map((s) => ({ ...s, value: v })));
      }
    },
    [mode],
  );

  const changeStat = useCallback(
    (index: number, patch: Partial<EditableStat>) => {
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

  const dpr = useDevicePixelRatio();

  /** Debounce de 250ms: o preview acompanha o slider sem render por pixel. */
  const settled = useDebounced(previewSource, 250);

  /** Sem `displayWidth`: é este que vira o arquivo compartilhado. */
  const shareQuery = useMemo(
    () => buildPreviewQuery({ ...settled, format: shareFormat, showSafeArea }),
    [settled, shareFormat, showSafeArea],
  );

  const shareDisplayQuery = useMemo(
    () =>
      buildPreviewQuery({
        ...settled,
        format: shareFormat,
        showSafeArea,
        displayWidth: displayWidthFor(CSS_PREVIEW_EMBUTIDO, dpr, shareFormat),
      }),
    [settled, shareFormat, showSafeArea, dpr],
  );

  const editorPreviewQuery = useMemo(
    () =>
      buildPreviewQuery({
        ...settled,
        format: 'story',
        showSafeArea,
        displayWidth: displayWidthFor(CSS_PREVIEW_EMBUTIDO, dpr, 'story'),
      }),
    [settled, showSafeArea, dpr],
  );

  // Só pré-gera quando o usuário já está perto de compartilhar.
  const prepping = step === 'estilo' || step === 'share';
  const { prepared, preparing } = useCardBlob(
    prepping ? shareQuery : '',
    shareFormat,
    media ? slugify(media.title) : 'card',
  );

  /**
   * Nada do card vai para o servidor. O que fica é o histórico, no aparelho de
   * quem avaliou — e o evento agregado, para saber quantos cards viram
   * compartilhamento de fato.
   *
   * A arte própria é guardada como Blob junto da avaliação: o link do upload
   * é cache de sessão e expira, então salvar só a URL perderia a imagem.
   */
  useEffect(() => {
    if (step !== 'share' || !media) return;
    track('created', null, shareFormat, media.category);

    void (async () => {
      const rating: SavedRating = {
        id: idDaAvaliacao(media.externalId),
        createdAt: new Date().toISOString(),
        externalId: media.externalId,
        title: media.title,
        creator: media.creator,
        year: media.year,
        category: media.category,
        overall,
        scaleMax,
        stats: stats.map((st) => ({ label: st.label, value: st.value })),
        frame,
        caption,
        author,
        artworkUrl: media.artworkUrl,
      };

      if (artworkUrl) {
        try {
          rating.artworkBlob = await (await fetch(artworkUrl)).blob();
        } catch {
          // Sem a imagem, a avaliação ainda vale a pena guardar.
        }
      }
      await salvarAvaliacao(rating);
    })();
    // Salva o estado do momento em que a pessoa chegou ao compartilhamento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, media]);

  /**
   * Reabre um item do catálogo para rever, ajustar ou compartilhar de novo.
   *
   * Com arte própria, o Blob guardado precisa primeiro virar uma URL que o
   * servidor consiga buscar — ele não enxerga `blob:`, que só existe dentro
   * desta aba. Enquanto o reenvio não termina, o card já abre com o resto do
   * estado preenchido; a arte chega meio segundo depois.
   */
  const abrirDoCatalogo = useCallback(async (r: SavedRating) => {
    setMedia({
      id: r.externalId,
      source: 'mock',
      externalId: r.externalId,
      category: r.category,
      title: r.title,
      creator: r.creator,
      year: r.year,
      artworkUrl: r.artworkUrl,
      fetchedAt: r.createdAt,
    });
    setStats(r.stats.map((st) => ({ ...st })));
    setOverall(r.overall);
    setScaleMax(r.scaleMax);
    setFrame(r.frame);
    setCaption(r.caption);
    setAuthor(r.author);
    setArtworkUrl(r.artworkBlob ? null : r.artworkUrl);
    setMode('manual');
    setStep('estilo');

    if (r.artworkBlob) {
      const url = await resolveCatalogArtwork(r);
      setArtworkUrl(url);
    }
  }, []);

  /**
   * Abre direto num item do catálogo quando a URL chega com `?abrir=<id>` —
   * é assim que a página /catalogo manda alguém de volta para o editor.
   *
   * Lido do `window.location` puro, e não do hook `useSearchParams` do Next:
   * o hook exigiria envolver a página numa Suspense boundary só para este
   * caso raro, e a leitura direta roda de qualquer forma só depois de montar.
   */
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('abrir');
    if (!id) return;
    window.history.replaceState(null, '', window.location.pathname);
    void buscarAvaliacao(id).then((r) => {
      if (r) void abrirDoCatalogo(r);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const level = levelFor(overall);

  /**
   * O que o painel de preview do desktop mostra: o exemplo enquanto ninguém
   * escolheu nada, e o card ao vivo daí em diante. No mobile ele não existe —
   * o preview continua embutido nos passos, para não custar altura de tela.
   */
  /** O painel do desktop é maior que os previews embutidos: pede mais pixels. */
  const paneEditorQuery = useMemo(
    () =>
      buildPreviewQuery({
        ...settled,
        format: step === 'share' ? shareFormat : 'story',
        showSafeArea,
        displayWidth: displayWidthFor(CSS_PAINEL, dpr, step === 'share' ? shareFormat : 'story'),
      }),
    [settled, showSafeArea, dpr, step, shareFormat],
  );

  const paneQuery = media
    ? paneEditorQuery
    : buildPreviewQuery({
        ...DEMO_PREVIEW_SOURCE,
        format: 'story',
        displayWidth: displayWidthFor(CSS_PAINEL, dpr, 'story'),
      });

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
          {step === 'busca' ? (
            <StepBusca onPick={pickMedia} onDemo={startDemo} />
          ) : null}

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
          }}
          onNotify={notify}
          onFrame={(f) => {
            setFrame(f);
          }}
          onCaption={(c) => {
            setCaption(c);
          }}
          onAuthor={(a) => {
            setAuthor(a);
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
          previewQuery={shareDisplayQuery}
          format={shareFormat}
          onFormat={setShareFormat}
          prepared={prepared}
          preparing={preparing}
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
        <a className={styles.footerLink} href="/sobre">
          CÓDIGO ABERTO · COMO RODAR
        </a>
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
