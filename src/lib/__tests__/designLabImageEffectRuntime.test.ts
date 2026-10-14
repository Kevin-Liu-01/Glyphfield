import { describe, expect, it, vi } from 'vitest';

import { createImageEffectProcessorPool } from '../designLabImageEffectRuntime';
import { designLabImageEffectPalette } from '../designLabImageEffects';
import { DEFAULT_LIVE_MATERIAL_SETTINGS } from '../liveMaterials';
import { resolveShaderEffectProps } from '../shaderEffectsProps';

const processed = vi.hoisted(() => ({ calls: [] as unknown[][] }));
vi.mock('../shaderEffectProcessor', () => ({
  createShaderEffectProcessor: async () => ({
    dispose: () => undefined,
    process: async (...args: unknown[]) => {
      processed.calls.push(args);
      return args[0];
    },
  }),
}));

describe('Design Lab image effect colours', () => {
  const brand = designLabImageEffectPalette(['#101820', '#FF5A1F', '#F4F1EA']);

  it('seeds palette-role colours from the brand palette instead of the Glyphfield default', () => {
    const effectId = 'shader-effects-dither';
    const branded = resolveShaderEffectProps(effectId, { ...brand, effectProps: {} });
    expect(branded.colorA).toBe('#101820');
    expect(branded.colorB).toBe('#F4F1EA');
    const defaults = resolveShaderEffectProps(effectId, { ...DEFAULT_LIVE_MATERIAL_SETTINGS, effectProps: {} });
    expect(defaults.colorA).not.toBe(branded.colorA);
    // An explicit edit still wins over the palette.
    expect(resolveShaderEffectProps(effectId, { ...brand, effectProps: { colorA: '#00FF00' } }).colorA).toBe('#00FF00');
  });

  it('hands the palette to the processor with every pass', async () => {
    const pool = createImageEffectProcessorPool();
    const source = {} as HTMLCanvasElement;
    await pool.process('effect-1', 'shader-effects-dither', source, {}, 0.5, brand);
    expect(processed.calls).toEqual([[source, {}, 0.5, brand]]);
    pool.dispose();
  });
});
