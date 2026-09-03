import type { Metadata } from 'next';
import { CatalogoClient } from './CatalogoClient';

export const metadata: Metadata = {
  title: 'Meu catálogo · Eu avaliei!',
  description: 'Tudo que você já avaliou, guardado neste aparelho.',
};

export default function CatalogoPage() {
  return <CatalogoClient />;
}
