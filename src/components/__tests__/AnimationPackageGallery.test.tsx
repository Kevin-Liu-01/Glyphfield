// @vitest-environment happy-dom

import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AnimationPackagePreview } from '@/components/AnimationPackageGallery';
import { renderFrame } from '@/lib/renderFrame';
import { DEFAULT_SETTINGS } from '@/lib/studio';

vi.mock('gt-next', () => ({ T: ({ children }: { children: ReactNode }) => children }));
vi.mock('@/lib/renderFrame', () => ({ renderFrame: vi.fn() }));

describe('Animation package preview activity', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let intersection: IntersectionObserverCallback;
  let mutations: { callback: MutationCallback; targets: Map<Node, MutationObserverInit> }[];
  let frames: Map<number, FrameRequestCallback>;
  let visibility: DocumentVisibilityState;
  let timestamp = 0;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    frames = new Map();
    mutations = [];
    visibility = 'visible';
    let frameId = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.set(++frameId, callback);
      return frameId;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ clearRect: vi.fn() } as unknown as CanvasRenderingContext2D);
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) { intersection = callback; }
      observe() {}
      disconnect() {}
    });
    vi.stubGlobal('MutationObserver', class {
      record: typeof mutations[number];
      constructor(callback: MutationCallback) {
        this.record = { callback, targets: new Map() };
        mutations.push(this.record);
      }
      observe(target: Node, options: MutationObserverInit) { this.record.targets.set(target, options); }
      disconnect() { this.record.targets.clear(); }
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

  function render({ animate = true, projectActive = true, toolActive = true } = {}) {
    act(() => root.render(
      <div className='studio-project-workspace-layer' data-active={String(projectActive)}>
        <div className='studio-workspace-panel'>
          <div className='studio-workspace-layer' data-active={String(toolActive)}>
            <AnimationPackagePreview animate={animate} packageId='morph-fade' settings={DEFAULT_SETTINGS} />
          </div>
        </div>
      </div>
    ));
  }

  function intersect(isIntersecting: boolean) {
    act(() => intersection([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver));
  }

  function setLayerActive(selector: string, active: boolean) {
    const target = container.querySelector(selector)!;
    act(() => {
      target.setAttribute('data-active', String(active));
      for (const { callback, targets } of mutations) {
        const options = targets.get(target);
        if (options?.attributes && (!options.attributeFilter || options.attributeFilter.includes('data-active'))) {
          callback([], {} as MutationObserver);
        }
      }
    });
  }

  function advanceFrame() {
    timestamp += 100;
    act(() => {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback(timestamp));
    });
  }

  it('stops hidden retained-project preview work even when geometry remains intersecting, then resumes', () => {
    render();
    intersect(true);
    advanceFrame();
    expect(renderFrame).toHaveBeenCalledTimes(2);
    setLayerActive('.studio-project-workspace-layer', false);
    advanceFrame();
    expect(renderFrame).toHaveBeenCalledTimes(2);
    expect(frames.size).toBe(0);
    setLayerActive('.studio-project-workspace-layer', true);
    expect(renderFrame).toHaveBeenCalledTimes(3);
    advanceFrame();
    expect(renderFrame).toHaveBeenCalledTimes(4);
  });

  it('does not activate an inactive retained tool and resumes without a new intersection event', () => {
    render({ toolActive: false });
    intersect(true);
    expect(renderFrame).not.toHaveBeenCalled();
    expect(frames.size).toBe(0);
    setLayerActive('.studio-workspace-layer', true);
    expect(renderFrame).toHaveBeenCalledTimes(1);
    expect(frames.size).toBe(1);
    setLayerActive('.studio-workspace-layer', false);
    expect(frames.size).toBe(0);
  });

  it('unsubscribes while the document is hidden and does not restart an offscreen preview', () => {
    render();
    intersect(true);
    act(() => {
      visibility = 'hidden';
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(frames.size).toBe(0);
    intersect(false);
    act(() => {
      visibility = 'visible';
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(frames.size).toBe(0);
    expect(renderFrame).toHaveBeenCalledTimes(1);
  });

  it('keeps static previews static and cleans up the last shared animation subscriber', () => {
    render({ animate: false });
    intersect(true);
    expect(renderFrame).toHaveBeenCalledTimes(1);
    expect(frames.size).toBe(0);
    render();
    expect(frames.size).toBe(1);
    act(() => root.unmount());
    expect(frames.size).toBe(0);
    root = createRoot(container);
  });
});
