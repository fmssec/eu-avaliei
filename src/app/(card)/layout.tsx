import './card.css';

/**
 * Root layout exclusivo da landing do card.
 *
 * Ele existe separado do layout do editor por um motivo só: manter o <head>
 * minúsculo. O parser de preview do WhatsApp lê apenas os primeiros KB do
 * <head>, e CSS ou JS inline grande antes das meta tags faz o preview falhar
 * em silêncio (spec §3.2). Por isso aqui não entra next/font, que injeta CSS
 * inline — as fontes vêm por @font-face num arquivo externo.
 */
export default function CardLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
