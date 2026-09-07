// @vitest-environment happy-dom

import { act, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useViewportActivity } from '@/hooks/useViewportActivity';

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);

function ViewportRanges() {
  const host = useRef<HTMLDivElement>(null);
  const near = useViewportActivity(host, { respectDocumentVisibility: false, rootMargin: '960px' });
  const active = useViewportActivity(host, { rootMargin: '96px' });
  return <div data-active={String(active)} data-near={String(near)} ref={host} />;
}

describe('useViewportActivity', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let visibility: DocumentVisibilityState;
  let observers: Map<string, IntersectionObserverCallback>;

  function intersect(margin: string, isIntersecting: boolean) {
    const callback = observers.get(margin);
    if (!callback) throw new Error(`Missing ${margin} observer`);
    act(() => callback([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver));
  }

  function showDocument(next: DocumentVisibilityState) {
    act(() => {
      visibility = next;
      document.dispatchEvent(new Event('visibilitychange'));
    });
  }

  function ranges() {
    return container.firstElementChild as HTMLElement;
  }

  beforeEach(() => {
    visibility = 'visible';
    observers = new Map();
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit) {
        observers.set(options.rootMargin!, callback);
      }
      observe() {}
      disconnect() {}
    });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('retains geometric mount range across tab visibility changes while default activity pauses', () => {
    act(() => root.render(<ViewportRanges />));
    intersect('960px', true);
    intersect('96px', true);
    expect(ranges().dataset).toMatchObject({ active: 'true', near: 'true' });

    showDocument('hidden');
    expect(ranges().dataset).toMatchObject({ active: 'false', near: 'true' });
    showDocument('visible');
    expect(ranges().dataset).toMatchObject({ active: 'true', near: 'true' });
  });

  it('still evicts by actual geometry while hidden and does not reactivate an offscreen host on return', () => {
    act(() => root.render(<ViewportRanges />));
    intersect('960px', true);
    intersect('96px', true);
    showDocument('hidden');
    intersect('960px', false);
    intersect('96px', false);
    expect(ranges().dataset).toMatchObject({ active: 'false', near: 'false' });

    showDocument('visible');
    expect(ranges().dataset).toMatchObject({ active: 'false', near: 'false' });
    intersect('960px', true);
    expect(ranges().dataset).toMatchObject({ active: 'false', near: 'true' });
  });

  it('can prepare a geometric-only range in a hidden document without starting its animation', () => {
    visibility = 'hidden';
    act(() => root.render(<ViewportRanges />));
    intersect('960px', true);
    intersect('96px', true);
    expect(ranges().dataset).toMatchObject({ active: 'false', near: 'true' });
  });
});
