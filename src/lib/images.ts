import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { inflate } from 'pako';

function imagesDir(): Directory {
  const dir = new Directory(Paths.document, 'imagens');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

function uniqueName(prefix: string, ext = 'jpg') {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}.${ext}`;
}

/**
 * Baixa uma capa da internet e salva no armazenamento do app. Retorna o caminho local,
 * ou null se a resposta não for uma imagem de verdade (404, placeholder vazio etc.).
 */
export async function downloadCover(url: string): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || !type.startsWith('image/')) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length < 1500) return null; // placeholders de 1×1 px
    const dest = new File(imagesDir(), uniqueName('capa', type.includes('png') ? 'png' : 'jpg'));
    dest.create();
    await dest.write(bytes);
    return dest.uri;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Baixa a capa e extrai a cor da lombada em segundo plano, depois que o livro já foi salvo.
 * Assim salvar é instantâneo, mesmo com capas lentas.
 */
export async function attachCoverInBackground(
  bookId: string,
  opts: { coverUrl?: string | null; coverPath?: string | null; needColor: boolean },
  update: (id: string, patch: { coverPath?: string | null; spineColor?: string | null }) => void,
) {
  let path = opts.coverPath ?? null;
  if (!path && opts.coverUrl) {
    path = await downloadCover(opts.coverUrl);
    if (path) update(bookId, { coverPath: path });
  }
  if (path && opts.needColor) {
    const color = await extractColor(path);
    if (color) update(bookId, { spineColor: color });
  }
}

/** Copia uma imagem escolhida/fotografada para o armazenamento do app. */
export async function saveLocalImage(uri: string, prefix: 'capa' | 'lombada'): Promise<string> {
  const src = new File(uri);
  const dest = new File(imagesDir(), uniqueName(prefix));
  await src.copy(dest);
  return dest.uri;
}

export function deleteImage(uri: string | null | undefined) {
  if (!uri) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // ignora
  }
}

// ---------- Cor dominante ----------

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of clean) {
    buffer = (buffer << 6) | B64.indexOf(ch);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(out);
}

/** Lê o pixel de um PNG 1x1 (RGB ou RGBA). */
function readSinglePixelPng(bytes: Uint8Array): [number, number, number] | null {
  const colorType = bytes[25];
  const chunks: Uint8Array[] = [];
  let p = 8;
  while (p < bytes.length) {
    const len = (bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3];
    const type = String.fromCharCode(bytes[p + 4], bytes[p + 5], bytes[p + 6], bytes[p + 7]);
    if (type === 'IDAT') chunks.push(bytes.subarray(p + 8, p + 8 + len));
    if (type === 'IEND') break;
    p += 12 + len;
  }
  if (!chunks.length) return null;
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const data = new Uint8Array(total);
  let o = 0;
  chunks.forEach((c) => {
    data.set(c, o);
    o += c.length;
  });
  const raw = inflate(data);
  // raw[0] = filtro; com um único pixel todos os filtros devolvem o valor bruto.
  if (colorType === 2 || colorType === 6) return [raw[1], raw[2], raw[3]];
  if (colorType === 0 || colorType === 4) return [raw[1], raw[1], raw[1]];
  return null;
}

function toHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}

/** Cor média da imagem, levemente escurecida para lembrar uma lombada de tecido. */
export async function extractColor(uri: string): Promise<string | null> {
  try {
    const ref = await ImageManipulator.manipulate(uri).resize({ width: 1, height: 1 }).renderAsync();
    const result = await ref.saveAsync({ format: SaveFormat.PNG, base64: true });
    if (!result.base64) return null;
    const px = readSinglePixelPng(base64ToBytes(result.base64));
    if (!px) return null;
    const [r, g, b] = px;
    const k = 0.85;
    return toHex(r * k, g * k, b * k);
  } catch {
    return null;
  }
}
