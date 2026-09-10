// @vitest-environment happy-dom
import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CanvasMinimap, { type CanvasMinimapHandle } from '../CanvasMinimap';

vi.mock('gt-next', () => ({ useGT: () => (message: string) => message }));

describe('lightweight canvas minimap', () => {
  let host: HTMLDivElement;
  let root: Root;
  let frames: Map<number, FrameRequestCallback>;
  const onPan = vi.fn();
  const onFitAll = vi.fn();
  const onCenterSelected = vi.fn();
  const onArrange = vi.fn();
  const ref = createRef<CanvasMinimapHandle>();
  const view = { width: 800, height: 600, zoom: 100, pan: { x: 0, y: 0 } };
  const items = [{ id: 'one', label: 'Portrait', x: 20, y: 40, width: 300, height: 600, active: true },
    { id: 'two', label: 'Landscape', x: 1400, y: 40, width: 800, height: 400 }];
  const map = () => host.querySelector<SVGSVGElement>('[aria-label="Navigate canvas map"]')!;
  const pointer = async (type: string, target: EventTarget, x: number, y: number, pointerId = 1, init: PointerEventInit = {}) => {
    await act(() => target.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId, button: 0,
      isPrimary: true, pointerType: 'mouse', clientX: x, clientY: y, ...init })));
  };
  const flush = async () => act(() => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach((cb) => cb(16)); });

  beforeEach(async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    frames = new Map(); let frameId = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
    host = document.body.appendChild(document.createElement('div'));
    root = createRoot(host);
    await act(() => root.render(<CanvasMinimap items={items} view={view} onPan={onPan}
      onFitAll={onFitAll} onCenterSelected={onCenterSelected} ref={ref} />));
    map().getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 200, bottom: 120, width: 200, height: 120, toJSON() {} });
  });
  afterEach(async () => { await act(() => root.unmount()); host.remove(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

  async function resize(height: number) {
    await act(() => root.render(<CanvasMinimap items={items} view={{ ...view, height }} onPan={onPan}
      onFitAll={onFitAll} onCenterSelected={onCenterSelected} ref={ref} />));
  }

  it('starts collapsed in a short canvas with a discoverable map toggle', async () => {
    await act(() => root.render(null));
    await resize(220);
    expect(map()).toBeNull();
    const toggle = host.querySelector<HTMLButtonElement>('[aria-label="Show artboard map"]')!;
    expect(host.querySelector('[aria-label="Move artboard map"]')!.textContent).toContain('Artboard map');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('automatically adapts to short and tall viewport resizes until explicitly toggled', async () => {
    await resize(299);
    expect(map()).toBeNull();
    await resize(300);
    expect(map()).not.toBeNull();
    await resize(220);
    expect(map()).toBeNull();
    await resize(600);
    expect(map()).not.toBeNull();
  });

  it('retains an explicit open or closed choice across viewport resizes', async () => {
    await resize(220);
    await act(() => host.querySelector<HTMLButtonElement>('[aria-label="Show artboard map"]')!.click());
    expect(map()).not.toBeNull();
    await resize(260);
    expect(map()).not.toBeNull();
    await resize(600);
    await act(() => host.querySelector<HTMLButtonElement>('[aria-label="Hide artboard map"]')!.click());
    expect(map()).toBeNull();
    await resize(220);
    await resize(700);
    expect(map()).toBeNull();
  });

  it('renders geometry only and can collapse without losing navigation', async () => {
    expect(host.querySelectorAll('[data-canvas-map-item]')).toHaveLength(2);
    expect(host.querySelectorAll('canvas, img, video')).toHaveLength(0);
    await act(() => host.querySelector<HTMLButtonElement>('[aria-label="Hide artboard map"]')!.click());
    expect(map()).toBeNull();
    await act(() => host.querySelector<HTMLButtonElement>('[aria-label="Show artboard map"]')!.click());
    expect(map()).not.toBeNull();
    await act(() => host.querySelector<HTMLButtonElement>('[aria-label="Center selected artboard"]')!.click());
    expect(onCenterSelected).toHaveBeenCalledOnce();
  });

  it('only exposes Tidy when supplied and routes each named action independently', async () => {
    expect(host.querySelector('[aria-label="Tidy and fit artboards"]')).toBeNull();
    await act(() => root.render(<CanvasMinimap items={items} view={view} onPan={onPan}
      onFitAll={onFitAll} onCenterSelected={onCenterSelected} onArrange={onArrange} />));
    const fit = host.querySelector<HTMLButtonElement>('[aria-label="Fit all"]')!;
    const center = host.querySelector<HTMLButtonElement>('[aria-label="Center selected artboard"]')!;
    const tidy = host.querySelector<HTMLButtonElement>('[aria-label="Tidy and fit artboards"]')!;
    expect(fit.textContent).toContain('Fit all');
    expect(center.textContent).toBe('Center');
    expect(tidy.textContent).toBe('Tidy');
    const originalItems = JSON.stringify(items);
    await act(() => fit.click());
    expect(onFitAll).toHaveBeenCalledOnce();
    expect(onCenterSelected).not.toHaveBeenCalled();
    expect(onArrange).not.toHaveBeenCalled();
    await act(() => center.click());
    expect(onCenterSelected).toHaveBeenCalledOnce();
    expect(onArrange).not.toHaveBeenCalled();
    expect(JSON.stringify(items)).toBe(originalItems);
    await act(() => tidy.click());
    expect(onArrange).toHaveBeenCalledOnce();
    expect(onFitAll).toHaveBeenCalledOnce();
    expect(onCenterSelected).toHaveBeenCalledOnce();
    expect(onPan).not.toHaveBeenCalled();
  });

  it('uses distinct decorative icons without replacing action names or adding tab stops', async () => {
    await act(() => root.render(<CanvasMinimap items={items} view={view} onPan={onPan}
      onFitAll={onFitAll} onCenterSelected={onCenterSelected} onArrange={onArrange} />));
    const artwork = ['Fit all', 'Center selected artboard', 'Tidy and fit artboards'].map((label) => {
      const button = host.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;
      expect(button.type).toBe('button');
      expect(button.tabIndex).toBe(0);
      const icon = button.querySelector('svg')!;
      expect(icon).not.toBeNull();
      expect(icon.getAttribute('aria-hidden')).toBe('true');
      expect(icon.hasAttribute('tabindex')).toBe(false);
      return icon.innerHTML;
    });
    expect(new Set(artwork).size).toBe(3);
  });

  it('disables Center without an active artboard while Fit all and optional Tidy remain independent', async () => {
    await act(() => root.render(<CanvasMinimap items={items.map((item) => ({ ...item, active: false }))}
      view={view} onPan={onPan} onFitAll={onFitAll} onCenterSelected={onCenterSelected} onArrange={onArrange} />));
    const center = host.querySelector<HTMLButtonElement>('[aria-label="Center selected artboard"]')!;
    expect(center.disabled).toBe(true);
    await act(() => center.click());
    expect(onCenterSelected).not.toHaveBeenCalled();
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Fit all"]')!.disabled).toBe(false);
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Tidy and fit artboards"]')!.disabled).toBe(false);
  });

  it('updates its viewport rectangle imperatively, retaining every artboard node', () => {
    const firstBoard = host.querySelector('[data-canvas-map-item]');
    ref.current!.updateView({ ...view, pan: { x: -200, y: -100 } });
    const rectangle = host.querySelector('[data-canvas-map-viewport]')!;
    expect(rectangle.getAttribute('x')).toBe('200');
    expect(rectangle.getAttribute('y')).toBe('100');
    expect(host.querySelector('[data-canvas-map-item]')).toBe(firstBoard);
  });

  it('freezes map bounds throughout a drag and commits once on outside release', async () => {
    const originalBounds = map().getAttribute('viewBox');
    await pointer('pointerdown', map(), 100, 60);
    expect(onPan).toHaveBeenLastCalledWith(expect.anything(), false);
    await pointer('pointermove', map(), 190, 100);
    await flush();
    expect(map().getAttribute('viewBox')).toBe(originalBounds);
    await pointer('pointerup', window, 240, 110, 2);
    expect(onPan.mock.calls.filter(([, commit]) => commit)).toHaveLength(0);
    await pointer('pointerup', window, 240, 110);
    expect(onPan.mock.calls.filter(([, commit]) => commit)).toHaveLength(1);
    expect(map().getAttribute('viewBox')).not.toBe(originalBounds);
    expect(map().hasAttribute('data-dragging')).toBe(false);
  });

  it('grabs the viewport without jumping and commits pending movement on cancellation', async () => {
    const viewport = host.querySelector('[data-canvas-map-viewport]')!;
    await pointer('pointerdown', viewport, 50, 60);
    expect(onPan).toHaveBeenLastCalledWith({ x: 0, y: 0 }, false);
    await pointer('pointermove', map(), 70, 60);
    await pointer('pointercancel', window, 0, 0);
    expect(onPan.mock.calls.filter(([, commit]) => commit)).toHaveLength(1);
    expect(onPan.mock.lastCall![0].x).not.toBe(0);
    expect(frames.size).toBe(0);
  });

  it('supports keyboard panning and cleans up an unfinished gesture on unmount', async () => {
    await act(() => map().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })));
    expect(onPan).toHaveBeenLastCalledWith({ x: -120, y: 0 }, true);
    await pointer('pointerdown', map(), 100, 60);
    await pointer('pointermove', map(), 120, 60);
    const before = onPan.mock.calls.length;
    await act(() => root.render(null));
    await flush();
    await pointer('pointerup', window, 140, 60);
    expect(onPan).toHaveBeenCalledTimes(before);
    expect(frames.size).toBe(0);
  });

  describe('artboard map docking', () => {
    const panel = () => host.querySelector<HTMLElement>('[role="region"][aria-label="Canvas map"]')!;
    const handle = () => host.querySelector<HTMLButtonElement>('[aria-label="Move artboard map"]')!;
    const key = async (value: string) => {
      const event = new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true });
      await act(() => handle().dispatchEvent(event));
      return event;
    };
    const expectNoCanvasAction = () => {
      expect(onPan).not.toHaveBeenCalled();
      expect(onFitAll).not.toHaveBeenCalled();
      expect(onCenterSelected).not.toHaveBeenCalled();
      expect(onArrange).not.toHaveBeenCalled();
    };

    beforeEach(async () => {
      await act(() => root.render(<CanvasMinimap items={items} view={view} onPan={onPan}
        onFitAll={onFitAll} onCenterSelected={onCenterSelected} onArrange={onArrange} ref={ref} />));
      host.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0,
        right: 800, bottom: 600, width: 800, height: 600, toJSON() {} });
      panel().getBoundingClientRect = () => {
        const left = panel().dataset.dock === 'left' ? 16 : 584;
        return { x: left, y: 384, left, top: 384, right: left + 200,
          bottom: 584, width: 200, height: 200, toJSON() {} };
      };
    });

    it('keeps movement separate from collapse and starts docked on the right', async () => {
      const initialMap = map();
      const toggle = host.querySelector<HTMLButtonElement>('[aria-label="Hide artboard map"]')!;
      expect(panel().dataset.dock).toBe('right');
      expect(handle()).not.toBe(toggle);
      expect(handle().type).toBe('button');
      expect(handle().tabIndex).toBe(0);
      expect(handle().textContent).toContain('Artboard map');
      await act(() => handle().click());
      expect(map()).toBe(initialMap);
      await act(() => toggle.click());
      expect(map()).toBeNull();
      expect(handle()).not.toBeNull();
      await act(() => handle().click());
      expect(map()).toBeNull();
      expect(host.querySelector('[aria-label="Show artboard map"]')).not.toBeNull();
      expectNoCanvasAction();
    });

    it('docks with horizontal arrow keys without panning and retains the choice across collapse and resize', async () => {
      const initialMap = map();
      expect((await key('ArrowLeft')).defaultPrevented).toBe(true);
      expect(panel().dataset.dock).toBe('left');
      for (const value of ['ArrowUp', 'ArrowDown']) {
        expect((await key(value)).defaultPrevented).toBe(false);
        expect(panel().dataset.dock).toBe('left');
      }
      expect(map()).toBe(initialMap);
      await act(() => host.querySelector<HTMLButtonElement>('[aria-label="Hide artboard map"]')!.click());
      await resize(220);
      expect(panel().dataset.dock).toBe('left');
      expect(map()).toBeNull();
      expect((await key('ArrowRight')).defaultPrevented).toBe(true);
      expect(panel().dataset.dock).toBe('right');
      expect(map()).toBeNull();
      await resize(600);
      expect(panel().dataset.dock).toBe('right');
      expectNoCanvasAction();
    });

    it.each([[3, false], [4, true]] as const)('activates dragging only at the 4px threshold (%spx)', async (distance, active) => {
      const initialMap = map();
      await pointer('pointerdown', handle(), 680, 400);
      await pointer('pointermove', handle(), 680 - distance, 400);
      await flush();
      if (active) expect(panel().style.transform).toMatch(/-4px/);
      else expect(panel().style.transform).toBe('');
      await pointer('pointerup', window, 680 - distance, 400);
      await act(() => handle().click());
      expect(panel().dataset.dock).toBe('right');
      expect(panel().style.transform).toBe('');
      expect(map()).toBe(initialMap);
      expect(frames.size).toBe(0);
      expectNoCanvasAction();
    });

    it.each([[450, 'left'], [490, 'right']] as const)(
      'follows the pointer and snaps by panel center on outside release at x=%s', async (releaseX, dock) => {
        const initialMap = map();
        await pointer('pointerdown', handle(), 760, 400);
        await pointer('pointermove', handle(), 560, 340);
        await flush();
        expect(panel().style.transform).toMatch(/-200px.*-60px/);
        expect(panel().dataset.dock).toBe('right');
        expect(map()).toBe(initialMap);
        // Both pointers remain right of the midpoint; only the panel center crosses it.
        await pointer('pointerup', window, releaseX, 260);
        expect(panel().dataset.dock).toBe(dock);
        expect(panel().style.transform).toBe('');
        expect(frames.size).toBe(0);
        await act(() => handle().click());
        expect(map()).toBe(initialMap);
        expectNoCanvasAction();
      },
    );

    it('can drag back from the left dock without changing canvas navigation', async () => {
      await key('ArrowLeft');
      await pointer('pointerdown', handle(), 100, 400);
      await pointer('pointermove', handle(), 600, 300);
      await flush();
      expect(panel().style.transform).toMatch(/500px.*-100px/);
      await pointer('pointerup', window, 600, 300);
      expect(panel().dataset.dock).toBe('right');
      expect(panel().style.transform).toBe('');
      expect(map()).not.toBeNull();
      expectNoCanvasAction();
    });

    it.each([
      ['Escape', 'left'], ['Escape', 'right'],
      ['pointercancel', 'left'], ['pointercancel', 'right'],
      ['blur', 'left'], ['blur', 'right'],
    ] as const)('restores the original dock and clears pending movement on %s from %s', async (cancel, dock) => {
      if (dock === 'left') await key('ArrowLeft');
      const startX = dock === 'left' ? 100 : 680;
      const moveX = dock === 'left' ? 600 : 180;
      const initialMap = map();
      await pointer('pointerdown', handle(), startX, 400);
      await pointer('pointermove', handle(), moveX, 300);
      await flush();
      expect(panel().style.transform).not.toBe('');
      await pointer('pointermove', handle(), moveX + 10, 280);
      expect(frames.size).toBe(1);
      if (cancel === 'Escape') await key('Escape');
      else if (cancel === 'pointercancel') await pointer('pointercancel', window, moveX, 280);
      else await act(() => window.dispatchEvent(new Event('blur')));
      expect(panel().dataset.dock).toBe(dock);
      expect(panel().style.transform).toBe('');
      expect(frames.size).toBe(0);
      await flush();
      await pointer('pointerup', window, moveX, 280);
      expect(panel().dataset.dock).toBe(dock);
      expect(map()).toBe(initialMap);
      expectNoCanvasAction();
    });

    it.each([
      ['collapse', 'left'], ['collapse', 'right'],
      ['expand', 'left'], ['expand', 'right'],
    ] as const)('cancels active docking when choosing to %s from the %s dock', async (action, dock) => {
      if (dock === 'left') await key('ArrowLeft');
      if (action === 'expand') {
        await act(() => host.querySelector<HTMLButtonElement>('[aria-label="Hide artboard map"]')!.click());
      }
      panel().getBoundingClientRect = () => {
        const left = panel().dataset.dock === 'left' ? 16 : 584;
        const height = map() ? 200 : 32;
        return { x: left, y: 584 - height, left, top: 584 - height,
          right: left + 200, bottom: 584, width: 200, height, toJSON() {} };
      };
      const startX = dock === 'left' ? 100 : 680;
      const moveX = dock === 'left' ? 600 : 180;
      await pointer('pointerdown', handle(), startX, action === 'expand' ? 568 : 400);
      await pointer('pointermove', handle(), moveX, 300);
      await flush();
      expect(panel().style.transform).not.toBe('');
      await pointer('pointermove', handle(), moveX + 10, 280);
      expect(frames.size).toBe(1);
      const label = action === 'collapse' ? 'Hide artboard map' : 'Show artboard map';
      await act(() => host.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!.click());
      expect(panel().dataset.dock).toBe(dock);
      expect(panel().style.transform).toBe('');
      expect(panel().hasAttribute('data-dragging')).toBe(false);
      expect(frames.size).toBe(0);
      expect(map() === null).toBe(action === 'collapse');
      await flush();
      await pointer('pointermove', handle(), moveX, 260);
      await pointer('pointerup', window, moveX, 260);
      expect(panel().dataset.dock).toBe(dock);
      expect(panel().style.transform).toBe('');
      expect(frames.size).toBe(0);
      expectNoCanvasAction();
    });

    it('ignores secondary pointers without replacing or ending the active drag', async () => {
      await pointer('pointerdown', handle(), 680, 400);
      await pointer('pointerdown', handle(), 120, 400, 2, { isPrimary: false, pointerType: 'touch' });
      await pointer('pointermove', handle(), 80, 300, 2);
      await flush();
      expect(panel().style.transform).toBe('');
      await pointer('pointermove', handle(), 180, 300);
      await flush();
      const transform = panel().style.transform;
      expect(transform).not.toBe('');
      await pointer('pointerup', window, 760, 300, 2);
      await pointer('pointercancel', window, 0, 0, 2);
      expect(panel().dataset.dock).toBe('right');
      expect(panel().style.transform).toBe(transform);
      await pointer('pointerup', window, 180, 300);
      expect(panel().dataset.dock).toBe('left');
      expect(panel().style.transform).toBe('');
      expectNoCanvasAction();
    });

    it.each([
      ['secondary-button', { button: 2 }],
      ['non-primary-pointer', { isPrimary: false, pointerType: 'touch' }],
    ] as const)('does not start docking from a %s press', async (_, init) => {
      await pointer('pointerdown', handle(), 680, 400, 1, init);
      await pointer('pointermove', handle(), 180, 300);
      await pointer('pointerup', window, 180, 300);
      expect(panel().dataset.dock).toBe('right');
      expect(panel().style.transform).toBe('');
      expect(frames.size).toBe(0);
      expectNoCanvasAction();
    });

    it('clears pending movement and listeners for an unfinished gesture on unmount', async () => {
      await pointer('pointerdown', handle(), 680, 400);
      await pointer('pointermove', handle(), 180, 300);
      expect(frames.size).toBe(1);
      await act(() => root.render(null));
      expect(frames.size).toBe(0);
      await flush();
      await pointer('pointermove', window, 100, 200);
      await pointer('pointerup', window, 100, 200);
      await act(() => window.dispatchEvent(new Event('blur')));
      expect(host.childElementCount).toBe(0);
      expectNoCanvasAction();
    });
  });
});
