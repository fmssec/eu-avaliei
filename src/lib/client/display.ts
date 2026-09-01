'use client';

import { useEffect, useState } from 'react';
import { FORMATS, type FormatId } from '../formats';

/**
 * Largura em pixels reais que um preview precisa ter para sair nítido.
 *
 * O preview é uma imagem rasterizada pelo servidor, então pedir menos pixels
 * do que a tela usa significa o navegador ampliar — e ampliar borra o texto
 * pequeno e transforma bordas de 1px, como a do painel translúcido, em faixas
 * visíveis. Foi o que aconteceu quando fixei uma largura única de 640: cobria
 * um painel de 400 CSS px em tela comum, mas faltava metade em tela retina.
 *
 * A conta certa é largura em CSS × densidade da tela, limitada ao tamanho real
 * do formato — não adianta pedir mais pixels do que o card tem.
 */

/** Densidade da tela. Começa em 2 para a primeira pintura já sair nítida em
 *  retina; corrige depois de montar, quando o valor real é conhecido. */
export function useDevicePixelRatio(): number {
  const [dpr, setDpr] = useState(2);

  useEffect(() => {
    const atualizar = () => setDpr(Math.min(3, Math.max(1, window.devicePixelRatio || 1)));
    atualizar();
    // Arrastar a janela entre monitores de densidades diferentes muda o valor.
    const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mq.addEventListener?.('change', atualizar);
    return () => mq.removeEventListener?.('change', atualizar);
  }, []);

  return dpr;
}

/**
 * Converte a largura de exibição em CSS para a largura a pedir do renderizador.
 * Arredonda para múltiplos de 20px: pequenas variações de layout não valem uma
 * URL nova, e URLs estáveis são o que faz o cache do preview servir para algo.
 */
export function displayWidthFor(cssWidth: number, dpr: number, format: FormatId): number {
  const alvo = Math.ceil((cssWidth * dpr) / 20) * 20;
  return Math.min(alvo, FORMATS[format].width);
}
