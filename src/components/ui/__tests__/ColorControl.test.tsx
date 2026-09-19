// @vitest-environment happy-dom

import { act, Profiler, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ColorControl from '@/components/ui/ColorControl';

describe('ColorControl edit transactions', () => {
  let container: HTMLDivElement;
  let root: Root;
  const commits = vi.fn();
  const previews = vi.fn();
  const opacityCommits = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  function Harness({ initial = '#FF0000', compact = false }: { initial?: string; compact?: boolean }) {
    const [value, setValue] = useState(initial);
    const [opacity, setOpacity] = useState(100);
    return <>
      <ColorControl
        ariaLabel='Fill'
        compact={compact}
        label='Fill'
        onChange={(next) => { commits(next); setValue(next); }}
        onOpacityChange={(next) => { opacityCommits(next); setOpacity(next); }}
        onOpacityPreview={vi.fn()}
        onPreview={previews}
        opacity={opacity}
        value={value}
      />
      <output data-source-color>{value}</output>
      <output data-source-opacity>{opacity}</output>
    </>;
  }

  function render(initial = '#FF0000', compact = false) {
    act(() => root.render(<Harness compact={compact} initial={initial} />));
  }

  function input(label: string) {
    return container.querySelector<HTMLInputElement>(`input[aria-label="Fill ${label}"]`)!;
  }

  function changeValue(target: HTMLInputElement, value: string, type = 'input') {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(target, value);
    target.dispatchEvent(new Event(type, { bubbles: true }));
  }

  function pointer(target: EventTarget, type: string, options: PointerEventInit = {}) {
    target.dispatchEvent(new PointerEvent(type, {
      bubbles: true, button: 0, clientX: 50, clientY: 50, isPrimary: true, pointerId: 7, ...options,
    }));
  }

  function picker() {
    const target = container.querySelector<HTMLDivElement>('[aria-label="Fill saturation and brightness"]')!;
    let captured: number | null = null;
    Object.defineProperties(target, {
      getBoundingClientRect: { value: () => ({ left: 0, top: 0, width: 100, height: 100 }) },
      setPointerCapture: { value: (id: number) => { captured = id; } },
      hasPointerCapture: { value: (id: number) => captured === id },
      releasePointerCapture: { value: () => { captured = null; } },
    });
    return target;
  }

  function screenPicker() {
    return container.querySelector<HTMLButtonElement>('[aria-label="Fill pick screen color"]')!;
  }

  function mockEyeDropper(open: ReturnType<typeof vi.fn>) {
    vi.stubGlobal('EyeDropper', class { open = open; });
  }

  it('coalesces a burst of pointer moves into one render and commits the final release immediately', () => {
    const renders = vi.fn();
    act(() => root.render(<Profiler id='color' onRender={renders}><Harness /></Profiler>));
    const target = picker();
    renders.mockClear();
    act(() => pointer(target, 'pointerdown', { clientX: 0, clientY: 0 }));
    for (let x = 1; x <= 20; x++) {
      act(() => pointer(target, 'pointermove', { clientX: x, clientY: 0 }));
    }
    expect(renders).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(20));
    expect(renders).toHaveBeenCalledTimes(1);
    expect(previews).toHaveBeenCalledExactlyOnceWith('#FFCCCC');
    expect(commits).not.toHaveBeenCalled();
    act(() => pointer(target, 'pointerup', { clientX: 100, clientY: 50 }));
    expect(commits).toHaveBeenCalledExactlyOnceWith('#800000');
    expect(input('HEX').value).toBe('#800000');
  });

  it.each([false, true])('commits a screen sample once through preview and source without changing opacity (compact=%s)', async (compact) => {
    const open = vi.fn().mockResolvedValue({ sRGBHex: '#12abef' });
    mockEyeDropper(open);
    render('#FF0000', compact);
    await act(async () => { screenPicker().click(); });
    expect(open).toHaveBeenCalledExactlyOnceWith({ signal: expect.any(AbortSignal) });
    expect(commits).toHaveBeenCalledExactlyOnceWith('#12ABEF');
    expect(previews).toHaveBeenCalledExactlyOnceWith('#12ABEF');
    expect(input('HEX').value).toBe('#12ABEF');
    expect(container.querySelector('[data-source-color]')!.textContent).toBe('#12ABEF');
    expect(opacityCommits).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screenPicker());
  });

  it('disables unsupported screen sampling while keeping manual color edits available', () => {
    vi.stubGlobal('EyeDropper', undefined);
    render();
    expect(screenPicker().disabled).toBe(true);
    expect(screenPicker().title).toContain('supported browser');
    act(() => changeValue(input('hue'), '120'));
    expect(commits).toHaveBeenCalledExactlyOnceWith('#00FF00');
  });

  it('silently cancels screen sampling and permits a retry', async () => {
    const open = vi.fn().mockRejectedValueOnce(new DOMException('Cancelled', 'AbortError'))
      .mockResolvedValueOnce({ sRGBHex: '#00ff00' });
    mockEyeDropper(open);
    render();
    await act(async () => { screenPicker().click(); });
    expect(commits).not.toHaveBeenCalled();
    expect(container.querySelector('[role="status"]')!.textContent).toBe('');
    await act(async () => { screenPicker().click(); });
    expect(commits).toHaveBeenCalledExactlyOnceWith('#00FF00');
  });

  it('reports screen sampling failures without changing the color', async () => {
    mockEyeDropper(vi.fn().mockRejectedValue(new DOMException('Failed', 'OperationError')));
    render();
    await act(async () => { screenPicker().click(); });
    expect(commits).not.toHaveBeenCalled();
    expect(container.querySelector('[role="status"]')!.textContent).toContain('Try again');
    expect(screenPicker().getAttribute('aria-pressed')).toBe('false');
  });

  it.each(['close', 'unmount'])('aborts sampling on %s and ignores a late result', async (action) => {
    let resolve!: (value: { sRGBHex: string }) => void;
    const open = vi.fn().mockImplementation(() => new Promise((done) => { resolve = done; }));
    mockEyeDropper(open);
    render();
    act(() => { screenPicker().click(); screenPicker().click(); });
    expect(open).toHaveBeenCalledTimes(1);
    expect(screenPicker().getAttribute('aria-pressed')).toBe('true');
    act(() => {
      if (action === 'unmount') root.render(null);
      else {
        const close = new Event('beforetoggle');
        Object.defineProperty(close, 'newState', { value: 'closed' });
        container.querySelector('[popover]')!.dispatchEvent(close);
      }
    });
    expect(open.mock.calls[0][0].signal.aborted).toBe(true);
    await act(async () => { resolve({ sRGBHex: '#00ff00' }); });
    expect(commits).not.toHaveBeenCalled();
  });

  it.each(['#000000', '#FFFFFF', '#808080'])('retains the chosen hue on %s before the first saturation click', (initial) => {
    render(initial);
    const target = picker();
    act(() => { changeValue(input('hue'), '240'); vi.advanceTimersByTime(20); });
    expect(input('hue').value).toBe('240');
    act(() => {
      pointer(target, 'pointerdown', { clientX: 100, clientY: 0 });
      pointer(target, 'pointerup', { clientX: 100, clientY: 0 });
    });
    expect(commits).toHaveBeenLastCalledWith('#0000FF');
  });

  it('preserves saturation and hue through a black edge of a drag', () => {
    render('#0000FF');
    const target = picker();
    act(() => { pointer(target, 'pointerdown', { clientX: 75, clientY: 100 }); vi.advanceTimersByTime(20); });
    expect(target.getAttribute('aria-valuenow')).toBe('75');
    expect(input('hue').value).toBe('240');
    act(() => pointer(target, 'pointerup', { clientX: 75, clientY: 0 }));
    expect(commits).toHaveBeenLastCalledWith('#4040FF');
  });

  it('keeps the 360-degree hue endpoint instead of snapping back to zero', () => {
    render();
    act(() => { changeValue(input('hue'), '360'); vi.advanceTimersByTime(20); });
    expect(input('hue').value).toBe('360');
  });

  it('commits keyboard hue and opacity changes without waiting for blur', () => {
    render();
    act(() => changeValue(input('hue'), '120'));
    expect(container.querySelector('[data-source-color]')!.textContent).toBe('#00FF00');
    act(() => changeValue(input('opacity'), '35'));
    expect(container.querySelector('[data-source-opacity]')!.textContent).toBe('35');
    act(() => {
      input('hue').dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      input('opacity').dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      vi.advanceTimersByTime(30);
    });
    expect(commits).toHaveBeenCalledExactlyOnceWith('#00FF00');
    expect(opacityCommits).toHaveBeenCalledExactlyOnceWith(35);
  });

  it.each(['hue', 'opacity'])('finishes a native %s drag released outside the input with its final value', (label) => {
    render();
    const target = input(label);
    const capture = vi.fn();
    Object.defineProperty(target, 'setPointerCapture', { value: capture });
    act(() => { pointer(target, 'pointerdown'); changeValue(target, '60'); vi.advanceTimersByTime(20); });
    expect(capture).not.toHaveBeenCalled();
    expect(label === 'hue' ? commits : opacityCommits).not.toHaveBeenCalled();
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(target, '120');
      pointer(window, 'pointerup');
    });
    expect(label === 'hue' ? commits : opacityCommits).toHaveBeenCalledExactlyOnceWith(label === 'hue' ? '#00FF00' : 100);
  });

  it('commits native change-only hue input', () => {
    render();
    act(() => changeValue(input('hue'), '120', 'change'));
    expect(commits).toHaveBeenCalledExactlyOnceWith('#00FF00');
  });

  it('commits an interrupted saturation drag exactly once', () => {
    render();
    const target = picker();
    act(() => {
      pointer(target, 'pointerdown', { clientX: 100, clientY: 50 });
      pointer(target, 'lostpointercapture');
      expect(commits).toHaveBeenCalledExactlyOnceWith('#800000');
      pointer(target, 'pointerup', { clientX: 100, clientY: 50 });
      vi.advanceTimersByTime(30);
    });
    expect(commits).toHaveBeenCalledExactlyOnceWith('#800000');
  });

  it.each(['pointercancel', 'blur'])('finishes a hue gesture on window %s and cancels deferred callbacks', (finish) => {
    render();
    const target = input('hue');
    act(() => {
      pointer(target, 'pointerdown');
      changeValue(target, '120');
      if (finish === 'blur') window.dispatchEvent(new Event('blur'));
      else pointer(window, finish);
      vi.advanceTimersByTime(30);
    });
    expect(commits).toHaveBeenCalledExactlyOnceWith('#00FF00');
    expect(previews).toHaveBeenCalledExactlyOnceWith('#00FF00');
  });

  it('ignores another pointer ending a hue gesture', () => {
    render();
    const target = input('hue');
    act(() => {
      pointer(target, 'pointerdown');
      changeValue(target, '120');
      pointer(window, 'pointerup', { pointerId: 8 });
    });
    expect(commits).not.toHaveBeenCalled();
    act(() => pointer(window, 'pointerup'));
    expect(commits).toHaveBeenCalledExactlyOnceWith('#00FF00');
  });

  it('flushes a pending saturation preview when the native popover is dismissed', () => {
    render();
    const target = picker();
    const popover = container.querySelector('[popover]')!;
    act(() => {
      pointer(target, 'pointerdown', { clientX: 100, clientY: 50 });
      const close = new Event('beforetoggle');
      Object.defineProperty(close, 'newState', { value: 'closed' });
      popover.dispatchEvent(close);
      vi.advanceTimersByTime(30);
    });
    expect(commits).toHaveBeenCalledExactlyOnceWith('#800000');
    expect(previews).toHaveBeenCalledExactlyOnceWith('#800000');
  });

  it('commits the focused compact text draft when the native popover is dismissed', () => {
    render('#FF0000', true);
    const target = input('HEX');
    act(() => {
      target.focus();
      changeValue(target, '#0f0');
      const close = new Event('beforetoggle');
      Object.defineProperty(close, 'newState', { value: 'closed' });
      container.querySelector('[popover]')!.dispatchEvent(close);
    });
    expect(commits).toHaveBeenCalledExactlyOnceWith('#00FF00');
  });

  it('keeps opacity editable inside the compact picker and reflects it on the trigger', () => {
    render('#FF0000', true);
    const opacity = input('opacity');
    expect(opacity.closest('[role="dialog"]')).not.toBeNull();
    act(() => changeValue(opacity, '35'));
    expect(opacityCommits).toHaveBeenCalledExactlyOnceWith(35);
    expect(container.querySelector('button[aria-label="Fill"]')!.textContent).toContain('35%');
    expect(container.querySelector('[data-source-opacity]')!.textContent).toBe('35');
  });

  it('uses the typed compact HEX hue on the first saturation click that blurs the draft', () => {
    render('#0000FF', true);
    const hexInput = input('HEX');
    const target = picker();
    act(() => { hexInput.focus(); changeValue(hexInput, '#FF0000'); });
    act(() => {
      pointer(target, 'pointerdown', { clientX: 100, clientY: 50 });
      pointer(target, 'pointerup', { clientX: 100, clientY: 50 });
    });
    expect(commits).toHaveBeenLastCalledWith('#800000');
    expect(input('hue').value).toBe('0');
  });

  it('ignores right-clicks in the saturation picker', () => {
    render();
    const target = picker();
    act(() => {
      pointer(target, 'pointerdown', { button: 2 });
      pointer(target, 'pointerup', { button: 2 });
      vi.advanceTimersByTime(30);
    });
    expect(commits).not.toHaveBeenCalled();
    expect(previews).not.toHaveBeenCalled();
  });

  it.each([false, true])('preserves text input identity during color updates (compact=%s)', (compact) => {
    render('#FF0000', compact);
    const hexInput = input('HEX');
    const oklchInput = input('OKLCH');
    act(() => { changeValue(input('hue'), '120'); vi.advanceTimersByTime(20); });
    expect(input('HEX')).toBe(hexInput);
    expect(input('OKLCH')).toBe(oklchInput);
    expect(hexInput.value).toBe('#00FF00');
  });

  it('reverts invalid text on blur and cancels valid text on Escape', () => {
    render();
    const target = input('HEX');
    act(() => { target.focus(); changeValue(target, 'not a color'); target.blur(); });
    expect(target.value).toBe('#FF0000');
    act(() => {
      target.focus();
      changeValue(target, '#00FF00');
      target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
    });
    expect(target.value).toBe('#FF0000');
    expect(commits).not.toHaveBeenCalled();
  });

  it('commits valid text once on Enter and refreshes the host preview', () => {
    render();
    const target = input('HEX');
    act(() => {
      target.focus();
      changeValue(target, '#0f0');
      target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
    });
    expect(commits).toHaveBeenCalledExactlyOnceWith('#00FF00');
    expect(previews).toHaveBeenLastCalledWith('#00FF00');
    expect(target.value).toBe('#00FF00');
  });

  it('preserves a focused text draft across an external color update, then commits the draft', () => {
    const renderValue = (value: string) => act(() => root.render(
      <ColorControl ariaLabel='Fill' label='Fill' onChange={commits} value={value} />
    ));
    renderValue('#FF0000');
    const target = input('HEX');
    act(() => { target.focus(); changeValue(target, '#00FF00'); });
    renderValue('#0000FF');
    expect(document.activeElement).toBe(target);
    expect(target.value).toBe('#00FF00');
    act(() => target.blur());
    expect(commits).toHaveBeenCalledExactlyOnceWith('#00FF00');
  });

  it('uses externally changed colors instead of stale HSV coordinates', () => {
    const renderValue = (value: string) => act(() => root.render(
      <ColorControl ariaLabel='Fill' label='Fill' onChange={commits} value={value} />
    ));
    renderValue('#FFFFFF');
    act(() => changeValue(input('hue'), '240'));
    renderValue('#00FF00');
    expect(input('hue').value).toBe('120');
    const target = picker();
    act(() => {
      pointer(target, 'pointerdown', { clientX: 100, clientY: 50 });
      pointer(target, 'pointerup', { clientX: 100, clientY: 50 });
    });
    expect(commits).toHaveBeenLastCalledWith('#008000');
  });
});
