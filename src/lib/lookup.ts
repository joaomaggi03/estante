/**
 * Busca de dados de livros em APIs públicas.
 * As fontes são consultadas em paralelo e os campos são mesclados: cada campo vem da primeira
 * fonte que o tiver (a BrasilAPI/CBL muitas vezes traz só o título, sem autor, páginas ou capa).
 */
import { getSetting } from '../db/repo';

export type LookupResult = {
  title: string;
  author: string | null;
  isbn: string | null;
  pageCount: number | null;
  coverUrl: string | null;
  year: string | null;
  source: string;
};

const TIMEOUT_MS = 12000;

async function getJson(url: string): Promise<any | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    // A Open Library pede que apps se identifiquem no User-Agent (limite de uso maior).
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'Estante/1.0 (app pessoal de leitura)' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export function cleanIsbn(raw: string): string {
  return raw.replace(/[^0-9Xx]/g, '').toUpperCase();
}

export function isIsbn(raw: string): boolean {
  const s = cleanIsbn(raw);
  return (s.length === 13 && (s.startsWith('978') || s.startsWith('979'))) || s.length === 10;
}

/** Converte ISBN-13 (978…) em ISBN-10, que algumas bases indexam melhor. */
function toIsbn10(isbn13: string): string | null {
  if (isbn13.length !== 13 || !isbn13.startsWith('978')) return null;
  const core = isbn13.slice(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += (10 - i) * Number(core[i]);
  const check = (11 - (sum % 11)) % 11;
  return core + (check === 10 ? 'X' : String(check));
}

function joinTitle(title?: string, subtitle?: string) {
  if (!title) return '';
  return subtitle ? `${title}: ${subtitle}` : title;
}

function httpsUrl(u?: string | null): string | null {
  if (!u) return null;
  return u.replace(/^http:\/\//, 'https://');
}

/** Títulos em CAIXA ALTA (comuns na CBL) ficam com a primeira letra maiúscula. */
function tidyTitle(t: string): string {
  const letters = t.replace(/[^A-Za-zÀ-ÿ]/g, '');
  if (letters.length > 3 && letters === letters.toUpperCase()) {
    const lower = t.toLocaleLowerCase('pt-BR');
    return lower.charAt(0).toLocaleUpperCase('pt-BR') + lower.slice(1);
  }
  return t;
}

function positive(n: unknown): number | null {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? Math.round(v) : null;
}

function nonEmptyAuthors(list: unknown): string | null {
  if (!Array.isArray(list)) return null;
  const placeholder = /not identified|unknown|desconhecid|anonym|an[oô]nimo|^\W*$/i;
  const names = [
    ...new Set(list.map((a) => (typeof a === 'string' ? a : a?.name)).filter((n) => n && !placeholder.test(n))),
  ] as string[];
  return names.length ? names.slice(0, 3).join(', ') : null;
}

type SourceHit = Omit<LookupResult, 'source'> & { source: string; titleIsUpper?: boolean };

// ---------- Fontes ----------

async function fromBrasilApi(isbn: string): Promise<SourceHit | null> {
  const b = await getJson(`https://brasilapi.com.br/api/isbn/v1/${isbn}`);
  if (!b?.title) return null;
  const title = joinTitle(b.title, b.subtitle);
  return {
    title,
    titleIsUpper: tidyTitle(title) !== title,
    author: nonEmptyAuthors(b.authors),
    isbn,
    pageCount: positive(b.page_count),
    coverUrl: httpsUrl(b.cover_url),
    year: b.year ? String(b.year) : null,
    source: 'BrasilAPI',
  };
}

async function fromOpenLibraryBooks(isbns: string[]): Promise<SourceHit | null> {
  const keys = isbns.map((i) => `ISBN:${i}`).join(',');
  const j = await getJson(`https://openlibrary.org/api/books?bibkeys=${keys}&format=json&jscmd=data`);
  if (!j) return null;
  const d = isbns.map((i) => j[`ISBN:${i}`]).find(Boolean);
  if (!d?.title) return null;
  return {
    title: joinTitle(d.title, d.subtitle),
    author: nonEmptyAuthors(d.authors),
    isbn: isbns[0],
    pageCount: positive(d.number_of_pages),
    coverUrl: d.cover?.medium ? httpsUrl(d.cover.medium) : null,
    year: d.publish_date ? String(d.publish_date).match(/\d{4}/)?.[0] ?? null : null,
    source: 'Open Library',
  };
}

function googleKeyParam(): string {
  const key = getSetting('googleBooksKey');
  return key ? `&key=${encodeURIComponent(key)}` : '';
}

function fromGoogleItem(item: any): SourceHit | null {
  const v = item?.volumeInfo;
  if (!v?.title) return null;
  const ids: { type: string; identifier: string }[] = v.industryIdentifiers ?? [];
  const isbn = ids.find((i) => i.type === 'ISBN_13')?.identifier ?? ids.find((i) => i.type === 'ISBN_10')?.identifier ?? null;
  const thumb: string | undefined = v.imageLinks?.thumbnail ?? v.imageLinks?.smallThumbnail;
  return {
    title: joinTitle(v.title, v.subtitle),
    author: nonEmptyAuthors(v.authors),
    isbn,
    pageCount: positive(v.pageCount),
    coverUrl: thumb ? httpsUrl(thumb.replace('&edge=curl', '')) : null,
    year: v.publishedDate ? String(v.publishedDate).slice(0, 4) : null,
    source: 'Google Books',
  };
}

async function fromGoogle(isbn: string): Promise<SourceHit | null> {
  const g = await getJson(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}${googleKeyParam()}`);
  return g?.items?.length ? fromGoogleItem(g.items[0]) : null;
}

// ---------- Busca por ISBN ----------

const OL_FIELDS = 'title,author_name,number_of_pages_median,isbn,cover_i,first_publish_year';

/** Busca da Open Library pelo ISBN: traz a mediana de páginas das edições da obra. */
async function fromOpenLibrarySearchIsbn(isbn: string): Promise<SourceHit | null> {
  const o = await getJson(`https://openlibrary.org/search.json?isbn=${isbn}&limit=1&fields=${OL_FIELDS}`);
  const r = o?.docs?.length ? fromOpenLibrarySearch(o.docs[0]) : null;
  return r ? { ...r, isbn } : null;
}

/** Remove acentos e pontuação (a busca da Open Library falha com acentos). */
function plain(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Páginas pela mediana das edições na Open Library, só se o título bater (e o autor, se houver). */
async function pagesByTitle(title: string, author: string | null): Promise<number | null> {
  const mainTitle = plain(title.split(':')[0]);
  if (mainTitle.length < 3) return null;
  const firstAuthor = plain(author?.split(',')[0]);
  const lastName = firstAuthor.split(' ').pop() ?? '';
  const q = encodeURIComponent(`${mainTitle} ${lastName}`.trim());
  const o = await getJson(`https://openlibrary.org/search.json?q=${q}&limit=10&fields=title,author_name,number_of_pages_median`);
  const docs: any[] = o?.docs ?? [];
  const match = docs.find(
    (d) =>
      positive(d.number_of_pages_median) &&
      plain(String(d.title).split(':')[0]) === mainTitle &&
      (!lastName || (d.author_name ?? []).some((a: string) => plain(a).includes(lastName))),
  );
  return match ? positive(match.number_of_pages_median) : null;
}

function merge(isbn: string, parts: (SourceHit | null)[]): LookupResult | null {
  const found = parts.filter((p): p is SourceHit => !!p);
  if (!found.length) return null;
  const pick = <K extends keyof SourceHit>(k: K) => found.map((p) => p[k]).find((v) => v != null && v !== '') ?? null;
  // Título: prefere um que não esteja em CAIXA ALTA.
  const titled = found.find((p) => !p.titleIsUpper) ?? found[0];
  return {
    title: tidyTitle(titled.title),
    author: pick('author') as string | null,
    isbn,
    pageCount: pick('pageCount') as number | null,
    coverUrl: pick('coverUrl') as string | null,
    year: pick('year') as string | null,
    source: [...new Set(found.map((p) => p.source))].join(' + '),
  };
}

function withCoverFallback(isbn: string, r: LookupResult | null): LookupResult | null {
  if (r && !r.coverUrl) {
    // Último recurso: capa da Open Library pelo ISBN (o app trata se a imagem não existir).
    return { ...r, coverUrl: `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false` };
  }
  return r;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Quanto esperar pelas outras fontes depois que a BrasilAPI responde, antes de abrir o formulário. */
const EXTRA_WAIT_MS = 2500;

export type IsbnLookup = {
  /** O que já chegou rápido (abre o formulário). */
  first: LookupResult | null;
  /** Resultado completo, com todas as fontes; chega depois e completa os campos vazios. */
  full: Promise<LookupResult | null>;
};

/**
 * Busca progressiva: devolve logo o que as fontes rápidas trouxeram e continua buscando o resto.
 * A Open Library às vezes leva 10 s ou mais; o formulário não fica esperando por ela.
 */
export async function lookupIsbn(raw: string): Promise<IsbnLookup> {
  const isbn = cleanIsbn(raw);
  const isbn10 = toIsbn10(isbn);
  const olKeys = isbn10 ? [isbn, isbn10] : [isbn];

  // Ordem = prioridade na mesclagem.
  const sources = [fromBrasilApi(isbn), fromOpenLibraryBooks(olKeys), fromGoogle(isbn), fromOpenLibrarySearchIsbn(isbn)];
  const settled: (SourceHit | null)[] = sources.map(() => null);
  sources.forEach((p, i) => p.then((v) => (settled[i] = v)));

  const full = Promise.all(sources).then(async (parts) => {
    const result = merge(isbn, parts);
    if (result && !result.pageCount) {
      // Nenhuma fonte tem as páginas desta edição: tenta a mediana das edições da obra pelo título.
      result.pageCount = await pagesByTitle(result.title, result.author);
    }
    return withCoverFallback(isbn, result);
  });

  // Espera a BrasilAPI (rápida) e mais um pouco pelas outras; o que não chegar fica para depois.
  await Promise.race([full, sources[0].then(() => sleep(EXTRA_WAIT_MS))]);
  // Sem a capa-reserva aqui: se uma fonte lenta trouxer a capa certa, o formulário a usa.
  const first = merge(isbn, settled);
  if (!first) {
    // Nada ainda (ex.: livro que só a Open Library conhece): espera tudo.
    const r = await full;
    return { first: r, full: Promise.resolve(r) };
  }
  return { first, full };
}

// ---------- Busca por título ----------

function fromOpenLibrarySearch(d: any): LookupResult | null {
  if (!d?.title) return null;
  const isbns: string[] = d.isbn ?? [];
  return {
    title: d.title,
    author: nonEmptyAuthors(d.author_name),
    isbn: isbns.find((i) => i.length === 13) ?? isbns[0] ?? null,
    pageCount: positive(d.number_of_pages_median),
    coverUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : null,
    year: d.first_publish_year ? String(d.first_publish_year) : null,
    source: 'Open Library',
  };
}

/** Busca por título: Google Books e, se falhar (ex.: cota esgotada), Open Library. */
export async function searchByTitle(query: string): Promise<LookupResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const g = await getJson(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&printType=books&maxResults=15${googleKeyParam()}`,
  );
  const fromG = ((g?.items ?? []) as any[]).map(fromGoogleItem).filter((x): x is SourceHit => !!x);
  if (fromG.length) return fromG.map(({ titleIsUpper, ...r }) => r);
  const o = await getJson(`https://openlibrary.org/search.json?q=${encodeURIComponent(plain(q))}&limit=15&fields=${OL_FIELDS}`);
  return ((o?.docs ?? []) as any[]).map(fromOpenLibrarySearch).filter((x): x is LookupResult => !!x);
}
