// @vitest-environment happy-dom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ShaderFrameHistoryControl } from '@/components/ShaderLabStudio';

vi.mock('gt-next', () => ({
  T: ({ children }: { children: ReactNode }) => children,
  useGT: () => (message: string) => message,
}));

describe('Design Lab motion timeline', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onFramePreview = vi.fn();
  const onPauseAtFrame = vi.fn();
  const onScrub = vi.fn();
  const onScrubPreview = vi.fn();

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
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  async function render(frame = 0, playing = false, durationMs = 4_000) {
    await act(() => root.render(<ShaderFrameHistoryControl
      durationMs={durationMs}
      fps={60}
      frame={frame}
      onFramePreview={onFramePreview}
      onPauseAtFrame={onPauseAtFrame}
      onPlay={vi.fn()}
      onScrub={onScrub}
      onScrubPreview={onScrubPreview}
      playing={playing}
    />));
  }

  it('reserves both number columns for the total frame count before playback grows a digit', async () => {
    await render(15);
    const output = container.querySelector('output')!;
    expect(output.style.getPropertyValue('--shader-frame-digits')).toBe('3ch');
    expect([...output.children].map((node) => node.textContent)).toEqual(['16', '/', '240']);
    await render(239);
    expect(output.style.getPropertyValue('--shader-frame-digits')).toBe('3ch');
    expect([...output.children].map((node) => node.textContent)).toEqual(['240', '/', '240']);
    await render(0, false, 30_000);
    expect(output.style.getPropertyValue('--shader-frame-digits')).toBe('4ch');
  });

  it('preserves the complete scrub range and commits the final frame on release', async () => {
    await render();
    const range = container.querySelector('input')!;
    expect(range.min).toBe('0');
    expect(range.max).toBe('239');
    await act(() => {
      range.value = range.max;
      range.dispatchEvent(new Event('input', { bubbles: true }));
      range.dispatchEvent(new Event('pointerup', { bubbles: true }));
    });
    expect(onFramePreview).toHaveBeenLastCalledWith(239);
    expect(onScrubPreview).toHaveBeenLastCalledWith(239);
    expect(onScrub).toHaveBeenLastCalledWith(239);
    expect(container.querySelector('output strong')?.textContent).toBe('240');
  });
});
