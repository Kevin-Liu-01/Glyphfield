import { describe, expect, it } from 'vitest';

import { designEffectActionInput, designLayerActionInput } from '@/components/ShaderLabStudio';

describe('Design Lab layer Browser actions', () => {
  it('accepts each documented input shape', () => {
    expect(designLayerActionInput('design.layers.arrange', { arrangement: 'distribute-horizontal', layerIds: ['text-a'] }))
      .toEqual({ arrangement: 'distribute-horizontal', layerIds: ['text-a'] });
    expect(designLayerActionInput('design.layers.arrange', { arrangement: 'left' })).toEqual({ arrangement: 'left' });
    expect(designLayerActionInput('design.layers.lock', { layerIds: ['logo-a'], locked: true })).toEqual({ layerIds: ['logo-a'], locked: true });
    expect(designLayerActionInput('design.layers.copyStyle', { layerId: 'text-a' })).toEqual({ layerId: 'text-a' });
    expect(designLayerActionInput('design.layers.pasteStyle', { layerIds: ['text-b'] })).toEqual({ layerIds: ['text-b'] });
  });

  it('rejects unknown fields, wrong types and unknown arrangements', () => {
    expect(() => designLayerActionInput('design.layers.arrange', { arrangement: 'center' })).toThrow(/arrangement must be/);
    expect(() => designLayerActionInput('design.layers.arrange', { arrangement: 'left', extra: true })).toThrow(/accepts only/);
    expect(() => designLayerActionInput('design.layers.lock', { layerIds: ['a'], locked: 'yes' })).toThrow(/locked must be/);
    expect(() => designLayerActionInput('design.layers.lock', { locked: true })).toThrow(/layerIds must list/);
    expect(() => designLayerActionInput('design.layers.pasteStyle', { layerIds: [1] })).toThrow(/array of layer ids/);
    expect(() => designLayerActionInput('design.layers.copyStyle', {})).toThrow(/layerId must identify/);
    expect(() => designLayerActionInput('design.layers.rotate', {})).toThrow(/Unknown Design Lab action/);
  });
});

describe('Design Lab effect Browser actions', () => {
  it('accepts built-in converters and image effects', () => {
    expect(designEffectActionInput('design.effects.describe', undefined)).toEqual({});
    expect(designEffectActionInput('design.effects.add', { kind: 'halftone', opacity: 0.5 })).toEqual({ kind: 'halftone', opacity: 0.5 });
    expect(designEffectActionInput('design.effects.add', { effectId: 'shader-effects-blur', effectProps: { intensity: 40 } }))
      .toEqual({ effectId: 'shader-effects-blur', effectProps: { intensity: 40 } });
    expect(designEffectActionInput('design.effects.configure', { layerId: 'effect-a', effectProps: {} })).toEqual({ layerId: 'effect-a', effectProps: {} });
    expect(designEffectActionInput('design.effects.configure', { layerId: 'effect-a', kind: 'ascii' })).toEqual({ layerId: 'effect-a', kind: 'ascii' });
  });

  it('rejects ambiguous, foreign or host-supplied input', () => {
    expect(() => designEffectActionInput('design.effects.add', { effectId: 'shader-effects-aurora' })).toThrow(/image effect ID/);
    expect(() => designEffectActionInput('design.effects.add', { effectId: 'shader-effects-blur', kind: 'bayer' })).toThrow(/not both/);
    expect(() => designEffectActionInput('design.effects.add', { effectProps: { intensity: 4 } })).toThrow(/need an effectId/);
    expect(() => designEffectActionInput('design.effects.add', { kind: 'dither' })).toThrow(/kind must be/);
    expect(() => designEffectActionInput('design.effects.add', { opacity: 2 })).toThrow(/opacity must be/);
    expect(() => designEffectActionInput('design.effects.add', { effectId: 'shader-effects-blur', effectProps: { sourceImage: '' } }))
      .toThrow(/processes the layers beneath/);
    expect(() => designEffectActionInput('design.effects.configure', { effectProps: {} })).toThrow(/layerId must identify/);
    expect(() => designEffectActionInput('design.effects.configure', { layerId: 'effect-a' })).toThrow(/needs effectId, kind, effectProps or opacity/);
    expect(() => designEffectActionInput('design.effects.describe', { verbose: true })).toThrow(/takes no input/);
    expect(() => designEffectActionInput('design.effects.remove', {})).toThrow(/Unknown Design Lab action/);
  });
});
