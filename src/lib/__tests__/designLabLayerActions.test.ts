import { describe, expect, it } from 'vitest';

import { designLayerActionInput } from '@/components/ShaderLabStudio';

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
