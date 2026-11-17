import type { Book } from '../db/types';

const PALETTE = [
  '#2F4A3A', '#7A2E1F', '#2E2A4F', '#D9A441', '#4A3B2C', '#1F3A5A',
  '#3E5A2A', '#5A1F14', '#6B6256', '#3D3470', '#8A5A2B', '#9C4A2A',
];

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function spineColorOf(book: Pick<Book, 'spineColor' | 'title'>): string {
  return book.spineColor ?? PALETTE[hashString(book.title) % PALETTE.length];
}

export function spineWidth(book: Pick<Book, 'pageCount'>): number {
  if (!book.pageCount) return 22;
  return Math.round(Math.max(14, Math.min(42, 10 + book.pageCount / 18)));
}

export const SHELF_HEIGHT = 112;

export function spineHeight(book: Pick<Book, 'title'>): number {
  return 84 + (hashString(book.title + '#h') % 21); // 84–104
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Cor do texto da lombada: creme em cores escuras, marrom em cores claras. */
export function spineTextColor(bg: string): string {
  return luminance(bg) > 0.35 ? '#3B2A1A' : '#F5ECD9';
}

export function hueOf(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d < 0.08) return 400 + (1 - max) * 100; // tons neutros vão para o fim
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}
