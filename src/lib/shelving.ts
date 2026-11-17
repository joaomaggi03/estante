import type { Book, BookStatus, Shelf } from '../db/types';
import { monthLabel, yearOf } from './dates';
import { hueOf, spineColorOf } from './spine';

export type SortKey = 'year' | 'recent' | 'rating' | 'title' | 'author' | 'size' | 'color' | 'manual';
export type SortDir = 'asc' | 'desc';

export const SORT_OPTIONS: { key: SortKey; label: string; icon: string }[] = [
  { key: 'manual', label: 'Minha ordem', icon: 'hand-left-outline' },
  { key: 'year', label: 'Por ano de leitura', icon: 'calendar-outline' },
  { key: 'recent', label: 'Lidos mais recentemente', icon: 'time-outline' },
  { key: 'rating', label: 'Mais bem avaliados', icon: 'star-outline' },
  { key: 'title', label: 'Título (A–Z)', icon: 'text-outline' },
  { key: 'author', label: 'Autor (A–Z)', icon: 'person-outline' },
  { key: 'size', label: 'Tamanho (páginas)', icon: 'resize-outline' },
  { key: 'color', label: 'Cor da lombada', icon: 'color-palette-outline' },
];

export const DEFAULT_DIR: Record<SortKey, SortDir> = {
  manual: 'asc',
  year: 'desc',
  recent: 'desc',
  rating: 'desc',
  title: 'asc',
  author: 'asc',
  size: 'desc',
  color: 'asc',
};

export function sortLabel(key: SortKey, status: BookStatus): string {
  if (key === 'year') return status === 'read' ? 'Por ano de leitura' : 'Por ano';
  if (key === 'recent') return status === 'read' ? 'Lidos mais recentemente' : 'Adicionados recentemente';
  return SORT_OPTIONS.find((o) => o.key === key)?.label ?? '';
}

export type ShelfGroup = {
  key: string;
  label: string;
  shelfId?: string | null; // só em "Minha ordem" (null = Recém-chegados)
  books: Book[];
};

/** Data usada para ordenar/agrupar por tempo, conforme a aba. */
export function relevantDate(b: Book): string | null {
  if (b.status === 'read') return b.endDate;
  if (b.status === 'reading') return b.startDate ?? b.createdAt.slice(0, 10);
  return b.createdAt.slice(0, 10);
}

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base' });

function firstLetter(s: string | null | undefined): string {
  const c = (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : '#';
}

const LETTER_RANGES = ['A–D', 'E–H', 'I–L', 'M–P', 'Q–T', 'U–Z'];
function letterRange(c: string): string {
  if (c === '#') return '#';
  const i = Math.min(5, Math.floor((c.charCodeAt(0) - 65) / 4));
  return LETTER_RANGES[i];
}

function authorSortKey(a: string | null): string {
  if (!a) return '';
  // Ordena pelo sobrenome do primeiro autor.
  const first = a.split(',')[0].trim();
  const parts = first.split(/\s+/);
  return parts[parts.length - 1] + ' ' + first;
}

function ratingLabel(r: number | null): string {
  if (r == null) return 'Sem nota';
  return `${'★'.repeat(Math.floor(r))}${r % 1 ? '½' : ''}  ${String(r).replace('.', ',')}`;
}

function groupBy(books: Book[], keyFn: (b: Book) => string, labelFn: (k: string) => string = (k) => k): ShelfGroup[] {
  const groups: ShelfGroup[] = [];
  const map = new Map<string, ShelfGroup>();
  for (const b of books) {
    const k = keyFn(b);
    let g = map.get(k);
    if (!g) {
      g = { key: k, label: labelFn(k), books: [] };
      map.set(k, g);
      groups.push(g);
    }
    g.books.push(b);
  }
  return groups;
}

export function buildGroups(
  books: Book[],
  sort: SortKey,
  dir: SortDir,
  shelves: Shelf[] = [],
): ShelfGroup[] {
  const m = dir === 'asc' ? 1 : -1;
  const list = [...books];

  switch (sort) {
    case 'manual': {
      const recent = list.filter((b) => !b.shelfId || !shelves.some((s) => s.id === b.shelfId));
      const byPos = (a: Book, b: Book) => (a.shelfPosition ?? 0) - (b.shelfPosition ?? 0);
      const groups: ShelfGroup[] = [];
      if (recent.length) groups.push({ key: 'recent', label: 'Recém-chegados', shelfId: null, books: recent.sort(byPos) });
      for (const s of shelves) {
        groups.push({
          key: s.id,
          label: s.name,
          shelfId: s.id,
          books: list.filter((b) => b.shelfId === s.id).sort(byPos),
        });
      }
      return groups;
    }
    case 'year': {
      list.sort((a, b) => m * ((relevantDate(a) ?? '').localeCompare(relevantDate(b) ?? '')));
      const groups = groupBy(list, (b) => String(yearOf(relevantDate(b)) ?? 'Sem data'));
      return moveLast(groups, 'Sem data');
    }
    case 'recent': {
      list.sort((a, b) => m * ((relevantDate(a) ?? '').localeCompare(relevantDate(b) ?? '')));
      const groups = groupBy(list, (b) => {
        const d = relevantDate(b);
        return d ? monthLabel(d) : 'Sem data';
      });
      return moveLast(groups, 'Sem data');
    }
    case 'rating': {
      list.sort((a, b) => {
        if (a.rating == null) return 1;
        if (b.rating == null) return -1;
        return m * (a.rating - b.rating) || collator.compare(a.title, b.title);
      });
      return groupBy(list, (b) => (b.rating == null ? 'none' : String(b.rating)), (k) =>
        ratingLabel(k === 'none' ? null : Number(k)),
      );
    }
    case 'title': {
      list.sort((a, b) => m * collator.compare(a.title, b.title));
      return groupBy(list, (b) => letterRange(firstLetter(b.title)));
    }
    case 'author': {
      list.sort((a, b) => m * collator.compare(authorSortKey(a.author), authorSortKey(b.author)));
      return groupBy(list, (b) => (b.author ? letterRange(firstLetter(authorSortKey(b.author))) : 'Sem autor'));
    }
    case 'size': {
      list.sort((a, b) => m * ((a.pageCount ?? 0) - (b.pageCount ?? 0)));
      return [{ key: 'all', label: '', books: list }];
    }
    case 'color': {
      list.sort((a, b) => m * (hueOf(spineColorOf(a)) - hueOf(spineColorOf(b))));
      return [{ key: 'all', label: '', books: list }];
    }
  }
}

function moveLast(groups: ShelfGroup[], key: string): ShelfGroup[] {
  const i = groups.findIndex((g) => g.key === key);
  if (i < 0) return groups;
  const [g] = groups.splice(i, 1);
  groups.push(g);
  return groups;
}

/** Divide os livros de um grupo em fileiras (tábuas) que cabem na largura disponível. */
export function chunkRows<T>(items: T[], widthOf: (t: T) => number, maxWidth: number, gap = 2): T[][] {
  const rows: T[][] = [];
  let row: T[] = [];
  let used = 0;
  for (const it of items) {
    const w = widthOf(it);
    const need = row.length ? used + gap + w : w;
    if (row.length && need > maxWidth) {
      rows.push(row);
      row = [it];
      used = w;
    } else {
      row.push(it);
      used = need;
    }
  }
  if (row.length || rows.length === 0) rows.push(row);
  return rows;
}
