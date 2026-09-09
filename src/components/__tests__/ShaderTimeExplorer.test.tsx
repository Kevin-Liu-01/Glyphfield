// @vitest-environment happy-dom
import { act, Profiler } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ShaderTimeExplorer, { type ShaderTimeExplorerProps } from '@/components/ShaderTimeExplorer';
import { getShaderMotionCapabilities } from '@/lib/shaderMotionCapabilities';

describe('native shader time exploration', () => {
  let container: HTMLDivElement;
  let root: Root;
  let props: ShaderTimeExplorerProps;
  const commits = vi.fn();
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    props = { timeMs: 0, playing: false, canSeek: true, busy: false,
      onTimeChange: vi.fn(), onTimePreview: vi.fn(), onLiveTime: vi.fn(),
      onFreeze: vi.fn(), onPlay: vi.fn(), onCapture: vi.fn() };
  });
  afterEach(async () => {
    await act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });
  const button = (label: string) => container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
  async function render() {
    await act(() => root.render(<Profiler id='explorer' onRender={commits}><ShaderTimeExplorer {...props} /></Profiler>));
  }
  it('steps by 1/60 second independently of an export range and never wraps', async () => {
    props.timeMs = 40_000;
    await render();
    await act(() => button('Next shader frame (1/60 second)').click());
    expect(props.onTimeChange).toHaveBeenLastCalledWith(40_000 + 1000 / 60);
    expect(container.querySelector('input')?.max).toBe('60000');
    expect(container.textContent).toContain('40.02s');
    await act(() => button('Previous shader frame (1/60 second)').click());
    expect(props.onTimeChange).toHaveBeenLastCalledWith(40_000);
  });
  it('updates live time without React commits, uniform stepping, or a fake loop', async () => {
    props.playing = true;
    props.timeMs = 29_990;
    await render();
    const count = commits.mock.calls.length;
    await act(() => vi.advanceTimersByTime(120));
    expect(commits).toHaveBeenCalledTimes(count);
    const elapsed = (props.onLiveTime as ReturnType<typeof vi.fn>).mock.lastCall?.[0] as number;
    expect(elapsed).toBeGreaterThan(30_000);
    expect(props.onTimePreview).not.toHaveBeenCalled();
    expect(container.querySelector('input')?.max).toBe('30000');
    expect(container.querySelector('input')?.value).toBe('30000');
    expect(container.querySelector('input')?.style.getPropertyValue('--studio-range-progress')).toBe('100%');
    await act(() => button('Extend shader exploration by 30 seconds').click());
    expect(container.querySelector('input')?.max).toBe('60000');
    expect(container.textContent).not.toContain('29.99s');
  });
  it('invariant_playback_never_grows_the_exploration_range_or_wraps_elapsed_time', async () => {
    props.playing = true;
    props.timeMs = 29_990;
    await render();
    const commitCount = commits.mock.calls.length;
    await act(() => vi.advanceTimersByTime(61_000));
    expect(commits).toHaveBeenCalledTimes(commitCount);
    expect(container.querySelector('input')?.max).toBe('30000');
    expect(container.querySelector('input')?.value).toBe('30000');
    const elapsed = (props.onLiveTime as ReturnType<typeof vi.fn>).mock.lastCall?.[0] as number;
    expect(elapsed).toBeGreaterThan(90_000);
    expect(props.onTimePreview).not.toHaveBeenCalled();
    expect(props.onTimeChange).not.toHaveBeenCalled();
    expect(props.onCapture).not.toHaveBeenCalled();
    await act(() => button('Extend shader exploration by 30 seconds').click());
    expect(container.querySelector('input')?.max).toBe('60000');
    expect(container.querySelector('input')?.value).toBe('60000');
    expect(container.textContent).toContain(`${(elapsed / 1000).toFixed(2)}s`);
  });
  it('previews drag changes once per animation frame and commits the final exact time', async () => {
    props.playing = true;
    props.onScrubStart = vi.fn();
    await render();
    const range = container.querySelector('input')!;
    await act(() => {
      range.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7, button: 0 }));
      for (const value of ['1600', '2200', '2500']) {
        range.value = value;
        range.dispatchEvent(new Event('input', { bubbles: true }));
      }
      range.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7 }));
    });
    expect(props.onScrubStart).toHaveBeenCalledTimes(1);
    expect(props.onFreeze).not.toHaveBeenCalled();
    expect(props.onTimePreview).toHaveBeenCalledTimes(1);
    expect(props.onTimeChange).toHaveBeenLastCalledWith(2500);
  });
  it('invariant_non_pointer_input_commits_before_a_following_capture_or_source_read', async () => {
    await render();
    const range = container.querySelector('input')!;
    await act(() => {
      range.value = '1250';
      range.dispatchEvent(new Event('input', { bubbles: true }));
      expect(props.onTimeChange).toHaveBeenCalledExactlyOnceWith(1250);
      range.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(props.onTimeChange).toHaveBeenCalledTimes(1);
  });
  it('invariant_change_only_accessibility_input_commits_the_native_range_value', async () => {
    await render();
    const range = container.querySelector('input')!;
    await act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(range, '2250');
      range.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(props.onTimeChange).toHaveBeenCalledExactlyOnceWith(2250);
  });
  it.each(['pointerup', 'pointercancel', 'blur', 'visibilitychange'])('invariant_%s_outside_the_range_commits_the_final_visible_time_once', async (type) => {
    props.playing = true;
    props.onScrubStart = vi.fn();
    await render();
    const range = container.querySelector('input')!;
    const capture = vi.fn();
    range.setPointerCapture = capture;
    await act(() => {
      range.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7, button: 0 }));
      range.value = '1250';
      range.dispatchEvent(new Event('input', { bubbles: true }));
      expect(props.onTimeChange).not.toHaveBeenCalled();
      range.value = '1500';
      if (type === 'visibilitychange') {
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        document.dispatchEvent(new Event(type));
        Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      } else window.dispatchEvent(type === 'blur' ? new Event(type) : new PointerEvent(type, { pointerId: 7 }));
      range.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7 }));
    });
    expect(capture).not.toHaveBeenCalled();
    expect(props.onTimeChange).toHaveBeenCalledExactlyOnceWith(1500);
    expect(props.onTimePreview).toHaveBeenCalledExactlyOnceWith(1500);
  });
  it('invariant_other_pointer_endings_cannot_commit_the_active_scrub', async () => {
    await render();
    const range = container.querySelector('input')!;
    await act(() => {
      range.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7, button: 0 }));
      range.value = '1250';
      range.dispatchEvent(new Event('input', { bubbles: true }));
      window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 8 }));
      window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 8 }));
    });
    expect(props.onTimeChange).not.toHaveBeenCalled();
    await act(() => window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7 })));
    expect(props.onTimeChange).toHaveBeenCalledExactlyOnceWith(1250);
  });
  it('invariant_an_unchanged_outside_release_does_not_leave_the_next_scrub_armed', async () => {
    props.playing = true;
    props.onScrubStart = vi.fn();
    await render();
    const range = container.querySelector('input')!;
    await act(() => {
      range.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7, button: 0 }));
      window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7 }));
    });
    expect(props.onTimeChange).not.toHaveBeenCalled();
    await act(() => {
      range.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 8, button: 0 }));
      range.value = '500';
      range.dispatchEvent(new Event('input', { bubbles: true }));
      expect(range.dataset.canvasPreviewPending).toBe('true');
      window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 8 }));
    });
    expect(props.onScrubStart).toHaveBeenCalledTimes(2);
    expect(props.onTimeChange).toHaveBeenCalledExactlyOnceWith(500);
    expect(range.hasAttribute('data-canvas-preview-pending')).toBe(false);
  });
  it('invariant_unmount_removes_scrub_listeners_and_discards_uncommitted_callbacks', async () => {
    await render();
    const range = container.querySelector('input')!;
    await act(() => {
      range.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7, button: 0 }));
      range.value = '1250';
      range.dispatchEvent(new Event('input', { bubbles: true }));
      root.render(null);
    });
    await act(() => {
      window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7 }));
      window.dispatchEvent(new Event('blur'));
      vi.advanceTimersByTime(100);
    });
    expect(props.onTimeChange).not.toHaveBeenCalled();
    expect(props.onTimePreview).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('resynchronizes a paused API seek even when its time prop is unchanged', async () => {
    props.playing = true;
    await render();
    await act(() => vi.advanceTimersByTime(120));
    expect(Number(container.querySelector('input')?.value)).toBeGreaterThan(0);
    props.playing = false;
    await render();
    expect(container.querySelector('input')?.value).toBe('0');
    expect(container.textContent).toContain('0.00s');
    await act(() => button('Next shader frame (1/60 second)').click());
    expect(props.onTimeChange).toHaveBeenLastCalledWith(1000 / 60);
  });
  it('does not offer false time seeking for a live fluid simulation', async () => {
    props.canSeek = false;
    props.capabilities = getShaderMotionCapabilities('pavel-fluid-energy');
    await render();
    expect(container.querySelector('input')?.disabled).toBe(true);
    expect(container.querySelector('input')?.getAttribute('aria-description')).toContain('timestamps cannot reconstruct');
    expect(button('Next shader frame (1/60 second)').disabled).toBe(true);
    expect(button('Capture shader frame').disabled).toBe(false);
    expect(button('Start new fluid motion')).not.toBeNull();
    await act(() => button('Capture shader frame').click());
    expect(props.onCapture).toHaveBeenCalledTimes(1);
  });
});
