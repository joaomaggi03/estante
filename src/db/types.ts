export type BookStatus = 'want' | 'reading' | 'read';

export type Book = {
  id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  status: BookStatus;
  rating: number | null;
  review: string | null;
  startDate: string | null; // YYYY-MM-DD
  endDate: string | null; // YYYY-MM-DD
  coverUrl: string | null;
  coverPath: string | null;
  pageCount: number | null;
  spineColor: string | null;
  spinePhotoPath: string | null;
  shelfId: string | null; // null = Recém-chegados
  shelfPosition: number | null;
  createdAt: string; // ISO
  updatedAt: string; // ISO
};

export type Shelf = {
  id: string;
  status: BookStatus;
  name: string;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export const STATUS_LABEL: Record<BookStatus, string> = {
  want: 'Quero ler',
  reading: 'Lendo',
  read: 'Lido',
};

export const STATUS_TAB_LABEL: Record<BookStatus, string> = {
  read: 'Lidos',
  want: 'Quero ler',
  reading: 'Lendo',
};
