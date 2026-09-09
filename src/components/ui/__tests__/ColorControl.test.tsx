// @vitest-environment happy-dom

import { act, useState } from 'react';
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
