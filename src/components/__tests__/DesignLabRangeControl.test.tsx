// @vitest-environment happy-dom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import DesignLabRangeControl from '@/components/DesignLabRangeControl';

describe('Design Lab range edit transactions', () => {
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

  function Harness({ preview = true }: { preview?: boolean }) {
    const [value, setValue] = useState(1);
    return <>
      <DesignLabRangeControl
        label='Text size'
        max={3}
        min={0.2}
        onChange={(nextValue) => {
          commits(nextValue);
          setValue(nextValue);
        }}
        onPreview={preview ? previews : undefined}
        step={0.05}
        value={value}
      />
      <output data-canonical-value>{value}</output>
    </>;
  }

  async function render(preview = true) {
    await act(() => root!.render(<Harness preview={preview} />));
    return container.querySelector<HTMLInputElement>('input[aria-label="Text size"]')!;
  }

  function sourceValue() {
    return Number(container.querySelector('[data-canonical-value]')!.textContent);
  }

  function inputValue(input: HTMLInputElement, value: number) {
    input.value = String(value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function pointer(input: HTMLInputElement, type: string, coordinates = { clientX: 10, clientY: 10 }) {
    input.dispatchEvent(new PointerEvent(type, {
      bubbles: true,
      button: 0,
      isPrimary: true,
      pointerId: 7,
      ...coordinates,
    }));
  }

  function installPointerCapture(input: HTMLInputElement) {
    let captured: number | null = null;
    const set = vi.fn((id: number) => { captured = id; });
    const release = vi.fn((id: number) => {
      if (captured !== id) return;
      captured = null;
      pointer(input, 'lostpointercapture');
    });
    Object.defineProperties(input, {
      hasPointerCapture: { configurable: true, value: (id: number) => captured === id },
      releasePointerCapture: { configurable: true, value: release },
      setPointerCapture: { configurable: true, value: set },
    });
    return { set, release };
  }

  it('invariant_non_pointer_edits_commit_before_observers_can_read_stale_source', async () => {
    const input = await render();
    await act(() => {
      inputValue(input, 0.75);
      // Export/readSource may run immediately after an input event, without blur.
      expect(sourceValue()).toBe(0.75);
      expect(input.dataset.canvasPreviewPending).not.toBe('true');
    });
    expect(commits).toHaveBeenCalledExactlyOnceWith(0.75);
    await act(() => vi.advanceTimersByTime(100));
    expect(sourceValue()).toBe(0.75);
    expect(commits).toHaveBeenCalledTimes(1);
  });

  it('invariant_keyboard_repeats_do_not_wait_for_blur_or_commit_twice_on_blur', async () => {
    const input = await render();
    for (const value of [0.95, 0.9, 0.85]) {
      await act(() => {
        inputValue(input, value);
        expect(sourceValue()).toBe(value);
      });
    }
    await act(() => input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
    expect(commits.mock.calls.map(([value]) => value)).toEqual([0.95, 0.9, 0.85]);
  });

  it('invariant_drag_previews_are_throttled_and_captured_release_commits_exactly_once', async () => {
    const input = await render();
    const capture = installPointerCapture(input);
    await act(() => {
      pointer(input, 'pointerdown');
      inputValue(input, 0.9);
      inputValue(input, 0.7);
      inputValue(input, 0.6);
    });
    expect(capture.set).toHaveBeenCalledWith(7);
    expect(input.dataset.canvasPreviewPending).toBe('true');
    expect(sourceValue()).toBe(1);
    expect(commits).not.toHaveBeenCalled();
    expect(previews).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTime(16));
    expect(previews).toHaveBeenCalledExactlyOnceWith(0.6);
    expect(sourceValue()).toBe(1);
    expect(input.dataset.canvasPreviewPending).toBe('true');

    await act(() => {
      inputValue(input, 0.5);
      // Native capture retargets an outside release to the original input.
      pointer(input, 'pointerup', { clientX: 2_000, clientY: -200 });
      expect(sourceValue()).toBe(0.5);
      expect(input.dataset.canvasPreviewPending).not.toBe('true');
      pointer(input, 'lostpointercapture');
      input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    expect(previews).toHaveBeenLastCalledWith(0.5);
    expect(commits).toHaveBeenCalledExactlyOnceWith(0.5);
    await act(() => vi.advanceTimersByTime(100));
    expect(commits).toHaveBeenCalledTimes(1);
    expect(previews).toHaveBeenCalledTimes(2);
  });

  it('invariant_release_before_the_preview_timer_commits_the_latest_input', async () => {
    const input = await render();
    installPointerCapture(input);
    await act(() => {
      pointer(input, 'pointerdown');
      inputValue(input, 0.55);
      pointer(input, 'pointerup');
      expect(sourceValue()).toBe(0.55);
    });
    await act(() => vi.advanceTimersByTime(100));
    expect(previews).toHaveBeenCalledExactlyOnceWith(0.55);
    expect(commits).toHaveBeenCalledExactlyOnceWith(0.55);
  });

  it.each(['pointercancel', 'lostpointercapture', 'blur'])(
    'invariant_%s_finishes_a_pending_drag_without_later_timer_commits',
    async (finish) => {
      const input = await render();
      installPointerCapture(input);
      await act(() => {
        pointer(input, 'pointerdown');
        inputValue(input, 0.65);
        if (finish === 'blur') input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        else pointer(input, finish);
        expect(sourceValue()).toBe(0.65);
        expect(input.dataset.canvasPreviewPending).not.toBe('true');
      });
      await act(() => vi.advanceTimersByTime(100));
      expect(commits).toHaveBeenCalledExactlyOnceWith(0.65);
      expect(previews).toHaveBeenCalledExactlyOnceWith(0.65);
    }
  );

  it('invariant_returning_to_the_original_value_restores_the_final_visible_preview', async () => {
    const input = await render();
    installPointerCapture(input);
    await act(() => {
      pointer(input, 'pointerdown');
      inputValue(input, 0.5);
      vi.advanceTimersByTime(16);
    });
    expect(previews).toHaveBeenLastCalledWith(0.5);
    await act(() => {
      inputValue(input, 1);
      pointer(input, 'pointerup');
    });
    expect(previews).toHaveBeenLastCalledWith(1);
    expect(sourceValue()).toBe(1);
    expect(input.dataset.canvasPreviewPending).not.toBe('true');
  });

  it('invariant_unmount_cancels_pending_callbacks_without_committing_to_a_new_owner', async () => {
    const input = await render();
    installPointerCapture(input);
    await act(() => {
      pointer(input, 'pointerdown');
      inputValue(input, 0.4);
      root!.unmount();
      root = null;
    });
    await act(() => vi.advanceTimersByTime(100));
    expect(previews).not.toHaveBeenCalled();
    expect(commits).not.toHaveBeenCalled();
  });

  it('invariant_controls_without_preview_callbacks_commit_non_pointer_edits_immediately', async () => {
    const input = await render(false);
    await act(() => {
      inputValue(input, 1.25);
      expect(sourceValue()).toBe(1.25);
    });
    expect(commits).toHaveBeenCalledExactlyOnceWith(1.25);
    expect(input.dataset.canvasPreviewPending).not.toBe('true');
  });
});
