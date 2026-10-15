import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { canvasPaintFamilyList, pinOpticalSizeAxis } from '@/lib/canvasPaintFonts';

const toArrayBuffer = (file: Buffer) => file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
const inter = toArrayBuffer(readFileSync('public/fonts/inter-variable.ttf'));

/** Reads the fvar axes and named instance coordinates, and checks the fvar table checksum. */
function readFvar(font: ArrayBuffer) {
  const view = new DataView(font);
  const tableCount = view.getUint16(4);
  for (let table = 0; table < tableCount; table += 1) {
    const record = 12 + table * 16;
    if (view.getUint32(record) !== 0x66766172) continue;
    const offset = view.getUint32(record + 8);
    const length = view.getUint32(record + 12);
    let checksum = 0;
    for (let at = offset; at < offset + length; at += 4) {
      const word = [0, 1, 2, 3].reduce((value, byte) => value * 256 + (at + byte < font.byteLength ? view.getUint8(at + byte) : 0), 0);
      checksum = (checksum + word) >>> 0;
    }
    const axesOffset = offset + view.getUint16(offset + 4);
    const axisCount = view.getUint16(offset + 8);
    const axisSize = view.getUint16(offset + 10);
    const instanceCount = view.getUint16(offset + 12);
    const instanceSize = view.getUint16(offset + 14);
    const axes = Array.from({ length: axisCount }, (_, axis) => {
      const at = axesOffset + axis * axisSize;
      const tag = String.fromCharCode(...[0, 1, 2, 3].map((byte) => view.getUint8(at + byte)));
      return { tag, min: view.getInt32(at + 4) / 65536, default: view.getInt32(at + 8) / 65536, max: view.getInt32(at + 12) / 65536 };
    });
    const instances = Array.from({ length: instanceCount }, (_, instance) => axes.map((_, axis) => (
      view.getInt32(axesOffset + axisCount * axisSize + instance * instanceSize + 4 + axis * 4) / 65536
    )));
    return { axes, instances, checksumMatches: checksum === view.getUint32(record + 4) };
  }
  return null;
}

describe('fixed optical size font copies', () => {
  it('fixes only the opsz axis at its default and keeps the font valid', () => {
    const before = readFvar(inter)!;
    expect(before.axes.find((axis) => axis.tag === 'opsz')).toEqual({ tag: 'opsz', min: 14, default: 14, max: 32 });
    const pinned = pinOpticalSizeAxis(inter)!;
    expect(pinned.byteLength).toBe(inter.byteLength);
    const after = readFvar(pinned)!;
    expect(after.axes.find((axis) => axis.tag === 'opsz')).toEqual({ tag: 'opsz', min: 14, default: 14, max: 14 });
    expect(after.axes.find((axis) => axis.tag === 'wght')).toEqual(before.axes.find((axis) => axis.tag === 'wght'));
    const opsz = after.axes.findIndex((axis) => axis.tag === 'opsz');
    expect(after.instances.every((coordinates) => coordinates[opsz] === 14)).toBe(true);
    expect(after.checksumMatches).toBe(true);
    expect(readFvar(inter)!.axes).toEqual(before.axes);
  });

  it('returns null for fonts without an optical size axis and for other formats', () => {
    expect(pinOpticalSizeAxis(toArrayBuffer(readFileSync('public/fonts/switzer-400.ttf')))).toBeNull();
    expect(pinOpticalSizeAxis(toArrayBuffer(readFileSync('public/fonts/geist-mono-latin.woff2')))).toBeNull();
    expect(pinOpticalSizeAxis(new ArrayBuffer(4))).toBeNull();
  });

  it('leaves a family list unchanged until its copy is prepared', () => {
    expect(canvasPaintFamilyList('"Glyphfield Project 1:: Inter", Arial, sans-serif')).toBe('"Glyphfield Project 1:: Inter", Arial, sans-serif');
  });
});
