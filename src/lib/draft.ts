import type { BookDraft } from '../db/repo';
import type { LookupResult } from './lookup';

/**
 * Rascunhos passados da tela "Adicionar" para o formulário (evita parâmetros enormes na rota).
 * Cada rascunho tem uma chave que vai na rota; ler não apaga, então o formulário pode ser
 * montado mais de uma vez sem perder os dados. Só os últimos rascunhos ficam guardados.
 */
export type Draft = {
  data: Partial<BookDraft>;
  /** Busca que ainda está completando autor, páginas e capa. */
  pending?: Promise<LookupResult | null>;
};

const drafts = new Map<string, Draft>();
let counter = 0;

export function putDraft(data: Partial<BookDraft>, pending?: Promise<LookupResult | null>): string {
  const key = `d${Date.now()}-${++counter}`;
  drafts.set(key, { data, pending });
  while (drafts.size > 5) drafts.delete(drafts.keys().next().value as string);
  return key;
}

export function getDraft(key: string | undefined): Draft | null {
  return key ? drafts.get(key) ?? null : null;
}
