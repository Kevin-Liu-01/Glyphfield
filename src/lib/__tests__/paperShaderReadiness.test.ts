// @vitest-environment happy-dom

import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { observePaperShaderReadiness } from '@/lib/paperShaderReadiness';

describe('Paper first-draw readiness', () => {
  let surface: HTMLDivElement & { paperShaderMount?: unknown };
  let onResize: () => void;
  let onMutation: () => void;
  let disconnectResize: ReturnType<typeof vi.fn>;
  let disconnectMutation: ReturnType<typeof vi.fn>;
  let frames: Map<number, FrameRequestCallback>;
  let dispose: (() => void) | undefined;

  beforeEach(() => {
    surface = document.body.appendChild(document.createElement('div'));
    frames = new Map();
    let nextFrame = 0;
    disconnectResize = vi.fn();
    disconnectMutation = vi.fn();
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) { onResize = callback; }
      observe = vi.fn();
      disconnect = disconnectResize;
    });
    vi.stubGlobal('MutationObserver', class {
      constructor(callback: () => void) { onMutation = callback; }
      observe = vi.fn();
      disconnect = disconnectMutation;
    });
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => { frames.delete(id); });
  });

  afterEach(() => {
    dispose?.();
    dispose = undefined;
    surface.remove();
    vi.unstubAllGlobals();
  });

  function flushFrames() {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((callback) => callback(16));
  }

  function installNativeCanvas() {
    const canvas = surface.appendChild(document.createElement('canvas'));
    surface.paperShaderMount = {};
    onMutation();
    return canvas;
  }

  it('waits for the asynchronous native canvas, its layout, and its first draw', () => {
    const ready = vi.fn();
    dispose = observePaperShaderReadiness(surface, ready);
    expect(frames.size).toBe(0);
    installNativeCanvas();
    expect(frames.size).toBe(0);
    expect(ready).not.toHaveBeenCalled();
    onResize();
    expect(ready).not.toHaveBeenCalled();
    expect(frames.size).toBe(1);
    flushFrames();
    expect(ready).toHaveBeenCalledOnce();
    expect(disconnectMutation).toHaveBeenCalledOnce();
    expect(disconnectResize).toHaveBeenCalled();
    onResize();
    expect(frames.size).toBe(0);
  });

  it('does not mistake a zero-sized native canvas for drawable output', () => {
    const ready = vi.fn();
    dispose = observePaperShaderReadiness(surface, ready);
    const canvas = installNativeCanvas();
    canvas.width = 0;
    onResize();
    flushFrames();
    expect(ready).not.toHaveBeenCalled();
    canvas.width = 640;
    onResize();
    flushFrames();
    expect(ready).toHaveBeenCalledOnce();
  });

  it('never resets readiness or resamples when uniforms and frame values change', () => {
    const ready = vi.fn();
    dispose = observePaperShaderReadiness(surface, ready);
    const canvas = installNativeCanvas();
    onResize();
    flushFrames();
    canvas.width = 320;
    onMutation();
    onResize();
    expect(frames.size).toBe(0);
    expect(ready).toHaveBeenCalledOnce();
  });

  it('cancels a pending readiness frame when the surface unmounts', () => {
    const ready = vi.fn();
    dispose = observePaperShaderReadiness(surface, ready);
    installNativeCanvas();
    onResize();
    dispose();
    flushFrames();
    expect(ready).not.toHaveBeenCalled();
    expect(frames.size).toBe(0);
    expect(disconnectMutation).toHaveBeenCalled();
  });

  it('does not fade an authentic canvas after readiness has exposed its pixels', () => {
    const styles = readFileSync('src/app/globals.css', 'utf8');
    expect(styles).not.toContain('live-material-canvas-ready');
    expect(styles).toContain('[data-live-material-surface]:has([data-live-material-ready=');
  });
});
