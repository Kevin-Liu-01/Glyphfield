import { describe, expect, it } from 'vitest';

import { crc32, createStoredZip } from '../zipStore';

function readEntries(zip: Uint8Array) {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const end = zip.byteLength - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const count = view.getUint16(end + 10, true);
  let cursor = view.getUint32(end + 16, true);
  const entries: { bytes: Uint8Array; name: string }[] = [];
  for (let index = 0; index < count; index += 1) {
    expect(view.getUint32(cursor, true)).toBe(0x02014b50);
    const crc = view.getUint32(cursor + 16, true);
    const size = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const offset = view.getUint32(cursor + 42, true);
    const name = new TextDecoder().decode(zip.slice(cursor + 46, cursor + 46 + nameLength));
    expect(view.getUint32(offset, true)).toBe(0x04034b50);
    const dataStart = offset + 30 + view.getUint16(offset + 26, true);
    const bytes = zip.slice(dataStart, dataStart + size);
    expect(crc32(bytes)).toBe(crc);
    entries.push({ bytes, name });
    cursor += 46 + nameLength;
  }
  return entries;
}

describe('createStoredZip', () => {
  it('computes the standard CRC-32', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('round-trips names and bytes, including UTF-8 names', () => {
    const files = [
      { bytes: new TextEncoder().encode('# Brand\n'), name: 'kit/brand.md' },
      { bytes: new Uint8Array([0, 1, 2, 255]), name: 'kit/logos/mark-dark.png' },
      { bytes: new TextEncoder().encode('你好'), name: 'kit/notes/你好.txt' },
    ];
    const entries = readEntries(createStoredZip(files, new Date(2026, 9, 13, 12, 0, 0)));
    expect(entries.map(({ name }) => name)).toEqual(files.map(({ name }) => name));
    expect(entries[1]!.bytes).toEqual(files[1]!.bytes);
  });

  it('rejects unsafe and duplicate names', () => {
    const bytes = new Uint8Array([1]);
    expect(() => createStoredZip([{ bytes, name: '../evil' }])).toThrow(/Unsafe/);
    expect(() => createStoredZip([{ bytes, name: '/root' }])).toThrow(/Unsafe/);
    expect(() => createStoredZip([{ bytes, name: 'a' }, { bytes, name: 'a' }])).toThrow(/Duplicate/);
  });
});
