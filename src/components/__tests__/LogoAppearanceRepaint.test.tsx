// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppearanceFilteredContent } from '@/components/LogoAppearancePreview';
import { DEFAULT_LOGO_APPEARANCE } from '@/lib/logoAppearance';

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);

describe('appearance dither repainting', () => {
  let container: HTMLDivElement;
  let root: Root;
  let frames: Map<number, FrameRequestCallback>;
  let frameId: number;
  let layoutReads: number;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    frames = new Map();
    frameId = 0;
    layoutReads = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.set(++frameId, callback);
      return frameId;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => { frames.delete(id); });
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(() => {
      layoutReads += 1;
      return 120;
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function flushFrames() {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback(100));
  }

  it('re-invalidates the mask when a descendant renderer publishes pixels', async () => {
    await act(async () => root.render(
      <AppearanceFilteredContent
        ariaLabel='Dithered material'
        settings={{ ...DEFAULT_LOGO_APPEARANCE, ditherEnabled: true }}
      >
        <canvas data-live-material-ready='false' />
      </AppearanceFilteredContent>
    ));
    flushFrames();
    const mask = container.querySelector<HTMLElement>('[data-appearance-dither-mask="true"]')!;
    expect(mask.style.webkitMaskImage).toContain('data:image/svg+xml');
    expect(layoutReads).toBe(1);

    mask.querySelector('canvas')!.dataset.liveMaterialReady = 'true';
    await new Promise((resolve) => setTimeout(resolve, 0));
    flushFrames();

    expect(layoutReads).toBe(2);
    expect(mask.dataset.appearanceDitherRevision).toBe('2');
    expect(mask.style.webkitMaskImage).toContain('data:image/svg+xml');
  });
});
