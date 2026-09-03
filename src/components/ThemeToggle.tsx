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
      {/* suppressHydrationWarning: o ícone depende do tema, que só é
          conhecido no cliente — no servidor não renderiza nenhum dos dois. */}
      <span suppressHydrationWarning>
        {theme === null ? null : isLight ? <MoonIcon /> : <SunIcon />}
      </span>
    </button>
  );
}

function SunIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
