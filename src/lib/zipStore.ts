// A minimal store-only (uncompressed) ZIP writer for small text and image kits.
// Brand kits are mostly SVG, JSON, CSS and Markdown, so compression would add a
// dependency for little gain. Names are written as UTF-8 (general flag bit 11).

export type ZipEntry = {
  bytes: Uint8Array;
  name: string;
};

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date: Date): { date: number; time: number } {
  const year = Math.min(2107, Math.max(1980, date.getFullYear()));
  return {
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
  };
}

/** Build a ZIP archive. Throws on duplicate names, unsafe paths or ZIP64-sized input. */
export function createStoredZip(entries: readonly ZipEntry[], modified = new Date()): Uint8Array {
  const encoder = new TextEncoder();
  const stamp = dosDateTime(modified);
  const names = new Set<string>();
  const prepared = entries.map((entry) => {
    if (!entry.name || entry.name.startsWith('/') || entry.name.split('/').includes('..')) {
      throw new TypeError(`Unsafe ZIP entry name: ${entry.name || '(empty)'}.`);
    }
    if (names.has(entry.name)) throw new TypeError(`Duplicate ZIP entry name: ${entry.name}.`);
    names.add(entry.name);
    return { bytes: entry.bytes, crc: crc32(entry.bytes), name: encoder.encode(entry.name) };
  });
  if (prepared.length > 0xfffe) throw new RangeError('A brand kit ZIP may contain at most 65,534 files.');

  const localSize = prepared.reduce((sum, entry) => sum + 30 + entry.name.length + entry.bytes.length, 0);
  const centralSize = prepared.reduce((sum, entry) => sum + 46 + entry.name.length, 0);
  if (localSize + centralSize + 22 > 0xffffffff) throw new RangeError('A brand kit ZIP must stay under 4 GB.');

  const output = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(output.buffer);
  const offsets: number[] = [];
  let cursor = 0;
  for (const entry of prepared) {
    offsets.push(cursor);
    view.setUint32(cursor, 0x04034b50, true);
    view.setUint16(cursor + 4, 20, true);
    view.setUint16(cursor + 6, 0x0800, true);
    view.setUint16(cursor + 8, 0, true);
    view.setUint16(cursor + 10, stamp.time, true);
    view.setUint16(cursor + 12, stamp.date, true);
    view.setUint32(cursor + 14, entry.crc, true);
    view.setUint32(cursor + 18, entry.bytes.length, true);
    view.setUint32(cursor + 22, entry.bytes.length, true);
    view.setUint16(cursor + 26, entry.name.length, true);
    view.setUint16(cursor + 28, 0, true);
    output.set(entry.name, cursor + 30);
    output.set(entry.bytes, cursor + 30 + entry.name.length);
    cursor += 30 + entry.name.length + entry.bytes.length;
  }
  const centralOffset = cursor;
  prepared.forEach((entry, index) => {
    view.setUint32(cursor, 0x02014b50, true);
    view.setUint16(cursor + 4, 20, true);
    view.setUint16(cursor + 6, 20, true);
    view.setUint16(cursor + 8, 0x0800, true);
    view.setUint16(cursor + 10, 0, true);
    view.setUint16(cursor + 12, stamp.time, true);
    view.setUint16(cursor + 14, stamp.date, true);
    view.setUint32(cursor + 16, entry.crc, true);
    view.setUint32(cursor + 20, entry.bytes.length, true);
    view.setUint32(cursor + 24, entry.bytes.length, true);
    view.setUint16(cursor + 28, entry.name.length, true);
    view.setUint16(cursor + 30, 0, true);
    view.setUint16(cursor + 32, 0, true);
    view.setUint16(cursor + 34, 0, true);
    view.setUint16(cursor + 36, 0, true);
    view.setUint32(cursor + 38, 0, true);
    view.setUint32(cursor + 42, offsets[index]!, true);
    output.set(entry.name, cursor + 46);
    cursor += 46 + entry.name.length;
  });
  view.setUint32(cursor, 0x06054b50, true);
  view.setUint16(cursor + 4, 0, true);
  view.setUint16(cursor + 6, 0, true);
  view.setUint16(cursor + 8, prepared.length, true);
  view.setUint16(cursor + 10, prepared.length, true);
  view.setUint32(cursor + 12, centralSize, true);
  view.setUint32(cursor + 16, centralOffset, true);
  view.setUint16(cursor + 20, 0, true);
  return output;
}
