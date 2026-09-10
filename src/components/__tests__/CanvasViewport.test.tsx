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
        versionHistory={<button type='button'>Saved designs</button>}
      >
        <input aria-label='Canvas text' />
        <span contentEditable='plaintext-only' data-testid='plain-text-editor' suppressContentEditableWarning tabIndex={0}>
          <span data-testid='plain-text-content'>Edit this text</span>
        </span>
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

  it('exposes direct Undo and Redo beside separate action and saved-design histories', async () => {
    const toolbar = container.querySelector<HTMLElement>('.canvas-viewport-toolbar')!;
    expect(toolbar.textContent).toContain('Saved designs');
    const undo = toolbar.querySelector<HTMLButtonElement>('[aria-label="Undo"]');
    const redo = toolbar.querySelector<HTMLButtonElement>('[aria-label="Redo"]');
    expect(undo).not.toBeNull();
    expect(redo).not.toBeNull();
    expect(container.querySelector('[role="dialog"][aria-label="Action history"]')).toBeNull();
    await act(() => undo!.click());
    await act(() => redo!.click());
    expect(onUndo).toHaveBeenCalledOnce();
    expect(onRedo).toHaveBeenCalledOnce();
    await act(() => toolbar.querySelector<HTMLButtonElement>('[aria-label="Action history"]')!.click());
    expect(container.querySelector('[role="dialog"][aria-label="Action history"]')).not.toBeNull();
    expect(container.querySelectorAll('[aria-label="Undo"]')).toHaveLength(1);
    expect(container.querySelectorAll('[aria-label="Redo"]')).toHaveLength(1);
  });

  it('disables unavailable canvas actions and keeps Reset view independent of Undo', async () => {
    await act(() => root.render(<CanvasViewport
      actionHistory={{ canRedo: false, canUndo: false, entries: [], onRedo, onUndo }}
      identityId='keyboard-test' toolId='material'
    ><span>Canvas content</span></CanvasViewport>));
    const undo = container.querySelector<HTMLButtonElement>('[aria-label="Undo"]')!;
    const redo = container.querySelector<HTMLButtonElement>('[aria-label="Redo"]')!;
    expect(undo.disabled).toBe(true);
    expect(redo.disabled).toBe(true);
    await act(() => { undo.click(); redo.click(); });
    await act(() => container.querySelector<HTMLButtonElement>('[aria-label="Zoom out"]')!.click());
    expect(container.querySelector('.canvas-zoom-value')?.textContent).toBe('90%');
    await act(() => container.querySelector<HTMLButtonElement>('[aria-label="Reset view"]')!.click());
    expect(container.querySelector('.canvas-zoom-value')?.textContent).toBe('100%');
    expect(onUndo).not.toHaveBeenCalled();
    expect(onRedo).not.toHaveBeenCalled();
  });

  it('renders saved-design history without requiring action history', async () => {
    await act(() => root.render(<CanvasViewport identityId='keyboard-test' toolId='material'
      versionHistory={<button type='button'>Saved designs</button>}
    ><span>Canvas content</span></CanvasViewport>));
    const toolbar = container.querySelector('.canvas-viewport-toolbar')!;
    expect(toolbar.textContent).toContain('Saved designs');
    expect(toolbar.querySelector('[aria-label="Undo"]')).toBeNull();
    expect(toolbar.querySelector('[aria-label="Action history"]')).toBeNull();
  });

  it('dismisses action history on other controls without consuming their clicks', async () => {
    const trigger = container.querySelector<HTMLButtonElement>('button[aria-label="Action history"]')!;
    const versions = [...container.querySelectorAll('button')].find((candidate) => candidate.textContent === 'Saved designs')!;
    const clicked = vi.fn();
    versions.addEventListener('click', clicked);
    await act(() => trigger.click());
    const dialog = container.querySelector<HTMLElement>('[role="dialog"][aria-label="Action history"]')!;
    await act(() => dialog.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    expect(dialog.isConnected).toBe(true);
    await act(() => {
      versions.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      versions.click();
    });
    expect(clicked).toHaveBeenCalledOnce();
    expect(container.querySelector('[role="dialog"][aria-label="Action history"]')).toBeNull();
    await act(() => trigger.click());
    await act(() => container.querySelector<HTMLButtonElement>('[aria-label="Zoom in"]')!
      .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    expect(container.querySelector('[role="dialog"][aria-label="Action history"]')).toBeNull();
  });

  it('closes action history on Escape and restores its exact trigger, not a neighboring history control', async () => {
    const trigger = container.querySelector<HTMLButtonElement>('button[aria-label="Action history"]')!;
    await act(() => trigger.click());
    trigger.blur();
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    await act(() => document.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(true);
    expect(container.querySelector('[role="dialog"][aria-label="Action history"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it.each(['studio-workspace-layer', 'studio-project-workspace-layer'])('closes history in an inactive %s without stealing focus', async (ownerClass) => {
    container.className = ownerClass;
    container.dataset.active = 'true';
    const trigger = container.querySelector<HTMLButtonElement>('button[aria-label="Action history"]')!;
    const nextWorkspaceControl = document.body.appendChild(document.createElement('button'));
    try {
      await act(() => trigger.click());
      await act(async () => {
        container.dataset.active = 'false';
        nextWorkspaceControl.focus();
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(container.querySelector('[role="dialog"][aria-label="Action history"]')).toBeNull();
      expect(document.activeElement).toBe(nextWorkspaceControl);
      await act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
      expect(document.activeElement).toBe(nextWorkspaceControl);
    } finally {
      nextWorkspaceControl.remove();
    }
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

  it('keeps native undo and spaces in plaintext-only canvas editors', async () => {
    const editor = container.querySelector<HTMLElement>('[data-testid="plain-text-editor"]')!;
    const content = container.querySelector<HTMLElement>('[data-testid="plain-text-content"]')!;
    editor.focus();
    expect((await key(content)).defaultPrevented).toBe(false);
    expect((await key(content, { key: ' ', code: 'Space', metaKey: false })).defaultPrevented).toBe(false);
    expect(onUndo).not.toHaveBeenCalled();
    expect(container.querySelector('[data-space-pressed="true"]')).toBeNull();
  });

  it('leaves native selection menus and pointer selection in plaintext-only editors', async () => {
    const content = container.querySelector<HTMLElement>('[data-testid="plain-text-content"]')!;
    const contextMenu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    const pointerDown = new PointerEvent('pointerdown', {
      bubbles: true, cancelable: true, button: 0, pointerType: 'mouse', pointerId: 1,
    });
    await act(() => content.dispatchEvent(contextMenu));
    await act(() => content.dispatchEvent(pointerDown));
    expect(contextMenu.defaultPrevented).toBe(false);
    expect(pointerDown.defaultPrevented).toBe(false);
    expect(container.querySelector('[data-panning="true"]')).toBeNull();
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

describe('canvas map and forced pan integration', () => {
  let host: HTMLDivElement;
  let root: Root;
  let width = 800;
  let height = 600;
  let resizeCallbacks: Set<ResizeObserverCallback>;
  let frames: Map<number, FrameRequestCallback>;
  const childPointer = vi.fn((event: { stopPropagation(): void }) => event.stopPropagation());
  const stage = () => host.querySelector<HTMLElement>('.canvas-viewport-stage')!;
  const scroll = () => host.querySelector<HTMLElement>('.canvas-viewport-scroll')!;
  const flush = async () => act(() => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach((callback) => callback(16)); });
  const pointer = async (type: string, target: Element, x: number, y: number, button = 0) => {
    await act(() => target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', button, clientX: x, clientY: y })));
  };

  beforeEach(async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    frames = new Map(); let frameId = 0; width = 800; height = 600;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
    resizeCallbacks = new Set();
    vi.stubGlobal('ResizeObserver', class {
      constructor(private callback: ResizeObserverCallback) { resizeCallbacks.add(callback); }
      observe() {}
      disconnect() { resizeCallbacks.delete(this.callback); }
    });
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => width);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(() => height);
    vi.spyOn(HTMLElement.prototype, 'setPointerCapture').mockImplementation(() => {});
    vi.spyOn(HTMLElement.prototype, 'hasPointerCapture').mockReturnValue(false);
    host = document.body.appendChild(document.createElement('div'));
    root = createRoot(host);
    await act(() => root.render(<CanvasViewport identityId='navigation-test' toolId='material' initialZoom={50}
      navigationItems={[{ id: 'one', label: 'Selected', x: 2000, y: 500, width: 300, height: 400, active: true }]}>
      <div className='editable-canvas-layer' onPointerDown={childPointer}>Editable contents</div>
    </CanvasViewport>));
    await flush();
  });
  afterEach(async () => { await act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

  it('centers the selected artboard at the same zoom, retaining that world center on resize', async () => {
    await act(() => host.querySelector<HTMLButtonElement>('[aria-label="Center selected artboard"]')!.click());
    expect(stage().style.transform).toBe('translate(-675px, -50px) scale(0.5)');
    expect(host.querySelector('.canvas-zoom-value')?.textContent).toBe('50%');
    width = 1000; height = 800;
    await act(() => [...resizeCallbacks].forEach((callback) => callback([], {} as ResizeObserver)));
    expect(stage().style.transform).toBe('translate(-575px, 50px) scale(0.5)');
    expect(host.querySelector('.canvas-zoom-value')?.textContent).toBe('50%');
  });

  it.each(['space', 'middle'])('starts %s panning before editable children can swallow it', async (mode) => {
    const child = host.querySelector('.editable-canvas-layer')!;
    scroll().focus();
    if (mode === 'space') await act(() => scroll().dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true })));
    await pointer('pointerdown', child, 100, 100, mode === 'middle' ? 1 : 0);
    expect(childPointer).not.toHaveBeenCalled();
    expect(scroll().getAttribute('data-panning')).toBe('true');
    await pointer('pointermove', scroll(), 140, 120);
    await flush();
    expect(stage().style.transform).toBe('translate(240px, 170px) scale(0.5)');
    await pointer('pointerup', scroll(), 140, 120);
    expect(scroll().hasAttribute('data-panning')).toBe(false);
  });

  it('leaves ordinary editable-layer pointer interaction intact', async () => {
    await pointer('pointerdown', host.querySelector('.editable-canvas-layer')!, 100, 100);
    expect(childPointer).toHaveBeenCalledOnce();
    expect(scroll().hasAttribute('data-panning')).toBe(false);
  });
});
