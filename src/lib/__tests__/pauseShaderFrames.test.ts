import { afterEach, describe, expect, it, vi } from 'vitest';
import { pauseShaderFrames } from '../pauseShaderFrames';
import { freezeLiveMaterialFrame } from '../liveMaterialPreview';

vi.mock('../liveMaterialPreview', () => ({ freezeLiveMaterialFrame: vi.fn() }));
const state = { engine: 'paper' as const, version: 2 as const, frame: 19.25, timelineTimeMs: 1000 };
const request = { key: 'canvas-one', root: null, recipeKey: 'recipe' };
afterEach(() => vi.resetAllMocks());

describe('storage-free shader pause', () => {
  it('keeps the exact native state held until React commits pause, then releases once', () => {
    const resume = vi.fn();
    vi.mocked(freezeLiveMaterialFrame).mockReturnValue({ canvas: {} as HTMLCanvasElement, state, resume });
    const operation = pauseShaderFrames([request], 1000);
    expect(operation.states.get(request.key)).toBe(state);
    expect(resume).not.toHaveBeenCalled();
    operation.release();
    operation.release();
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it('releases all previously paused renderers if another is not ready', () => {
    const resume = vi.fn();
    vi.mocked(freezeLiveMaterialFrame).mockReturnValueOnce({ canvas: {} as HTMLCanvasElement, state, resume });
    expect(() => pauseShaderFrames([request, { ...request, key: 'two' }], 1000)).toThrow('still loading');
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it('does not touch a renderer for an already captured frame', () => {
    const existing = { frameState: state, frameSnapshot: { assetId: 'saved', width: 10, height: 10, version: 1 as const } };
    const operation = pauseShaderFrames([{ ...request, existing }], 1000);
    expect(operation.states.get(request.key)).toBe(state);
    expect(freezeLiveMaterialFrame).not.toHaveBeenCalled();
    operation.release();
  });
});
