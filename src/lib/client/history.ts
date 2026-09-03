'use client';

import type { Category, FrameId } from '../types';
import type { ScaleMax } from '../scale';

/**
 * Histórico de avaliações, no aparelho de quem avaliou.
 *
 * Guardar no navegador — e não no servidor — é o que mantém a promessa de não
 * ter login sem exigir identidade nenhuma: não há conta, não há token, não há
 * nada nosso para vazar, e a hospedagem continua sem estado.
 *
 * O preço é honesto e precisa ser dito na interface: trocar de aparelho ou
 * limpar o navegador apaga o histórico. Por isso existe exportar/importar.
 *
 * IndexedDB, e não localStorage, por causa da imagem própria: quando alguém
 * anexa a própria arte, ela é guardada como Blob junto da avaliação. Em
 * localStorage isso estouraria a cota de 5 MB em poucas imagens, e o link do
 * upload no servidor é cache de sessão — expira.
 */

const DB_NAME = 'eu-avaliei';
const DB_VERSION = 1;
const STORE = 'avaliacoes';

export interface SavedRating {
  id: string;
  createdAt: string;
  /** Identifica a mídia na fonte, para reabrir com dados frescos se preciso. */
  externalId: string;
  title: string;
  creator: string;
  year: number | null;
  category: Category;
  overall: number;
  scaleMax: ScaleMax;
  stats: { label: string; value: number }[];
  frame: FrameId;
  caption: string;
  author: string;
  /** Arte da fonte de metadados (URL do nosso proxy), quando houver. */
  artworkUrl: string | null;
  /** Arte própria, guardada inteira: o upload no servidor expira. */
  artworkBlob?: Blob;
}

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function comStore<T>(
  modo: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  const db = await abrir();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, modo);
      const req = fn(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

/**
 * O IndexedDB pode simplesmente não existir: janela privada em alguns
 * navegadores, armazenamento bloqueado, cota esgotada. Nenhuma dessas
 * situações pode impedir alguém de fazer e compartilhar um card — o histórico
 * é conveniência, não requisito.
 */
export function historicoDisponivel(): boolean {
  return typeof indexedDB !== 'undefined';
}

export async function salvarAvaliacao(rating: SavedRating): Promise<void> {
  if (!historicoDisponivel()) return;
  try {
    await comStore('readwrite', (store) => store.put(rating));
  } catch {
    // Cota estourada ou storage bloqueado: seguir sem histórico.
  }
}

export async function listarAvaliacoes(): Promise<SavedRating[]> {
  if (!historicoDisponivel()) return [];
  try {
    const todas = await comStore<SavedRating[]>('readonly', (store) => store.getAll());
    // Mais recentes primeiro.
    return todas.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export async function apagarAvaliacao(id: string): Promise<void> {
  if (!historicoDisponivel()) return;
  try {
    await comStore('readwrite', (store) => store.delete(id));
  } catch {
    // ignora
  }
}

export async function limparHistorico(): Promise<void> {
  if (!historicoDisponivel()) return;
  try {
    await comStore('readwrite', (store) => store.clear());
  } catch {
    // ignora
  }
}

/**
 * Identidade da avaliação: a mesma mídia avaliada de novo substitui a anterior
 * em vez de duplicar. Quem reavalia um filme está corrigindo a nota, não
 * criando um segundo registro.
 */
export function idDaAvaliacao(externalId: string): string {
  return externalId;
}

/** Exportar e importar existem porque o histórico mora só neste aparelho. */
export async function exportarHistorico(): Promise<Blob> {
  const avaliacoes = await listarAvaliacoes();
  // Blob não sobrevive a JSON: a arte própria vira base64 na exportação.
  const serializaveis = await Promise.all(
    avaliacoes.map(async ({ artworkBlob, ...resto }) => ({
      ...resto,
      artworkData: artworkBlob ? await blobParaDataUrl(artworkBlob) : undefined,
    })),
  );
  return new Blob([JSON.stringify({ versao: 1, avaliacoes: serializaveis }, null, 2)], {
    type: 'application/json',
  });
}

export async function importarHistorico(arquivo: File): Promise<number> {
  const texto = await arquivo.text();
  const dados = JSON.parse(texto) as {
    versao?: number;
    avaliacoes?: (Omit<SavedRating, 'artworkBlob'> & { artworkData?: string })[];
  };
  if (!Array.isArray(dados.avaliacoes)) throw new Error('Arquivo não reconhecido');

  let importadas = 0;
  for (const { artworkData, ...resto } of dados.avaliacoes) {
    await salvarAvaliacao({
      ...resto,
      artworkBlob: artworkData ? await dataUrlParaBlob(artworkData) : undefined,
    });
    importadas++;
  }
  return importadas;
}

function blobParaDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function dataUrlParaBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}
