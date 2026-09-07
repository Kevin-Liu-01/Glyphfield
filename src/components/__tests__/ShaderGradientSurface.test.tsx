// @vitest-environment happy-dom

import { act, Children, isValidElement, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ShaderGradientSurface from '@/components/ShaderGradientSurface';
import { DEFAULT_LIVE_MATERIAL_SETTINGS } from '@/lib/liveMaterials';

const observed = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));
vi.mock('@shadergradient/react', () => ({
  ShaderGradient: (props: Record<string, unknown>) => { observed.props = props; return null; },
  ShaderGradientCanvas: ({ children }: { children: ReactNode }) => <div>{Children.toArray(children)
    .filter((child) => !isValidElement(child) || child.type !== 'ambientLight')}</div>,
}));
vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
  useThree: () => ({ invalidate: vi.fn(), setDpr: vi.fn(), setFrameloop: vi.fn(), size: { height: 360, width: 640 } }),
}));
afterEach(() => vi.unstubAllGlobals());

describe('Sphere camera and native shader clock are independent', () => {
  it.each([
    { animate: 'on', captureTimeMs: null, paused: false },
    { animate: 'off', captureTimeMs: null, paused: true },
    { animate: 'off', captureTimeMs: 2300, paused: true },
  ])('does not damp the camera while shader playback is $animate at $captureTimeMs', async ({ animate, captureTimeMs, paused }) => {
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
    expect(observed.props).toMatchObject({ animate, enableTransition: false, loop: 'on', loopDuration: 1.6 });
    if (captureTimeMs !== null) expect(observed.props.uTime).toBe(2.3);
    await act(async () => root.unmount());
  });
});
