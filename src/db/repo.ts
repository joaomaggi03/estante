import * as Crypto from 'expo-crypto';
import { getDb, notifyChange } from './database';
import type { Book, BookStatus, Shelf } from './types';
import { todayISO } from '../lib/dates';

const BOOK_COLUMNS: (keyof Book)[] = [
  'id', 'title', 'author', 'isbn', 'status', 'rating', 'review', 'startDate', 'endDate',
  'coverUrl', 'coverPath', 'pageCount', 'spineColor', 'spinePhotoPath', 'shelfId',
  'shelfPosition', 'createdAt', 'updatedAt',
];

export function newId(): string {
  return Crypto.randomUUID();
}

function nowISO() {
  return new Date().toISOString();
}

// ---------- Livros ----------

export function listBooks(): Book[] {
  return getDb().getAllSync<Book>('SELECT * FROM books');
}

export function getBook(id: string): Book | null {
  return getDb().getFirstSync<Book>('SELECT * FROM books WHERE id = ?', [id]) ?? null;
}

export type BookDraft = Partial<Omit<Book, 'id' | 'createdAt' | 'updatedAt'>> & { title: string };

/** Aplica as regras automáticas de datas ao entrar em um status. */
export function applyStatusRules<T extends Partial<Book>>(b: T, prevStatus?: BookStatus | null): T {
  const out = { ...b };
  if (out.status && out.status !== prevStatus) {
    if (out.status === 'reading' && !out.startDate) out.startDate = todayISO();
    if (out.status === 'read' && !out.endDate) out.endDate = todayISO();
  }
  return out;
}

function upsertRow(book: Book) {
  const placeholders = BOOK_COLUMNS.map(() => '?').join(', ');
  const values = BOOK_COLUMNS.map((c) => (book[c] === undefined ? null : book[c])) as (string | number | null)[];
  getDb().runSync(
    `INSERT OR REPLACE INTO books (${BOOK_COLUMNS.join(', ')}) VALUES (${placeholders})`,
    values,
  );
}

export function createBook(draft: BookDraft): Book {
  const now = nowISO();
  const withRules = applyStatusRules({ status: 'want' as BookStatus, ...draft }, null);
  const book: Book = {
    id: newId(),
    title: withRules.title.trim(),
    author: withRules.author?.trim() || null,
    isbn: withRules.isbn || null,
    status: withRules.status ?? 'want',
    rating: withRules.rating ?? null,
    review: withRules.review ?? null,
    startDate: withRules.startDate ?? null,
    endDate: withRules.endDate ?? null,
    coverUrl: withRules.coverUrl ?? null,
    coverPath: withRules.coverPath ?? null,
    pageCount: withRules.pageCount ?? null,
    spineColor: withRules.spineColor ?? null,
    spinePhotoPath: withRules.spinePhotoPath ?? null,
    shelfId: null,
    shelfPosition: -Date.now(), // Recém-chegados: mais novo primeiro
    createdAt: now,
    updatedAt: now,
  };
  upsertRow(book);
  notifyChange();
  return book;
}

export function updateBook(id: string, patch: Partial<Book>): Book | null {
  const current = getBook(id);
  if (!current) return null;
  let next: Book = applyStatusRules({ ...current, ...patch }, current.status);
  if (patch.status && patch.status !== current.status) {
    // Mudou de aba: vai para "Recém-chegados" da nova aba.
    next = { ...next, shelfId: null, shelfPosition: -Date.now() };
  }
  next.updatedAt = nowISO();
  upsertRow(next);
  notifyChange();
  return next;
}

export function deleteBook(id: string) {
  getDb().runSync('DELETE FROM books WHERE id = ?', [id]);
  notifyChange();
}

function normalize(s: string | null | undefined) {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function findDuplicate(isbn: string | null | undefined, title: string, author: string | null | undefined, ignoreId?: string): Book | null {
  const books = listBooks().filter((b) => b.id !== ignoreId);
  if (isbn) {
    const byIsbn = books.find((b) => b.isbn && b.isbn === isbn);
    if (byIsbn) return byIsbn;
  }
  const t = normalize(title);
  const a = normalize(author);
  if (!t) return null;
  return books.find((b) => normalize(b.title) === t && normalize(b.author) === a) ?? null;
}

/** Insere/atualiza um livro mantendo o id (usado pela importação). */
export function upsertBookRaw(book: Book) {
  upsertRow(book);
}

// ---------- Prateleiras ----------

export function listShelves(status: BookStatus): Shelf[] {
  return getDb().getAllSync<Shelf>('SELECT * FROM shelves WHERE status = ? ORDER BY position', [status]);
}

export function listAllShelves(): Shelf[] {
  return getDb().getAllSync<Shelf>('SELECT * FROM shelves ORDER BY status, position');
}

export function createShelf(status: BookStatus, name: string, position?: number, notify = true): Shelf {
  const now = nowISO();
  const pos = position ?? listShelves(status).length;
  const shelf: Shelf = { id: newId(), status, name, position: pos, createdAt: now, updatedAt: now };
  getDb().runSync(
    'INSERT INTO shelves (id, status, name, position, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
    [shelf.id, shelf.status, shelf.name, shelf.position, now, now],
  );
  if (notify) notifyChange();
  return shelf;
}

export function upsertShelfRaw(s: Shelf) {
  getDb().runSync(
    'INSERT OR REPLACE INTO shelves (id, status, name, position, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
    [s.id, s.status, s.name, s.position, s.createdAt, s.updatedAt],
  );
}

export function renameShelf(id: string, name: string) {
  getDb().runSync('UPDATE shelves SET name = ?, updatedAt = ? WHERE id = ?', [name, nowISO(), id]);
  notifyChange();
}

export function deleteShelf(id: string) {
  const d = getDb();
  d.withTransactionSync(() => {
    d.runSync('UPDATE books SET shelfId = NULL, shelfPosition = ? WHERE shelfId = ?', [-Date.now(), id]);
    d.runSync('DELETE FROM shelves WHERE id = ?', [id]);
  });
  notifyChange();
}

/** Move a prateleira uma posição para cima (-1) ou para baixo (+1). */
export function moveShelf(status: BookStatus, id: string, delta: -1 | 1) {
  const shelves = listShelves(status);
  const i = shelves.findIndex((s) => s.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= shelves.length) return;
  [shelves[i], shelves[j]] = [shelves[j], shelves[i]];
  const d = getDb();
  d.withTransactionSync(() => {
    shelves.forEach((s, idx) => d.runSync('UPDATE shelves SET position = ? WHERE id = ?', [idx, s.id]));
  });
  notifyChange();
}

/**
 * Move um livro para a prateleira `shelfId` (null = Recém-chegados) na posição `index`,
 * renumerando a prateleira de destino.
 */
export function moveBookTo(bookId: string, shelfId: string | null, index: number) {
  const book = getBook(bookId);
  if (!book) return;
  const d = getDb();
  const siblings = d
    .getAllSync<Book>(
      shelfId === null
        ? 'SELECT * FROM books WHERE status = ? AND shelfId IS NULL ORDER BY shelfPosition'
        : 'SELECT * FROM books WHERE status = ? AND shelfId = ? ORDER BY shelfPosition',
      shelfId === null ? [book.status] : [book.status, shelfId],
    )
    .filter((b) => b.id !== bookId);
  const clamped = Math.max(0, Math.min(index, siblings.length));
  siblings.splice(clamped, 0, book);
  d.withTransactionSync(() => {
    siblings.forEach((b, idx) =>
      d.runSync('UPDATE books SET shelfId = ?, shelfPosition = ? WHERE id = ?', [shelfId, idx, b.id]),
    );
  });
  notifyChange();
}

/** Cria as prateleiras da "Minha ordem" a partir de um agrupamento existente. */
export function initManualShelves(status: BookStatus, groups: { label: string; books: Book[] }[]) {
  const d = getDb();
  d.withTransactionSync(() => {
    groups.forEach((g, gi) => {
      const shelf = createShelf(status, g.label || 'Prateleira', gi, false);
      g.books.forEach((b, bi) =>
        d.runSync('UPDATE books SET shelfId = ?, shelfPosition = ? WHERE id = ?', [shelf.id, bi, b.id]),
      );
    });
  });
  notifyChange();
}

// ---------- Configurações ----------

export function getSetting(key: string): string | null {
  const row = getDb().getFirstSync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value ?? null;
}

export function setSetting(key: string, value: string) {
  getDb().runSync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  notifyChange();
}
