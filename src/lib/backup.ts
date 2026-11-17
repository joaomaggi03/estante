import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getDb, notifyChange } from '../db/database';
import { getBook, listAllShelves, listBooks, upsertBookRaw, upsertShelfRaw } from '../db/repo';
import type { Book, BookStatus, Shelf } from '../db/types';
import { downloadCover, extractColor } from './images';
import { todayISO } from './dates';

const FORMAT = 'estante-backup';
const VERSION = 1;

type BackupBook = Omit<Book, 'coverPath' | 'spinePhotoPath'>;

export async function exportBackup(): Promise<void> {
  const books: BackupBook[] = listBooks().map(({ coverPath, spinePhotoPath, ...rest }) => rest);
  const data = {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    books,
    shelves: listAllShelves(),
  };
  const file = new File(Paths.cache, `estante-backup-${todayISO()}.json`);
  if (file.exists) file.delete();
  file.create();
  await file.write(JSON.stringify(data, null, 2));
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Salvar backup da estante' });
}

const STATUSES: BookStatus[] = ['want', 'reading', 'read'];

function isValidBook(b: any): b is BackupBook {
  return b && typeof b.id === 'string' && typeof b.title === 'string' && STATUSES.includes(b.status);
}

function isValidShelf(s: any): s is Shelf {
  return s && typeof s.id === 'string' && typeof s.name === 'string' && STATUSES.includes(s.status);
}

export type ImportResult = { added: number; updated: number; shelves: number } | null;

/** Abre o seletor de arquivo e mescla o backup: adiciona novos, atualiza mesmo id, nunca apaga. */
export async function importBackup(onProgress?: (msg: string) => void): Promise<ImportResult> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  });
  if (picked.canceled || !picked.assets?.length) return null;

  const text = await new File(picked.assets[0].uri).text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('O arquivo não é um JSON válido.');
  }
  if (data?.format !== FORMAT || !Array.isArray(data.books)) {
    throw new Error('Esse arquivo não é um backup da Estante.');
  }

  const books: BackupBook[] = data.books.filter(isValidBook);
  const shelves: Shelf[] = Array.isArray(data.shelves) ? data.shelves.filter(isValidShelf) : [];
  let added = 0;
  let updated = 0;
  const needCover: Book[] = [];

  const db = getDb();
  db.withTransactionSync(() => {
    for (const s of shelves) upsertShelfRaw({ ...s, position: Number(s.position) || 0 });
    for (const incoming of books) {
      const local = getBook(incoming.id);
      const keepCover = local && local.coverUrl === incoming.coverUrl ? local.coverPath : null;
      const merged: Book = {
        ...incoming,
        author: incoming.author ?? null,
        isbn: incoming.isbn ?? null,
        rating: incoming.rating ?? null,
        review: incoming.review ?? null,
        startDate: incoming.startDate ?? null,
        endDate: incoming.endDate ?? null,
        coverUrl: incoming.coverUrl ?? null,
        pageCount: incoming.pageCount ?? null,
        spineColor: incoming.spineColor ?? null,
        shelfId: incoming.shelfId ?? null,
        shelfPosition: incoming.shelfPosition ?? null,
        createdAt: incoming.createdAt ?? new Date().toISOString(),
        updatedAt: incoming.updatedAt ?? new Date().toISOString(),
        coverPath: keepCover,
        spinePhotoPath: local?.spinePhotoPath ?? null,
      };
      upsertBookRaw(merged);
      if (local) updated++;
      else added++;
      if (merged.coverUrl && !merged.coverPath) needCover.push(merged);
    }
  });
  notifyChange();

  // Rebaixa as capas depois, sem travar a importação.
  let done = 0;
  for (const b of needCover) {
    onProgress?.(`Baixando capas… ${++done}/${needCover.length}`);
    const path = await downloadCover(b.coverUrl!);
    if (path) {
      const color = b.spineColor ?? (await extractColor(path));
      db.runSync('UPDATE books SET coverPath = ?, spineColor = ? WHERE id = ?', [path, color, b.id]);
    }
  }
  if (needCover.length) notifyChange();

  return { added, updated, shelves: shelves.length };
}
