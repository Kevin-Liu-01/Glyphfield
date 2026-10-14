/**
 * Read the variation axes (`fvar`) of a font file without React or DOM:
 * TrueType/OpenType directly, WOFF through zlib, and WOFF2 when the runtime's
 * DecompressionStream supports Brotli. Returns [] for a static font and null when
 * the file cannot be read.
 */

export type FontAxis = {
  default: number;
  max: number;
  min: number;
  /** Four-character axis tag such as wght, opsz, slnt, ital or wdth. */
  tag: string;
};

const textDecoder = new TextDecoder('latin1');

function tagAt(view: DataView, offset: number): string {
  return textDecoder.decode(new Uint8Array(view.buffer, view.byteOffset + offset, 4));
}

function fixed(view: DataView, offset: number): number {
  return Math.round((view.getInt32(offset) / 65536) * 1000) / 1000;
}

/** Parse an `fvar` table body. */
export function parseFvar(table: DataView): FontAxis[] {
  if (table.byteLength < 16) return [];
  const axesOffset = table.getUint16(4);
  const axisCount = table.getUint16(8);
  const axisSize = table.getUint16(10);
  const axes: FontAxis[] = [];
  for (let index = 0; index < axisCount; index += 1) {
    const offset = axesOffset + index * axisSize;
    if (offset + 20 > table.byteLength) break;
    axes.push({
      default: fixed(table, offset + 8),
      max: fixed(table, offset + 12),
      min: fixed(table, offset + 4),
      tag: tagAt(table, offset),
    });
  }
  return axes;
}

function sfntTable(view: DataView, tag: string): DataView | 'missing' | null {
  const tableCount = view.getUint16(4);
  for (let index = 0; index < tableCount; index += 1) {
    const record = 12 + index * 16;
    if (record + 16 > view.byteLength) return null;
    if (tagAt(view, record) !== tag) continue;
    const offset = view.getUint32(record + 8);
    const length = view.getUint32(record + 12);
    if (offset + length > view.byteLength) return null;
    return new DataView(view.buffer, view.byteOffset + offset, length);
  }
  return 'missing';
}

async function decompress(bytes: Uint8Array, format: 'brotli' | 'deflate'): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === 'undefined') return null;
  let stream: DecompressionStream;
  try {
    stream = new DecompressionStream(format as CompressionFormat);
  } catch {
    return null;
  }
  try {
    const output = await new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream)).arrayBuffer();
    return new Uint8Array(output);
  } catch {
    return null;
  }
}

/** The table, 'missing' when the directory does not list it, or null when it cannot be read. */
async function woffTable(view: DataView, tag: string): Promise<DataView | 'missing' | null> {
  if (view.byteLength < 44) return null;
  const tableCount = view.getUint16(12);
  for (let index = 0; index < tableCount; index += 1) {
    const entry = 44 + index * 20;
    if (entry + 20 > view.byteLength) return null;
    if (tagAt(view, entry) !== tag) continue;
    const offset = view.getUint32(entry + 4);
    const compressedLength = view.getUint32(entry + 8);
    const originalLength = view.getUint32(entry + 12);
    if (offset + compressedLength > view.byteLength) return null;
    const bytes = new Uint8Array(view.buffer, view.byteOffset + offset, compressedLength);
    if (compressedLength >= originalLength) return new DataView(bytes.buffer, bytes.byteOffset, compressedLength);
    const inflated = await decompress(bytes, 'deflate');
    return inflated ? new DataView(inflated.buffer, inflated.byteOffset, inflated.byteLength) : null;
  }
  return 'missing';
}

// WOFF2 known-table index (spec section 5.1); 63 means an explicit tag follows.
const WOFF2_KNOWN_TAGS = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'];

function readBase128(view: DataView, cursor: { offset: number }): number | null {
  let value = 0;
  for (let index = 0; index < 5; index += 1) {
    if (cursor.offset >= view.byteLength) return null;
    const byte = view.getUint8(cursor.offset);
    cursor.offset += 1;
    value = value * 128 + (byte & 0x7f);
    if ((byte & 0x80) === 0) return value;
  }
  return null;
}

async function woff2Table(view: DataView, tag: string): Promise<DataView | null> {
  const tableCount = view.getUint16(12);
  const compressedLength = view.getUint32(20);
  const cursor = { offset: 48 };
  let streamOffset = 0;
  let target: { length: number; offset: number } | null = null;
  for (let index = 0; index < tableCount; index += 1) {
    if (cursor.offset >= view.byteLength) return null;
    const flags = view.getUint8(cursor.offset);
    cursor.offset += 1;
    let tableTag = WOFF2_KNOWN_TAGS[flags & 0x3f];
    if ((flags & 0x3f) === 63) {
      tableTag = tagAt(view, cursor.offset);
      cursor.offset += 4;
    }
    const originalLength = readBase128(view, cursor);
    if (originalLength === null) return null;
    const transform = (flags >> 6) & 0x03;
    // glyf and loca use transform 0 to mean "transformed"; every other table uses 0 for none.
    const transformed = tableTag === 'glyf' || tableTag === 'loca' ? transform === 0 : transform !== 0;
    let length = originalLength;
    if (transformed) {
      const transformLength = readBase128(view, cursor);
      if (transformLength === null) return null;
      length = transformLength;
    }
    if (tableTag === tag) target = { length, offset: streamOffset };
    streamOffset += length;
  }
  if (!target) return null;
  // Collections add a header here; they are rare for brand fonts and are not read.
  if (view.getUint32(4) === 0x74746366) return null;
  const compressed = new Uint8Array(view.buffer, view.byteOffset + cursor.offset, Math.min(compressedLength, view.byteLength - cursor.offset));
  const tables = await decompress(compressed, 'brotli');
  if (!tables || target.offset + target.length > tables.byteLength) return null;
  return new DataView(tables.buffer, tables.byteOffset + target.offset, target.length);
}

function axesFrom(table: DataView | 'missing' | null): FontAxis[] | null {
  if (table === 'missing') return [];
  return table ? parseFvar(table) : null;
}

/** Axes from font bytes: [] for a static font, null when the format or runtime cannot read it. */
export async function readFontAxes(buffer: ArrayBuffer): Promise<FontAxis[] | null> {
  if (buffer.byteLength < 12) return null;
  const view = new DataView(buffer);
  const signature = tagAt(view, 0);
  try {
    if (signature === 'wOFF') return axesFrom(await woffTable(view, 'fvar'));
    if (signature === 'wOF2') {
      if (view.byteLength < 48) return null;
      const listed = woff2Lists(view, 'fvar');
      if (listed !== true) return listed === false ? [] : null;
      return axesFrom(await woff2Table(view, 'fvar'));
    }
    if (signature === 'OTTO' || signature === 'true' || view.getUint32(0) === 0x00010000) return axesFrom(sfntTable(view, 'fvar'));
  } catch {
    return null;
  }
  return null;
}

/** Whether a WOFF2 table directory lists `tag`, without decompressing anything. */
function woff2Lists(view: DataView, tag: string): boolean | null {
  const tableCount = view.getUint16(12);
  const cursor = { offset: 48 };
  for (let index = 0; index < tableCount; index += 1) {
    if (cursor.offset >= view.byteLength) return null;
    const flags = view.getUint8(cursor.offset);
    cursor.offset += 1;
    let tableTag = WOFF2_KNOWN_TAGS[flags & 0x3f];
    if ((flags & 0x3f) === 63) {
      tableTag = tagAt(view, cursor.offset);
      cursor.offset += 4;
    }
    if (readBase128(view, cursor) === null) return null;
    const transform = (flags >> 6) & 0x03;
    const transformed = tableTag === 'glyf' || tableTag === 'loca' ? transform === 0 : transform !== 0;
    if (transformed && readBase128(view, cursor) === null) return null;
    if (tableTag === tag) return true;
  }
  return false;
}

/** Axes for a font URL (data: or same-origin path), cached per URL for the session. */
const axisCache = new Map<string, Promise<FontAxis[] | null>>();

export function loadFontAxes(url: string): Promise<FontAxis[] | null> {
  const cached = axisCache.get(url);
  if (cached) return cached;
  const pending = fetch(url)
    .then((response) => (response.ok ? response.arrayBuffer() : null))
    .then((buffer) => (buffer ? readFontAxes(buffer) : null))
    .catch(() => null);
  axisCache.set(url, pending);
  return pending;
}

export function fontAxis(axes: readonly FontAxis[] | null | undefined, tag: string): FontAxis | undefined {
  return axes?.find((axis) => axis.tag === tag);
}
