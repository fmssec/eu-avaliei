'use client';

import { useEffect, useRef, useState } from 'react';
import { formatScore } from '@/lib/scale';
import { levelFor } from '@/lib/design';
import {
  apagarAvaliacao,
  exportarHistorico,
  importarHistorico,
  limparHistorico,
  listarAvaliacoes,
  type SavedRating,
} from '@/lib/client/history';
import styles from './editor.module.css';

/**
 * As avaliações que esta pessoa já fez, neste aparelho.
 *
 * Fica na tela inicial porque é onde ela chega quando volta: o valor de guardar
 * é justamente rever, e esconder atrás de um menu anularia isso.
 */
export function Historico({
  onAbrir,
  onNotify,
}: {
  onAbrir: (rating: SavedRating) => void;
  onNotify: (message: string) => void;
}) {
  const [avaliacoes, setAvaliacoes] = useState<SavedRating[] | null>(null);
  const inputArquivo = useRef<HTMLInputElement>(null);

  const recarregar = () => void listarAvaliacoes().then(setAvaliacoes);
  useEffect(recarregar, []);

  // `null` = ainda lendo. Não renderiza nada até saber, para não piscar.
  if (avaliacoes === null || avaliacoes.length === 0) return null;

  async function baixar() {
    const blob = await exportarHistorico();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eu-avaliei-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function importar(arquivo: File | undefined) {
    if (!arquivo) return;
    try {
      const n = await importarHistorico(arquivo);
      recarregar();
      onNotify(`${n} AVALIAÇÃO${n === 1 ? '' : 'ÕES'} IMPORTADA${n === 1 ? '' : 'S'}`);
    } catch {
      onNotify('ARQUIVO NÃO RECONHECIDO');
    }
  }

  return (
    <div className={styles.historico}>
      <div className={styles.demoHead}>
        <span className={styles.fieldLabel}>MINHAS AVALIAÇÕES</span>
        <span className={styles.demoTag}>{avaliacoes.length}</span>
      </div>

      <div className={styles.historicoLista}>
        {avaliacoes.map((r) => {
          const nivel = levelFor(r.overall);
          return (
            <div key={r.id} className={styles.historicoItem}>
              <button
                type="button"
                className={styles.historicoAbrir}
                onClick={() => onAbrir(r)}
              >
                <span className={styles.historicoNota} style={{ color: nivel.edge }}>
                  {formatScore(r.overall, r.scaleMax)}
                </span>
                <span className={styles.resultBody}>
                  <span className={styles.historicoTitulo}>{r.title}</span>
                  <span className={styles.resultMeta}>
                    {[r.creator, r.year].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </button>
              <button
                type="button"
                className={styles.historicoApagar}
                aria-label={`Apagar avaliação de ${r.title}`}
                onClick={async () => {
                  await apagarAvaliacao(r.id);
                  recarregar();
                }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      <div className={styles.historicoAcoes}>
        <button type="button" className={styles.artButton} onClick={baixar}>
          EXPORTAR
        </button>
        <button
          type="button"
          className={styles.artButton}
          onClick={() => inputArquivo.current?.click()}
        >
          IMPORTAR
        </button>
        <button
          type="button"
          className={styles.artButton}
          onClick={async () => {
            await limparHistorico();
            recarregar();
            onNotify('HISTÓRICO APAGADO');
          }}
        >
          APAGAR TUDO
        </button>
      </div>

      <input
        ref={inputArquivo}
        type="file"
        accept="application/json"
        hidden
        onChange={(e) => {
          void importar(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      <div className={styles.hint}>
        FICA SÓ NESTE APARELHO · TROCAR DE CELULAR OU LIMPAR O NAVEGADOR APAGA
      </div>
    </div>
  );
}
