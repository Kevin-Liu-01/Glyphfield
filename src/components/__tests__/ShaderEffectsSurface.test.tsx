// @vitest-environment happy-dom

import { readFileSync } from 'node:fs';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ShaderEffectsSurface from '@/components/ShaderEffectsSurface';
import { DEFAULT_LIVE_MATERIAL_SETTINGS, type LiveMaterialId } from '@/lib/liveMaterials';

const webgpu = vi.hoisted(() => ({ supported: false }));
vi.mock('shaders/core', () => ({ getWebGPUSupport: async () => ({ supported: webgpu.supported }) }));
vi.mock('@/lib/shaderEffectsRenderer', () => ({ createShaderEffectsRenderer: vi.fn() }));
vi.mock('gt-next', () => ({ useGT: () => (message: string) => message }));

describe('ShaderEffectsSurface without WebGPU', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    // happy-dom has no 2D canvas; the surface only needs a context to exist before it probes WebGPU.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as RenderingContext);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('marks its labelled still so the loading skeleton does not cover it, and still reports an error', async () => {
    await act(async () => {
      root.render(
        <ShaderEffectsSurface
          active
          captureTimeMs={null}
          frameRate={30}
          materialId={'shader-effects-neon' as LiveMaterialId}
          patternScale={1}
          paused={false}
          renderScale={1}
          settings={DEFAULT_LIVE_MATERIAL_SETTINGS}
        />
      );
    });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    const surface = container.querySelector<HTMLElement>('[data-shader-effects]');
    expect(surface?.dataset.liveMaterialReady).toBe('error');
    expect(surface?.dataset.liveMaterialStill).toBe('true');
    expect(container.querySelector('[role="status"]')?.textContent).toBe('WebGPU is unavailable here. Showing a still preview.');
    expect(container.querySelector('.authentic-shader-preview')).not.toBeNull();
  });

  it('hides the loading skeleton for a surface that shows its still', () => {
    const styles = readFileSync('src/app/globals.css', 'utf8');
    expect(styles).toContain('[data-live-material-surface]:has([data-live-material-still]) > .live-material-loading {\n  display: none;');
    // The rule must follow the rules that show the skeleton for an errored descendant.
    expect(styles.indexOf(':has([data-live-material-still])')).toBeGreaterThan(styles.indexOf("[data-live-material-ready='error']) > .live-material-loading"));
  });
});
