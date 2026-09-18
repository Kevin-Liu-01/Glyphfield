// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CanvasEditableText from '@/components/CanvasEditableText';

describe('native canvas text editing', () => {
  let container: HTMLDivElement;
  let root: Root;
  const commit = vi.fn();
  const select = vi.fn();
  const layerPointerDown = vi.fn();
  const layerMenu = vi.fn();
  const layerKeyDown = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  async function render(value = 'Select this text') {
    await act(() => root.render(
      <div
        className='shader-lab-v2'
        onContextMenu={(event) => { layerMenu(); event.preventDefault(); }}
        onKeyDown={layerKeyDown}
        onPointerDown={layerPointerDown}
      >
        <CanvasEditableText
          className='shader-lab-v2-layer-text'
          label='Edit text'
          onChange={commit}
          onFocus={select}
          style={{ fontSize: 40, fontWeight: 500, lineHeight: 1.1, letterSpacing: '-0.02em' }}
          value={value}
        />
      </div>
    ));
    return container.querySelector<HTMLElement>('[role="textbox"]')!;
  }

  async function pointer(text: HTMLElement, modifiers: PointerEventInit) {
    const event = new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, ...modifiers });
    await act(() => text.dispatchEvent(event));
    return event;
  }

  it('preserves Shift-click extension inside the focused editor', async () => {
    const text = await render();
    await act(() => text.focus());
    const event = await pointer(text, { shiftKey: true });
    expect(event.defaultPrevented).toBe(false);
    expect(layerPointerDown).not.toHaveBeenCalled();
  });

  it('retains additive layer selection outside an active text edit', async () => {
    const text = await render();
    expect((await pointer(text, { shiftKey: true })).defaultPrevented).toBe(true);
    expect(layerPointerDown).toHaveBeenCalledOnce();
    await act(() => text.focus());
    expect((await pointer(text, { metaKey: true })).defaultPrevented).toBe(true);
    expect(layerPointerDown).toHaveBeenCalledTimes(2);
  });

  it('preserves the native text menu instead of opening the canvas layer menu', async () => {
    const text = await render();
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    await act(() => text.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(false);
    expect(layerMenu).not.toHaveBeenCalled();
  });

  it('leaves native undo and typing shortcuts unhandled without bubbling to the canvas', async () => {
    const text = await render();
    const event = new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true, cancelable: true });
    await act(() => text.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(false);
    expect(layerKeyDown).not.toHaveBeenCalled();
  });

  it('coalesces input commits, preserves active text, and flushes the final value on blur', async () => {
    const text = await render();
    await act(() => {
      text.focus();
      text.innerText = 'Edited text';
      text.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await render('Stale render');
    expect(text.innerText).toBe('Edited text');
    expect(commit).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTime(140));
    expect(commit).toHaveBeenLastCalledWith('Edited text');
    await act(() => {
      text.innerText = 'Final text';
      text.dispatchEvent(new Event('input', { bubbles: true }));
      text.blur();
    });
    expect(commit).toHaveBeenLastCalledWith('Final text');
  });

  it('keeps typography previews during a drag and restores canonical styles after it', async () => {
    const text = await render();
    const pendingControl = document.createElement('input');
    pendingControl.setAttribute('data-canvas-preview-pending', 'true');
    text.parentElement!.append(pendingControl);
    text.style.fontSize = '80px';
    await render();
    expect(text.style.fontSize).toBe('80px');
    pendingControl.remove();
    await render();
    expect(text.style.fontSize).toBe('40px');
    expect(text.style.lineHeight).toBe('1.1');
  });

  it('remaps each pending rich edit before coalescing its commit', async () => {
    const richChange = vi.fn();
    await act(() => root.render(<CanvasEditableText className='rich' label='Rich editor'
      onChange={commit} onRichChange={richChange} onFocus={select} style={{}}
      value='abcd' runs={[{ start: 1, end: 3, style: { weight: 700 } }]}
      resolveRunStyle={(style) => ({ fontWeight: String(style.weight ?? 400) })} />));
    const text = container.querySelector<HTMLElement>('[role="textbox"]')!;
    await act(() => {
      text.focus();
      text.textContent = 'xabcd';
      text.dispatchEvent(new Event('input', { bubbles: true }));
      text.textContent = 'xabc!d';
      text.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(richChange).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTime(140));
    expect(richChange).toHaveBeenCalledWith('xabc!d', [{ start: 2, end: 5, style: { weight: 700 } }]);
  });

  it('ignores a collapsed DOM selection after focus moves to an inspector control', async () => {
    const selection = vi.fn();
    await act(() => root.render(<><CanvasEditableText className='rich' label='Rich editor'
      onChange={commit} onFocus={select} onSelectionChange={selection} style={{}}
      value='abcd' runs={[{ start: 0, end: 2, style: { weight: 700 } }]} resolveRunStyle={() => ({})} /><button>Format</button></>));
    const text = container.querySelector<HTMLElement>('[role="textbox"]')!;
    const range = document.createRange(); range.setStart(text.firstChild!.firstChild!, 0); range.collapse(true);
    await act(() => {
      container.querySelector('button')!.focus();
      window.getSelection()!.removeAllRanges(); window.getSelection()!.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
    });
    expect(selection).not.toHaveBeenCalled();
  });
});
