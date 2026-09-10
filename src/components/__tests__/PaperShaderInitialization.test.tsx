// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gemSmokePresets } from '@paper-design/shaders-react';

import LiveMaterialCanvas from '@/components/LiveMaterialCanvas';
import { DEFAULT_LIVE_MATERIAL_SETTINGS, getPaperLiveMaterialDefinition } from '@/lib/liveMaterials';
import { freezeLiveMaterialFrame, previewLiveMaterialTime } from '@/lib/liveMaterialPreview';
import { resolvePaperShaderFrame } from '@/lib/paperShaderTime';
import { loadPaperShaderRenderer } from '@/components/paperShaderRegistry';
import * as paperRegistry from '@/components/paperShaderRegistry';
import type { PaperShaderRenderer } from '@/components/paperShaderRenderer';

const native = vi.hoisted(() => ({
  frame: 0,
  props: {} as { frame?: number; speed?: number },
  ready: undefined as (() => void) | undefined,
  setFrame: vi.fn<(frame: number) => void>(),
  setSpeed: vi.fn<(speed: number) => void>(),
}));

vi.mock('@/lib/paperShaderReadiness', () => ({
  observePaperShaderReadiness: (_surface: HTMLElement, ready: () => void) => {
    native.ready = ready;
    return () => { native.ready = undefined; };
  },
}));
vi.mock('@/lib/webglContext', () => ({
  browserSupportsWebGL2: () => true,
  cancelWebGLContextRelease: vi.fn(),
  scheduleWebGLContextRelease: vi.fn(),
}));
vi.mock('@paper-design/shaders-react', async (original) => {
  const paper = await original<typeof import('@paper-design/shaders-react')>();
  const { createElement, forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } = await import('react');
  return { ...paper, GemSmoke: forwardRef<HTMLDivElement, Record<string, unknown>>((props, ref) => {
    const surface = useRef<HTMLDivElement>(null);
    useImperativeHandle(ref, () => surface.current!);
    useLayoutEffect(() => { native.props = props; });
    useEffect(() => {
      const element = surface.current! as HTMLDivElement & { paperShaderMount?: unknown };
      const canvas = element.appendChild(document.createElement('canvas'));
      native.frame = Number(props.frame);
      element.paperShaderMount = {
        getCurrentFrame: () => native.frame,
        setFrame: native.setFrame,
        setSpeed: native.setSpeed,
      };
      return () => { canvas.remove(); delete element.paperShaderMount; };
      // Simulates Paper's asynchronous constructor: its later isInitialized
      // effect is driven explicitly by each test, after our initial seek.
    }, []);
    return createElement('div', { ref: surface, 'data-paper-shader': '' });
  }) };
});

describe('Paper controlled first-frame initialization', () => {
  let host: HTMLDivElement;
  let root: Root;
  const materialId = 'paper-gem-smoke';
  const preset = gemSmokePresets[getPaperLiveMaterialDefinition(materialId).presetIndex]!.params;
  const expected = (timeMs: number) => resolvePaperShaderFrame({
    materialId, timeMs, preserveGeometry: false,
    speed: DEFAULT_LIVE_MATERIAL_SETTINGS.speed, preset,
  });
  const render = async (timeMs: number | null, paused = true) => {
    await act(async () => root.render(<LiveMaterialCanvas materialId={materialId}
      settings={DEFAULT_LIVE_MATERIAL_SETTINGS} captureTimeMs={timeMs} paused={paused} activeWhileMounted />));
    await act(async () => { await loadPaperShaderRenderer('gem-smoke'); });
  };

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    native.setFrame.mockImplementation((frame) => { native.frame = frame; });
    native.setSpeed.mockClear();
    host = document.body.appendChild(document.createElement('div'));
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    native.setFrame.mockReset();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('seeds the native constructor and its delayed isInitialized reset with authored time, not preset zero', async () => {
    await render(1250);
    expect(native.props.frame).toBeCloseTo(expected(1250));
    native.setFrame(native.props.frame!); // installed Paper's delayed effect
    expect(freezeLiveMaterialFrame(host, 1250)).toBeUndefined();
    await act(async () => native.ready!());
    const capture = freezeLiveMaterialFrame(host, 1250);
    expect(capture?.state.frame).toBeCloseTo(expected(1250));
    capture?.resume();
  });

  it('reapplies the latest seek before ready exposes the capture runtime', async () => {
    await render(1250);
    await render(2500);
    native.setFrame(0); // late vendor initialization overwrote an earlier seek
    expect(host.querySelector('.paper-shader-host')?.getAttribute('data-live-material-ready')).toBe('false');
    expect(freezeLiveMaterialFrame(host, 2500)).toBeUndefined();
    await act(async () => native.ready!());
    const capture = freezeLiveMaterialFrame(host, 2500);
    expect(host.querySelector('.paper-shader-host')?.getAttribute('data-live-material-ready')).toBe('true');
    expect(capture?.state.frame).toBeCloseTo(expected(2500));
    capture?.resume();
  });

  it('retains every imperative seek while a non-landing family is still downloading', async () => {
    const renderer = await loadPaperShaderRenderer('gem-smoke');
    const read = vi.spyOn(paperRegistry, 'readPaperShaderRenderer').mockReturnValue(undefined);
    let finish!: (value: PaperShaderRenderer) => void;
    vi.spyOn(paperRegistry, 'loadPaperShaderRenderer').mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    await act(async () => root.render(<LiveMaterialCanvas materialId={materialId}
      settings={DEFAULT_LIVE_MATERIAL_SETTINGS} previewGroup='loading-family' activeWhileMounted />));
    for (const timeMs of [1250, 2500]) {
      await act(async () => {
        previewLiveMaterialTime('loading-family', timeMs);
        await new Promise((resolve) => setTimeout(resolve, 40));
      });
    }
    expect(host.querySelector('canvas')).toBeNull();
    await act(async () => { read.mockRestore(); finish(renderer); });
    expect(native.props.frame).toBeCloseTo(expected(2500));
  });

  it('starts the provider watchdog only after a slow family download and preserves the latest seek', async () => {
    const renderer = await loadPaperShaderRenderer('gem-smoke');
    vi.useFakeTimers();
    const read = vi.spyOn(paperRegistry, 'readPaperShaderRenderer').mockReturnValue(undefined);
    let finish!: (value: PaperShaderRenderer) => void;
    const load = vi.spyOn(paperRegistry, 'loadPaperShaderRenderer').mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    await act(async () => root.render(<LiveMaterialCanvas materialId={materialId}
      settings={DEFAULT_LIVE_MATERIAL_SETTINGS} previewGroup='slow-family' activeWhileMounted />));
    await act(async () => { await vi.advanceTimersByTimeAsync(1600); });
    expect(load).toHaveBeenCalledOnce();
    expect(host.querySelector('[data-live-material-ready="error"]')).toBeNull();
    await act(async () => {
      previewLiveMaterialTime('slow-family', 2500);
      await vi.advanceTimersByTimeAsync(40);
    });
    await act(async () => { read.mockRestore(); finish(renderer); });
    expect(native.props.frame).toBeCloseTo(expected(2500));
    expect(host.querySelector('canvas')).not.toBeNull();
  });

  it('keeps the vendor frame prop stable during subsequent scrubs and native release', async () => {
    await render(1250);
    await act(async () => native.ready!());
    const initialProp = native.props.frame;
    await render(2500);
    expect(native.props.frame).toBe(initialProp);
    expect(native.frame).toBeCloseTo(expected(2500));
    native.setFrame.mockClear();
    await render(null, false);
    expect(native.props.frame).toBe(initialProp);
    expect(native.setFrame).not.toHaveBeenCalled();
    expect(native.props.speed).toBeGreaterThan(0);
  });

  it('does not seek or redraw while an exact capture holds the already-rendered frame', async () => {
    await render(1250);
    await act(async () => native.ready!());
    const capture = freezeLiveMaterialFrame(host, 1250)!;
    native.setFrame.mockClear();
    await render(2500);
    expect(native.setFrame).not.toHaveBeenCalled();
    expect(native.frame).toBe(capture.state.frame);
    capture.resume();
  });
});
