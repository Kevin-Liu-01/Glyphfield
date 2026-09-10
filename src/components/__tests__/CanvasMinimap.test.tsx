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
  const pointer = async (type: string, target: EventTarget, x: number, y: number, pointerId = 1) => {
    await act(() => target.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId, button: 0, clientX: x, clientY: y })));
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
    expect(toggle.textContent).toContain('Artboard map');
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
    expect(center.textContent).toContain('Center selected');
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
});
