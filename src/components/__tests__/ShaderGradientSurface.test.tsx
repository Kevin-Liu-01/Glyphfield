// @vitest-environment happy-dom

import { act, Children, isValidElement, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ShaderGradientSurface from '@/components/ShaderGradientSurface';
import { DEFAULT_LIVE_MATERIAL_SETTINGS } from '@/lib/liveMaterials';
import { freezeLiveMaterialFrame } from '@/lib/liveMaterialPreview';

const observed = vi.hoisted(() => ({
  props: {} as Record<string, unknown>,
  canvas: null as HTMLCanvasElement | null,
  frame: undefined as ((state: { gl: { info: { render: { frame: number } } }; scene: unknown }) => void) | undefined,
  frameloop: vi.fn(),
}));
vi.mock('@shadergradient/react', () => ({
  ShaderGradient: (props: Record<string, unknown>) => { observed.props = props; return null; },
  ShaderGradientCanvas: ({ children }: { children: ReactNode }) => <div>{Children.toArray(children)
    .filter((child) => !isValidElement(child) || child.type !== 'ambientLight')}</div>,
}));
vi.mock('@react-three/fiber', () => ({
  useFrame: (callback: typeof observed.frame) => { observed.frame = callback; },
  useThree: () => ({ gl: { domElement: observed.canvas ??= document.createElement('canvas') }, invalidate: vi.fn(), setDpr: vi.fn(), setFrameloop: observed.frameloop, size: { height: 360, width: 640 } }),
}));
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); observed.canvas = null; observed.frame = undefined; });

describe('Sphere camera and native shader clock are independent', () => {
  it.each([
    { animate: 'on', captureTimeMs: null, paused: false },
    { animate: 'off', captureTimeMs: null, paused: true },
    { animate: 'off', captureTimeMs: 2300, paused: true },
  ])('does not damp the camera while shader playback is $animate at $captureTimeMs', async ({ captureTimeMs, paused }) => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    const host = document.createElement('div');
    const root = createRoot(host);
    // ambientLight is interpreted by R3F in production; this test only checks
    // the adapter's vendor props. Pixel proof is the real browser matrix.
    await act(async () => root.render(<ShaderGradientSurface
      captureTimeMs={captureTimeMs}
      className=''
      loopDurationMs={1600}
      patternScale={1}
      paused={paused}
      renderScale={1}
      settings={DEFAULT_LIVE_MATERIAL_SETTINGS}
    />));
    expect(observed.props).toMatchObject({ animate: 'off', enableTransition: false, loop: 'on', loopDuration: 1.6 });
    expect(observed.props.uTime).toBe(0);
    expect(observed.props.uSpeed).toBeGreaterThan(0);
    await act(async () => root.unmount());
  });

  it('owns a continuous native R3F clock and freezes only lit, already-rendered pixels', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    let now = 100;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const host = document.createElement('div');
    const root = createRoot(host);
    await act(async () => root.render(<ShaderGradientSurface captureTimeMs={null} className='' loopDurationMs={1600}
      patternScale={1} paused={false} renderScale={1} settings={DEFAULT_LIVE_MATERIAL_SETTINGS}
      frameState={{ engine: 'shadergradient', frame: 812.25, timelineTimeMs: 400, version: 2, loopDurationMs: 2000 }} />));
    const canvas = observed.canvas!;
    expect(freezeLiveMaterialFrame(canvas, 400)).toBeUndefined();
    const uniform = { value: 0 };
    const state = { gl: { info: { render: { frame: 1 } } }, scene: { environment: {},
      getObjectByName: () => ({ material: { userData: { uTime: uniform } } }) } };
    await act(async () => observed.frame?.(state));
    expect(uniform.value).toBe(0.81225);
    now += 16;
    state.gl.info.render.frame = 4;
    await act(async () => observed.frame?.(state));
    expect(uniform.value).toBe(0.82825);
    const captured = freezeLiveMaterialFrame(canvas, 416);
    expect(captured?.state).toMatchObject({ engine: 'shadergradient', frame: 828.25, loopDurationMs: 2000 });
    expect(observed.frameloop).toHaveBeenLastCalledWith('never');
    now += 2000;
    await act(async () => observed.frame?.(state));
    expect(uniform.value).toBe(0.82825);
    captured?.resume();
    await act(async () => observed.frame?.(state));
    expect(uniform.value).toBe(0.82825);
    now += 16;
    await act(async () => observed.frame?.(state));
    expect(uniform.value).toBe(0.84425);
    await act(async () => root.unmount());
    expect(freezeLiveMaterialFrame(canvas, 500)).toBeUndefined();
  });
});
