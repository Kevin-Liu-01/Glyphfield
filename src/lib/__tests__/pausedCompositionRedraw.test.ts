// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { observePausedCompositionReadiness } from '../pausedCompositionRedraw';

describe('paused shader composition readiness redraw', () => {
  let root: HTMLDivElement;
  let callbacks: Map<number, FrameRequestCallback>;
  const cleanups: Array<() => void> = [];
  beforeEach(() => {
    root = document.createElement('div');
    document.body.append(root);
    callbacks = new Map();
    let nextId = 0;
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      callbacks.set(++nextId, callback);
      return nextId;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => { callbacks.delete(id); }));
  });
  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
    root.remove();
    vi.unstubAllGlobals();
  });
  function flushFrame() {
    const queued = [...callbacks.values()];
    callbacks.clear();
    queued.forEach((callback) => callback(100));
  }
  async function flushMutations() { await new Promise((resolve) => setTimeout(resolve, 0)); }
  function observe(draw = vi.fn()) {
    const watcher = observePausedCompositionReadiness(root, draw);
    cleanups.push(watcher.disconnect);
    return { ...watcher, draw };
  }

  it('waits for a decoded captured frame, then redraws the paused converter without polling', async () => {
    root.innerHTML = '<div data-live-material-ready="false" data-shader-frame-ready="false"><img data-shader-frame-image /></div>';
    const { draw } = observe();
    flushFrame();
    expect(draw).not.toHaveBeenCalled();
    expect(callbacks.size).toBe(0);
    root.querySelector('img')!.dispatchEvent(new Event('load'));
    flushFrame();
    expect(draw).not.toHaveBeenCalled();
    root.firstElementChild!.setAttribute('data-live-material-ready', 'true');
    root.firstElementChild!.setAttribute('data-shader-frame-ready', 'true');
    await flushMutations();
    expect(callbacks.size).toBe(1);
    flushFrame();
    expect(draw).toHaveBeenCalledTimes(1);
    expect(callbacks.size).toBe(0);
  });

  it('does not paint a deferred skeleton and redraws when the native renderer replaces it', async () => {
    root.innerHTML = '<span data-shader-skeleton="loading"></span>';
    const { draw } = observe();
    flushFrame();
    expect(draw).not.toHaveBeenCalled();
    root.innerHTML = '<div data-live-material-ready="true"><canvas></canvas></div>';
    await flushMutations();
    flushFrame();
    expect(draw).toHaveBeenCalledTimes(1);
  });

  it('coalesces native and image readiness bursts and ignores unrelated canvas mutations', async () => {
    root.innerHTML = '<div data-live-material-ready="true"><canvas></canvas><img /></div>';
    const { draw, request } = observe();
    request();
    root.querySelector('img')!.dispatchEvent(new Event('load'));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(callbacks.size).toBe(1);
    flushFrame();
    root.querySelector('canvas')!.width = 640;
    root.querySelector('canvas')!.style.opacity = '0.5';
    await flushMutations();
    expect(callbacks.size).toBe(0);
    expect(draw).toHaveBeenCalledTimes(1);
  });

  it('retains the last complete effect while one of multiple shader sources reloads', async () => {
    root.innerHTML = '<div data-live-material-ready="true"></div><div data-live-material-ready="false"></div>';
    const { draw } = observe();
    flushFrame();
    expect(draw).not.toHaveBeenCalled();
    root.children[1]!.setAttribute('data-live-material-ready', 'error');
    await flushMutations();
    flushFrame();
    expect(draw).not.toHaveBeenCalled();
    root.children[1]!.setAttribute('data-live-material-ready', 'true');
    await flushMutations();
    flushFrame();
    expect(draw).toHaveBeenCalledTimes(1);
  });

  it('redraws after a captured shader publishes a painted control preview', async () => {
    root.innerHTML = '<div data-live-material-ready="true" data-shader-frame-preview-revision="0"></div>';
    const { draw } = observe();
    flushFrame();
    root.firstElementChild!.setAttribute('data-shader-frame-preview-revision', '1');
    await flushMutations();
    flushFrame();
    expect(draw).toHaveBeenCalledTimes(2);
    expect(callbacks.size).toBe(0);
  });

  it('redraws direct native paused previews after the provider publishes painted pixels', async () => {
    root.innerHTML = '<div data-live-material-ready="true"><canvas data-live-material-preview-revision="0"></canvas></div>';
    const { draw } = observe();
    flushFrame();
    root.querySelector('canvas')!.setAttribute('data-live-material-preview-revision', '1');
    root.querySelector('canvas')!.setAttribute('data-live-material-preview-revision', '2');
    await flushMutations();
    expect(callbacks.size).toBe(1);
    flushFrame();
    expect(draw).toHaveBeenCalledTimes(2);
    expect(callbacks.size).toBe(0);
  });

  it('cancels queued work and all readiness subscriptions when leaving the paused design', async () => {
    const { disconnect, draw, request } = observe();
    expect(callbacks.size).toBe(1);
    disconnect();
    root.innerHTML = '<canvas data-live-material-ready="true"></canvas>';
    root.dispatchEvent(new Event('load'));
    document.dispatchEvent(new Event('visibilitychange'));
    request();
    await flushMutations();
    flushFrame();
    expect(draw).not.toHaveBeenCalled();
    expect(callbacks.size).toBe(0);
  });
});
