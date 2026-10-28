import { describe, expect, it } from 'vitest';

import {
  appendLottieMarker,
  applyLottieEdits,
  brandLottieColorMap,
  EMPTY_LOTTIE_EDITS,
  listLottieColors,
  listLottieLayers,
  listLottieMarkers,
  listLottieTextLayers,
  MAX_LOTTIE_MARKERS,
  normalizeLottieEdits,
} from '../lottieEditing';
import { LOTTIE_EXAMPLES, type LottieDocument } from '../lottieExamples';
import { lottieExportDurationMs, lottieExportFrameAt } from '../lottieMotionExport';

const document: LottieDocument = {
  assets: [],
  fr: 30,
  layers: [
    { ind: 1, nm: 'Title', t: { d: { k: [{ s: { fc: [1, 0, 0], t: 'Hello', s: 40 }, t: 0 }] } }, ty: 5 },
    { ind: 2, nm: 'Card', shapes: [{ it: [{ c: { a: 0, k: [0, 0, 1, 1] }, ty: 'fl' }, { c: { a: 0, k: [0, 0, 1, 1] }, ty: 'st', w: { a: 0, k: 2 } }], ty: 'gr' }], ty: 4 },
    { nm: 'Unindexed', ty: 3 },
  ],
  markers: [{ cm: 'Intro', dr: 20, tm: 0 }],
  op: 90,
};

describe('Lottie editing', () => {
  it('lists layers, text, colours, and markers with stable keys', () => {
    expect(listLottieLayers(document)).toEqual([
      { hidden: false, key: '1', name: 'Title', type: 'text' },
      { hidden: false, key: '2', name: 'Card', type: 'shape' },
      { hidden: false, key: '#2', name: 'Unindexed', type: 'null' },
    ]);
    expect(listLottieTextLayers(document)).toEqual([{ key: '1', name: 'Title', text: 'Hello' }]);
    expect(listLottieColors(document)).toEqual([{ count: 2, hex: '#0000FF' }, { count: 1, hex: '#FF0000' }]);
    expect(listLottieMarkers(document)).toEqual([{ duration: 20, frame: 0, name: 'Intro' }]);
  });

  it('applies visibility, colour, text, and markers without mutating the source', () => {
    const snapshot = JSON.stringify(document);
    const edited = applyLottieEdits(document, {
      colorMap: { '#0000FF': '#00FF00', '#ff0000': '#123456' },
      hiddenLayers: ['2'],
      markers: [{ duration: 10, frame: 5, name: 'Loop' }],
      textOverrides: { 1: 'Line one\nLine two' },
    });
    expect(JSON.stringify(document)).toBe(snapshot);
    expect(listLottieLayers(edited)[1]?.hidden).toBe(true);
    expect(listLottieColors(edited).map(({ hex }) => hex).sort()).toEqual(['#00FF00', '#123456']);
    expect(listLottieTextLayers(edited)[0]?.text).toBe('Line one\nLine two');
    expect(JSON.stringify(edited)).toContain('Line one\\rLine two');
    expect(edited.markers).toEqual([{ cm: 'Loop', dr: 10, tm: 5 }]);
    expect(applyLottieEdits(document, EMPTY_LOTTIE_EDITS)).toBe(document);
  });

  it('validates edits from source with field paths', () => {
    expect(normalizeLottieEdits(undefined)).toEqual(EMPTY_LOTTIE_EDITS);
    expect(normalizeLottieEdits({ colorMap: { '0000ff': '#00ff00' }, hiddenLayers: ['1', '1'] })).toEqual({ colorMap: { '#0000FF': '#00FF00' }, hiddenLayers: ['1'], textOverrides: {} });
    expect(() => normalizeLottieEdits({ colorMap: { '#0000FF': 'green' } })).toThrow('edits.colorMap.#0000FF');
    expect(() => normalizeLottieEdits({ markers: [{ frame: -1, name: 'x' }] })).toThrow('edits.markers[0].frame');
    expect(() => normalizeLottieEdits({ hiddenLayers: [3] })).toThrow('edits.hiddenLayers');
  });

  it('maps chromatic colours to brand accents and neutrals by lightness', () => {
    const map = brandLottieColorMap(['#FF0000', '#111111', '#EEEEEE'], [
      { hex: '#0A0A0A' }, { hex: '#F2F0E9' }, { hex: '#F3A51B' },
    ]);
    expect(map).toEqual({ '#111111': '#0A0A0A', '#EEEEEE': '#F2F0E9', '#FF0000': '#F3A51B' });
  });

  it('gives every built-in study named build, hold, and resolve segments', () => {
    for (const example of LOTTIE_EXAMPLES) {
      expect(listLottieMarkers(example.data).map(({ name }) => name)).toEqual(['Build', 'Hold', 'Resolve']);
      const total = listLottieMarkers(example.data).reduce((sum, marker) => sum + marker.duration, 0);
      expect(total).toBe(example.data.op);
    }
  });
});

describe('Lottie motion export timing', () => {
  const timing = { frameRate: 60, mode: 'forward' as const, segmentEnd: 120, segmentStart: 60, speed: 2 };

  it('maps output time through the trimmed segment, speed, and direction', () => {
    expect(lottieExportDurationMs(timing)).toBe(500);
    expect(lottieExportFrameAt(0, timing)).toBe(60);
    expect(lottieExportFrameAt(250, timing)).toBe(90);
    expect(lottieExportFrameAt(500, timing)).toBe(120);
    expect(lottieExportFrameAt(250, { ...timing, mode: 'reverse' })).toBe(90);
    expect(lottieExportFrameAt(0, { ...timing, mode: 'reverse' })).toBe(120);
    expect(lottieExportDurationMs({ ...timing, mode: 'bounce' })).toBe(1000);
    expect(lottieExportFrameAt(750, { ...timing, mode: 'bounce' })).toBe(90);
    expect(lottieExportFrameAt(250, { ...timing, mode: 'reverse-bounce' })).toBe(90);
    expect(lottieExportFrameAt(999, { ...timing, mode: 'reverse-bounce' })).toBeCloseTo(119.88, 1);
  });
});

describe('Lottie marker limit', () => {
  const marker = (index: number) => ({ duration: 10, frame: index, name: `Segment ${index + 1}` });

  it('adds markers up to the limit that a saved draft can restore', () => {
    const almostFull = Array.from({ length: MAX_LOTTIE_MARKERS - 1 }, (_, index) => marker(index));
    const full = appendLottieMarker(almostFull, marker(MAX_LOTTIE_MARKERS - 1));
    expect(full).toHaveLength(MAX_LOTTIE_MARKERS);
    expect(() => normalizeLottieEdits({ markers: full })).not.toThrow();
    expect(appendLottieMarker(full, marker(MAX_LOTTIE_MARKERS))).toBe(full);
  });
});

describe('gradient stop bounds', () => {
  const gradient = (p: number) => ({
    assets: [],
    layers: [{ g: { k: { a: 0, k: [0, 1, 0, 0, 1, 0, 0, 1] }, p }, ty: 'gf' }],
  }) as unknown as LottieDocument;

  it('reads at most the packed stop count', () => {
    expect(listLottieColors(gradient(10_000_000))).toHaveLength(2);
    expect(listLottieColors(gradient(2)).map(({ hex }) => hex).sort()).toEqual(['#0000FF', '#FF0000']);
  });

  it('keeps the stops array at its length when recolouring a huge p', () => {
    const edited = applyLottieEdits(gradient(10_000_000), { colorMap: { '#FF0000': '#00FF00' }, hiddenLayers: [], textOverrides: {} });
    const stops = (edited.layers as { g: { k: { k: unknown[] } } }[])[0]!.g.k.k;
    expect(stops).toHaveLength(8);
    expect(stops.slice(1, 4)).toEqual([0, 1, 0]);
  });
});
