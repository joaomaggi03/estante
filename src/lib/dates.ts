const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** "2 nov 2026" (ou "2 nov" quando omitYear). */
export function formatDate(s: string | null | undefined, omitYear = false): string {
  if (!s) return '—';
  const d = parseISODate(s);
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return omitYear ? base : `${base} ${d.getFullYear()}`;
}

export function monthLabel(s: string): string {
  const d = parseISODate(s);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function daysBetween(a: string, b: string): number {
  const ms = parseISODate(b).getTime() - parseISODate(a).getTime();
  return Math.max(0, Math.round(ms / 86400000));
}

export function yearOf(s: string | null | undefined): number | null {
  if (!s) return null;
  const y = Number(s.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

export function sinceLabel(days: number): string {
  if (days === 0) return 'desde hoje';
  if (days === 1) return 'há 1 dia';
  return `há ${days} dias`;
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}
