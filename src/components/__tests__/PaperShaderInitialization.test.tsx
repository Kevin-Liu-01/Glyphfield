// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gemSmokePresets } from '@paper-design/shaders-react';

import LiveMaterialCanvas from '@/components/LiveMaterialCanvas';
import { DEFAULT_LIVE_MATERIAL_SETTINGS, getPaperLiveMaterialDefinition } from '@/lib/liveMaterials';
import { freezeLiveMaterialFrame } from '@/lib/liveMaterialPreview';
import { resolvePaperShaderFrame } from '@/lib/paperShaderTime';

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
    vi.unstubAllGlobals();
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
