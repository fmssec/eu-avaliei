'use client';

import { useRef, useState } from 'react';
import styles from './editor.module.css';

/**
 * Anexar arte própria — arquivo do dispositivo ou link.
 *
 * Vale por dois motivos distintos. O prático: mídia que não existe na base
 * (curta, zine, álbum independente, filme do festival) hoje fica sem imagem.
 * E o estrutural: pôster de estúdio é obra de terceiro, e um card com imagem
 * do próprio usuário não depende de licença de ninguém.
 *
 * Os dois caminhos terminam no mesmo POST: o servidor reprocessa a imagem e
 * devolve uma URL nossa. O componente nunca manda bytes para o preview.
 */

interface Props {
  value: string | null;
  onChange: (artworkUrl: string | null) => void;
  onNotify: (message: string) => void;
  /** Arte que veio da fonte de metadados, quando existe. */
  fallbackUrl?: string | null;
}

const ACCEPT = 'image/png,image/jpeg,image/webp,image/avif,image/gif';

export function ArtworkPicker({ value, onChange, onNotify, fallbackUrl }: Props) {
  const [busy, setBusy] = useState(false);
  const [linkMode, setLinkMode] = useState(false);
  const [link, setLink] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  async function send(body: FormData | string) {
    setBusy(true);
    try {
      const res = await fetch('/api/uploads', {
        method: 'POST',
        ...(typeof body === 'string'
          ? { headers: { 'Content-Type': 'application/json' }, body }
          : { body }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        onNotify((data.error ?? 'NÃO FOI POSSÍVEL USAR ESSA IMAGEM').toUpperCase());
        return;
      }
      onChange(data.url);
      setLink('');
      setLinkMode(false);
    } catch {
      onNotify('FALHA AO ENVIAR A IMAGEM');
    } finally {
      setBusy(false);
    }
  }

  function pickFile(file: File | undefined) {
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    void send(form);
  }

  const current = value ?? fallbackUrl ?? null;

  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>
        IMAGEM
        <span>{value ? 'SUA IMAGEM' : fallbackUrl ? 'DA BASE' : 'SEM IMAGEM'}</span>
      </span>

      <div className={styles.artRow}>
        <div className={styles.artThumb}>
          {current ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.artThumbImg} src={current} alt="Arte escolhida" />
          ) : (
            <span className={styles.artThumbEmpty} aria-hidden />
          )}
        </div>

        <div className={styles.artActions}>
          <button
            type="button"
            className={styles.artButton}
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            {busy ? 'ENVIANDO…' : 'ESCOLHER ARQUIVO'}
          </button>

          <button
            type="button"
            className={styles.artButton}
            disabled={busy}
            onClick={() => setLinkMode((v) => !v)}
            aria-expanded={linkMode}
          >
            {linkMode ? 'CANCELAR LINK' : 'USAR UM LINK'}
          </button>

          {value ? (
            <button
              type="button"
              className={styles.artButton}
              disabled={busy}
              onClick={() => onChange(null)}
            >
              REMOVER
            </button>
          ) : null}
        </div>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          pickFile(e.target.files?.[0]);
          // Zera para que escolher o mesmo arquivo de novo dispare o evento.
          e.target.value = '';
        }}
      />

      {linkMode ? (
        <div className={styles.artLinkRow}>
          <input
            className={styles.textInput}
            value={link}
            type="url"
            inputMode="url"
            placeholder="https://…"
            aria-label="Link da imagem"
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && link.trim() && !busy) {
                void send(JSON.stringify({ url: link.trim() }));
              }
            }}
          />
          <button
            type="button"
            className={styles.artButton}
            disabled={busy || !link.trim()}
            onClick={() => void send(JSON.stringify({ url: link.trim() }))}
          >
            {busy ? '…' : 'USAR'}
          </button>
        </div>
      ) : null}

    </div>
  );
}
