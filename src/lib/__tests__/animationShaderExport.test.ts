// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAnimationShaderExport } from '../animationShaderExport';
import { createLiveMaterialClock } from '../liveMaterialClock';
import { DEFAULT_LIVE_MATERIAL_SETTINGS, type LiveMaterialId } from '../liveMaterials';
import { registerLiveMaterialRuntime } from '../liveMaterialPreview';
import type { StudioSource } from '../renderFrame';
import { drawShaderFramePresentation, preloadShaderFramePresentation } from '../shaderFramePresentation';

vi.mock('../shaderFramePresentation', () => ({
  drawShaderFramePresentation: vi.fn(), preloadShaderFramePresentation: vi.fn(async () => {}),
}));

function source(id = 'one', materialId: LiveMaterialId = 'paper-dithering'): StudioSource {
  return { id, kind: 'text', text: id, background: {
    style: 'shader', materialId, materialSettings: DEFAULT_LIVE_MATERIAL_SETTINGS,
    angle: 0, colorA: '#111111', colorB: '#eeeeee', colorC: '#888888',
  } };
}

function renderer(ready = 'true') {
  const root = document.createElement('div');
  root.innerHTML = `<div data-live-material-ready="${ready}"><canvas width="80" height="40"></canvas></div>`;
  return { root, canvas: root.querySelector('canvas')!, surface: root.firstElementChild! };
}

describe('Animation shader export parity', () => {
  const clearRect = vi.fn();
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ clearRect } as unknown as CanvasRenderingContext2D);
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
      queueMicrotask(() => callback(0));
      return 1;
    });
  });
  afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); });

  it('waits for actual lazy shader readiness before compositing instead of binding a fallback', async () => {
    const { root, surface, canvas } = renderer('false');
    const clip = createAnimationShaderExport([source()], () => ({ key: 'sequence', root: () => root }));
    let finished = false;
    const render = clip.refresh().then(() => { finished = true; });
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(finished).toBe(false);
    expect(drawShaderFramePresentation).not.toHaveBeenCalled();
    surface.setAttribute('data-live-material-ready', 'true');
    await render;
    expect(drawShaderFramePresentation).toHaveBeenCalledWith(expect.anything(), canvas, undefined, { x: 0, y: 0, width: 80, height: 40 });
    expect(clip.sources[0]!.background!.image).not.toBe(canvas);
    clip.dispose();
  });

  it('rejects unavailable or missing native canvases rather than returning gradient output', async () => {
    const { root } = renderer('error');
    const clip = createAnimationShaderExport([source()], () => ({ key: 'sequence', root: () => root }));
    await expect(clip.refresh()).rejects.toThrow('could not render');
    root.innerHTML = '<div data-live-material-ready="true"></div>';
    await expect(clip.refresh()).rejects.toThrow(/fallback cannot be exported/);
    expect(drawShaderFramePresentation).not.toHaveBeenCalled();
    clip.dispose();
  });

  it('composites current filter/grain once per shared native instance on every sample', async () => {
    const { root, canvas } = renderer();
    const presentation = { filter: 'brightness(1.2) saturate(0.8)', grainOpacity: 0.2, grainTileSize: 120 };
    const cleanup = registerLiveMaterialRuntime(canvas, {
      readFrame: () => ({ engine: 'paper', frame: 44, timelineTimeMs: 20, version: 2 }),
      freeze: vi.fn(), resume: vi.fn(), presentation: () => presentation,
    });
    const previewSource = source();
    previewSource.background!.shaderPresentation = presentation;
    const clip = createAnimationShaderExport([previewSource, source('two')], () => ({ key: 'sequence', root: () => root }));
    expect(clip.sources[0]!.background!.image).toBe(clip.sources[1]!.background!.image);
    expect(clip.sources[0]!.background!.shaderPresentation).toBeUndefined();
    await clip.refresh();
    await clip.refresh();
    expect(preloadShaderFramePresentation).toHaveBeenCalledTimes(2);
    expect(drawShaderFramePresentation).toHaveBeenCalledTimes(2);
    expect(drawShaderFramePresentation).toHaveBeenLastCalledWith(expect.anything(), canvas, presentation, expect.anything());
    const scratch = clip.sources[0]!.background!.image as HTMLCanvasElement;
    clip.dispose();
    expect([scratch.width, scratch.height]).toEqual([0, 0]);
    await expect(clip.refresh()).rejects.toThrow('has ended');
    cleanup();
  });

  it('captures the exact entry anchor so paused pixels are restored after sampled export', () => {
    const { root, canvas } = renderer();
    const clock = createLiveMaterialClock('webgl', 'aurora');
    const draw = (time: number | null, frameState?: Parameters<typeof clock.draw>[0]['frameState']) => clock.draw({
      now: 0, rate: 1, active: true, paused: true, captureTimeMs: time, frameState,
    });
    draw(875.25);
    const cleanup = registerLiveMaterialRuntime(canvas, {
      readFrame: (timeMs) => clock.read(timeMs), freeze: () => clock.freeze(), resume: () => clock.resume(),
    });
    const clip = createAnimationShaderExport([source()], () => ({ key: 'sequence', root: () => root }));
    const pose = clip.captureEntryPose(300);
    expect(clock.frozen).toBe(true);
    expect(pose.states.get('sequence')!.frame).toBe(875.25);
    pose.release();
    pose.release();
    draw(1600, pose.states.get('sequence'));
    expect(clock.frame).not.toBe(875.25);
    draw(300, pose.states.get('sequence'));
    expect(clock.frame).toBe(875.25);
    expect(clock.frozen).toBe(false);
    clip.dispose();
    cleanup();
  });

  it('rejects stateful Fluid before allocating buffers or beginning timestamp sampling', () => {
    const resolve = vi.fn();
    expect(() => createAnimationShaderExport([source(), source('fluid', 'pavel-fluid-energy')], resolve)).toThrow(/Fluid needs a live recording/);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('does not bind an old canvas if a renderer is replaced between samples', async () => {
    const { root, canvas } = renderer();
    const clip = createAnimationShaderExport([source()], () => ({ key: 'sequence', root: () => root }));
    await clip.refresh();
    const replacement = document.createElement('canvas');
    replacement.width = 100;
    replacement.height = 50;
    canvas.replaceWith(replacement);
    await clip.refresh();
    expect(drawShaderFramePresentation).toHaveBeenLastCalledWith(expect.anything(), replacement, undefined, { x: 0, y: 0, width: 100, height: 50 });
    clip.dispose();
  });

  it('waits for every override before producing a complete frame', async () => {
    const first = renderer();
    const second = renderer('false');
    const clip = createAnimationShaderExport([source(), source('two')], (item) => ({
      key: item.id, root: () => item.id === 'one' ? first.root : second.root,
    }));
    const pending = clip.refresh();
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(drawShaderFramePresentation).not.toHaveBeenCalled();
    second.surface.setAttribute('data-live-material-ready', 'true');
    await pending;
    expect(drawShaderFramePresentation).toHaveBeenCalledTimes(2);
    clip.dispose();
  });

  it('releases already-frozen native engines if another entry pose cannot be read', () => {
    const first = renderer();
    const second = renderer();
    const resume = vi.fn();
    const cleanups = [registerLiveMaterialRuntime(first.canvas, {
      readFrame: () => ({ engine: 'paper', frame: 400, timelineTimeMs: 0, version: 2 }),
      freeze: vi.fn(), resume,
    }), registerLiveMaterialRuntime(second.canvas, {
      readFrame: () => { throw new Error('Renderer lost'); }, freeze: vi.fn(), resume: vi.fn(),
    })];
    const clip = createAnimationShaderExport([source(), source('two')], (item) => ({
      key: item.id, root: () => item.id === 'one' ? first.root : second.root,
    }));
    expect(() => clip.captureEntryPose(0)).toThrow('Renderer lost');
    expect(resume).toHaveBeenCalledOnce();
    cleanups.forEach((cleanup) => cleanup());
    clip.dispose();
  });

  it('does not compose after an export is disposed during presentation loading', async () => {
    const { root } = renderer();
    let finish!: () => void;
    vi.mocked(preloadShaderFramePresentation).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const clip = createAnimationShaderExport([source()], () => ({ key: 'sequence', root: () => root }));
    const pending = clip.refresh();
    const rejected = expect(pending).rejects.toThrow('has ended');
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    clip.dispose();
    finish();
    await rejected;
    expect(drawShaderFramePresentation).not.toHaveBeenCalled();
  });

  it('passes non-shader sources through without allocating native work', async () => {
    const plain: StudioSource = { id: 'text', kind: 'text', text: 'Hello' };
    const resolve = vi.fn();
    const clip = createAnimationShaderExport([plain], resolve);
    expect(clip.sources[0]).toBe(plain);
    expect(clip.captureEntryPose(20).states.size).toBe(0);
    await clip.refresh();
    expect(resolve).not.toHaveBeenCalled();
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    clip.dispose();
  });
});
