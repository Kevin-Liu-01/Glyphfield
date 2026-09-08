// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import EditableCanvasLayer from '@/components/EditableCanvasLayer';
import { canvasSelectionLocalBounds } from '@/components/CanvasSelectionClip';

describe('canvas selection clipping', () => {
  let container: HTMLDivElement;
  let root: Root;
  let viewportBounds: DOMRect;
  const layerBounds = new DOMRect(150, 130, 800, 300);

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('innerWidth', 1200);
    vi.stubGlobal('innerHeight', 800);
    vi.useFakeTimers();
    viewportBounds = new DOMRect(200, 100, 600, 500);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) =>
      window.setTimeout(() => callback(performance.now()), 0)
    );
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => window.clearTimeout(id));
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      if (this.classList.contains('canvas-viewport') || this.classList.contains('canvas-viewport-scroll')) return viewportBounds;
      return layerBounds;
    });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function render(initializing = false) {
    const onChange = vi.fn();
    await act(() => root.render(
      <div className='canvas-viewport'>
        <div className='canvas-viewport-scroll'>
        <div
          className='canvas-viewport-stage'
          data-canvas-initializing={initializing ? 'true' : undefined}
          style={{ visibility: initializing ? 'hidden' : undefined }}
        >
          <EditableCanvasLayer
            baseHeight={300}
            baseWidth={800}
            baseX={0}
            baseY={0}
            canvasHeight={600}
            canvasWidth={1000}
            label='Shader'
            onChange={onChange}
            onDeselect={vi.fn()}
            onSelect={vi.fn()}
            selected
            transform={{ scale: 1, x: 0, y: 0 }}
            zIndex={1}
          >
            Shader artwork
          </EditableCanvasLayer>
        </div>
        </div>
      </div>
    ));
    return onChange;
  }

  it('clips portaled affordances to the canvas without cropping their geometry', async () => {
    await render();
    const overlay = document.querySelector<HTMLElement>('.editable-canvas-layer-selection')!;
    const clip = overlay.parentElement!;
    expect(clip.parentElement).toBe(container.querySelector('.canvas-viewport'));
    expect(clip.closest('.canvas-viewport-stage')).toBeNull();
    expect(overlay.style.left).toBe('-50px');
    expect(overlay.style.top).toBe('30px');
    expect(overlay.style.width).toBe('800px');
    expect(overlay.querySelector('button[aria-label="Resize Shader"]')).not.toBeNull();
  });

  it('updates the clipping boundary on viewport resize without modifying the design', async () => {
    const onChange = await render();
    viewportBounds = new DOMRect(225, 60, 400, 450);
    await act(async () => {
      window.dispatchEvent(new Event('resize'));
      await vi.runOnlyPendingTimersAsync();
    });
    const overlay = document.querySelector<HTMLElement>('.editable-canvas-layer-selection')!;
    expect(overlay.parentElement?.parentElement).toBe(container.querySelector('.canvas-viewport'));
    expect(overlay.style.left).toBe('-75px');
    expect(overlay.style.top).toBe('70px');
    expect(overlay.style.width).toBe('800px');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not expose a selection before the restored view is framed', async () => {
    let notifyStageMutation = () => {};
    vi.stubGlobal('MutationObserver', class {
      constructor(callback: () => void) { notifyStageMutation = callback; }
      observe() {}
      disconnect() {}
    });
    await render(true);
    expect(document.querySelector('.editable-canvas-layer-selection')).toBeNull();
    const layer = container.querySelector('.editable-canvas-layer');
    const onChange = await render(false);
    await act(() => notifyStageMutation());
    expect(document.querySelector('.editable-canvas-layer-selection')).not.toBeNull();
    expect(container.querySelector('.editable-canvas-layer')).toBe(layer);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('normalizes a scaled and bordered viewport without changing artwork dimensions', () => {
    const viewport = document.createElement('div');
    viewport.className = 'canvas-viewport';
    Object.defineProperties(viewport, {
      offsetWidth: { value: 300 },
      offsetHeight: { value: 250 },
      clientLeft: { value: 2 },
      clientTop: { value: 3 },
    });
    expect(canvasSelectionLocalBounds(layerBounds, viewport)).toEqual({
      left: -27, top: 12, width: 400, height: 150,
    });
  });

  it('keeps the overlay mounted as the viewport moves', async () => {
    await render();
    const overlay = container.querySelector('.editable-canvas-layer-selection');
    viewportBounds = new DOMRect(280, 170, 400, 450);
    await act(async () => {
      document.dispatchEvent(new Event('scroll'));
      await vi.runOnlyPendingTimersAsync();
    });
    expect(container.querySelector('.editable-canvas-layer-selection')).toBe(overlay);
    expect((overlay as HTMLElement).style.left).toBe('-130px');
    expect((overlay as HTMLElement).style.top).toBe('-40px');
  });
});
