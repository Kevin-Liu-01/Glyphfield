import type { BrandFontAsset } from '@/lib/brandIdentity';
import { resolveLocalAssetUrl } from '@/lib/download';

// The editable canvas lays text out with `font-optical-sizing: none` (see canvasTextLayout),
// so a variable font draws its default optical size at every zoom. Canvas text has no such
// switch: it picks the optical size from the painted pixel size, so an export would draw a
// narrower cut than the canvas shows. Exports paint with a copy of each such font whose
// optical size axis only allows its default, which draws the same cut in Chromium and WebKit.

const SFNT_VERSIONS = new Set([0x00010000, 0x4f54544f, 0x74727565]); // TrueType, 'OTTO', 'true'
const FVAR = 0x66766172;
const OPSZ = 0x6f70737a;

/** The table directory record of `tag`, when it lies inside the file. */
function findTable(view: DataView, tag: number) {
  const tableCount = view.getUint16(4);
  for (let table = 0; table < tableCount; table += 1) {
    const record = 12 + table * 16;
    if (record + 16 > view.byteLength) return null;
    if (view.getUint32(record) !== tag) continue;
    const offset = view.getUint32(record + 8);
    const length = view.getUint32(record + 12);
    return offset + length <= view.byteLength ? { length, offset, record } : null;
  }
  return null;
}

/** Fixes every opsz axis of an fvar table at its default. Returns false when there is none. */
function pinOpszAxes(view: DataView, offset: number, length: number): boolean {
  if (length < 16) return false;
  const axesOffset = offset + view.getUint16(offset + 4);
  const axisCount = view.getUint16(offset + 8);
  const axisSize = view.getUint16(offset + 10);
  const instanceCount = view.getUint16(offset + 12);
  const instanceSize = view.getUint16(offset + 14);
  const instancesOffset = axesOffset + axisCount * axisSize;
  if (axisSize < 20 || instanceSize < 4 + axisCount * 4 || instancesOffset + instanceCount * instanceSize > offset + length) return false;
  let pinned = false;
  for (let axis = 0; axis < axisCount; axis += 1) {
    const at = axesOffset + axis * axisSize;
    if (view.getUint32(at) !== OPSZ) continue;
    const defaultValue = view.getInt32(at + 8);
    view.setInt32(at + 4, defaultValue);
    view.setInt32(at + 12, defaultValue);
    // Named instances outside the axis range would invalidate the table.
    for (let instance = 0; instance < instanceCount; instance += 1) {
      view.setInt32(instancesOffset + instance * instanceSize + 4 + axis * 4, defaultValue);
    }
    pinned = true;
  }
  return pinned;
}

function tableChecksum(bytes: Uint8Array, offset: number, length: number): number {
  let checksum = 0;
  for (let at = offset; at < offset + length; at += 4) {
    const word = (bytes[at]! << 24) | ((bytes[at + 1] ?? 0) << 16) | ((bytes[at + 2] ?? 0) << 8) | (bytes[at + 3] ?? 0);
    checksum = (checksum + (word >>> 0)) >>> 0;
  }
  return checksum;
}

/** Returns a copy of a TrueType or OpenType font with its opsz axis fixed at its default, or null when there is nothing to fix. */
export function pinOpticalSizeAxis(font: ArrayBuffer): ArrayBuffer | null {
  if (font.byteLength < 12) return null;
  const bytes = new Uint8Array(font.slice(0));
  const view = new DataView(bytes.buffer);
  if (!SFNT_VERSIONS.has(view.getUint32(0))) return null;
  const fvar = findTable(view, FVAR);
  if (!fvar || !pinOpszAxes(view, fvar.offset, fvar.length)) return null;
  view.setUint32(fvar.record + 4, tableChecksum(bytes, fvar.offset, fvar.length));
  return bytes.buffer;
}

const paintFamilies = new Map<string, string>();
const preparations = new Map<string, Promise<void>>();
let registeredCopies = 0;

/** The family to paint `family` with on a canvas: its fixed-optical-size copy once prepared, otherwise itself. */
export function canvasPaintFamily(family: string): string {
  return paintFamilies.get(family) ?? family;
}

/** Swaps the leading family of a CSS family list, such as `"Inter", Arial, sans-serif`, for its paint family. */
export function canvasPaintFamilyList(list: string): string {
  return list.replace(/^"((?:[^"\\]|\\.)*)"/, (quoted) => JSON.stringify(canvasPaintFamily(JSON.parse(quoted) as string)));
}

async function registerPaintFamily(family: string, fonts: readonly BrandFontAsset[]) {
  const sources = await Promise.all(fonts.map(async (font) => {
    const href = resolveLocalAssetUrl(font.path);
    if (!href) throw new Error(`${font.path} is not a data: or same-origin font file.`);
    const response = await fetch(href);
    if (!response.ok) throw new Error(`${font.path} returned ${response.status}`);
    return response.arrayBuffer();
  }));
  const pinned = sources.map(pinOpticalSizeAxis);
  if (pinned.every((source) => source === null)) return;
  registeredCopies += 1;
  // Numbered, so new files under the same family name never match an older copy.
  const paintFamily = `${family} (fixed optical size ${registeredCopies})`;
  const faces = fonts.map((font, index) => new FontFace(paintFamily, pinned[index] ?? sources[index]!, {
    style: font.style,
    weight: font.weightMin !== undefined && font.weightMax !== undefined ? `${font.weightMin} ${font.weightMax}` : String(font.weight),
  }));
  await Promise.all(faces.map((face) => face.load()));
  faces.forEach((face) => document.fonts.add(face));
  paintFamilies.set(family, paintFamily);
}

/**
 * Prepares fixed-optical-size copies of the families a canvas export paints. A family whose
 * files have no optical size axis, or cannot be read, keeps painting with its own name.
 */
export async function prepareCanvasPaintFamilies(fonts: readonly BrandFontAsset[], families: Iterable<string>) {
  await Promise.all([...new Set(families)].map((family) => {
    const files = fonts.filter((font) => font.family === family);
    if (files.length === 0) return undefined;
    const key = `${family}\n${files.map((font) => font.path).join('\n')}`;
    let preparation = preparations.get(key);
    if (!preparation) {
      preparation = registerPaintFamily(family, files).catch(() => {
        // The export still paints with the family itself; only its optical size can differ.
      });
      preparations.set(key, preparation);
    }
    return preparation;
  }));
}
