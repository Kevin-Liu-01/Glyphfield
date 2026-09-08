// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureComposedEffectFrames } from '../captureEffectFrames';
import { canvasToImageBlob } from '../canvasExport';

vi.mock('../canvasExport', () => ({ canvasToImageBlob: vi.fn(async () => new Blob(['png'], { type: 'image/png' })) }));
vi.mock('../shaderFrameAssets', () => ({ createShaderFrameAsset: vi.fn(async (_blob, canvas) => ({
  assetId: `shader-frame:${'a'.repeat(64)}`, version: 1, width: canvas.width, height: canvas.height,
})) }));
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); });

describe('atomic composed effect frame capture', () => {
  it('copies all compositor prefixes synchronously before encoding can yield or mutate the shared buffer', async () => {
    const events: string[] = [];
    const copies: HTMLCanvasElement[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
      copies.push(this);
      return { drawImage: () => events.push('copy') } as unknown as CanvasRenderingContext2D;
    });
    vi.mocked(canvasToImageBlob).mockImplementation(async () => { events.push('encode'); return new Blob(['png']); });
    const buffer = document.createElement('canvas');
    buffer.width = 640;
    buffer.height = 360;
    const operation = captureComposedEffectFrames(['effect-one', 'effect-two'], (copy) => {
      events.push('first'); copy('effect-one', buffer);
      events.push('second'); copy('effect-two', buffer);
    });
    expect(events.slice(0, 5)).toEqual(['first', 'copy', 'second', 'copy', 'encode']);
    const frames = await operation;
    expect(frames.size).toBe(2);
    expect(frames.get('effect-two')).toMatchObject({ width: 640, height: 360 });
    expect(copies.every((canvas) => canvas.width === 0 && canvas.height === 0)).toBe(true);
  });

  it('rejects incomplete, duplicate and loading converter buffers', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage() {} } as unknown as CanvasRenderingContext2D);
    const buffer = document.createElement('canvas');
    await expect(captureComposedEffectFrames(['effect-one'], () => {})).rejects.toThrow(/did not finish/);
    await expect(captureComposedEffectFrames(['effect-one'], (copy) => { copy('effect-one', buffer); copy('effect-one', buffer); })).rejects.toThrow(/order changed/);
    buffer.width = 0;
    await expect(captureComposedEffectFrames(['effect-one'], (copy) => copy('effect-one', buffer))).rejects.toThrow(/not ready/);
    expect(canvasToImageBlob).not.toHaveBeenCalled();
  });

  it('releases every temporary image even when storage or PNG encoding fails', async () => {
    const copies: HTMLCanvasElement[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
      copies.push(this);
      return { drawImage() {} } as unknown as CanvasRenderingContext2D;
    });
    vi.mocked(canvasToImageBlob).mockRejectedValueOnce(new Error('Storage unavailable'));
    await expect(captureComposedEffectFrames(['effect-one'], (copy) => copy('effect-one', document.createElement('canvas')))).rejects.toThrow(/Storage unavailable/);
    expect(copies.every((canvas) => canvas.width === 0 && canvas.height === 0)).toBe(true);
  });
});
