// @vitest-environment happy-dom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ShaderZoomControl } from '@/components/ShaderLabStudio';
import { shaderZoomFromSlider } from '@/lib/shaderZoom';

describe('Shader zoom edit transactions', () => {
  let container: HTMLDivElement;
  let root: Root | null;
  const commits = vi.fn();
  const previews = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(() => root?.unmount());
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  function Harness() {
    const [value, setValue] = useState(1);
    return <>
      <ShaderZoomControl value={value} onPreview={previews} onChange={(next) => {
        commits(next);
        setValue(next);
      }} />
      <output data-canonical-value>{value}</output>
    </>;
  }

  async function render() {
    await act(() => root!.render(<Harness />));
    return container.querySelector<HTMLInputElement>('input[type="range"]')!;
  }

  function sourceValue() {
    return Number(container.querySelector('[data-canonical-value]')!.textContent);
  }

  function nativeValue(input: HTMLInputElement, value: number, event = 'input') {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, String(value));
    input.dispatchEvent(new Event(event, { bubbles: true }));
  }

  function pointer(target: EventTarget, type: string, pointerId = 7) {
    target.dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0, pointerId }));
  }

  it('cancels the number draft on Escape instead of committing it through blur', async () => {
    await render();
    const entry = container.querySelector<HTMLInputElement>('input[type="number"]')!;
    await act(() => entry.focus());
    await act(() => nativeValue(entry, 3));
    await act(() => entry.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Escape' })));
    expect(sourceValue()).toBe(1);
    expect(entry.value).toBe('1');
    expect(commits).not.toHaveBeenCalled();
    expect(previews).not.toHaveBeenCalled();
  });

  it('commits keyboard and assistive input synchronously without waiting for blur', async () => {
    const slider = await render();
    await act(() => {
      nativeValue(slider, 0.3);
      expect(sourceValue()).toBe(shaderZoomFromSlider(0.3));
    });
    await act(() => vi.advanceTimersByTime(100));
    await act(() => slider.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
    expect(commits).toHaveBeenCalledExactlyOnceWith(shaderZoomFromSlider(0.3));
  });

  it.each(['pointerup', 'pointercancel', 'blur'])('commits a native drag on window %s', async (finish) => {
    const slider = await render();
    await act(() => {
      pointer(slider, 'pointerdown');
      nativeValue(slider, 0.2);
      nativeValue(slider, 0.3);
    });
    expect(commits).not.toHaveBeenCalled();
    expect(previews).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTime(20));
    expect(previews).toHaveBeenLastCalledWith(shaderZoomFromSlider(0.3));
    await act(() => {
      if (finish === 'blur') window.dispatchEvent(new Event('blur'));
      else pointer(window, finish);
      expect(sourceValue()).toBe(shaderZoomFromSlider(0.3));
    });
    await act(() => vi.advanceTimersByTime(100));
    expect(commits).toHaveBeenCalledExactlyOnceWith(shaderZoomFromSlider(0.3));
  });

  it('ignores another pointer and commits the final native value exactly once', async () => {
    const slider = await render();
    await act(() => {
      pointer(slider, 'pointerdown');
      nativeValue(slider, 0.2);
      pointer(window, 'pointerup', 8);
    });
    expect(commits).not.toHaveBeenCalled();
    await act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(slider, '0.4');
      pointer(slider, 'pointerup');
      expect(sourceValue()).toBe(shaderZoomFromSlider(0.4));
      slider.dispatchEvent(new Event('change', { bubbles: true }));
      pointer(slider, 'lostpointercapture');
    });
    expect(commits).toHaveBeenCalledExactlyOnceWith(shaderZoomFromSlider(0.4));
  });

  it('cleans up a pending drag without committing to an unmounted owner', async () => {
    const slider = await render();
    await act(() => {
      pointer(slider, 'pointerdown');
      nativeValue(slider, 0.3);
      root!.unmount();
      root = null;
    });
    await act(() => {
      pointer(window, 'pointerup');
      vi.advanceTimersByTime(100);
    });
    expect(commits).not.toHaveBeenCalled();
    expect(previews).not.toHaveBeenCalled();
  });
});
