// @vitest-environment happy-dom

import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import EditableCanvasLayer from '@/components/EditableCanvasLayer';
import { canvasThirdsSnapTargets, type CanvasLayerTransform } from '@/lib/canvasInteraction';
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
            resizeMode='box'
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
    expect(overlay.querySelector('button[aria-label="Resize Shader from top left"]')).not.toBeNull();
    expect(overlay.querySelector('button[aria-label="Resize Shader from top right"]')).not.toBeNull();
    expect(overlay.querySelector('button[aria-label="Resize Shader from bottom left"]')).not.toBeNull();
    expect(overlay.querySelector('button[aria-label="Resize Shader from bottom right"]')).not.toBeNull();
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

  it.each(['move', 'resize'])('cancels a %s on window blur without committing or following later pointer moves', async (mode) => {
    const onChange = await render();
    const layer = container.querySelector<HTMLElement>('.editable-canvas-layer')!;
    const target = mode === 'move' ? layer
      : container.querySelector<HTMLElement>('[aria-label="Resize Shader from right"]')!;
    const initialWidth = layer.style.width;
    const initialLeft = layer.style.left;
    vi.spyOn(target, 'setPointerCapture').mockImplementation(() => {});
    vi.spyOn(target, 'hasPointerCapture').mockReturnValue(true);
    const release = vi.spyOn(target, 'releasePointerCapture').mockImplementation(() => {});
    await act(() => target.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, button: 0, pointerId: 7, clientX: 200, clientY: 200,
    })));
    await act(async () => {
      window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 7, clientX: 260, clientY: 240 }));
      await vi.runOnlyPendingTimersAsync();
    });
    expect(layer.dataset.interactionPreview).toBeTruthy();
    // Include a queued frame: losing focus must cancel both painted and pending work.
    await act(() => {
      window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 7, clientX: 300, clientY: 280 }));
      window.dispatchEvent(new Event('blur'));
    });
    expect(layer.dataset.interactionPreview).toBeUndefined();
    expect(layer.style.transform).toBe('');
    expect(layer.style.width).toBe(initialWidth);
    expect(layer.style.left).toBe(initialLeft);
    expect(release).toHaveBeenCalledWith(7);
    await act(async () => {
      window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 7, clientX: 400, clientY: 300 }));
      window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, clientX: 400, clientY: 300 }));
      await vi.runOnlyPendingTimersAsync();
    });
    expect(layer.dataset.interactionPreview).toBeUndefined();
    expect(onChange).not.toHaveBeenCalled();
    const overlay = container.querySelector<HTMLElement>('.editable-canvas-layer-selection')!;
    expect(overlay.style.left).toBe('-50px');
    expect(overlay.style.top).toBe('30px');
  });

  async function renderLayer(props: Partial<{
    onChange: (transform: CanvasLayerTransform) => void;
    onRotate: (rotation: number) => void;
    rotation: number;
    snapTargets: { x?: readonly number[]; y?: readonly number[] };
  }>) {
    await act(() => root.render(
      <div className='canvas-viewport'>
        <div className='canvas-viewport-scroll'>
          <div className='canvas-viewport-stage'>
            <EditableCanvasLayer
              baseHeight={300}
              baseWidth={800}
              baseX={0}
              baseY={0}
              canvasHeight={600}
              canvasWidth={1000}
              label='Shader'
              onChange={props.onChange ?? vi.fn()}
              onDeselect={vi.fn()}
              onRotate={props.onRotate}
              onSelect={vi.fn()}
              resizeMode='box'
              rotation={props.rotation}
              selected
              snapTargets={props.snapTargets}
              transform={{ scale: 1, x: 0, y: 0 }}
              zIndex={1}
            >
              Shader artwork
            </EditableCanvasLayer>
          </div>
        </div>
      </div>
    ));
  }

  async function drag(target: HTMLElement, from: { x: number; y: number }, to: { x: number; y: number }, shiftKey = false) {
    vi.spyOn(target, 'setPointerCapture').mockImplementation(() => {});
    vi.spyOn(target, 'hasPointerCapture').mockReturnValue(true);
    vi.spyOn(target, 'releasePointerCapture').mockImplementation(() => {});
    await act(() => target.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, button: 0, pointerId: 9, clientX: from.x, clientY: from.y,
    })));
    await act(async () => {
      window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 9, clientX: to.x, clientY: to.y, shiftKey }));
      await vi.runOnlyPendingTimersAsync();
    });
    await act(async () => {
      window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 9, clientX: to.x, clientY: to.y, shiftKey }));
      await vi.runOnlyPendingTimersAsync();
    });
  }

  it('offers a rotate handle only to hosts that accept rotation, and turns the frame with the layer', async () => {
    await renderLayer({});
    expect(document.querySelector('[aria-label="Rotate Shader"]')).toBeNull();
    await renderLayer({ onRotate: vi.fn(), rotation: 30 });
    expect(document.querySelector('[aria-label="Rotate Shader"]')).not.toBeNull();
    expect(container.querySelector<HTMLElement>('.editable-canvas-layer')!.style.rotate).toBe('30deg');
    expect(document.querySelector<HTMLElement>('.editable-canvas-layer-selection')!.style.rotate).toBe('30deg');
  });

  it('reports the angle swept around the layer center, in 15° steps with Shift', async () => {
    const onRotate = vi.fn();
    await renderLayer({ onRotate });
    const handle = document.querySelector<HTMLElement>('[aria-label="Rotate Shader"]')!;
    // The mocked layer rect is 800 × 300 at (150, 130): its center is (550, 280).
    await drag(handle, { x: 550, y: 100 }, { x: 730, y: 280 });
    expect(onRotate).toHaveBeenCalledTimes(1);
    expect(onRotate.mock.calls[0]![0]).toBeCloseTo(90, 6);
    await drag(handle, { x: 730, y: 280 }, { x: 730, y: 330 }, true);
    expect(onRotate).toHaveBeenLastCalledWith(15);
  });

  it('restores the committed angle when a rotate drag is cancelled', async () => {
    const onRotate = vi.fn();
    await renderLayer({ onRotate, rotation: 10 });
    const handle = document.querySelector<HTMLElement>('[aria-label="Rotate Shader"]')!;
    vi.spyOn(handle, 'setPointerCapture').mockImplementation(() => {});
    vi.spyOn(handle, 'hasPointerCapture').mockReturnValue(true);
    vi.spyOn(handle, 'releasePointerCapture').mockImplementation(() => {});
    await act(() => handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 4, clientX: 550, clientY: 100 })));
    await act(async () => {
      window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 4, clientX: 730, clientY: 280 }));
      await vi.runOnlyPendingTimersAsync();
    });
    const layer = container.querySelector<HTMLElement>('.editable-canvas-layer')!;
    expect(layer.style.rotate).not.toBe('10deg');
    await act(() => window.dispatchEvent(new Event('blur')));
    expect(layer.style.rotate).toBe('10deg');
    expect(onRotate).not.toHaveBeenCalled();
  });

  it('snaps moves to extra targets such as thirds', async () => {
    const onChange = vi.fn();
    await renderLayer({ onChange, snapTargets: canvasThirdsSnapTargets(1000, 600) });
    const layer = container.querySelector<HTMLElement>('.editable-canvas-layer')!;
    // The stage rect is 800 px for 1000 canvas units: 264 px is 330 units, near the 333⅓ third.
    await drag(layer, { x: 300, y: 200 }, { x: 564, y: 200 });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]![0].x).toBeCloseTo(1000 / 3, 6);
    const plain = vi.fn();
    await act(() => root.render(<div />));
    await renderLayer({ onChange: plain });
    await drag(container.querySelector<HTMLElement>('.editable-canvas-layer')!, { x: 300, y: 200 }, { x: 564, y: 200 });
    expect(plain.mock.calls[0]![0].x).toBeCloseTo(330, 6);
  });

  it('clears the move preview when the host re-bases the committed transform', async () => {
    function RebasingHost() {
      const [state, setState] = useState({ baseX: 0, transform: { scale: 1, x: 0, y: 0 } as CanvasLayerTransform });
      return (
        <div className='canvas-viewport'>
          <div className='canvas-viewport-scroll'>
            <div className='canvas-viewport-stage'>
              <EditableCanvasLayer
                baseHeight={300}
                baseWidth={800}
                baseX={state.baseX}
                baseY={0}
                canvasHeight={600}
                canvasWidth={1000}
                label='Shader'
                onChange={(next) => setState((current) => ({ baseX: current.baseX + next.x, transform: { ...next, x: 0 } }))}
                onDeselect={vi.fn()}
                onSelect={vi.fn()}
                selected
                transform={state.transform}
                zIndex={1}
              >
                Shader artwork
              </EditableCanvasLayer>
            </div>
          </div>
        </div>
      );
    }
    await act(() => root.render(<RebasingHost />));
    const layer = container.querySelector<HTMLElement>('.editable-canvas-layer')!;
    await drag(layer, { x: 300, y: 200 }, { x: 380, y: 200 });
    expect(layer.dataset.interactionPreview).toBeUndefined();
    expect(layer.style.transform).toBe('');
    expect(layer.style.left).toBe('10%');
  });
});
