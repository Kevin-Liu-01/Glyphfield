// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { beginShaderFrameCapture, shaderFrameMatches, shaderFrameRecipeKey } from '../captureShaderFrames';
import { canvasToImageBlob } from '../canvasExport';
import { freezeLiveMaterialFrame } from '../liveMaterialPreview';

vi.mock('../canvasExport', () => ({ canvasToImageBlob: vi.fn(async () => new Blob(['png'], { type: 'image/png' })) }));
vi.mock('../liveMaterialPreview', async (original) => ({
  ...await original<typeof import('../liveMaterialPreview')>(), freezeLiveMaterialFrame: vi.fn(),
}));
vi.mock('../shaderFrameAssets', () => ({ createShaderFrameAsset: vi.fn(async (_blob, canvas) => ({
  assetId: `shader-frame:${'a'.repeat(64)}`, version: 1, width: canvas.width, height: canvas.height,
})) }));

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

afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); });

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

  it('invalidates snapshots when time or recipe changes but not settings key order', () => {
    const snapshot = { assetId: 'saved', version: 1 as const, width: 20, height: 10, timeMs: 500, recipeKey: shaderFrameRecipeKey(application) };
    expect(shaderFrameMatches(snapshot, application, 500)).toBe(true);
    expect(shaderFrameMatches(snapshot, { ...application, settings: { speed: 1, colorA: '#ff0000' } }, 500)).toBe(true);
    expect(shaderFrameMatches(snapshot, { ...application, shaderSize: 2 }, 500)).toBe(false);
    expect(shaderFrameMatches(snapshot, application, 501)).toBe(false);
  });
});
