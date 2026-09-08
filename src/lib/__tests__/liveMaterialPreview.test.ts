import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  captureLiveMaterialFrameState,
  clearLiveMaterialTimePreview,
  LIVE_MATERIAL_PATTERN_SCALE_PREVIEW_EVENT,
  LIVE_MATERIAL_SETTINGS_PREVIEW_EVENT,
  LIVE_MATERIAL_TIME_PREVIEW_EVENT,
  previewLiveMaterialPatternScale,
  previewLiveMaterialSettings,
  previewLiveMaterialTime,
  normalizeLiveMaterialFrameState,
  registerLiveMaterialRuntime,
  freezeLiveMaterialFrame,
  readLiveMaterialPresentation,
  createLiveMaterialPreviewSignal,
  hasUncommittedShaderPreview,
  type LiveMaterialPatternScalePreview,
  type LiveMaterialSettingsPreview,
  type LiveMaterialTimePreview,
} from '@/lib/liveMaterialPreview';
import { DEFAULT_LIVE_MATERIAL_SETTINGS } from '@/lib/liveMaterials';

describe('live material local previews', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('routes each preview to its renderer channel without touching composition state', () => {
    const target = new EventTarget();
    vi.stubGlobal('window', target);
    const received: unknown[] = [];
    target.addEventListener(LIVE_MATERIAL_PATTERN_SCALE_PREVIEW_EVENT, (event) => {
      received.push((event as CustomEvent<LiveMaterialPatternScalePreview>).detail);
    });
    target.addEventListener(LIVE_MATERIAL_SETTINGS_PREVIEW_EVENT, (event) => {
      received.push((event as CustomEvent<LiveMaterialSettingsPreview>).detail);
    });
    target.addEventListener(LIVE_MATERIAL_TIME_PREVIEW_EVENT, (event) => {
      received.push((event as CustomEvent<LiveMaterialTimePreview>).detail);
    });

    previewLiveMaterialPatternScale('content-asset-1', 2.4);
    previewLiveMaterialSettings('content-asset-1', { frequency: 8, colorA: '#2F6BFF' });
    previewLiveMaterialTime('design-lab', 640);
    clearLiveMaterialTimePreview('design-lab');

    expect(received).toEqual([
      { channel: 'content-asset-1', value: 2.4 },
      { channel: 'content-asset-1', settings: { frequency: 8, colorA: '#2F6BFF' } },
      { group: 'design-lab', timeMs: 640 },
      { group: 'design-lab', timeMs: null },
    ]);
  });

  it('captures a compact native Paper frame instead of persisting canvas pixels', () => {
    const surface = {
      paperShaderMount: { getCurrentFrame: () => 412.75 },
      querySelectorAll: () => [],
    } as unknown as ParentNode;

    expect(captureLiveMaterialFrameState(surface, 640)).toEqual({
      engine: 'paper',
      frame: 412.75,
      timelineTimeMs: 640,
      version: 2,
    });
    expect(normalizeLiveMaterialFrameState({
      engine: 'paper',
      frame: Number.NaN,
      timelineTimeMs: 640,
      version: 1,
    })).toBeUndefined();
  });

  it('migrates Paper v1 exactly and rejects unknown engines or versions', () => {
    expect(normalizeLiveMaterialFrameState({ engine: 'paper', frame: -42.75, timelineTimeMs: 123, version: 1 }))
      .toEqual({ engine: 'paper', frame: -42.75, timelineTimeMs: 123, version: 2 });
    expect(normalizeLiveMaterialFrameState({ engine: 'fluid', frame: 9, timelineTimeMs: 12, version: 1 })).toBeUndefined();
    expect(normalizeLiveMaterialFrameState({ engine: 'unknown', frame: 9, timelineTimeMs: 12, version: 2 })).toBeUndefined();
    expect(normalizeLiveMaterialFrameState({ engine: 'paper', frame: 9, timelineTimeMs: 12, version: 99 })).toBeUndefined();
  });

  it('freezes an authentic registered canvas without drawing and resumes only once', () => {
    const canvas = { width: 320, height: 200, querySelectorAll: () => [] } as unknown as HTMLCanvasElement;
    const root = { querySelectorAll: () => [canvas] } as unknown as ParentNode;
    const freeze = vi.fn();
    const resume = vi.fn();
    const readFrame = vi.fn((timelineTimeMs: number) => ({ engine: 'fluid' as const, frame: 712.25, timelineTimeMs, version: 2 as const }));
    const unregister = registerLiveMaterialRuntime(canvas, { readFrame, freeze, resume });
    const captured = freezeLiveMaterialFrame(root, 333);
    expect(captured?.canvas).toBe(canvas);
    expect(captured?.state.frame).toBe(712.25);
    expect(freeze).toHaveBeenCalledTimes(1);
    captured?.resume();
    captured?.resume();
    expect(resume).toHaveBeenCalledTimes(1);
    unregister();
    expect(freezeLiveMaterialFrame(root, 333)).toBeUndefined();
  });

  it('does not freeze a loading runtime or replace its pixels with a fallback', () => {
    const canvas = { width: 320, height: 200, querySelectorAll: () => [] } as unknown as HTMLCanvasElement;
    const freeze = vi.fn();
    const unregister = registerLiveMaterialRuntime(canvas, { readFrame: () => undefined, freeze, resume: vi.fn() });
    expect(freezeLiveMaterialFrame(canvas, 0)).toBeUndefined();
    expect(freeze).not.toHaveBeenCalled();
    unregister();
  });
  it('reads live presentation metadata without freezing or advancing the renderer', () => {
    const canvas = { width: 640, height: 360, querySelectorAll: () => [] } as unknown as HTMLCanvasElement;
    const freeze = vi.fn();
    const resume = vi.fn();
    const presentation = { filter: 'contrast(1.2)', grainOpacity: 0.12, grainTileSize: 320 };
    const unregister = registerLiveMaterialRuntime(canvas, {
      readFrame: () => ({ engine: 'paper', frame: 100, timelineTimeMs: 0, version: 2 }),
      freeze, resume, presentation: () => presentation,
    });
    expect(readLiveMaterialPresentation(canvas)).toEqual(presentation);
    expect(freeze).not.toHaveBeenCalled();
    expect(resume).not.toHaveBeenCalled();
    expect(freezeLiveMaterialFrame(canvas, 0)?.presentation).toEqual(presentation);
    unregister();
    expect(readLiveMaterialPresentation(canvas)).toBeUndefined();
  });
  it('publishes painted preview revisions without starving during continuous drag events', () => {
    const pending = new Map<number, FrameRequestCallback>();
    let id = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { pending.set(++id, callback); return id; });
    vi.stubGlobal('cancelAnimationFrame', (key: number) => pending.delete(key));
    const surface = { dataset: {} } as HTMLElement;
    const signal = createLiveMaterialPreviewSignal(surface);
    const paint = () => { const work = [...pending.values()]; pending.clear(); work.forEach((callback) => callback(0)); };
    signal.publish();
    signal.publish();
    expect(pending.size).toBe(1);
    paint();
    expect(surface.dataset.liveMaterialPreviewRevision).toBeUndefined();
    signal.publish();
    paint();
    expect(surface.dataset.liveMaterialPreviewRevision).toBe('1');
    signal.publish();
    paint();
    signal.publish();
    paint();
    expect(surface.dataset.liveMaterialPreviewRevision).toBe('2');
    signal.publish();
    signal.dispose();
    paint();
    signal.publish();
    expect(pending.size).toBe(0);
    expect(surface.dataset.liveMaterialPreviewRevision).toBe('2');
  });
  it('unblocks capture after settings or scale commits and ignores no-op previews', () => {
    const settings = { ...DEFAULT_LIVE_MATERIAL_SETTINGS };
    const colorPreview = { base: settings, value: { colorA: '#ff2200' } };
    expect(hasUncommittedShaderPreview(null, settings, null, 1, null, 500)).toBe(false);
    expect(hasUncommittedShaderPreview(colorPreview, settings, null, 1, null, 500)).toBe(true);
    expect(hasUncommittedShaderPreview(colorPreview, { ...settings, ...colorPreview.value }, null, 1, null, 500)).toBe(false);
    expect(hasUncommittedShaderPreview({ base: settings, value: { colorA: settings.colorA } }, settings, null, 1, null, 500)).toBe(false);
    const scalePreview = { base: 1, value: 1.8 };
    expect(hasUncommittedShaderPreview(null, settings, scalePreview, 1, null, 500)).toBe(true);
    expect(hasUncommittedShaderPreview(null, settings, scalePreview, 1.8, null, 500)).toBe(false);
    expect(hasUncommittedShaderPreview(null, settings, { base: 1, value: 1 }, 1, null, 500)).toBe(false);
  });
  it('keeps Paper imperative previews guarded until commit explicitly clears the time sentinel', () => {
    const settings = DEFAULT_LIVE_MATERIAL_SETTINGS;
    // Later Paper setFrame calls do not update this first React preview value.
    const firstTimePreview = { base: 500, value: 500 };
    expect(hasUncommittedShaderPreview(null, settings, null, 1, firstTimePreview, 500)).toBe(true);
    // A changed committed time invalidates the old preview base immediately.
    expect(hasUncommittedShaderPreview(null, settings, null, 1, firstTimePreview, 750)).toBe(false);
    // Committing the same time, resuming, or stopping a sequence clears it.
    expect(hasUncommittedShaderPreview(null, settings, null, 1, null, 500)).toBe(false);
    expect(hasUncommittedShaderPreview(null, settings, null, 1, null, null)).toBe(false);
  });
});
