// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createShaderDiagnostics, readShaderDiagnostics } from '@/lib/shaderDiagnostics';
import { createShaderGpuTimer } from '@/lib/shaderGpuTimer';

function mockGpu(webgl2 = false) {
  let available = false;
  let disjoint = false;
  let busy = false;
  const pending = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    pending.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => pending.delete(id));
  const extension = {
    CURRENT_QUERY_EXT: 1, GPU_DISJOINT_EXT: 2, QUERY_RESULT_AVAILABLE_EXT: 3,
    QUERY_RESULT_EXT: 4, TIME_ELAPSED_EXT: 5,
    beginQueryEXT: vi.fn(), createQueryEXT: vi.fn(() => ({})), deleteQueryEXT: vi.fn(),
    endQueryEXT: vi.fn(), getQueryEXT: vi.fn(() => busy ? {} : null),
    getQueryObjectEXT: vi.fn((_query: unknown, parameter: number) => parameter === 3 ? available : 2_500_000),
  };
  const gl = {
    getExtension: vi.fn(() => extension), getParameter: vi.fn(() => disjoint),
    isContextLost: vi.fn(() => false),
    ...(webgl2 ? {
      CURRENT_QUERY: 1, QUERY_RESULT_AVAILABLE: 3, QUERY_RESULT: 4,
      beginQuery: extension.beginQueryEXT, createQuery: extension.createQueryEXT,
      deleteQuery: extension.deleteQueryEXT, endQuery: extension.endQueryEXT,
      getQuery: extension.getQueryEXT, getQueryParameter: extension.getQueryObjectEXT,
    } : {}),
  } as unknown as WebGLRenderingContext;
  return {
    extension, gl, pending,
    available() { available = true; },
    busy() { busy = true; },
    disjoint() { disjoint = true; },
    paint() {
      const callbacks = [...pending.values()];
      pending.clear();
      callbacks.forEach((callback) => callback(16));
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('opt-in shader diagnostics', () => {
  it('does no context, clock or scheduled work when disabled', () => {
    const gpu = mockGpu();
    const now = vi.fn(() => 0);
    expect(createShaderDiagnostics({ canvas: document.createElement('canvas'), enabled: false, gl: gpu.gl, now, provider: 'test' })).toBeNull();
    expect(now).not.toHaveBeenCalled();
    expect(gpu.gl.getExtension).not.toHaveBeenCalled();
    expect(gpu.pending.size).toBe(0);
  });

  it('keeps CPU submission, callback cadence, compile calls and readiness separate', () => {
    const root = document.createElement('div');
    const canvas = root.appendChild(document.createElement('canvas'));
    let time = 0;
    const diagnostic = createShaderDiagnostics({ canvas, enabled: true, now: () => time, provider: '2d' })!;
    diagnostic.measureCompilation(() => { time = 5; });
    diagnostic.measureFrame(() => { time = 8; }, 16);
    diagnostic.markReady();
    diagnostic.measureFrame(() => { time = 10; }, 32);
    expect(diagnostic.read()).toMatchObject({
      compilationCpuMs: { count: 1, mean: 5 },
      frameCallbackCpuMs: { count: 2, mean: 2.5 },
      frameCallbackIntervalMs: { count: 1, mean: 16 },
      gpu: { status: 'unsupported', frameMs: { count: 0, mean: null } },
      readinessMs: 8,
    });
    expect(readShaderDiagnostics(root)[0]!.timingStatus).toBe('instrumented');
    diagnostic.dispose();
    expect(readShaderDiagnostics(root)[0]!.timing).toBeNull();
  });

  it.each([false, true])('reads asynchronous real GPU query values with WebGL2=%s', (webgl2) => {
    const gpu = mockGpu(webgl2);
    const timer = createShaderGpuTimer(gpu.gl);
    expect(timer.begin()).toBe(true);
    timer.end();
    gpu.paint();
    expect(timer.read().milliseconds).toEqual([]);
    expect(gpu.extension.getQueryObjectEXT).not.toHaveBeenCalledWith(expect.anything(), 4);
    gpu.available();
    gpu.paint();
    expect(timer.read().milliseconds).toEqual([2.5]);
    expect(gpu.pending.size).toBe(0);
    timer.dispose();
  });

  it('discards disjoint GPU results rather than reporting fake timings', () => {
    const gpu = mockGpu();
    const timer = createShaderGpuTimer(gpu.gl);
    timer.begin(); timer.end();
    gpu.available(); gpu.disjoint(); gpu.paint();
    expect(timer.read()).toMatchObject({ discardedDisjoint: 1, milliseconds: [], pending: 0 });
    timer.dispose();
  });

  it('does not nest timer queries owned by another profiler', () => {
    const gpu = mockGpu();
    gpu.busy();
    const timer = createShaderGpuTimer(gpu.gl);
    expect(timer.begin()).toBe(false);
    timer.end();
    expect(gpu.extension.beginQueryEXT).not.toHaveBeenCalled();
    expect(gpu.extension.endQueryEXT).not.toHaveBeenCalled();
    expect(timer.read().skippedBusy).toBe(1);
    timer.dispose();
  });

  it('expires unresolved queries and releases pending work on disposal', () => {
    const gpu = mockGpu();
    let time = 0;
    const timer = createShaderGpuTimer(gpu.gl, () => time);
    timer.begin(); timer.end();
    time = 2_001;
    gpu.paint();
    expect(timer.read().discardedExpired).toBe(1);
    timer.begin(); timer.end();
    timer.dispose();
    expect(gpu.pending.size).toBe(0);
    expect(gpu.extension.deleteQueryEXT).toHaveBeenCalledTimes(2);
  });

  it('closes the GPU query even if the draw callback throws', () => {
    const gpu = mockGpu();
    const diagnostic = createShaderDiagnostics({ canvas: document.createElement('canvas'), enabled: true, gl: gpu.gl, provider: 'test' })!;
    expect(() => diagnostic.measureFrame(() => { throw new Error('draw failed'); })).toThrow('draw failed');
    expect(gpu.extension.endQueryEXT).toHaveBeenCalledTimes(1);
    diagnostic.dispose();
    expect(gpu.pending.size).toBe(0);
  });
});
