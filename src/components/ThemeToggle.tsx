'use client';

import { useEffect, useState } from 'react';
import styles from './editor.module.css';

/**
 * Alternância entre claro e escuro.
 *
 * Três estados, não dois: claro, escuro e "seguir o sistema", que é o padrão.
 * Só uma escolha explícita grava no localStorage — quem nunca tocou no botão
 * continua acompanhando o sistema quando ele mudar.
 *
 * O script que evita o flash de tema errado está no layout, e roda antes da
 * primeira pintura. Aqui só refletimos e gravamos.
 */

type Theme = 'light' | 'dark';
const KEY = 'eu-avaliei:theme';

function systemTheme(): Theme {
  return typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
}

export function ThemeToggle() {
  // Sem estado inicial no servidor: o HTML sai igual para todo mundo e o
  // efeito abaixo corrige no cliente. Evita erro de hidratação.
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const stored = (() => {
      try {
        return localStorage.getItem(KEY);
      } catch {
        return null;
      }
    })();
    setTheme(stored === 'light' || stored === 'dark' ? stored : systemTheme());
  }, []);

  function toggle() {
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Janela privada: o tema vale para esta sessão e não persiste.
    }
  }

  const isLight = theme === 'light';

  return (
    <button
      type="button"
      className={styles.themeToggle}
      onClick={toggle}
      aria-label={isLight ? 'Mudar para o tema escuro' : 'Mudar para o tema claro'}
      title={isLight ? 'Tema escuro' : 'Tema claro'}
    >
      {/* suppressHydrationWarning: o rótulo depende do tema, que só é
          conhecido no cliente. */}
      <span suppressHydrationWarning>{theme === null ? '' : isLight ? 'ESCURO' : 'CLARO'}</span>
    </button>
  );
}
