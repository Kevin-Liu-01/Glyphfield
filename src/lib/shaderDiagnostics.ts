import { createShaderGpuTimer, type ShaderGpuTiming } from './shaderGpuTimer';

type GL = WebGLRenderingContext | WebGL2RenderingContext;
const diagnosticsByCanvas = new WeakMap<HTMLCanvasElement, ShaderDiagnostics>();

export interface ShaderDiagnosticSummary {
  count: number;
  max: number | null;
  mean: number | null;
  p95: number | null;
}

export function summarizeShaderSamples(values: readonly number[]): ShaderDiagnosticSummary {
  const sorted = values.filter((value) => Number.isFinite(value) && value >= 0).toSorted((a, b) => a - b);
  return {
    count: sorted.length,
    max: sorted.at(-1) ?? null,
    mean: sorted.length ? sorted.reduce((sum, value) => sum + value, 0) / sorted.length : null,
    p95: sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? null,
  };
}

export interface ShaderDiagnosticReport {
  provider: string;
  readinessMs: number | null;
  compilationCpuMs: ShaderDiagnosticSummary;
  frameCallbackCpuMs: ShaderDiagnosticSummary;
  frameCallbackIntervalMs: ShaderDiagnosticSummary;
  gpu: Omit<ShaderGpuTiming, 'milliseconds'> & { frameMs: ShaderDiagnosticSummary };
}

export interface ShaderDiagnostics {
  markReady: () => void;
  measureCompilation: <T>(compile: () => T) => T;
  measureFrame: <T>(draw: () => T, timestamp?: number) => T;
  read: () => ShaderDiagnosticReport;
  dispose: () => void;
}

/** No extension checks, clock reads, arrays, observers or rAFs when disabled. */
export function createShaderDiagnostics({
  canvas, enabled, gl, now = () => performance.now(), provider,
}: {
  canvas: HTMLCanvasElement;
  enabled: boolean;
  gl?: GL;
  now?: () => number;
  provider: string;
}): ShaderDiagnostics | null {
  if (!enabled) return null;
  const startedAt = now();
  const gpu = gl ? createShaderGpuTimer(gl, now) : null;
  const compilation: number[] = [];
  const cpu: number[] = [];
  const intervals: number[] = [];
  let readinessMs: number | null = null;
  let previousFrame: number | null = null;
  function append(samples: number[], value: number) {
    samples.push(value);
    if (samples.length > 240) samples.shift();
  }
  const diagnostics: ShaderDiagnostics = {
    markReady() { readinessMs ??= now() - startedAt; },
    measureCompilation(compile) {
      const start = now();
      try { return compile(); } finally { append(compilation, now() - start); }
    },
    measureFrame(draw, timestamp = now()) {
      if (previousFrame !== null) append(intervals, timestamp - previousFrame);
      previousFrame = timestamp;
      const startedGpuQuery = gpu?.begin();
      const start = now();
      try { return draw(); } finally {
        append(cpu, now() - start);
        if (startedGpuQuery) gpu?.end();
      }
    },
    read() {
      const timing = gpu?.read() ?? {
        discardedDisjoint: 0, discardedExpired: 0, milliseconds: [], pending: 0,
        skippedBusy: 0, status: 'unsupported' as const,
      };
      const { milliseconds, ...gpuStatus } = timing;
      return {
        compilationCpuMs: summarizeShaderSamples(compilation),
        frameCallbackCpuMs: summarizeShaderSamples(cpu),
        frameCallbackIntervalMs: summarizeShaderSamples(intervals),
        gpu: { ...gpuStatus, frameMs: summarizeShaderSamples(milliseconds) },
        provider,
        readinessMs,
      };
    },
    dispose() {
      gpu?.dispose();
      if (diagnosticsByCanvas.get(canvas) === diagnostics) diagnosticsByCanvas.delete(canvas);
    },
  };
  diagnosticsByCanvas.set(canvas, diagnostics);
  return diagnostics;
}

/** Native provider callbacks are deliberately not mislabeled as GPU timing. */
export function readShaderDiagnostics(root: HTMLElement) {
  return Array.from(root.querySelectorAll('canvas'), (canvas) => ({
    height: canvas.height,
    timing: diagnosticsByCanvas.get(canvas)?.read() ?? null,
    timingStatus: diagnosticsByCanvas.has(canvas) ? 'instrumented' : 'uninstrumented',
    width: canvas.width,
  }));
}
