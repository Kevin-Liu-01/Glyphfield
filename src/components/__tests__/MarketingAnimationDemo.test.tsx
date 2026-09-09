// @vitest-environment happy-dom
import { act, useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const lifecycle = vi.hoisted(() => ({ mount: vi.fn(), release: vi.fn() }));

vi.mock('@/components/AnimationStudio', () => ({
  default: ({ autoPlay = false, previewFrameRate = 60, viewportVisible = true }: {
    autoPlay?: boolean; previewFrameRate?: number; viewportVisible?: boolean;
  }) => {
    const [playing, setPlaying] = useState(autoPlay);
    const [edits, setEdits] = useState(0);
    useEffect(() => { lifecycle.mount(); return () => { lifecycle.release(); }; }, []);
    return <section data-editor data-ticking={String(viewportVisible && playing)}
      data-playing={String(playing)} data-visible={String(viewportVisible)} data-frame-rate={previewFrameRate}>
      <button data-toggle onClick={() => setPlaying((current) => !current)}>Toggle playback</button>
      <button data-edit onClick={() => setEdits((current) => current + 1)}>Edit demo</button>
      <output>{edits}</output>
    </section>;
  },
}));

vi.mock('next/dynamic', async () => {
  const { default: Live } = await import('../MarketingAnimationStudioLive');
  return { default: () => Live };
});

import MarketingAnimationDemo from '../MarketingAnimationDemo';
import MarketingAnimationStudioLive from '../MarketingAnimationStudioLive';

describe('landing Animation editor loading and visibility', () => {
  let host: HTMLDivElement;
  let root: Root;
  let visibility: DocumentVisibilityState;
  let observers: Map<string, IntersectionObserverCallback>;
  let idle: Map<number, IdleRequestCallback>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.clearAllMocks();
    visibility = 'visible';
    observers = new Map();
    idle = new Map();
    let idleId = 0;
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit) {
        observers.set(options.rootMargin!, callback);
      }
      observe() {}
      disconnect() {}
    });
    vi.stubGlobal('requestIdleCallback', (callback: IdleRequestCallback) => { idle.set(++idleId, callback); return idleId; });
    vi.stubGlobal('cancelIdleCallback', (id: number) => idle.delete(id));
    host = document.body.appendChild(document.createElement('div'));
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const editor = () => host.querySelector<HTMLElement>('[data-editor]');
  const render = (eager = true) => act(() => root.render(<MarketingAnimationDemo eager={eager} />));
  function intersect(margin: string, inRange: boolean) {
    // Older code has no distinct visible range; behavior assertions expose that gap.
    const callback = observers.get(margin);
    if (callback) act(() => callback([{ isIntersecting: inRange } as IntersectionObserverEntry], {} as IntersectionObserver));
  }
  function runIdle() {
    act(() => {
      const callbacks = Array.from(idle.values());
      idle.clear();
      callbacks.forEach((callback) => callback({ didTimeout: false, timeRemaining: () => 40 }));
    });
  }
  function warm() {
    act(() => vi.advanceTimersByTime(4_000));
    runIdle();
  }
  function documentVisibility(next: DocumentVisibilityState) {
    act(() => { visibility = next; document.dispatchEvent(new Event('visibilitychange')); });
  }

  it('mounts the eager hero after its 600ms paint delay and idle opportunity, not a 3.6s gate', () => {
    render();
    expect(editor()).toBeNull();
    act(() => vi.advanceTimersByTime(599));
    runIdle();
    expect(editor()).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    runIdle();
    expect(editor()).not.toBeNull();
    expect(lifecycle.mount).toHaveBeenCalledOnce();
  });

  it('does not mount the editor in the middle of a held pointer gesture', () => {
    render();
    act(() => window.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 12 })));
    warm();
    expect(editor()).toBeNull();
    expect(idle.size).toBe(0);
    act(() => window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 12 })));
    act(() => vi.advanceTimersByTime(600));
    runIdle();
    expect(editor()).not.toBeNull();
  });

  it('keeps a far-away uneager editor unloaded and prewarms nearby without playing offscreen', () => {
    render(false);
    warm();
    expect(editor()).toBeNull();
    intersect('420px', true);
    warm();
    expect(editor()?.dataset.visible).toBe('false');
    expect(editor()?.dataset.ticking).toBe('false');
    expect(editor()?.dataset.playing).toBe('true');
    intersect('0px', true);
    expect(editor()?.dataset.ticking).toBe('true');
  });

  it('retains one prepared editor and user edits across hidden tabs and far-away scrolls', () => {
    render();
    intersect('420px', true);
    intersect('0px', true);
    warm();
    const original = editor();
    act(() => host.querySelector<HTMLButtonElement>('[data-edit]')!.click());
    documentVisibility('hidden');
    expect(editor()).toBe(original);
    expect(editor()?.dataset.ticking).toBe('false');
    documentVisibility('visible');
    expect(editor()?.dataset.ticking).toBe('true');
    intersect('0px', false);
    intersect('420px', false);
    expect(editor()).toBe(original);
    expect(editor()?.dataset.ticking).toBe('false');
    expect(host.querySelector('output')?.textContent).toBe('1');
    intersect('420px', true);
    intersect('0px', true);
    expect(editor()).toBe(original);
    expect(editor()?.dataset.ticking).toBe('true');
    expect(lifecycle.mount).toHaveBeenCalledOnce();
    expect(lifecycle.release).not.toHaveBeenCalled();
    expect(idle.size).toBe(0);
  });

  it('does not turn a user-paused demo back on when it reappears', () => {
    render();
    intersect('420px', true);
    intersect('0px', true);
    warm();
    const original = editor();
    act(() => host.querySelector<HTMLButtonElement>('[data-toggle]')!.click());
    intersect('0px', false);
    intersect('420px', false);
    intersect('420px', true);
    intersect('0px', true);
    warm();
    expect(editor()).toBe(original);
    expect(editor()?.dataset.playing).toBe('false');
    expect(editor()?.dataset.ticking).toBe('false');
  });

  it('forwards visibility-only suspension and retains the native 60fps preview default', () => {
    act(() => root.render(<MarketingAnimationStudioLive viewportVisible={false} />));
    expect(editor()?.dataset.visible).toBe('false');
    expect(editor()?.dataset.playing).toBe('true');
    expect(editor()?.dataset.frameRate).toBe('60');
  });
});
