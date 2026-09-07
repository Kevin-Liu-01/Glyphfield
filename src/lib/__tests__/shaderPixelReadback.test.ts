// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';

import { compareShaderPixels, readShaderPixels, summarizeShaderPixels } from '@/lib/shaderPixelReadback';

describe('shader pixel validation (real renderer coverage: check-shader-pixels.mjs)', () => {
  it('rejects fallback-only, missing, failed and not-yet-ready shader surfaces', () => {
    const root = document.createElement('main');
    document.body.append(root);
    root.innerHTML = '<img alt="Shader preview" />';
    expect(() => readShaderPixels(root)).toThrow('found 0');
    root.innerHTML = '<div data-live-material-ready="error"><img /></div>';
    expect(() => readShaderPixels(root)).toThrow('failed');
    root.innerHTML = '<div data-live-material-ready="false"><canvas /></div>';
    expect(() => readShaderPixels(root)).toThrow('not ready');
    root.innerHTML = '<div style="opacity:0"><canvas /></div>';
    expect(() => readShaderPixels(root)).toThrow('hidden');
    root.remove();
  });

  it('distinguishes transparent/flat buffers from varied visible pixels', () => {
    expect(summarizeShaderPixels({ data: new Uint8ClampedArray(8), height: 1, width: 2 }))
      .toMatchObject({ luminanceRange: 0, visibleFraction: 0 });
    expect(summarizeShaderPixels({ data: new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]), height: 1, width: 2 }))
      .toMatchObject({ luminanceRange: 255, meanLuminance: 127.5, visibleFraction: 1 });
  });

  it('compares actual bytes and dimensions, not thumbnails or file sizes', () => {
    const previous = { data: new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]), height: 1, width: 2 };
    expect(compareShaderPixels(previous, previous)).toMatchObject({ changedPixels: 0, dimensionsMatch: true, maxChannelDelta: 0 });
    const next = { ...previous, data: new Uint8ClampedArray([0, 0, 0, 255, 240, 255, 255, 255]) };
    expect(compareShaderPixels(previous, next)).toMatchObject({ changedPixels: 1, maxChannelDelta: 15 });
    expect(compareShaderPixels(previous, { ...next, width: 1 })).toMatchObject({ dimensionsMatch: false });
  });
});
