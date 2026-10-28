import { hexToOklch, normalizeHex } from './color';
import type { LottieDocument } from './lottieExamples';

/**
 * Non-destructive edits over a Lottie JSON document: layer visibility, colour
 * replacement, text content, and named segment markers. The source document is
 * never mutated; `applyLottieEdits` returns a new document for playback and export.
 */

export type LottieMarker = { duration: number; frame: number; name: string };

export type LottieEdits = {
  /** Original colour (#RRGGBB) → replacement. Applies to static fills, strokes, gradients, and text. */
  colorMap: Record<string, string>;
  /** Top-level layer keys (see `lottieLayerKey`) to hide. */
  hiddenLayers: string[];
  /** Named segments written to the document's `markers`. Undefined keeps the authored markers. */
  markers?: LottieMarker[];
  /** Top-level text layer key → replacement text. */
  textOverrides: Record<string, string>;
};

export const EMPTY_LOTTIE_EDITS: LottieEdits = { colorMap: {}, hiddenLayers: [], textOverrides: {} };

export type LottieLayerSummary = {
  hidden: boolean;
  key: string;
  name: string;
  type: 'image' | 'null' | 'precomp' | 'shape' | 'solid' | 'text' | 'other';
};

export type LottieTextLayer = { key: string; name: string; text: string };

export type LottieColorSummary = { count: number; hex: string };

type LottieRecord = Record<string, unknown>;

const LAYER_TYPES: Record<number, LottieLayerSummary['type']> = { 0: 'precomp', 1: 'solid', 2: 'image', 3: 'null', 4: 'shape', 5: 'text' };
const MAX_EDITED_TEXT = 500;
/** A saved draft restores at most this many markers, so Add marker stops here too. */
export const MAX_LOTTIE_MARKERS = 64;

function isRecord(value: unknown): value is LottieRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function layers(document: LottieDocument): LottieRecord[] {
  return Array.isArray(document.layers) ? document.layers.filter(isRecord) : [];
}

/** Stable key for a top-level layer: its `ind` when present, otherwise its position. */
export function lottieLayerKey(layer: LottieRecord, position: number): string {
  return typeof layer.ind === 'number' && Number.isFinite(layer.ind) ? String(layer.ind) : `#${position}`;
}

function layerName(layer: LottieRecord, position: number): string {
  // Built-in studies prefix text layers with their palette slot for recolouring.
  const name = typeof layer.nm === 'string' ? layer.nm.replace(/^Palette \d+ Text \| /, '').trim() : '';
  return name || `Layer ${position + 1}`;
}

export function listLottieLayers(document: LottieDocument): LottieLayerSummary[] {
  return layers(document).map((layer, position) => ({
    hidden: layer.hd === true,
    key: lottieLayerKey(layer, position),
    name: layerName(layer, position),
    type: LAYER_TYPES[typeof layer.ty === 'number' ? layer.ty : -1] ?? 'other',
  }));
}

function textKeyframes(layer: LottieRecord): LottieRecord[] {
  const text = isRecord(layer.t) ? layer.t : null;
  const documentData = text && isRecord(text.d) ? text.d : null;
  return Array.isArray(documentData?.k) ? documentData.k.filter(isRecord) : [];
}

export function listLottieTextLayers(document: LottieDocument): LottieTextLayer[] {
  return layers(document).flatMap((layer, position) => {
    if (layer.ty !== 5) return [];
    const first = textKeyframes(layer)[0];
    const style = first && isRecord(first.s) ? first.s : null;
    return [{ key: lottieLayerKey(layer, position), name: layerName(layer, position), text: typeof style?.t === 'string' ? style.t.replace(/\r/g, '\n') : '' }];
  });
}

function channelToHex(channel: unknown): string {
  const value = typeof channel === 'number' && Number.isFinite(channel) ? channel : 0;
  return Math.round(Math.min(1, Math.max(0, value)) * 255).toString(16).padStart(2, '0').toUpperCase();
}

/** Lottie colours are 0–1 RGB(A) arrays. */
export function lottieColorToHex(color: readonly unknown[]): string {
  return `#${channelToHex(color[0])}${channelToHex(color[1])}${channelToHex(color[2])}`;
}

function hexToChannels(hex: string): [number, number, number] {
  const normalized = normalizeHex(hex).slice(1);
  return [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255) as [number, number, number];
}

function isStaticColor(value: unknown): value is LottieRecord & { k: number[] } {
  return isRecord(value) && value.a === 0 && Array.isArray(value.k) && value.k.length >= 3 && value.k.every((entry) => typeof entry === 'number');
}

/** Gradient stops are packed 4 numbers per colour; `g.p` must match them. */
function gradientStopCount(p: unknown, stops: readonly unknown[]): number {
  return typeof p === 'number' && Number.isInteger(p) && p >= 0
    ? Math.min(p, Math.floor(stops.length / 4))
    : 0;
}

function gradientStopColors(record: LottieRecord): string[] {
  const gradient = isRecord(record.g) ? record.g : null;
  const stops = gradient && isRecord(gradient.k) && gradient.k.a === 0 && Array.isArray(gradient.k.k) ? gradient.k.k as unknown[] : [];
  const count = gradientStopCount(gradient?.p, stops);
  return Array.from({ length: count }, (_, stop) => lottieColorToHex(stops.slice(stop * 4 + 1, stop * 4 + 4)));
}

function textFillColors(record: LottieRecord): string[] {
  return textKeyframes(record).flatMap((keyframe) => {
    const style = isRecord(keyframe.s) ? keyframe.s : null;
    return Array.isArray(style?.fc) ? [lottieColorToHex(style.fc)] : [];
  });
}

function recordColors(record: LottieRecord): string[] {
  if ((record.ty === 'fl' || record.ty === 'st') && isStaticColor(record.c)) return [lottieColorToHex(record.c.k)];
  if (record.ty === 'gf' || record.ty === 'gs') return gradientStopColors(record);
  if (record.ty === 5) return textFillColors(record);
  return [];
}

/** Visits every static colour in the document (fills, strokes, gradient stops, text fill). */
function visitColors(value: unknown, visit: (hex: string) => void): void {
  if (Array.isArray(value)) {
    value.forEach((entry) => visitColors(entry, visit));
    return;
  }
  if (!isRecord(value)) return;
  recordColors(value).forEach(visit);
  for (const [key, child] of Object.entries(value)) {
    if (key !== 'c' && key !== 'g') visitColors(child, visit);
  }
}

/** Distinct static colours, most used first. */
export function listLottieColors(document: LottieDocument): LottieColorSummary[] {
  const counts = new Map<string, number>();
  visitColors(document.layers, (hex) => counts.set(hex, (counts.get(hex) ?? 0) + 1));
  visitColors(document.assets, (hex) => counts.set(hex, (counts.get(hex) ?? 0) + 1));
  return [...counts.entries()]
    .map(([hex, count]) => ({ count, hex }))
    .sort((first, second) => second.count - first.count || first.hex.localeCompare(second.hex));
}

export function listLottieMarkers(document: LottieDocument): LottieMarker[] {
  return (Array.isArray(document.markers) ? document.markers : []).flatMap((marker) => {
    if (!isRecord(marker) || typeof marker.tm !== 'number' || !Number.isFinite(marker.tm)) return [];
    const name = typeof marker.cm === 'string' && marker.cm.trim() ? marker.cm.trim() : `Marker ${marker.tm}`;
    return [{ duration: typeof marker.dr === 'number' && Number.isFinite(marker.dr) ? Math.max(0, marker.dr) : 0, frame: marker.tm, name }];
  });
}

function mapColor(channels: unknown[], colorMap: ReadonlyMap<string, string>): unknown[] {
  const replacement = colorMap.get(lottieColorToHex(channels));
  if (!replacement) return channels;
  const [red, green, blue] = hexToChannels(replacement);
  return [red, green, blue, ...channels.slice(3)];
}

function isColorArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.length >= 3 && value.every((entry) => typeof entry === 'number');
}

function recolor(value: unknown, colorMap: ReadonlyMap<string, string>): unknown {
  if (Array.isArray(value)) return value.map((entry) => recolor(entry, colorMap));
  if (!isRecord(value)) return value;
  const next: LottieRecord = Object.fromEntries(Object.entries(value).map(([key, child]) => [key, recolor(child, colorMap)]));
  if ((value.ty === 'fl' || value.ty === 'st') && isStaticColor(value.c)) {
    next.c = { ...value.c, k: mapColor(value.c.k, colorMap) };
  }
  if ((value.ty === 'gf' || value.ty === 'gs') && isRecord(value.g) && isRecord(value.g.k) && value.g.k.a === 0 && Array.isArray(value.g.k.k)) {
    const stops = [...value.g.k.k as unknown[]];
    const count = gradientStopCount(value.g.p, stops);
    for (let stop = 0; stop < count; stop += 1) {
      const mapped = mapColor(stops.slice(stop * 4 + 1, stop * 4 + 4), colorMap);
      stops.splice(stop * 4 + 1, 3, ...mapped.slice(0, 3));
    }
    next.g = { ...value.g, k: { ...value.g.k, k: stops } };
  }
  // Text document styles carry fill (fc) and stroke (sc) colours directly.
  if (isColorArray(value.fc)) next.fc = mapColor(value.fc, colorMap);
  if (isColorArray(value.sc)) next.sc = mapColor(value.sc, colorMap);
  return next;
}

function editText(layer: LottieRecord, text: string): LottieRecord {
  const textData = isRecord(layer.t) ? layer.t : {};
  const documentData = isRecord(textData.d) ? textData.d : {};
  const keyframes = textKeyframes(layer);
  return {
    ...layer,
    t: {
      ...textData,
      d: {
        ...documentData,
        // Lottie separates lines with a carriage return.
        k: keyframes.map((keyframe) => ({ ...keyframe, s: { ...(isRecord(keyframe.s) ? keyframe.s : {}), t: text.replace(/\r?\n/g, '\r') } })),
      },
    },
  };
}

/** Adds a marker unless the list is already at the limit. */
export function appendLottieMarker(markers: readonly LottieMarker[], marker: LottieMarker): readonly LottieMarker[] {
  return markers.length >= MAX_LOTTIE_MARKERS ? markers : [...markers, marker];
}

export function lottieEditsAreEmpty(edits: LottieEdits): boolean {
  return edits.hiddenLayers.length === 0
    && Object.keys(edits.colorMap).length === 0
    && Object.keys(edits.textOverrides).length === 0
    && edits.markers === undefined;
}

export function applyLottieEdits(document: LottieDocument, edits: LottieEdits): LottieDocument {
  if (lottieEditsAreEmpty(edits)) return document;
  const hidden = new Set(edits.hiddenLayers);
  const colorMap = new Map(Object.entries(edits.colorMap).map(([from, to]) => [normalizeHex(from), normalizeHex(to)]));
  const editedLayers = layers(document).map((layer, position) => {
    const key = lottieLayerKey(layer, position);
    let next: LottieRecord = layer;
    if (hidden.has(key)) next = { ...next, hd: true };
    const text = edits.textOverrides[key];
    if (layer.ty === 5 && typeof text === 'string') next = editText(next, text);
    return next;
  });
  const recolored = colorMap.size > 0
    ? { layers: recolor(editedLayers, colorMap), assets: recolor(document.assets, colorMap) }
    : { layers: editedLayers, assets: document.assets };
  return {
    ...document,
    ...recolored,
    ...(edits.markers ? { markers: edits.markers.map(({ duration, frame, name }) => ({ cm: name, dr: duration, tm: frame })) } : {}),
  };
}

function normalizeColorMap(value: unknown): Record<string, string> {
  if (value === undefined) return {};
  if (!isRecord(value)) throw new TypeError('edits.colorMap must map #RRGGBB colours to replacements.');
  return Object.fromEntries(Object.entries(value).map(([from, to]) => {
    if (typeof to !== 'string' || !/^#?[0-9a-f]{6}$/i.test(from) || !/^#?[0-9a-f]{6}$/i.test(to)) {
      throw new TypeError(`edits.colorMap.${from} must be a #RRGGBB colour.`);
    }
    return [normalizeHex(from), normalizeHex(to)];
  }));
}

function normalizeTextOverrides(value: unknown): Record<string, string> {
  if (value === undefined) return {};
  if (!isRecord(value)) throw new TypeError('edits.textOverrides must map layer keys to text.');
  return Object.fromEntries(Object.entries(value).map(([key, text]) => {
    if (typeof text !== 'string') throw new TypeError(`edits.textOverrides.${key} must be a string.`);
    return [key, text.slice(0, MAX_EDITED_TEXT)];
  }));
}

function normalizeMarker(marker: unknown, index: number): LottieMarker {
  if (!isRecord(marker) || typeof marker.name !== 'string' || !marker.name.trim()) throw new TypeError(`edits.markers[${index}].name must be a non-empty string.`);
  if (typeof marker.frame !== 'number' || !Number.isFinite(marker.frame) || marker.frame < 0) throw new TypeError(`edits.markers[${index}].frame must be a non-negative frame.`);
  const duration = marker.duration ?? 0;
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration < 0) throw new TypeError(`edits.markers[${index}].duration must be a non-negative frame count.`);
  return { duration, frame: marker.frame, name: marker.name.trim().slice(0, 64) };
}

/** Validates edits read from source; unknown fields are ignored and limits enforced. */
export function normalizeLottieEdits(value: unknown): LottieEdits {
  if (value === undefined || value === null) return { ...EMPTY_LOTTIE_EDITS };
  if (!isRecord(value)) throw new TypeError('Lottie edits must be an object.');
  const hiddenLayers = value.hiddenLayers ?? [];
  if (!Array.isArray(hiddenLayers) || !hiddenLayers.every((key) => typeof key === 'string')) {
    throw new TypeError('edits.hiddenLayers must be an array of layer keys.');
  }
  if (value.markers !== undefined && (!Array.isArray(value.markers) || value.markers.length > MAX_LOTTIE_MARKERS)) {
    throw new TypeError(`edits.markers must be an array of at most ${MAX_LOTTIE_MARKERS} markers.`);
  }
  const markers = Array.isArray(value.markers) ? value.markers.map(normalizeMarker) : undefined;
  return {
    colorMap: normalizeColorMap(value.colorMap),
    hiddenLayers: [...new Set(hiddenLayers as string[])],
    ...(markers ? { markers } : {}),
    textOverrides: normalizeTextOverrides(value.textOverrides),
  };
}

/**
 * Maps document colours onto brand tokens: chromatic colours take the brand's
 * accents in order of chroma; neutrals take the brand neutral nearest in lightness.
 */
export function brandLottieColorMap(
  colors: readonly string[],
  tokens: readonly { hex: string }[]
): Record<string, string> {
  const brand = tokens.map(({ hex }) => ({ hex: normalizeHex(hex), ...hexToOklch(hex) }));
  const accents = brand.filter(({ chroma }) => chroma >= 0.06).sort((first, second) => second.chroma - first.chroma);
  const neutrals = brand.filter(({ chroma }) => chroma < 0.06);
  const pool = neutrals.length > 0 ? neutrals : brand;
  const sources = colors.map((hex) => ({ hex: normalizeHex(hex), ...hexToOklch(hex) }));
  const chromatic = sources.filter(({ chroma }) => chroma >= 0.06).sort((first, second) => second.chroma - first.chroma);
  const map: Record<string, string> = {};
  chromatic.forEach((source, index) => {
    const accent = accents[index % Math.max(1, accents.length)];
    if (accent) map[source.hex] = accent.hex;
  });
  for (const source of sources) {
    if (map[source.hex] || pool.length === 0) continue;
    const nearest = pool.reduce((best, token) => (
      Math.abs(token.lightness - source.lightness) < Math.abs(best.lightness - source.lightness) ? token : best
    ));
    map[source.hex] = nearest.hex;
  }
  return map;
}
