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
    expect(container.querySelector('input')?.max).toBe('60000');
    await act(() => button('Extend shader exploration by 30 seconds').click());
    expect(container.querySelector('input')?.max).toBe('90000');
    expect(container.textContent).not.toContain('29.99s');
  });
  it('previews drag changes once per animation frame and commits the final exact time', async () => {
    props.playing = true;
    props.onScrubStart = vi.fn();
    await render();
    const range = container.querySelector('input')!;
    await act(() => {
      for (const value of ['1600', '2200', '2500']) {
        range.value = value;
        range.dispatchEvent(new Event('input', { bubbles: true }));
      }
      range.dispatchEvent(new Event('pointerup', { bubbles: true }));
    });
    expect(props.onScrubStart).toHaveBeenCalledTimes(1);
    expect(props.onFreeze).not.toHaveBeenCalled();
    expect(props.onTimePreview).toHaveBeenCalledTimes(1);
    expect(props.onTimeChange).toHaveBeenLastCalledWith(2500);
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
