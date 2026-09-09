// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AnimationCanvasSelection from '@/components/AnimationCanvasSelection';

describe('Animation canvas selection presentation', () => {
  let container: HTMLDivElement;
  let root: Root;
  let currentMsRef: { current: number };
  let listeners: Set<(timeMs: number) => void>;
  let subscribeToPlayhead: (listener: (timeMs: number) => void) => () => void;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    currentMsRef = { current: 0 };
    listeners = new Set();
    subscribeToPlayhead = (listener) => {
      listeners.add(listener);
      listener(currentMsRef.current);
      return () => { listeners.delete(listener); };
    };
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(() => root.unmount());
    expect(listeners.size).toBe(0);
    container.remove();
    vi.unstubAllGlobals();
  });

  async function render({ active = true, isPlaying = false, selectedIndex = 0, viewportVisible = true } = {}) {
    await act(() => root.render(
      <AnimationCanvasSelection
        active={active}
        currentMsRef={currentMsRef}
        holdMs={1000}
        isPlaying={isPlaying}
        itemCount={2}
        selectedIndex={selectedIndex}
        subscribeToPlayhead={subscribeToPlayhead}
        transitionMs={500}
        viewportVisible={viewportVisible}
      >
        <div data-selection='true'>Selected frame controls</div>
      </AnimationCanvasSelection>
    ));
  }

  async function seek(timeMs: number) {
    await act(() => {
      currentMsRef.current = timeMs;
      for (const listener of listeners) listener(timeMs);
    });
  }

  it('shows the paused selected frame without remounting its controls during its hold', async () => {
    await render();
    const selection = container.firstElementChild;
    expect(selection).not.toBeNull();
    await seek(500);
    expect(container.firstElementChild).toBe(selection);
  });

  it('never mounts initial selection controls during autoplay', async () => {
    await render({ isPlaying: true });
    expect(container.firstElementChild).toBeNull();
    expect(listeners.size).toBe(0);
  });

  it('removes controls immediately on playback and does not resubscribe per frame', async () => {
    await render();
    expect(listeners.size).toBe(1);
    await render({ isPlaying: true });
    expect(container.firstElementChild).toBeNull();
    expect(listeners.size).toBe(0);
    await seek(1800);
    await render();
    expect(container.firstElementChild).toBeNull();
  });

  it('hides the retained selection in transitions and other scenes, restoring it only at its hold', async () => {
    await render();
    await seek(1000);
    expect(container.firstElementChild).toBeNull();
    await seek(1500);
    expect(container.firstElementChild).toBeNull();
    await seek(0);
    expect(container.firstElementChild).not.toBeNull();
  });

  it.each(['active', 'viewportVisible'] as const)('hides a retained editor when %s is false and unsubscribes until visible', async (gate) => {
    await render();
    await render({ [gate]: false });
    expect(container.firstElementChild).toBeNull();
    expect(listeners.size).toBe(0);
    await render();
    expect(container.firstElementChild).not.toBeNull();
    expect(listeners.size).toBe(1);
  });

  it('follows explicit scene selection without displaying a previous scene box', async () => {
    await render({ selectedIndex: 1 });
    expect(container.firstElementChild).toBeNull();
    await seek(1500);
    expect(container.firstElementChild).not.toBeNull();
    await render({ selectedIndex: 0 });
    expect(container.firstElementChild).toBeNull();
  });

  it('does not expose a missing source selection', async () => {
    await render({ selectedIndex: -1 });
    expect(container.firstElementChild).toBeNull();
    expect(listeners.size).toBe(0);
  });
});
