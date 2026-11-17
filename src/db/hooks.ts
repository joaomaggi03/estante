import { useMemo, useSyncExternalStore } from 'react';
import { getVersion, subscribe } from './database';
import { getBook, getSetting, listBooks, listShelves } from './repo';
import type { Book, BookStatus, Shelf } from './types';

/** Versão do banco: muda a cada escrita, fazendo os hooks abaixo lerem de novo. */
function useDbVersion(): number {
  return useSyncExternalStore(subscribe, getVersion);
}

export function useBooks(): Book[] {
  const v = useDbVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => listBooks(), [v]);
}

export function useBook(id: string | undefined): Book | null {
  const v = useDbVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => (id ? getBook(id) : null), [id, v]);
}

export function useShelves(status: BookStatus): Shelf[] {
  const v = useDbVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => listShelves(status), [status, v]);
}

export function useSetting(key: string): string | null {
  const v = useDbVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => getSetting(key), [key, v]);
}

export function useGoal(): number {
  const year = new Date().getFullYear();
  const v = useSetting(`goal:${year}`);
  const n = v ? Number(v) : 12;
  return Number.isFinite(n) && n > 0 ? n : 12;
}
