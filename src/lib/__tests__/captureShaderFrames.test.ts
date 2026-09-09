// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { beginShaderFrameCapture, shaderFrameMatches, shaderFrameRecipeKey, type CapturedShaderFrame } from '../captureShaderFrames';
import { canvasToImageBlob } from '../canvasExport';
import { freezeLiveMaterialFrame } from '../liveMaterialPreview';
import { createShaderFrameAsset, validateShaderFramePng } from '../shaderFrameAssets';

vi.mock('../canvasExport', () => ({ canvasToImageBlob: vi.fn(async () => new Blob(['png'], { type: 'image/png' })) }));
vi.mock('../liveMaterialPreview', async (original) => ({
  ...await original<typeof import('../liveMaterialPreview')>(), freezeLiveMaterialFrame: vi.fn(),
}));
vi.mock('../shaderFrameAssets', () => ({ createShaderFrameAsset: vi.fn(async (_blob, canvas) => ({
  assetId: `shader-frame:${'a'.repeat(64)}`, version: 1, width: canvas.width, height: canvas.height,
})), validateShaderFramePng: vi.fn(async (_blob, dimensions) => ({ width: dimensions.width, height: dimensions.height })) }));

const frameState = { engine: 'paper' as const, frame: 1234.567, timelineTimeMs: 500, version: 2 as const };
const application = { materialId: 'paper-dithering', settings: { colorA: '#ff0000', speed: 1 }, shaderSize: 1 };
const request = (key: string) => ({ key, root: document.createElement('div'), recipeKey: shaderFrameRecipeKey(application) });

function mockFrames(events: string[]) {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({
    drawImage: () => events.push('copy'),
  }) as unknown as CanvasRenderingContext2D);
  vi.mocked(freezeLiveMaterialFrame).mockImplementation(() => {
    events.push('freeze');
    const canvas = document.createElement('canvas');
    canvas.width = 20;
    canvas.height = 10;
    return { canvas, state: frameState, resume: () => events.push('resume'), presentation: { filter: 'brightness(1.2)' } };
  });
}

afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

describe('atomic displayed shader frame capture', () => {
  it('copies every canvas before encoding yields and immediately resumes normal Save capture', async () => {
    const events: string[] = [];
    mockFrames(events);
    vi.mocked(canvasToImageBlob).mockImplementation(async () => { events.push('encode'); return new Blob(['png']); });
    const capture = beginShaderFrameCapture([request('one'), request('two')], 500);
    expect(events.slice(0, 7)).toEqual(['freeze', 'copy', 'freeze', 'copy', 'resume', 'resume', 'encode']);
    const frames = await capture.result;
    expect(frames.size).toBe(2);
    expect(frames.get('one')?.frameState.frame).toBe(1234.567);
    expect(frames.get('one')?.frameSnapshot.presentation).toEqual({ filter: 'brightness(1.2)' });
    capture.resume();
    expect(events.filter((event) => event === 'resume')).toHaveLength(2);
  });

  it('keeps pause capture held until the caller commits, releasing idempotently', async () => {
    const events: string[] = [];
    mockFrames(events);
    const capture = beginShaderFrameCapture([request('one')], 500, { hold: true });
    await capture.result;
    expect(events).not.toContain('resume');
    capture.resume();
    capture.resume();
    expect(events.filter((event) => event === 'resume')).toHaveLength(1);
  });

  it('captures export-only pixels without durable persistence and releases scratch buffers', async () => {
    mockFrames([]);
    const frames = await beginShaderFrameCapture([request('one'), request('two')], 500, { mode: 'transient' }).result;
    expect(createShaderFrameAsset).not.toHaveBeenCalled();
    expect(validateShaderFramePng).toHaveBeenCalledTimes(2);
    expect(frames.get('one')?.frameBlob).toBeInstanceOf(Blob);
    for (const [encoder] of vi.mocked(canvasToImageBlob).mock.calls) {
      const canvas = encoder as HTMLCanvasElement;
      expect([canvas.width, canvas.height]).toEqual([0, 0]);
    }
  });

  it('exports valid temporary pixels without crypto, storage, or a fabricated durable asset ID', async () => {
    mockFrames([]);
    vi.stubGlobal('crypto', undefined);
    vi.stubGlobal('indexedDB', undefined);
    const frames = await beginShaderFrameCapture([request('one')], 500, { mode: 'transient' }).result;
    expect(frames.get('one')).toMatchObject({ frameBlob: expect.any(Blob), width: 20, height: 10, frameState });
    expect(frames.get('one')).not.toHaveProperty('frameSnapshot');
    expect(frames.get('one')).not.toHaveProperty('assetId');
    expect(createShaderFrameAsset).not.toHaveBeenCalled();
  });

  it('cleans every copied buffer and reports an actionable capture SecurityError', async () => {
    mockFrames([]);
    const copies: HTMLCanvasElement[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
      copies.push(this);
      return { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D;
    });
    const cause = new DOMException('The operation is insecure.', 'SecurityError');
    vi.mocked(canvasToImageBlob).mockRejectedValueOnce(cause);
    const capture = beginShaderFrameCapture([request('one'), request('two')], 500, { hold: true });
    await expect(capture.result).rejects.toMatchObject({ name: 'SecurityError', cause, message: expect.stringMatching(/browser.*pixels.*cross-origin/i) });
    expect(copies).toHaveLength(2);
    copies.forEach((canvas) => expect([canvas.width, canvas.height]).toEqual([0, 0]));
  });

  it('cleans the currently allocated buffer when synchronous copying fails', () => {
    mockFrames([]);
    const copies: HTMLCanvasElement[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
      copies.push(this);
      return { drawImage: () => { throw new Error('GPU copy failed'); } } as unknown as CanvasRenderingContext2D;
    });
    expect(() => beginShaderFrameCapture([request('one')], 500)).toThrow('GPU copy failed');
    copies.forEach((canvas) => expect([canvas.width, canvas.height]).toEqual([0, 0]));
  });

  it('fails the whole capture and releases previous canvases when a renderer is not ready', () => {
    const events: string[] = [];
    mockFrames(events);
    const readyFrame = vi.mocked(freezeLiveMaterialFrame).getMockImplementation()!;
    vi.mocked(freezeLiveMaterialFrame).mockImplementationOnce(readyFrame).mockReturnValueOnce(undefined);
    expect(() => beginShaderFrameCapture([request('one'), request('two')], 500)).toThrow('still loading');
    expect(events).toEqual(['freeze', 'copy', 'resume']);
    expect(canvasToImageBlob).not.toHaveBeenCalled();
  });

  it('releases frozen engines on encoding failure instead of reporting partial success', async () => {
    const events: string[] = [];
    mockFrames(events);
    vi.mocked(canvasToImageBlob).mockRejectedValueOnce(new Error('storage full'));
    const capture = beginShaderFrameCapture([request('one')], 500, { hold: true });
    await expect(capture.result).rejects.toThrow('storage full');
    expect(events).toContain('resume');
  });

  it('reuses a persisted exact frame without mounting or reading a shader', async () => {
    const existing = { frameState, frameSnapshot: { assetId: 'saved', version: 1 as const, width: 20, height: 10 } };
    const frames = await beginShaderFrameCapture([{ ...request('one'), existing }], 500).result;
    expect(frames.get('one')).toBe(existing);
    expect(freezeLiveMaterialFrame).not.toHaveBeenCalled();
    expect(canvasToImageBlob).not.toHaveBeenCalled();
  });

  it('does not reuse an export-only result as if its pixels had been saved', () => {
    const existing = { frameState, frameSnapshot: { assetId: 'saved', version: 1 as const, width: 20, height: 10 },
      frameBlob: new Blob(['pixels'], { type: 'image/png' }) };
    expect(() => beginShaderFrameCapture([{ ...request('one'), existing: existing as unknown as CapturedShaderFrame }], 500)).toThrow(/export-only/);
    expect(createShaderFrameAsset).not.toHaveBeenCalled();
  });

  it('invalidates snapshots when time or recipe changes but not settings key order', () => {
    const snapshot = { assetId: 'saved', version: 1 as const, width: 20, height: 10, timeMs: 500, recipeKey: shaderFrameRecipeKey(application) };
    expect(shaderFrameMatches(snapshot, application, 500)).toBe(true);
    expect(shaderFrameMatches(snapshot, { ...application, settings: { speed: 1, colorA: '#ff0000' } }, 500)).toBe(true);
    expect(shaderFrameMatches(snapshot, { ...application, shaderSize: 2 }, 500)).toBe(false);
    expect(shaderFrameMatches(snapshot, application, 501)).toBe(false);
  });
});
