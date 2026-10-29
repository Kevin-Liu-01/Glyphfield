import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  DESIGN_LAB_IMAGE_EFFECT_CATEGORIES,
  DESIGN_LAB_IMAGE_EFFECTS,
  assertDesignLabEffectSettings,
  designLabImageEffectGroups,
  isDesignLabImageEffectId,
  firstLayerById,
  planImageEffectPasses,
  resolveImageEffectOutputs,
} from '../designLabImageEffects';
import { SHADER_EFFECTS } from '../shaderEffects';

type FakeCanvas = HTMLCanvasElement & { draws: unknown[]; label: string };

function fakeCanvas(label: string): FakeCanvas {
  const draws: unknown[] = [];
  const canvas = { draws, height: 0, label, width: 0 } as unknown as FakeCanvas;
  const context = {
    canvas,
    clearRect: () => draws.splice(0),
    drawImage: (image: FakeCanvas) => draws.push(image.label),
  };
  (canvas as unknown as { getContext: () => unknown }).getContext = () => context;
  return canvas;
}

describe('Design Lab image effects', () => {
  it('offers every Shaders.com component that needs an image, grouped by upstream category', () => {
    expect(DESIGN_LAB_IMAGE_EFFECTS.map(({ id }) => id).sort())
      .toEqual(SHADER_EFFECTS.filter(({ requiresChild }) => requiresChild).map(({ id }) => id).sort());
    expect(DESIGN_LAB_IMAGE_EFFECT_CATEGORIES.slice(0, 5)).toEqual(['Stylize', 'Blurs', 'Distortions', 'Adjustments', 'Transitions']);
    const grouped = designLabImageEffectGroups();
    expect(grouped.map(({ category }) => category)).toEqual(DESIGN_LAB_IMAGE_EFFECT_CATEGORIES);
    expect(grouped.reduce((total, { effects }) => total + effects.length, 0)).toBe(DESIGN_LAB_IMAGE_EFFECTS.length);
    // Picker buttons are labelled by name, so names must be unique.
    expect(new Set(DESIGN_LAB_IMAGE_EFFECTS.map(({ name }) => name)).size).toBe(DESIGN_LAB_IMAGE_EFFECTS.length);
    DESIGN_LAB_IMAGE_EFFECTS.forEach(({ id }) => expect(existsSync(join(process.cwd(), 'public/shader-previews', `${id}.webp`))).toBe(true));
  });

  it('searches every word across name, description and category', () => {
    const blurs = designLabImageEffectGroups('blur');
    expect(blurs.some(({ category }) => category === 'Blurs')).toBe(true);
    expect(designLabImageEffectGroups('radial blur').flatMap(({ effects }) => effects).every(({ name, description, category }) => (
      `${name} ${description} ${category}`.toLowerCase().includes('radial')
    ))).toBe(true);
    expect(designLabImageEffectGroups('no such effect anywhere')).toEqual([]);
  });

  it('accepts additive effect settings and rejects foreign ids and host inputs', () => {
    expect(isDesignLabImageEffectId('shader-effects-blur')).toBe(true);
    expect(isDesignLabImageEffectId('shader-effects-aurora')).toBe(false);
    expect(() => assertDesignLabEffectSettings({ kind: 'bayer' })).not.toThrow();
    expect(() => assertDesignLabEffectSettings({ effectId: 'shader-effects-blur', effectProps: { intensity: 40 }, kind: 'bayer' })).not.toThrow();
    expect(() => assertDesignLabEffectSettings({ effectId: 'shader-effects-aurora' })).toThrow(/image effect ID/);
    expect(() => assertDesignLabEffectSettings({ effectProps: { intensity: 4 } })).toThrow(/need an effectId/);
    expect(() => assertDesignLabEffectSettings({ effectId: 'shader-effects-blur', effectProps: [] })).toThrow(/must be an object/);
    expect(() => assertDesignLabEffectSettings({ effectId: 'shader-effects-blur', effectProps: { sourceImage: 'data:image/png;base64,AA==' } }))
      .toThrow(/processes the layers beneath/);
  });

  it('plans one pass per image effect with the layers beneath it', () => {
    const ids = ['shader-a', 'effect-x', 'text-b', 'effect-y', 'logo-c'];
    const passes = planImageEffectPasses(ids, (id): id is 'effect-x' | 'effect-y' => id.startsWith('effect-'));
    expect(passes).toEqual([
      { beneathCount: 1, layerId: 'effect-x' },
      { beneathCount: 3, layerId: 'effect-y' },
    ]);
  });

  it('composes beneath each effect with earlier outputs resolved and skips effects that cannot run', async () => {
    const calls: Array<{ beneath: readonly string[]; resolved: string[] }> = [];
    const created: FakeCanvas[] = [];
    const source = fakeCanvas('source');
    const outputs = await resolveImageEffectOutputs<string, string>({
      composeBeneath: (_context, beneath, resolved) => { calls.push({ beneath, resolved: [...resolved.keys()] }); },
      createCanvas: () => {
        const canvas = fakeCanvas(`output-${created.length}`);
        created.push(canvas);
        return canvas;
      },
      height: 90,
      layerIds: ['shader-a', 'effect-x', 'effect-y', 'effect-z'],
      passes: [
        { beneathCount: 1, layerId: 'effect-x' },
        { beneathCount: 2, layerId: 'effect-y' },
        { beneathCount: 3, layerId: 'effect-z' },
      ],
      run: async (layerId) => layerId === 'effect-y' ? null : fakeCanvas(`gpu-${layerId}`),
      source,
      width: 160,
    });
    expect(calls).toEqual([
      { beneath: ['shader-a'], resolved: [] },
      { beneath: ['shader-a', 'effect-x'], resolved: ['effect-x'] },
      { beneath: ['shader-a', 'effect-x', 'effect-y'], resolved: ['effect-x'] },
    ]);
    expect([...outputs.keys()]).toEqual(['effect-x', 'effect-z']);
    expect(source.width).toBe(160);
    expect(source.height).toBe(90);
    // Each output is a copy at the requested size, never the processor's own canvas.
    expect((outputs.get('effect-x') as FakeCanvas).draws).toEqual(['gpu-effect-x']);
    expect(outputs.get('effect-x')?.width).toBe(160);
  });

  it('reuses the caller\'s output canvases between preview frames', async () => {
    const kept = new Map<string, HTMLCanvasElement>();
    const run = async () => fakeCanvas('gpu');
    const options = {
      composeBeneath: () => undefined,
      createCanvas: () => fakeCanvas('new'),
      height: 10,
      layerIds: ['effect-x'],
      outputs: kept,
      passes: [{ beneathCount: 0, layerId: 'effect-x' }],
      run,
      width: 10,
    };
    const first = await resolveImageEffectOutputs<string, string>(options);
    const second = await resolveImageEffectOutputs<string, string>(options);
    expect(second.get('effect-x')).toBe(first.get('effect-x'));
  });
});

describe('firstLayerById', () => {
  it('keeps the first entry per id and preserves order and contents', () => {
    const layers = [
      { id: 'a', name: 'first a' },
      { id: 'b', name: 'only b' },
      { id: 'a', name: 'second a' },
      { id: 'c', name: 'only c' },
    ];
    const byId = firstLayerById(layers);
    expect([...byId.keys()]).toEqual(['a', 'b', 'c']);
    expect(byId.get('a')?.name).toBe('first a');
    expect(byId.get('b')?.name).toBe('only b');
    expect(byId.get('c')?.name).toBe('only c');
  });
});
