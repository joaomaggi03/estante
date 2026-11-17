import type { Book } from '../db/types';
import { daysBetween, yearOf } from './dates';

export type YearStat = { year: number; count: number; avgRating: number | null; avgDays: number | null };

function avg(nums: number[]): number | null {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

export function computeStats(books: Book[]) {
  const read = books.filter((b) => b.status === 'read');
  const ratings = read.map((b) => b.rating).filter((r): r is number => r != null);
  const durations = read
    .filter((b) => b.startDate && b.endDate)
    .map((b) => daysBetween(b.startDate!, b.endDate!));

  const byYear = new Map<number, Book[]>();
  for (const b of read) {
    const y = yearOf(b.endDate);
    if (y == null) continue;
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y)!.push(b);
  }
  const years: YearStat[] = [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, list]) => ({
      year,
      count: list.length,
      avgRating: avg(list.map((b) => b.rating).filter((r): r is number => r != null)),
      avgDays: avg(
        list.filter((b) => b.startDate && b.endDate).map((b) => daysBetween(b.startDate!, b.endDate!)),
      ),
    }));

  const thisYear = new Date().getFullYear();
  return {
    totalRead: read.length,
    readThisYear: byYear.get(thisYear)?.length ?? 0,
    avgRating: avg(ratings),
    avgDays: avg(durations),
    years,
  };
}

export function formatNumber(n: number | null, digits = 1): string {
  if (n == null) return '—';
  return n.toFixed(digits).replace('.', ',').replace(/,0$/, '');
}
