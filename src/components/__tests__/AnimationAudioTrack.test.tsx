// @vitest-environment happy-dom

import { act, createRef, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createDefaultAnimationAudioState,
  DEFAULT_ANIMATION_AUDIO_CLIP_ID,
} from '@/lib/animationAudio';

vi.mock('gt-next', () => ({
  T: ({ children }: { children: ReactNode }) => children,
  useGT: () => (message: string) => message,
  useLocale: () => 'en-US',
  useVersionId: () => 'test',
}));

import AnimationAudioTrack from '@/components/AnimationAudioTrack';

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);

function changeRange(input: HTMLInputElement | null, value: string) {
  if (!input) return;
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  valueSetter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('AnimationAudioTrack', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.replaceChildren();
  });

  it('starts collapsed and reveals the complete editor on demand', () => {
    const onSelectedClipChange = vi.fn();
    act(() => root.render(
      <AnimationAudioTrack
        audio={createDefaultAnimationAudioState()}
        onClipChange={vi.fn()}
        onFiles={vi.fn()}
        onMutedChange={vi.fn()}
        onPlayheadKeyDown={vi.fn()}
        onPlayheadPointerCancel={vi.fn()}
        onPlayheadPointerDown={vi.fn()}
        onPlayheadPointerMove={vi.fn()}
        onPlayheadPointerUp={vi.fn()}
        onRemoveClip={vi.fn()}
        onSelectedClipChange={onSelectedClipChange}
        onSplitClip={vi.fn()}
        onVolumeChange={vi.fn()}
        playheadMs={0}
        playheadRef={createRef<HTMLDivElement>()}
        selectedClipId={null}
        segmentCount={7}
        totalMs={9_660}
      />
    ));

    const disclosure = container.querySelector<HTMLButtonElement>('[aria-expanded]');
    expect(disclosure?.textContent).toContain('Audio');
    expect(disclosure?.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('.animation-audio-lane')).toBeNull();

    act(() => disclosure?.click());
    expect(disclosure?.getAttribute('aria-expanded')).toBe('true');
    expect(onSelectedClipChange).toHaveBeenCalledWith(DEFAULT_ANIMATION_AUDIO_CLIP_ID);
    expect(container.querySelector('.animation-audio-lane')).not.toBeNull();
    expect(container.querySelector('.animation-audio-playhead')).not.toBeNull();
    expect(container.querySelector('.animation-audio-track')?.firstElementChild).toBe(
      container.querySelector('.animation-audio-lane')
    );
    expect(container.textContent).toContain('Add audio');
    expect(container.querySelectorAll('.animation-audio-lane-guides i')).toHaveLength(8);
    expect(container.querySelector('[data-selected="true"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Selected audio clip volume"]')).not.toBeNull();

    act(() => disclosure?.click());
    expect(disclosure?.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('.animation-audio-lane')).toBeNull();
  });

  it('exposes working master and per-clip sound-level controls', () => {
    const onClipChange = vi.fn();
    const onVolumeChange = vi.fn();
    act(() => root.render(
      <AnimationAudioTrack
        audio={{ ...createDefaultAnimationAudioState(), volume: 0.72 }}
        onClipChange={onClipChange}
        onFiles={vi.fn()}
        onMutedChange={vi.fn()}
        onPlayheadKeyDown={vi.fn()}
        onPlayheadPointerCancel={vi.fn()}
        onPlayheadPointerDown={vi.fn()}
        onPlayheadPointerMove={vi.fn()}
        onPlayheadPointerUp={vi.fn()}
        onRemoveClip={vi.fn()}
        onSelectedClipChange={vi.fn()}
        onSplitClip={vi.fn()}
        onVolumeChange={onVolumeChange}
        playheadMs={5_215}
        playheadRef={createRef<HTMLDivElement>()}
        selectedClipId={DEFAULT_ANIMATION_AUDIO_CLIP_ID}
        segmentCount={7}
        totalMs={10_430}
      />
    ));

    act(() => container.querySelector<HTMLButtonElement>('[aria-expanded]')?.click());
    const master = container.querySelector<HTMLInputElement>('[aria-label="Master audio volume"]');
    const clip = container.querySelector<HTMLInputElement>('[aria-label="Selected audio clip volume"]');
    const audioPlayhead = container.querySelector<HTMLElement>('[aria-label="Audio track playhead"]');

    expect(master?.type).toBe('range');
    expect(master?.value).toBe('0.72');
    expect(master?.getAttribute('aria-valuetext')).toBe('72%');
    expect(master?.closest('label')?.textContent).toContain('72%');
    expect(clip?.type).toBe('range');
    expect(clip?.getAttribute('aria-valuetext')).toBe('100%');
    expect(clip?.closest('label')?.textContent).toContain('100%');
    expect(audioPlayhead?.getAttribute('role')).toBe('slider');
    expect(audioPlayhead?.getAttribute('aria-valuenow')).toBe('5215');

    act(() => {
      changeRange(master, '0.35');
    });
    expect(onVolumeChange).toHaveBeenCalledWith(0.35);

    act(() => {
      changeRange(clip, '0.48');
    });
    expect(onClipChange).toHaveBeenCalledWith(DEFAULT_ANIMATION_AUDIO_CLIP_ID, { volume: 0.48 });
  });
});
