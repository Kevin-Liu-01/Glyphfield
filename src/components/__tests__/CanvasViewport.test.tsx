// @vitest-environment happy-dom

import { act, type ReactNode, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CanvasViewport from '@/components/CanvasViewport';

vi.mock('gt-next', () => ({
  T: ({ children }: { children: ReactNode }) => children,
  useGT: () => (message: string) => message,
}));
vi.mock('@/hooks/usePersistentState', () => ({
  useStudioDraft: (_identity: string, _tool: string, _key: string, value: number) => useState(value),
}));

describe('canvas keyboard history', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onUndo = vi.fn();
  const onRedo = vi.fn();

  beforeEach(async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(() => root.render(
      <CanvasViewport
        actionHistory={{ canRedo: true, canUndo: true, entries: [], onRedo, onUndo }}
        identityId='keyboard-test'
        toolId='material'
      >
        <input aria-label='Canvas text' />
      </CanvasViewport>
    ));
  });

  afterEach(async () => {
    await act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  async function key(target: Element, init: KeyboardEventInit = {}) {
    const event = new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true, cancelable: true, ...init });
    await act(() => target.dispatchEvent(event));
    return event;
  }

  it('undoes and redoes from keyboard focus without mouse hover', async () => {
    const canvas = container.querySelector<HTMLElement>('[aria-label="Canvas viewport"]')!;
    canvas.focus();
    expect((await key(canvas)).defaultPrevented).toBe(true);
    await key(canvas, { shiftKey: true });
    expect(onUndo).toHaveBeenCalledOnce();
    expect(onRedo).toHaveBeenCalledOnce();
  });

  it('leaves native text editing and outside shortcuts alone', async () => {
    const input = container.querySelector('input[aria-label="Canvas text"]')! as HTMLInputElement;
    input.focus();
    expect((await key(input)).defaultPrevented).toBe(false);
    input.blur();
    await key(document.body);
    expect(onUndo).not.toHaveBeenCalled();
  });

  it('does not consume handled shortcuts or undo inside a hidden workspace', async () => {
    const canvas = container.querySelector<HTMLElement>('[aria-label="Canvas viewport"]')!;
    canvas.focus();
    const handled = new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true, cancelable: true });
    handled.preventDefault();
    await act(() => canvas.dispatchEvent(handled));
    container.setAttribute('inert', '');
    await key(canvas);
    expect(onUndo).not.toHaveBeenCalled();
  });
});

describe('restored canvas entry framing', () => {
  let container: HTMLDivElement;
  let root: Root;
  let geometryRead: ReturnType<typeof vi.fn>;
  let resizeCallbacks: Set<ResizeObserverCallback>;

  async function layoutReady() {
    await act(() => {
      [...resizeCallbacks].forEach((callback) => callback([], {} as ResizeObserver));
    });
  }

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    resizeCallbacks = new Set();
    vi.stubGlobal('ResizeObserver', class {
      constructor(private callback: ResizeObserverCallback) { resizeCallbacks.add(callback); }
      observe() {}
      disconnect() { resizeCallbacks.delete(this.callback); }
    });
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
    geometryRead = vi.fn(() => 1000);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(geometryRead);
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(500);
    vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockReturnValue(50);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function render(ready: boolean) {
    await act(() => root.render(
      <CanvasViewport
        focusKey={ready ? 'restored-artboard:0' : undefined}
        identityId='entry-test'
        initialViewReady={ready}
        initialZoom={40}
        toolId='material'
      >
        <div data-canvas-focus-target='true' data-testid='restored-artboard'>Saved composition</div>
      </CanvasViewport>
    ));
  }

  it('reveals the same artboard only with its restored fit and centering applied', async () => {
    await render(false);
    const stage = container.querySelector<HTMLElement>('.canvas-viewport-stage')!;
    const artboard = stage.firstElementChild;
    expect(stage.style.visibility).toBe('hidden');
    expect(container.querySelector('.canvas-viewport')?.getAttribute('aria-busy')).toBe('true');

    await render(true);
    expect(stage.style.visibility).toBe('hidden');
    expect(geometryRead).not.toHaveBeenCalled();
    await layoutReady();
    expect(resizeCallbacks.size).toBe(0);
    expect(stage.style.visibility).toBe('');
    expect(stage.style.transform).toBe('translate(-20px, 90px) scale(0.7)');
    expect(stage.firstElementChild).toBe(artboard);
    expect(container.querySelector('.canvas-zoom-value')?.textContent).toBe('70%');
    expect(stage.hasAttribute('data-canvas-initializing')).toBe(false);
  });

  it('does not reset user zoom when the ready editor rerenders', async () => {
    await render(false);
    await render(true);
    await layoutReady();
    const stage = container.querySelector<HTMLElement>('.canvas-viewport-stage')!;
    await act(() => container.querySelector<HTMLButtonElement>('[aria-label="Zoom in"]')!.click());
    expect(container.querySelector('.canvas-zoom-value')?.textContent).toBe('80%');
    const userTransform = stage.style.transform;
    await render(true);
    expect(stage.style.transform).toBe(userTransform);
    expect(stage.style.visibility).toBe('');
  });

  it('releases a pending first-layout observation if the editor leaves before framing', async () => {
    await render(false);
    await render(true);
    expect(resizeCallbacks.size).toBe(1);
    await act(() => root.render(null));
    expect(resizeCallbacks.size).toBe(0);
    expect(geometryRead).not.toHaveBeenCalled();
  });
});
