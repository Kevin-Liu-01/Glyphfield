// @vitest-environment happy-dom

import { act, useState, type Dispatch, type SetStateAction } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import StudioFontSizeControl from '@/components/StudioFontSizeControl';

describe('shared pixel font-size control', () => {
  let host: HTMLDivElement;
  let root: Root;
  let setValue: Dispatch<SetStateAction<number>>;
  const commits = vi.fn();
  const previews = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.body.appendChild(document.createElement('div'));
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  function Harness({ initial = 48, preview = true, owner = 'first' }: { initial?: number; preview?: boolean; owner?: string }) {
    const [value, updateValue] = useState(initial);
    setValue = updateValue;
    return <>
      <StudioFontSizeControl key={owner} value={value} onPreview={preview ? previews : undefined}
        onChange={(next) => { commits(next); updateValue(next); }} />
      <output data-canonical-size>{value}</output>
    </>;
  }

  const numeric = () => host.querySelector<HTMLInputElement>('[aria-label="Text size in pixels"]')!;
  const slider = () => host.querySelector<HTMLInputElement>('[aria-label="Text size"]')!;
  const canonical = () => Number(host.querySelector('[data-canonical-size]')!.textContent);
  async function render(props: { initial?: number; preview?: boolean; owner?: string } = {}) {
    await act(async () => root.render(<Harness {...props} />));
  }
  async function type(value: string) {
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(numeric(), value);
      numeric().dispatchEvent(new Event('input', { bubbles: true }));
    });
  }
  async function key(value: string) {
    await act(async () => numeric().dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true })));
  }
  async function blur() {
    await act(async () => numeric().dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
  }
  function rangeInput(value: number) {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(slider(), String(value));
    slider().dispatchEvent(new Event('input', { bubbles: true }));
  }
  function pointer(type: string) {
    slider().dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0, pointerId: 5, isPrimary: true }));
  }

  it('exposes native pixel bounds and a practical shared slider', async () => {
    await render();
    expect(numeric().type).toBe('number');
    expect([numeric().min, numeric().max, numeric().step, numeric().value]).toEqual(['1', '2048', '1', '48']);
    expect([slider().min, slider().max, slider().step]).toEqual(['1', '512', '1']);
    expect(host.textContent).toContain('48 px');
  });

  it('accepts temporary blank input and commits direct pixel entry on blur', async () => {
    await render();
    await type('');
    expect(numeric().value).toBe('');
    expect(canonical()).toBe(48);
    await type('12');
    expect(commits).not.toHaveBeenCalled();
    expect(previews).not.toHaveBeenCalled();
    await blur();
    expect(canonical()).toBe(12);
    expect(commits).toHaveBeenCalledExactlyOnceWith(12);
    expect(previews).toHaveBeenCalledExactlyOnceWith(12);
  });

  it('commits Enter synchronously without another commit on blur', async () => {
    await render();
    await type('1024');
    await act(async () => {
      numeric().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      expect(canonical()).toBe(1024);
    });
    await blur();
    expect(commits).toHaveBeenCalledExactlyOnceWith(1024);
    expect(slider().max).toBe('1024');
  });

  it('commits the public Browser API native value/input/change sequence synchronously once', async () => {
    await render();
    await act(async () => {
      numeric().value = '96';
      numeric().dispatchEvent(new Event('input', { bubbles: true }));
      numeric().dispatchEvent(new Event('change', { bubbles: true }));
      expect(canonical()).toBe(96);
    });
    await blur();
    expect(commits).toHaveBeenCalledExactlyOnceWith(96);
    expect(previews).toHaveBeenCalledExactlyOnceWith(96);
  });

  it('captures directly assigned input as a draft without committing before blur', async () => {
    await render();
    await act(async () => {
      numeric().value = '24';
      numeric().dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(canonical()).toBe(48);
    expect(commits).not.toHaveBeenCalled();
    await blur();
    expect(canonical()).toBe(24);
    expect(commits).toHaveBeenCalledExactlyOnceWith(24);
  });

  it('does not round exact legacy source on a no-op native change of its formatted display', async () => {
    const initial = 1920 * 0.17 * 0.7;
    await render({ initial });
    await act(async () => {
      numeric().value = numeric().value;
      numeric().dispatchEvent(new Event('input', { bubbles: true }));
      numeric().dispatchEvent(new Event('change', { bubbles: true }));
    });
    await blur();
    expect(numeric().value).toBe('228.48');
    expect(canonical()).toBe(initial);
    expect(commits).not.toHaveBeenCalled();
    expect(previews).not.toHaveBeenCalled();
  });

  it('uses the latest controlled value and removes native listeners when the owner changes', async () => {
    await render();
    const previousField = numeric();
    await render({ owner: 'second' });
    await act(async () => setValue(128));
    await act(async () => {
      previousField.value = '256';
      previousField.dispatchEvent(new Event('change', { bubbles: true }));
      numeric().value = '128';
      numeric().dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(canonical()).toBe(128);
    expect(commits).not.toHaveBeenCalled();
  });

  it('reverts Escape without committing or losing numeric-field focus', async () => {
    await render();
    await act(async () => numeric().focus());
    await type('144');
    await key('Escape');
    expect(numeric().value).toBe('48');
    expect(document.activeElement).toBe(numeric());
    await blur();
    expect(commits).not.toHaveBeenCalled();
    expect(previews).not.toHaveBeenCalled();
  });

  it.each(['', '0', '-10', '2049', 'Infinity', 'invalid'])('preserves the prior valid size when committing invalid draft %j', async (draft) => {
    await render();
    await type(draft);
    await key('Enter');
    expect(numeric().value).toBe('48');
    expect(canonical()).toBe(48);
    expect(commits).not.toHaveBeenCalled();
  });

  it('steps by one pixel with arrows and respects the numeric limits', async () => {
    await render({ initial: 1 });
    await key('ArrowDown');
    expect(commits).not.toHaveBeenCalled();
    await key('ArrowUp');
    expect(canonical()).toBe(2);
    await act(async () => setValue(2048));
    await key('ArrowUp');
    expect(canonical()).toBe(2048);
    await key('ArrowDown');
    expect(canonical()).toBe(2047);
    expect(commits.mock.calls.map(([value]) => value)).toEqual([2, 2047]);
  });

  it('preserves authored fractional pixels and accepts precise numeric entry', async () => {
    await render({ initial: 12.5 });
    expect(numeric().value).toBe('12.5');
    await blur();
    expect(commits).not.toHaveBeenCalled();
    await type('18.5');
    await key('Enter');
    expect(canonical()).toBe(18.5);
  });

  it('hides arithmetic display noise without changing untouched source pixels', async () => {
    const initial = 1920 * 0.17 * 0.7;
    await render({ initial });
    expect(numeric().value).toBe('228.48');
    await act(async () => numeric().focus());
    await key('Enter');
    await blur();
    expect(canonical()).toBe(initial);
    expect(commits).not.toHaveBeenCalled();
    expect(previews).not.toHaveBeenCalled();
  });

  it('steps pristine values from exact source rather than rounded display text', async () => {
    const initial = 1920 * 0.17 * 0.7;
    await render({ initial });
    await key('ArrowUp');
    expect(canonical()).toBe(initial + 1);
    expect(commits).toHaveBeenCalledExactlyOnceWith(initial + 1);
  });

  it('keeps explicitly entered precision canonical even when the settled display is shorter', async () => {
    await render();
    await type('12.1234567890123');
    await key('Enter');
    expect(canonical()).toBe(12.1234567890123);
    expect(numeric().value).toBe('12.123456789');
    await blur();
    expect(commits).toHaveBeenCalledExactlyOnceWith(12.1234567890123);
  });

  it.each([0.125, 12.5, 5000.75])('does not normalize existing size %s merely when the integer slider blurs', async (initial) => {
    await render({ initial });
    await act(async () => slider().dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
    expect(canonical()).toBe(initial);
    expect(numeric().value).toBe(String(initial));
    expect(commits).not.toHaveBeenCalled();
  });

  it('steps from the current numeric draft rather than the older canonical size', async () => {
    await render();
    await type('24');
    await key('ArrowUp');
    expect(canonical()).toBe(25);
    expect(numeric().value).toBe('25');
    expect(commits).toHaveBeenCalledExactlyOnceWith(25);
  });

  it('discards an obsolete draft on external size changes without remounting the focused input', async () => {
    await render();
    const field = numeric();
    await act(async () => field.focus());
    await type('24');
    await act(async () => setValue(128));
    expect(numeric()).toBe(field);
    expect(document.activeElement).toBe(field);
    expect(field.value).toBe('128');
    await blur();
    expect(commits).not.toHaveBeenCalled();
  });

  it('resets a same-size layer draft when the host changes the selected-owner key', async () => {
    await render();
    await type('24');
    await render({ owner: 'second' });
    expect(numeric().value).toBe('48');
    await blur();
    expect(commits).not.toHaveBeenCalled();
  });

  it('keeps shared slider keyboard input immediately canonical', async () => {
    await render();
    await act(async () => {
      rangeInput(16);
      expect(canonical()).toBe(16);
    });
    expect(numeric().value).toBe('16');
    expect(commits).toHaveBeenCalledExactlyOnceWith(16);
  });

  it('retains the shared slider live-preview transaction and commits once on release', async () => {
    await render();
    await act(async () => {
      pointer('pointerdown');
      rangeInput(12);
      vi.advanceTimersByTime(16);
    });
    expect(previews).toHaveBeenCalledExactlyOnceWith(12);
    expect(canonical()).toBe(48);
    expect(numeric().value).toBe('12');
    await act(async () => pointer('pointerup'));
    expect(commits).toHaveBeenCalledExactlyOnceWith(12);
    expect(canonical()).toBe(12);
    await blur();
    expect(commits).toHaveBeenCalledOnce();
  });

  it('preserves shared slider fallback commits when no preview callback is provided', async () => {
    await render({ preview: false });
    await act(async () => {
      pointer('pointerdown');
      rangeInput(24);
      vi.advanceTimersByTime(16);
    });
    expect(canonical()).toBe(24);
    expect(numeric().value).toBe('24');
    expect(previews).not.toHaveBeenCalled();
  });

  it('cancels a pending slider preview when the selected text owner changes', async () => {
    await render();
    await act(async () => {
      pointer('pointerdown');
      rangeInput(12);
    });
    await render({ owner: 'second' });
    await act(async () => {
      vi.advanceTimersByTime(100);
      window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 5 }));
    });
    expect(previews).not.toHaveBeenCalled();
    expect(commits).not.toHaveBeenCalled();
    expect(canonical()).toBe(48);
  });
});
