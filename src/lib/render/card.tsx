import type { CSSProperties, ReactElement } from 'react';
import { COLOR, FONT, levelFor } from '../design';
import type { Variant } from '../formats';
import { abbreviate } from '../axes';
import { formatScore, type ScaleMax } from '../scale';
import type { FrameId } from '../types';

/**
 * O card, em JSX para o Satori.
 *
 * Porte literal de Card.dc.html, com quatro adaptações forçadas pelo subset de
 * CSS do Satori (spec §4.2):
 *   1. `display:grid` não existe — o grid 2×3 do craque virou flex-wrap com
 *      largura de coluna calculada à mão.
 *   2. oklch() não é interpretado — as cores vêm de design.ts já em hex.
 *   3. `text-wrap:balance` não existe — removido, sem substituto.
 *   4. `repeating-linear-gradient` do placeholder de pôster virou chapa sólida.
 * Ornamentos mais elaborados de moldura entram como asset SVG/PNG composto em
 * camada, nunca desenhados em CSS.
 */

export interface CardRenderInput {
  variant: Variant;
  frame: FrameId;
  /** 0–10. */
  overall: number;
  scaleMax: ScaleMax;
  title: string;
  creator: string;
  year: number | null;
  categoryLabel: string;
  caption: string;
  author: string;
  stats: { label: string; value: number }[];
  /** data: URI do pôster já embutido. Satori não busca rede por conta própria. */
  artwork?: string | null;
  /** Sobrepõe as faixas cobertas pela UI do Instagram no 9:16. */
  showSafeArea?: boolean;
  width: number;
  height: number;
}

const mono = (size: number, tracking: number, color: string): CSSProperties => ({
  fontFamily: FONT.mono,
  fontSize: size,
  letterSpacing: tracking,
  color,
});

const display = (size: number, color: string, tracking = -0.03): CSSProperties => ({
  fontFamily: FONT.display,
  fontSize: size,
  letterSpacing: size * tracking,
  color,
});

const row: CSSProperties = { display: 'flex', flexDirection: 'row' };
const col: CSSProperties = { display: 'flex', flexDirection: 'column' };

/**
 * Satori não ignora chaves de estilo com valor `undefined` — ele tenta parsear
 * e quebra. Por isso a chapa e o ornamento viram cor OU gradiente, nunca as
 * duas chaves com uma delas vazia.
 */
function fill(value: string): CSSProperties {
  return value.startsWith('linear-gradient') || value.startsWith('radial-gradient')
    ? { backgroundImage: value }
    : { backgroundColor: value };
}

/**
 * "EU AVALIEI:" antes do título.
 *
 * Faz o card se ler como uma frase — "Eu avaliei: Pulp Fiction" — em vez de um
 * título solto com uma marca no rodapé. A marca continua no rodapé como
 * assinatura; aqui ela é o começo da sentença, e é o que a pessoa lê primeiro.
 */
function Eyebrow({ size, color }: { size: number; color: string }) {
  return <div style={{ ...mono(size, size * 0.16, color) }}>EU AVALIEI:</div>;
}

/** Frase do usuário. Opcional, e presente em todas as variantes. */
function Caption({
  text,
  size,
  color,
}: {
  text: string;
  size: number;
  color: string;
}) {
  if (!text) return null;
  return (
    <div
      style={{
        fontFamily: FONT.sans,
        fontWeight: 500,
        fontSize: size,
        lineHeight: 1.15,
        color,
      }}
    >
      {text}
    </div>
  );
}

/** Barra de progresso horizontal (craque e square). */
function Bar({ value, edge, height = 3 }: { value: number; edge: string; height?: number }) {
  return (
    <div style={{ ...row, height, width: '100%', backgroundColor: 'rgba(244,241,234,0.12)' }}>
      <div
        style={{ height, width: `${Math.max(3, Math.round(value * 10))}%`, backgroundColor: edge }}
      />
    </div>
  );
}

/** Barra vertical (poster e wide), preenchida de baixo para cima. */
function Column({ value, edge, height }: { value: number; edge: string; height: number }) {
  return (
    <div
      style={{
        ...col,
        height,
        width: '100%',
        backgroundColor: 'rgba(244,241,234,0.12)',
        justifyContent: 'flex-end',
      }}
    >
      <div
        style={{
          width: '100%',
          height: `${Math.max(4, Math.round(value * 10))}%`,
          backgroundColor: edge,
        }}
      />
    </div>
  );
}

/** Arte da mídia, ou a chapa vazia com o rótulo da fonte. */
function Artwork({
  src,
  label,
  style,
}: {
  src: string | null | undefined;
  label: string;
  style: CSSProperties;
}) {
  if (src) {
    return (
      <div style={{ ...row, overflow: 'hidden', ...style }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
      </div>
    );
  }
  return (
    <div
      style={{
        ...row,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#141418',
        ...style,
      }}
    >
      <div style={mono(9, 1.44, COLOR.muted3)}>{label}</div>
    </div>
  );
}

function SafeArea({ width, height }: { width: number; height: number }) {
  // 250px topo e 300px base do destino 1920 → mesma proporção no tamanho base.
  const top = Math.round((250 / 1920) * height);
  const bottom = Math.round((300 / 1920) * height);
  const band: CSSProperties = {
    ...row,
    position: 'absolute',
    left: 0,
    width,
    backgroundColor: 'rgba(178,58,44,0.16)',
    justifyContent: 'center',
  };
  return (
    <div style={{ ...col, position: 'absolute', top: 0, left: 0, width, height }}>
      <div style={{ ...band, top: 0, height: top, alignItems: 'flex-end' }}>
        <div style={{ ...mono(8, 0.96, '#E8907F'), paddingBottom: 2 }}>250px UI</div>
      </div>
      <div style={{ ...band, bottom: 0, height: bottom, alignItems: 'flex-start' }}>
        <div style={{ ...mono(8, 0.96, '#E8907F'), paddingTop: 2 }}>300px UI</div>
      </div>
    </div>
  );
}

export function CardArt(input: CardRenderInput): ReactElement {
  const { variant, frame, width, height } = input;
  const lvl = levelFor(input.overall);
  const nota = formatScore(input.overall, input.scaleMax);
  const subtitle = [input.creator, input.year].filter(Boolean).join(' · ');
  const stats = input.stats.slice(0, 6);
  const shown = (v: number) => formatScore(v, input.scaleMax);

  if (variant === 'tall' && frame === 'poster') {
    const pad = 16;
    return (
      <div
        style={{
          ...col,
          position: 'relative',
          width,
          height,
          backgroundColor: COLOR.plateDark,
          border: `6px solid ${lvl.edge}`,
          overflow: 'hidden',
          fontFamily: FONT.sans,
        }}
      >
        <Artwork
          src={input.artwork}
          label="KEY ART"
          style={{ position: 'absolute', top: 0, left: 0, width, height }}
        />
        {/* Escurecimento na base: o texto precisa sobreviver a qualquer key art. */}
        <div
          style={{
            ...row,
            position: 'absolute',
            left: 0,
            bottom: 0,
            width,
            height: Math.round(height * 0.62),
            backgroundImage:
              'linear-gradient(to top,#0B0B0C 8%,rgba(11,11,12,0.86) 42%,rgba(11,11,12,0))',
          }}
        />
        <div
          style={{
            ...row,
            position: 'absolute',
            top: pad,
            left: pad,
            width: width - pad * 2,
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div
            style={{
              ...mono(9, 1.44, COLOR.ink),
              backgroundColor: 'rgba(11,11,12,0.7)',
              padding: '4px 7px',
            }}
          >
            {input.categoryLabel}
          </div>
          <div
            style={{
              ...mono(9, 1.44, lvl.edge),
              backgroundColor: 'rgba(11,11,12,0.7)',
              padding: '4px 7px',
            }}
          >
            {lvl.label}
          </div>
        </div>
        <div
          style={{
            ...col,
            position: 'absolute',
            left: pad,
            bottom: pad,
            width: width - pad * 2,
            gap: 10,
          }}
        >
          <div style={{ ...row, alignItems: 'flex-end', gap: 10 }}>
            <div style={{ ...display(88, lvl.edge, -0.04), lineHeight: 0.8 }}>{nota}</div>
            {/* Uma string só: texto + expressão seriam dois nós, e o Satori
                exige display:flex em qualquer div com mais de um filho. */}
            <div style={{ ...mono(9, 1.44, COLOR.muted2), paddingBottom: 8 }}>
              {`/ ${input.scaleMax}`}
            </div>
          </div>
          <div style={{ ...col, gap: 3 }}>
            <Eyebrow size={9} color={lvl.edge} />
            <div
              style={{
                ...display(26, COLOR.ink, -0.02),
                lineHeight: 1,
                textTransform: 'uppercase',
              }}
            >
              {input.title}
            </div>
            <div style={mono(10, 0.8, COLOR.muted)}>{subtitle}</div>
            <Caption text={input.caption} size={14} color={COLOR.inkSoft} />
          </div>
          <div style={{ ...row, gap: 6 }}>
            {stats.map((s) => (
              <div key={s.label} style={{ ...col, flex: 1, gap: 4 }}>
                <Column value={s.value} edge={lvl.edge} height={34} />
                <div style={{ ...mono(7, 0.42, COLOR.muted2), textTransform: 'uppercase' }}>
                  {abbreviate(s.label)}
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              ...row,
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid rgba(244,241,234,0.18)',
              paddingTop: 8,
            }}
          >
            {input.author ? (
              <div style={mono(9, 1.08, COLOR.muted)}>{input.author}</div>
            ) : (
              <div style={mono(9, 1.08, 'rgba(0,0,0,0)')}> </div>
            )}
            <div style={display(11, COLOR.ink, -0.01)}>Eu avaliei!</div>
          </div>
        </div>
        {input.showSafeArea ? <SafeArea width={width} height={height} /> : null}
      </div>
    );
  }

  if (variant === 'tall') {
    /**
     * Craque: a arte ocupa o card inteiro, e o conteúdo se apoia sobre ela.
     *
     * A versão anterior encaixava o pôster numa caixa de 332×236 — paisagem,
     * 1,41:1 — enquanto um pôster é retrato 2:3. O `cover` então descartava
     * topo e base e sobrava uma tira do meio. Em sangria total a proporção do
     * card (0,5625) é quase a do pôster (0,667), e quase nada se perde.
     *
     * O preço é legibilidade: texto pequeno sobre foto não se lê. Daí as duas
     * camadas — um degradê que escurece a base, e uma chapa translúcida atrás
     * das estatísticas, onde a densidade de texto é maior. A arte continua
     * visível através dela, que é o ponto.
     */
    const pad = 14;
    const inner = width - pad * 2;
    const statGap = 14;
    const platePad = 10;
    /** Respiro do painel translúcido que cobre o bloco inferior. */
    const panelPad = 12;
    // Desconta padding e borda da chapa: 2px de estouro fazem o flex-wrap
    // jogar tudo para uma coluna só.
    const statW = Math.floor((inner - panelPad * 2 - 2 - platePad * 2 - 2 - statGap) / 2);
    const hasArt = Boolean(input.artwork);

    return (
      <div
        style={{
          ...col,
          position: 'relative',
          width,
          height,
          overflow: 'hidden',
          fontFamily: FONT.sans,
          ...fill(hasArt ? COLOR.plateDark : lvl.plate),
          border: `3px solid ${lvl.edge}`,
        }}
      >
        {/* Sem arte a chapa da raridade já preenche o card; o placeholder
            centralizado ficaria por baixo do título. */}
        {hasArt ? (
          <>
            <Artwork
              src={input.artwork}
              label="PÔSTER"
              style={{ position: 'absolute', top: 0, left: 0, width, height }}
            />
            {/* Um degradê só, cobrindo o card inteiro.
                Antes eram dois elementos — um no topo, outro na base — e a
                aresta de cada um caía no meio da arte. Não produzia degrau de
                brilho, e por isso a varredura por diferença não achava: o que
                mudava era a INCLINAÇÃO da curva (0,43 por linha acima da
                aresta, 0,17 abaixo). O olho lê mudança brusca de inclinação
                como linha — bandas de Mach. Sem aresta, não há o que ler. */}
            <div
              style={{
                ...row,
                position: 'absolute',
                top: 0,
                left: 0,
                width,
                height,
                backgroundImage:
                  'linear-gradient(to bottom,rgba(8,8,10,0.86) 0%,rgba(8,8,10,0.32) 14%,rgba(8,8,10,0) 30%,rgba(8,8,10,0) 44%,rgba(8,8,10,0.30) 62%,rgba(8,8,10,0.78) 82%,rgba(8,8,10,0.96) 100%)',
              }}
            />
          </>
        ) : null}

        <div
          style={{
            ...row,
            position: 'absolute',
            top: pad,
            left: pad,
            width: inner,
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          <div style={col}>
            <div style={{ ...display(64, lvl.edge), lineHeight: 0.86 }}>{nota}</div>
            <div style={{ ...row, gap: 8, alignItems: 'center', marginTop: 4 }}>
              <div style={mono(9, 1.62, lvl.edge)}>{lvl.label}</div>
            </div>
          </div>
          <div style={{ ...col, alignItems: 'flex-end', gap: 6 }}>
            <div
              style={{
                ...mono(9, 1.44, COLOR.ink),
                padding: '4px 7px',
                border: `1px solid ${lvl.edge}`,
                backgroundColor: 'rgba(8,8,10,0.65)',
              }}
            >
              {input.categoryLabel}
            </div>
            <div
              style={{
                ...row,
                width: 26,
                height: 26,
                border: `1px solid ${lvl.edge}`,
                ...fill(lvl.ornament),
              }}
            />
          </div>
        </div>

        {/* Um painel só sobre a arte, em vez de degradê opaco: assim o pôster
            continua visível por baixo das estatísticas — o degradê forte
            apagava justamente a parte que deveria aparecer. */}
        <div
          style={{
            ...col,
            position: 'absolute',
            bottom: pad,
            left: pad,
            width: inner,
            padding: hasArt ? panelPad : 0,
            gap: 10,
            ...(hasArt
              ? {
                  backgroundColor: 'rgba(8,8,10,0.74)',
                  border: '1px solid rgba(244,241,234,0.13)',
                }
              : {}),
          }}
        >
          <div style={{ ...col, gap: 3 }}>
            <Eyebrow size={9} color={lvl.edge} />
            <div
              style={{
                ...display(23, COLOR.ink, -0.02),
                lineHeight: 1.02,
                textTransform: 'uppercase',
              }}
            >
              {input.title}
            </div>
            <div style={mono(10, 0.8, COLOR.inkDim)}>{subtitle}</div>
          </div>

          {/* A chapa das estatísticas: preto translúcido sobre a arte.
              Satori não tem display:grid — duas colunas de largura fixa. */}
          <div
            style={{
              ...row,
              flexWrap: 'wrap',
              width: inner,
              padding: platePad,
              rowGap: 8,
              columnGap: statGap,
              backgroundColor: 'rgba(244,241,234,0.05)',
              border: `1px solid ${hasArt ? 'rgba(244,241,234,0.10)' : COLOR.line3}`,
            }}
          >
            {stats.map((s) => (
              <div key={s.label} style={{ ...col, width: statW, gap: 3 }}>
                <div
                  style={{
                    ...row,
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    gap: 6,
                  }}
                >
                  <div style={{ ...mono(9, 1.08, COLOR.inkDim), textTransform: 'uppercase' }}>
                    {s.label}
                  </div>
                  <div
                    style={{
                      fontFamily: FONT.sans,
                      fontWeight: 700,
                      fontSize: 16,
                      lineHeight: 1,
                      color: COLOR.ink,
                    }}
                  >
                    {shown(s.value)}
                  </div>
                </div>
                <Bar value={s.value} edge={lvl.edge} />
              </div>
            ))}
          </div>

          <Caption text={input.caption} size={15} color={COLOR.inkSoft} />

          <div
            style={{
              ...row,
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid rgba(244,241,234,0.18)',
              paddingTop: 8,
            }}
          >
            {input.author ? (
              <div style={mono(9, 1.08, COLOR.inkDim)}>{input.author}</div>
            ) : (
              <div style={mono(9, 1.08, 'rgba(0,0,0,0)')}> </div>
            )}
            <div style={display(11, COLOR.ink, -0.01)}>Eu avaliei!</div>
          </div>
        </div>
        {input.showSafeArea ? <SafeArea width={width} height={height} /> : null}
      </div>
    );
  }

  if (variant === 'square' && frame === 'poster') {
    // Poster no quadrado: a mesma gramática do craque no story — arte em
    // sangria total, um degradê só na base, texto direto sobre ele. Sem chapa
    // translúcida própria: no poster, é o degradê que garante a leitura.
    const pad = 16;
    return (
      <div
        style={{
          ...col,
          position: 'relative',
          width,
          height,
          backgroundColor: COLOR.plateDark,
          border: `5px solid ${lvl.edge}`,
          overflow: 'hidden',
          fontFamily: FONT.sans,
        }}
      >
        <Artwork
          src={input.artwork}
          label="PÔSTER"
          style={{ position: 'absolute', top: 0, left: 0, width, height }}
        />
        <div
          style={{
            ...row,
            position: 'absolute',
            left: 0,
            bottom: 0,
            width,
            height: Math.round(height * 0.66),
            backgroundImage:
              'linear-gradient(to top,#0B0B0C 10%,rgba(11,11,12,0.88) 46%,rgba(11,11,12,0) 100%)',
          }}
        />
        <div
          style={{
            ...row,
            position: 'absolute',
            top: pad,
            left: pad,
            width: width - pad * 2,
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div
            style={{
              ...mono(8, 1.44, COLOR.ink),
              backgroundColor: 'rgba(11,11,12,0.7)',
              padding: '4px 7px',
            }}
          >
            {input.categoryLabel}
          </div>
          <div
            style={{
              ...mono(8, 1.44, lvl.edge),
              backgroundColor: 'rgba(11,11,12,0.7)',
              padding: '4px 7px',
            }}
          >
            {lvl.label}
          </div>
        </div>
        <div
          style={{
            ...col,
            position: 'absolute',
            left: pad,
            bottom: pad,
            width: width - pad * 2,
            gap: 8,
          }}
        >
          <div style={{ ...row, alignItems: 'flex-end', gap: 8 }}>
            <div style={{ ...display(50, lvl.edge, -0.04), lineHeight: 0.8 }}>{nota}</div>
            <div style={{ ...mono(8, 1.44, COLOR.muted2), paddingBottom: 6 }}>
              {`/ ${input.scaleMax}`}
            </div>
          </div>
          <div style={{ ...col, gap: 2 }}>
            <Eyebrow size={8} color={lvl.edge} />
            <div
              style={{
                ...display(18, COLOR.ink, -0.02),
                lineHeight: 1,
                textTransform: 'uppercase',
              }}
            >
              {input.title}
            </div>
            <div style={mono(9, 0.8, COLOR.muted)}>{subtitle}</div>
            <Caption text={input.caption} size={12} color={COLOR.inkSoft} />
          </div>
          <div style={{ ...row, gap: 5 }}>
            {stats.map((s) => (
              <div key={s.label} style={{ ...col, flex: 1, gap: 3 }}>
                <Column value={s.value} edge={lvl.edge} height={20} />
                <div style={{ ...mono(6, 0.4, COLOR.muted2), textTransform: 'uppercase' }}>
                  {abbreviate(s.label)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'square') {
    // Ficha: a mesma gramática do craque no story — arte em sangria total e
    // uma chapa translúcida só sobre o bloco de texto, pôster ainda visível
    // por baixo. Sem arte, a chapa da raridade preenche o quadrado inteiro.
    const pad = 16;
    const inner = width - pad * 2;
    const hasArt = Boolean(input.artwork);
    const panelPad = 10;
    const platePad = 8;
    const statGap = 10;
    const statW = Math.floor((inner - panelPad * 2 - 2 - platePad * 2 - 2 - statGap) / 2);

    return (
      <div
        style={{
          ...col,
          position: 'relative',
          width,
          height,
          overflow: 'hidden',
          fontFamily: FONT.sans,
          ...fill(hasArt ? COLOR.plateDark : lvl.plate),
          border: `3px solid ${lvl.edge}`,
        }}
      >
        {hasArt ? (
          <>
            <Artwork
              src={input.artwork}
              label="PÔSTER"
              style={{ position: 'absolute', top: 0, left: 0, width, height }}
            />
            <div
              style={{
                ...row,
                position: 'absolute',
                top: 0,
                left: 0,
                width,
                height,
                backgroundImage:
                  'linear-gradient(to bottom,rgba(8,8,10,0.82) 0%,rgba(8,8,10,0.28) 16%,rgba(8,8,10,0) 32%,rgba(8,8,10,0) 40%,rgba(8,8,10,0.34) 60%,rgba(8,8,10,0.80) 80%,rgba(8,8,10,0.96) 100%)',
              }}
            />
          </>
        ) : null}

        <div
          style={{
            ...row,
            position: 'absolute',
            top: pad,
            left: pad,
            width: inner,
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 8,
          }}
        >
          <div style={{ ...display(38, lvl.edge), lineHeight: 0.86 }}>{nota}</div>
          <div
            style={{
              ...mono(8, 1.44, COLOR.ink),
              padding: '3px 6px',
              border: `1px solid ${lvl.edge}`,
              backgroundColor: 'rgba(8,8,10,0.65)',
            }}
          >
            {input.categoryLabel}
          </div>
        </div>

        <div
          style={{
            ...col,
            position: 'absolute',
            bottom: pad,
            left: pad,
            width: inner,
            padding: hasArt ? panelPad : 0,
            gap: 8,
            ...(hasArt
              ? {
                  backgroundColor: 'rgba(8,8,10,0.74)',
                  border: '1px solid rgba(244,241,234,0.13)',
                }
              : {}),
          }}
        >
          <div style={{ ...col, gap: 2 }}>
            <Eyebrow size={8} color={lvl.edge} />
            <div
              style={{
                ...display(17, COLOR.ink, -0.02),
                lineHeight: 1.02,
                textTransform: 'uppercase',
              }}
            >
              {input.title}
            </div>
            <div style={mono(9, 0.8, COLOR.inkDim)}>{subtitle}</div>
          </div>

          <div
            style={{
              ...row,
              flexWrap: 'wrap',
              width: inner,
              padding: platePad,
              rowGap: 6,
              columnGap: statGap,
              backgroundColor: 'rgba(244,241,234,0.05)',
              border: `1px solid ${hasArt ? 'rgba(244,241,234,0.10)' : COLOR.line3}`,
            }}
          >
            {stats.map((s) => (
              <div key={s.label} style={{ ...col, width: statW, gap: 2 }}>
                <div
                  style={{
                    ...row,
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    gap: 6,
                  }}
                >
                  <div style={{ ...mono(7, 1.0, COLOR.inkDim), textTransform: 'uppercase' }}>
                    {s.label}
                  </div>
                  <div
                    style={{
                      fontFamily: FONT.sans,
                      fontWeight: 700,
                      fontSize: 12,
                      lineHeight: 1,
                      color: COLOR.ink,
                    }}
                  >
                    {shown(s.value)}
                  </div>
                </div>
                <Bar value={s.value} edge={lvl.edge} height={2} />
              </div>
            ))}
          </div>

          <Caption text={input.caption} size={11} color={COLOR.inkSoft} />
        </div>
      </div>
    );
  }

  // wide — usado no og:image (1200×630) e no anexo do X (1600×900).
  //
  // 210–225px de altura de base não sobra espaço para o tratamento de sangria
  // total do craque/poster do story — uma chapa com painel e grade 2 colunas
  // não cabe sem estourar ou espremer o resto a ponto de virar ilegível. A
  // arte fica como faixa lateral fixa nos dois casos; o que muda entre as
  // molduras é só o bloco de eixos: no poster ele fica solto sobre a chapa,
  // no ficha ganha uma caixa translúcida, com o valor de cada eixo à vista —
  // pouca altura a mais, mas o suficiente para não ser o mesmo card duas vezes.
  const artW = Math.round(width * 0.315);
  const isFicha = frame !== 'poster';
  return (
    <div
      style={{
        ...row,
        width,
        height,
        fontFamily: FONT.sans,
        ...fill(lvl.plate),
        border: `2px solid ${lvl.edge}`,
      }}
    >
      <Artwork
        src={input.artwork}
        label="PÔSTER"
        style={{ width: artW, height: '100%', flexShrink: 0 }}
      />
      <div style={{ ...col, flex: 1, padding: 14, gap: 8 }}>
        <div style={{ ...row, alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ ...row, alignItems: 'flex-end', gap: 8 }}>
            <div style={{ ...display(52, lvl.edge), lineHeight: 0.82 }}>{nota}</div>
            <div style={{ ...mono(8, 1.28, COLOR.muted2), paddingBottom: 6 }}>{lvl.label}</div>
          </div>
          <div style={display(11, COLOR.ink, -0.01)}>Eu avaliei!</div>
        </div>
        <div style={{ ...col, gap: 3 }}>
          <Eyebrow size={8} color={lvl.edge} />
          <div
            style={{
              ...display(18, COLOR.ink, -0.02),
              lineHeight: 1.02,
              textTransform: 'uppercase',
            }}
          >
            {input.title}
          </div>
          <div style={mono(9, 0.72, COLOR.muted2)}>{subtitle}</div>
          <Caption text={input.caption} size={12} color={COLOR.inkSoft} />
        </div>
        <div
          style={{
            ...row,
            marginTop: 'auto',
            gap: 6,
            ...(isFicha
              ? {
                  padding: '6px 8px',
                  backgroundColor: 'rgba(244,241,234,0.05)',
                  border: `1px solid ${COLOR.line3}`,
                }
              : {}),
          }}
        >
          {stats.map((s) => (
            <div key={s.label} style={{ ...col, flex: 1, gap: 3 }}>
              <Column value={s.value} edge={lvl.edge} height={22} />
              <div style={{ ...row, justifyContent: 'space-between', gap: 4 }}>
                <div style={{ ...mono(7, 0.35, COLOR.muted2), textTransform: 'uppercase' }}>
                  {abbreviate(s.label)}
                </div>
                {isFicha ? (
                  <div style={{ fontFamily: FONT.sans, fontWeight: 700, fontSize: 9, color: COLOR.ink }}>
                    {shown(s.value)}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
