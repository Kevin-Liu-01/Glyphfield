import { describe, expect, it } from 'vitest';

import {
  customizeLottieDocument,
  LOTTIE_EXAMPLES,
} from '../lottieExamples';

function collectRecords(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(collectRecords);
  if (!value || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  return [record, ...Object.values(record).flatMap(collectRecords)];
}

function rootLayerPositions(document: Record<string, unknown>) {
  const layers = Array.isArray(document.layers) ? document.layers : [];
  return layers.flatMap((layer) => {
    if (!layer || typeof layer !== 'object') return [];
    const keyframes = (layer as Record<string, unknown>).ks;
    if (!keyframes || typeof keyframes !== 'object') return [];
    const position = (keyframes as Record<string, unknown>).p;
    if (!position || typeof position !== 'object') return [];
    const property = position as Record<string, unknown>;
    if (property.a === 0 && Array.isArray(property.k)) return [property.k];
    if (property.a !== 1 || !Array.isArray(property.k)) return [];
    return property.k.flatMap((keyframe) => {
      if (!keyframe || typeof keyframe !== 'object') return [];
      const value = (keyframe as Record<string, unknown>).s;
      return Array.isArray(value) ? [value] : [];
    });
  });
}

function animatedProperties(document: Record<string, unknown>) {
  return collectRecords(document).filter(
    (record) => record.a === 1 && Array.isArray(record.k),
  );
}

function numericValues(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is number => typeof item === 'number');
}

function textLayers(document: Record<string, unknown>) {
  const layers = Array.isArray(document.layers) ? document.layers : [];
  return layers.filter(
    (layer): layer is Record<string, unknown> =>
      Boolean(layer) && typeof layer === 'object' && (layer as Record<string, unknown>).ty === 5,
  );
}

function textValue(layer: Record<string, unknown>) {
  const text = layer.t as Record<string, unknown> | undefined;
  const documentData = text?.d as Record<string, unknown> | undefined;
  const keyframes = Array.isArray(documentData?.k) ? documentData.k : [];
  const firstKeyframe = keyframes[0] as Record<string, unknown> | undefined;
  const style = firstKeyframe?.s as Record<string, unknown> | undefined;
  return style?.t;
}

describe('Lottie product presets', () => {
  it('ships a broad library of distinct product-motion systems', () => {
    expect(LOTTIE_EXAMPLES).toHaveLength(7);
    expect(new Set(LOTTIE_EXAMPLES.map(({ category }) => category)).size).toBe(7);
    expect(new Set(LOTTIE_EXAMPLES.map(({ id }) => id)).size).toBe(7);
    expect(new Set(LOTTIE_EXAMPLES.map(({ data }) => JSON.stringify(data))).size).toBe(7);

    for (const example of LOTTIE_EXAMPLES) {
      expect(example.data).toMatchObject({ fr: 60, h: 720, op: 240, w: 960 });
      expect(Array.isArray(example.data.layers)).toBe(true);
      expect((example.data.layers as unknown[]).length).toBeGreaterThan(4);

      const layers = example.data.layers as Record<string, unknown>[];
      expect(new Set(layers.map(({ ind }) => ind)).size).toBe(layers.length);
      expect(new Set(layers.map(({ nm }) => nm)).size).toBe(layers.length);
    }
  });

  it('keeps every timeline finite, ordered, bounded, and loop-safe', () => {
    for (const example of LOTTIE_EXAMPLES) {
      const properties = animatedProperties(example.data);
      expect(properties.length).toBeGreaterThan(4);

      for (const property of properties) {
        const keyframes = property.k as Record<string, unknown>[];
        const times = keyframes
          .map(({ t }) => t)
          .filter((time): time is number => typeof time === 'number');

        expect(times).toEqual([...times].sort((left, right) => left - right));
        expect(new Set(times).size).toBe(times.length);
        expect(times[0]).toBeGreaterThanOrEqual(0);
        expect(times.at(-1)).toBeLessThanOrEqual(240);

        for (const keyframe of keyframes) {
          const values = numericValues(keyframe.s);
          expect(values.length).toBeGreaterThan(0);
          expect(values.every(Number.isFinite)).toBe(true);
        }

        expect(keyframes.at(-1)?.s).toEqual(keyframes[0]?.s);
      }
    }
  });

  it('uses readable brand-bound typography in every product scene', () => {
    for (const example of LOTTIE_EXAMPLES) {
      const layers = textLayers(example.data);
      expect(layers.length, `${example.id} text layers`).toBeGreaterThanOrEqual(4);

      for (const layer of layers) {
        const value = textValue(layer);
        expect(typeof value).toBe('string');
        expect((value as string).trim()).not.toBe('');
        expect((value as string).length).toBeLessThanOrEqual(32);
        expect((value as string)).not.toContain('\n');

        const transform = layer.ks as Record<string, unknown> | undefined;
        const opacity = transform?.o as Record<string, unknown> | undefined;
        expect(opacity?.a, `${example.id} ${String(layer.nm)} opacity`).toBe(1);
      }

      const fonts = example.data.fonts as Record<string, unknown> | undefined;
      expect(Array.isArray(fonts?.list)).toBe(true);
      expect(fonts?.list).toHaveLength(3);
    }
  });

  it('keeps every easing handle valid and intentional', () => {
    for (const example of LOTTIE_EXAMPLES) {
      const easingHandles = collectRecords(example.data).filter(
        (record) => record.i && record.o,
      );
      expect(easingHandles.length).toBeGreaterThan(4);

      for (const handle of easingHandles) {
        for (const side of ['i', 'o'] as const) {
          const point = handle[side] as Record<string, unknown>;
          const values = [...numericValues(point.x), ...numericValues(point.y)];
          expect(values.length).toBeGreaterThan(0);
          expect(values.every((value) => value >= 0 && value <= 1)).toBe(true);
        }
      }
    }
  });

  it('keeps generated geometry positive and renderable', () => {
    for (const example of LOTTIE_EXAMPLES) {
      const rectangles = collectRecords(example.data).filter(
        (record) => record.ty === 'rc',
      );
      expect(rectangles.length).toBeGreaterThan(0);

      for (const rectangle of rectangles) {
        const size = rectangle.s as Record<string, unknown> | undefined;
        const values = numericValues(size?.k);
        expect(values.slice(0, 2).every((value) => value > 0)).toBe(true);
      }
    }
  });

  it('keeps every root layer inside the composition safe area', () => {
    for (const example of LOTTIE_EXAMPLES) {
      const positions = rootLayerPositions(example.data);
      expect(positions.length).toBeGreaterThan(0);

      for (const position of positions) {
        expect(position[0], `${example.id} x position`).toBeGreaterThanOrEqual(64);
        expect(position[0], `${example.id} x position`).toBeLessThanOrEqual(896);
        expect(position[1], `${example.id} y position`).toBeGreaterThanOrEqual(64);
        expect(position[1], `${example.id} y position`).toBeLessThanOrEqual(656);
      }
    }
  });

  it('uses one coordinated editorial stage without generic dashboard chrome', () => {
    for (const example of LOTTIE_EXAMPLES) {
      const layers = example.data.layers as Record<string, unknown>[];
      const records = collectRecords(example.data);
      const strokes = records.filter((record) => record.ty === 'st');
      const stageBase = records.find(({ nm, ty }) => nm === 'Stage wash base' && ty === 'rc');
      const stageSize = stageBase?.s as Record<string, unknown> | undefined;
      const rectangles = records.filter(({ ty }) => ty === 'rc');
      const kicker = layers.find(({ nm }) => nm === 'Palette 3 Text | Scene kicker');
      const title = layers.find(({ nm }) => nm === 'Palette 1 Text | Scene title');
      const meta = layers.find(({ nm }) => nm === 'Palette 2 Text | Scene meta');
      const titleTransform = title?.ks as Record<string, unknown> | undefined;
      const titlePosition = titleTransform?.p as Record<string, unknown> | undefined;
      const titleText = title?.t as Record<string, unknown> | undefined;
      const titleDocument = titleText?.d as Record<string, unknown> | undefined;
      const titleKeyframes = Array.isArray(titleDocument?.k) ? titleDocument.k : [];
      const titleStyle = (titleKeyframes[0] as Record<string, unknown> | undefined)?.s as Record<string, unknown> | undefined;

      expect(layers.length).toBeLessThanOrEqual(22);
      expect(records.some(({ nm }) => (
        typeof nm === 'string' && /(card|panel|tile|workspace|halo)/i.test(nm)
      ))).toBe(false);
      expect(
        strokes.every((stroke) => {
          const opacity = stroke.o as Record<string, unknown> | undefined;
          return typeof opacity?.k === 'number' && opacity.k <= 35;
        }),
      ).toBe(true);
      expect(numericValues(stageSize?.k)).toEqual([896, 656]);
      expect(rectangles.every((rectangle) => {
        const radius = rectangle.r as Record<string, unknown> | undefined;
        return typeof radius?.k === 'number' && radius.k <= 12;
      })).toBe(true);
      expect(kicker).toBeDefined();
      expect(meta).toBeDefined();
      expect(titlePosition?.k).toEqual([208, 120, 0]);
      expect(titleStyle?.s).toBe(32);
      expect(titleStyle?.j).toBe(0);
    }
  });

  it('applies three brand colors and shared geometry controls', () => {
    const customized = customizeLottieDocument(LOTTIE_EXAMPLES[0]?.data ?? {}, {
      colors: ['#FF0000', '#00FF00', '#0000FF'],
      cornerRadius: 33,
      fontFamily: 'Test Brand Sans',
      strokeWidth: 9,
    });
    const records = collectRecords(customized);
    const paletteColors = records
      .filter((record) => record.ty === 'fl' || record.ty === 'st')
      .map((record) => (record.c as Record<string, unknown>)?.k);

    expect(paletteColors).toContainEqual([1, 0, 0, 1]);
    expect(paletteColors).toContainEqual([0, 1, 0, 1]);
    expect(paletteColors).toContainEqual([0, 0, 1, 1]);
    expect(
      records
        .filter((record) => record.ty === 'gf')
        .map((record) => {
          const gradient = record.g as Record<string, unknown> | undefined;
          const colorProperty = gradient?.k as Record<string, unknown> | undefined;
          return colorProperty?.k;
        }),
    ).toContainEqual([0, 0, 1, 0, 1, 0, 0, 1]);
    expect(
      records
        .filter((record) => record.ty === 'rc')
        .every((record) => {
          const radius = (record.r as Record<string, unknown>)?.k;
          const size = numericValues((record.s as Record<string, unknown>)?.k);
          if (typeof radius !== 'number' || size.length < 2) return false;
          const maximumRadius = Math.min(size[0] ?? 0, size[1] ?? 0) / 2;
          return radius === Math.min(33, maximumRadius);
        }),
    ).toBe(true);
    expect(
      records
        .filter((record) => record.ty === 'st')
        .every((record) => (record.w as Record<string, unknown>)?.k === 9),
    ).toBe(true);

    const customizedFonts = customized.fonts as Record<string, unknown> | undefined;
    const customizedFontList = customizedFonts?.list as Record<string, unknown>[] | undefined;
    expect(customizedFontList?.map(({ fFamily }) => fFamily)).toEqual([
      'Test Brand Sans',
      'Test Brand Sans',
      'Test Brand Sans',
    ]);
    expect(
      textLayers(customized).every((layer) => {
        const text = layer.t as Record<string, unknown>;
        const documentData = text.d as Record<string, unknown>;
        const keyframe = (documentData.k as Record<string, unknown>[])[0];
        const style = keyframe?.s as Record<string, unknown> | undefined;
        return typeof style?.f === 'string' && style.f.startsWith('BrandFont-');
      }),
    ).toBe(true);
  });

  it('embeds the active brand mark in a reserved animated safe area', () => {
    const customized = customizeLottieDocument(
      LOTTIE_EXAMPLES.find(({ id }) => id === 'release-stack')?.data ?? {},
      {
      brandLogo: {
        dataUrl: 'data:image/svg+xml;base64,PHN2Zy8+',
        height: 120,
        label: 'Test brand',
        width: 360,
      },
      colors: ['#FFFFFF', '#777777', '#345CFF'],
      cornerRadius: 20,
      fontFamily: 'Test Brand Sans',
      strokeWidth: 3,
      },
    );
    const assets = customized.assets as Record<string, unknown>[];
    const layers = customized.layers as Record<string, unknown>[];
    const logoAssets = assets.filter(({ id }) => id === 'glyphfield-brand-logo');
    const logoLayers = layers.filter(({ nm }) => nm === 'Brand logo');

    expect(logoAssets).toHaveLength(1);
    expect(logoAssets[0]).toMatchObject({ e: 1, h: 120, w: 360 });
    expect(logoLayers).toHaveLength(1);
    expect(logoLayers[0]).toMatchObject({ refId: 'glyphfield-brand-logo', ty: 2 });

    const transform = logoLayers[0]?.ks as Record<string, unknown>;
    const positions = (transform.p as Record<string, unknown>).k as Record<string, unknown>[];
    const finalPosition = positions.find(({ t }) => t === 42)?.s as number[];
    expect(finalPosition[0]).toBeGreaterThanOrEqual(88);
    expect(finalPosition[1]).toBeLessThan(112);

    const customizedAgain = customizeLottieDocument(customized, {
      brandLogo: {
        dataUrl: 'data:image/svg+xml;base64,PHN2Zy8+',
        height: 120,
        label: 'Test brand',
        width: 360,
      },
      colors: ['#FFFFFF', '#777777', '#345CFF'],
      cornerRadius: 20,
      fontFamily: 'Test Brand Sans',
      strokeWidth: 3,
    });
    expect(
      (customizedAgain.assets as Record<string, unknown>[])
        .filter(({ id }) => id === 'glyphfield-brand-logo'),
    ).toHaveLength(1);
    expect(
      (customizedAgain.layers as Record<string, unknown>[])
        .filter(({ nm }) => nm === 'Brand logo'),
    ).toHaveLength(1);
  });
});
