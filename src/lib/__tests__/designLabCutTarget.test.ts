import { describe, expect, it } from 'vitest';

import { designLabCutTarget } from '../designLabClipboard';

describe('Design Lab cut target', () => {
  it('cuts the canvas selection, which never holds a locked layer', () => {
    expect(designLabCutTarget({ canvasSelectionCount: 2, chosenLayerLocked: false })).toBe('canvas-selection');
  });

  it('cuts the unlocked layer chosen in the layer list', () => {
    expect(designLabCutTarget({ canvasSelectionCount: 0, chosenLayerLocked: false })).toBe('chosen-layer');
  });

  it('only copies a locked layer chosen in the layer list, as Delete leaves it in place', () => {
    expect(designLabCutTarget({ canvasSelectionCount: 0, chosenLayerLocked: true })).toBe('copy-only');
  });
});
