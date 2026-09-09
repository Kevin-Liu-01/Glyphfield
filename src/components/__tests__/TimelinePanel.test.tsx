// @vitest-environment happy-dom
import { act, type ComponentProps, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyAnimationAudioState } from '@/lib/animationAudio';
import { DEFAULT_SETTINGS } from '@/lib/studio';

vi.mock('gt-next', () => ({ T: ({ children }: { children: ReactNode }) => children,
  useGT: () => (message: string) => message, useLocale: () => 'en-US', useVersionId: () => 'test' }));
import TimelinePanel from '@/components/TimelinePanel';

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);

describe('Animation export playback lock', () => {
  let container: HTMLDivElement;
  let root: Root;
  let props: ComponentProps<typeof TimelinePanel>;
  beforeEach(() => {
    container = document.createElement('div'); document.body.append(container);
    root = createRoot(container);
    props = { audio: createEmptyAnimationAudioState(), currentMsRef: { current: 500 }, isPlaying: false,
      onAudioClipChange: vi.fn(), onAudioFiles: vi.fn(), onAudioMutedChange: vi.fn(), onAudioRemoveClip: vi.fn(),
      onAudioSelectedClipChange: vi.fn(), onAudioSplitClip: vi.fn(), onAudioVolumeChange: vi.fn(),
      onPlayChange: vi.fn(), onRateChange: vi.fn(), onSeek: vi.fn(), onSelectSource: vi.fn(),
      onSelectTransition: vi.fn(), playbackRate: 1, previewSources: [], selectedAudioClipId: null,
      selectedSourceId: null, selectedTransitionIndex: null, settings: { ...DEFAULT_SETTINGS, fps: 10 },
      subscribeToPlayhead: () => () => {}, sources: [], totalMs: 1000, transitionSettings: [] };
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); });

  it('disables native controls and ignores custom playhead keys without moving the visible clock', () => {
    act(() => root.render(<TimelinePanel {...props} disabled />));
    const play = container.querySelector<HTMLButtonElement>('[aria-label="Play preview"]')!;
    const range = container.querySelector<HTMLInputElement>('[aria-label="Timeline playhead"]')!;
    const handle = container.querySelector<HTMLElement>('[aria-label="Storyboard playhead"]')!;
    expect(play.disabled).toBe(true);
    expect(range.disabled).toBe(true);
    expect(handle.getAttribute('aria-disabled')).toBe('true');
    act(() => { play.click(); handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })); });
    expect(props.onPlayChange).not.toHaveBeenCalled();
    expect(props.onSeek).not.toHaveBeenCalled();
    expect(range.value).toBe('500');
    act(() => root.render(<TimelinePanel {...props} disabled={false} />));
    act(() => handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })));
    expect(props.onSeek).toHaveBeenLastCalledWith(1000);
    act(() => play.click());
    expect(props.onPlayChange).toHaveBeenLastCalledWith(true);
  });

  it('does not apply a previously queued pointer sample after export locks playback', () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => { frames.push(callback); return frames.length; });
    act(() => root.render(<TimelinePanel {...props} />));
    const handle = container.querySelector<HTMLElement>('[aria-label="Storyboard playhead"]')!;
    handle.setPointerCapture = vi.fn(); handle.hasPointerCapture = () => false;
    act(() => handle.dispatchEvent(new PointerEvent('pointerdown', { button: 0, pointerId: 1, clientX: 10, bubbles: true })));
    act(() => handle.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 80, bubbles: true })));
    const before = vi.mocked(props.onSeek).mock.calls.length;
    expect(before).toBeGreaterThan(0);
    act(() => root.render(<TimelinePanel {...props} disabled />));
    act(() => frames.splice(0).forEach((callback) => callback(50)));
    expect(props.onSeek).toHaveBeenCalledTimes(before);
  });
});
