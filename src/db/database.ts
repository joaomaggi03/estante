import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

/** Abre o banco (assíncrono) e cria as tabelas. Chamado uma vez antes de desenhar o app. */
export async function initDb(): Promise<void> {
  if (db) return;
  const d = await SQLite.openDatabaseAsync('estante.db');
  await d.execAsync(SCHEMA);
  db = d;
}

export function getDb(): SQLite.SQLiteDatabase {
  if (!db) throw new Error('Banco de dados ainda não foi aberto (initDb).');
  return db;
}

const SCHEMA = `
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      author TEXT,
      isbn TEXT,
      status TEXT NOT NULL,
      rating REAL,
      review TEXT,
      startDate TEXT,
      endDate TEXT,
      coverUrl TEXT,
      coverPath TEXT,
      pageCount INTEGER,
      spineColor TEXT,
      spinePhotoPath TEXT,
      shelfId TEXT,
      shelfPosition REAL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS shelves (
      id TEXT PRIMARY KEY NOT NULL,
      status TEXT NOT NULL,
      name TEXT NOT NULL,
      position REAL NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_books_status ON books(status);
    CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn);
`;

// Notificação simples de mudanças para as telas recarregarem.
type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

let version = 0;

/** Número que muda a cada alteração no banco (snapshot para useSyncExternalStore). */
export function getVersion(): number {
  return version;
}

export function notifyChange() {
  version++;
  listeners.forEach((fn) => fn());
}
