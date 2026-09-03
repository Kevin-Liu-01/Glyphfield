// @vitest-environment happy-dom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDefaultAnimationAudioState } from '@/lib/animationAudio';

vi.mock('gt-next', () => ({
  T: ({ children }: { children: ReactNode }) => children,
  useGT: () => (message: string) => message,
}));

import AnimationAudioTrack from '@/components/AnimationAudioTrack';

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);

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
    act(() => root.render(
      <AnimationAudioTrack
        audio={createDefaultAnimationAudioState()}
        onClipChange={vi.fn()}
        onFiles={vi.fn()}
        onMutedChange={vi.fn()}
        onRemoveClip={vi.fn()}
        onSelectedClipChange={vi.fn()}
        onSplitClip={vi.fn()}
        onVolumeChange={vi.fn()}
        selectedClipId={null}
        totalMs={9_660}
      />
    ));

    const disclosure = container.querySelector<HTMLButtonElement>('[aria-expanded]');
    expect(disclosure?.textContent).toContain('Audio');
    expect(disclosure?.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('.animation-audio-lane')).toBeNull();

    act(() => disclosure?.click());
    expect(disclosure?.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('.animation-audio-lane')).not.toBeNull();
    expect(container.textContent).toContain('Add audio');

    act(() => disclosure?.click());
    expect(disclosure?.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('.animation-audio-lane')).toBeNull();
  });
});
