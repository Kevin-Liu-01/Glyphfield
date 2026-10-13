'use client';

import dynamic from 'next/dynamic';

import type { PaperShaderElement, ShaderComponentProps } from '@paper-design/shaders-react';
import PaperShaderRendererBoundary from '@/components/PaperShaderRendererBoundary';
import { readPaperShaderRenderer } from '@/components/paperShaderRegistry';
import type { PaperShaderRenderer } from '@/components/paperShaderRenderer';
import {
  Component,
  createElement,
  useCallback,
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react';

import type { RefObject } from 'react';

import { useCommittedRef } from '@/hooks/useCommittedRef';
import { useAncestorWorkspaceActivity } from '@/hooks/useAncestorWorkspaceActivity';
import { useMountEffect } from '@/hooks/useMountEffect';
import { observePaperShaderReadiness } from '@/lib/paperShaderReadiness';
import { resolvePaperShaderFrame } from '@/lib/paperShaderTime';
import {
  getPaperLiveMaterialDefinition,
  isPaperLiveMaterialId,
  liveMaterialMotionRate,
  liveMaterialMotionTimeMs,
  normalizeLiveMaterialId,
  type LiveMaterialId,
  type LiveMaterialSettings,
  type PaperLiveMaterialId,
  type PaperShaderFamilyId,
} from '@/lib/liveMaterials';
import {
  LIVE_MATERIAL_PATTERN_SCALE_PREVIEW_EVENT,
  LIVE_MATERIAL_SETTINGS_PREVIEW_EVENT,
  LIVE_MATERIAL_TIME_PREVIEW_EVENT,
  normalizeLiveMaterialFrameState,
  registerLiveMaterialRuntime,
  type LiveMaterialFrameState,
  type LiveMaterialPatternScalePreview,
  type LiveMaterialSettingsPreview,
  type LiveMaterialTimePreview,
} from '@/lib/liveMaterialPreview';
import { resolveLiveMaterialPixelRatio } from '@/lib/liveMaterialRenderBudget';
import { createLiveMaterialFrameLoop } from '@/lib/liveMaterialFrameLoop';
import { createLiveMaterialClock, liveMaterialFramePointer, shouldAdvanceLiveFluid } from '@/lib/liveMaterialClock';
import { createLiveMaterialPreviewSignal, hasUncommittedShaderPreview } from '@/lib/liveMaterialPreview';
import { createShaderDiagnostics } from '@/lib/shaderDiagnostics';
import { PAPER_MATERIAL_GRAIN_IMAGE, PAPER_MATERIAL_GRAIN_TILE_SIZE } from '@/lib/shaderFramePresentation';
import { drawCanvasGlyph } from '@/lib/canvasDrawing';
import { liveMaterialReadinessStatus, shouldMountLiveMaterial } from '@/lib/liveMaterialReadiness';
import { clampShaderZoom, interpolateShaderZoom } from '@/lib/shaderZoom';
import {
  paperControlOverrides,
  paperPaletteOverrides,
  paperShaderFilter,
  paperShaderGrainOpacity,
  resolvePaperShaderScale,
} from '@/lib/paperShaderControls';
import {
  browserSupportsWebGL2,
  cancelWebGLContextRelease,
  scheduleWebGLContextRelease,
} from '@/lib/webglContext';

const ShaderEffectsSurface = dynamic(() => import('./ShaderEffectsSurface'), { ssr: false, loading: () => <div data-live-material-ready='false'><ShaderSkeleton /></div> });

const SHADER_ZOOM_RESPONSE_MS = 45;
const PAPER_PREVIEW_FRAME_RATE = 30;
const WEBGL_PREVIEW_FRAME_RATE = 60;

function usePaintedLiveMaterialPreview(surface: RefObject<HTMLElement | null>) {
  const signal = useRef<ReturnType<typeof createLiveMaterialPreviewSignal> | undefined>(undefined);
  useMountEffect(() => {
    if (!surface.current) return;
    const current = createLiveMaterialPreviewSignal(surface.current);
    signal.current = current;
    return () => { signal.current = undefined; current.dispose(); };
  });
  return useCallback(() => signal.current?.publish(), []);
}

function useSmoothedShaderZoom(target: number, immediate = false): number {
  const boundedTarget = clampShaderZoom(target);
  const currentZoomRef = useRef(boundedTarget);
  const targetZoomRef = useRef(boundedTarget);
  const animationFrameRef = useRef(0);
  const [renderedZoom, setRenderedZoom] = useState(boundedTarget);

  useEffect(() => {
    targetZoomRef.current = boundedTarget;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (immediate || reduceMotion) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = 0;
      currentZoomRef.current = boundedTarget;
      setRenderedZoom(boundedTarget);
      return;
    }

    let previousTime = performance.now();
    const tick = (now: number) => {
      const elapsed = Math.min(48, Math.max(0, now - previousTime));
      previousTime = now;
      const targetLog = Math.log10(targetZoomRef.current);
      const interpolatedZoom = interpolateShaderZoom(
        currentZoomRef.current,
        targetZoomRef.current,
        elapsed,
        SHADER_ZOOM_RESPONSE_MS
      );
      const settled = Math.abs(targetLog - Math.log10(interpolatedZoom)) < 0.002;
      const nextZoom = settled ? targetZoomRef.current : interpolatedZoom;
      currentZoomRef.current = nextZoom;
      setRenderedZoom(nextZoom);
      if (settled) {
        animationFrameRef.current = 0;
        return;
      }
      animationFrameRef.current = requestAnimationFrame(tick);
    };

    cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = 0;
    };
  }, [boundedTarget, immediate]);

  useEffect(() => () => cancelAnimationFrame(animationFrameRef.current), []);
  return renderedZoom;
}
import ShaderSkeleton from '@/components/ShaderSkeleton';
import { shaderColor, type Vec3 } from '@/lib/materialColor';
import {
  FLUID_ADVECTION_SOURCE,
  FLUID_CLEAR_SOURCE,
  FLUID_CURL_SOURCE,
  FLUID_DISPLAY_SOURCE,
  FLUID_DIVERGENCE_SOURCE,
  FLUID_EMIT_SOURCE,
  FLUID_EMITTER_COUNT,
  FLUID_GRADIENT_SOURCE,
  FLUID_PRESSURE_SOURCE,
  FLUID_VERTEX_SOURCE,
  FLUID_VORTICITY_SOURCE,
  fluidEmitters,
} from '@/lib/fluidSimulationShaders';
import { isOriginalMaterialId, ORIGINAL_VERTEX_SOURCE, originalFragmentSource } from '@/lib/originalMaterialShaders';

const ShaderGradientSurface = dynamic(() => import('./ShaderGradientSurface'), {
  loading: () => <div data-live-material-ready='false'><ShaderSkeleton /></div>,
  ssr: false,
});

export type LiveMaterialCanvasProps = {
  activeWhileMounted?: boolean;
  className?: string;
  captureTimeMs?: number | null;
  diagnostics?: boolean;
  enabled?: boolean;
  frameRate?: number;
  frameState?: LiveMaterialFrameState;
  loopDurationMs?: number;
  materialId: LiveMaterialId;
  maxPixelCount?: number;
  paperShaderOverrides?: Readonly<Record<string, unknown>>;
  patternScale?: number;
  paused?: boolean;
  preservePresetAppearance?: boolean;
  preservePresetGeometry?: boolean;
  previewChannel?: string;
  previewGroup?: string;
  renderScale?: number;
  settings: LiveMaterialSettings;
  sourceImage?: string;
  sourceImageOpacity?: number;
};

type WebglLiveMaterialCanvasProps = {
  active: boolean;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  captureTimeMs: number | null;
  diagnostics?: boolean;
  frameRate: number;
  frameState?: LiveMaterialFrameState;
  maxPixelCount?: number;
  onContextLost: () => void;
  patternScale: number;
  paused: boolean;
  renderScale: number;
  settings: LiveMaterialSettings;
};

function useLiveMaterialInvalidation({
  active, captureTimeMs, frameRate, frameState, maxPixelCount, patternScale, paused, renderScale, settings,
}: Omit<WebglLiveMaterialCanvasProps, 'canvasRef' | 'onContextLost'>) {
  const invalidateRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    invalidateRef.current?.();
  }, [active, captureTimeMs, frameRate, frameState, maxPixelCount, patternScale, paused, renderScale, settings]);
  return invalidateRef;
}

function requestMaterialContextRecovery(canvas: HTMLCanvasElement, recover: () => void, delayMs = 120) {
  canvas.dataset.liveMaterialReady = 'error';
  return window.setTimeout(recover, delayMs);
}

function useWebglLiveMaterialRefs({ active, captureTimeMs, frameRate, patternScale, paused, settings }: Omit<WebglLiveMaterialCanvasProps, 'canvasRef' | 'onContextLost' | 'renderScale'>) {
  return {
    activeRef: useCommittedRef(active),
    captureTimeRef: useCommittedRef(captureTimeMs),
    frameRateRef: useCommittedRef(frameRate),
    patternScaleRef: useCommittedRef(patternScale),
    pausedRef: useCommittedRef(paused),
    settingsRef: useCommittedRef(settings),
  };
}

type PropBoundPreview<T, Base = T> = {
  base: Base;
  value: T;
};

function resolvePropBoundPreview<T, Base>(
  preview: PropBoundPreview<T, Base> | null,
  base: Base,
  fallback: T
): T {
  return preview?.base === base ? preview.value : fallback;
}

function resolveLiveSettingsPreview(
  preview: PropBoundPreview<Partial<LiveMaterialSettings>, LiveMaterialSettings> | null,
  settings: LiveMaterialSettings
): LiveMaterialSettings {
  if (preview?.base !== settings) return settings;
  return { ...settings, ...preview.value };
}

function currentContextRecovery(
  recovery: { failed: boolean; materialId: LiveMaterialId; version: number },
  materialId: LiveMaterialId
) {
  if (recovery.materialId === materialId) return recovery;
  return { failed: false, materialId, version: 0 };
}

function materialRequiresWebGL2(materialId: LiveMaterialId): boolean {
  return materialId === 'shadergradient-prismatic-sphere'
    || materialId === 'pavel-fluid-energy'
    || isPaperLiveMaterialId(materialId)
    || isOriginalMaterialId(materialId);
}

function paperMaterialUsesSourceImage(materialId: LiveMaterialId): boolean {
  if (!isPaperLiveMaterialId(materialId)) return false;
  const definition = getPaperLiveMaterialDefinition(materialId);
  return PAPER_IMAGE_SHADER_FAMILIES.has(definition.family)
    && !PAPER_PROCEDURAL_BACKDROP_FAMILIES.has(definition.family);
}

const CONTEXT_RECOVERY_DELAY_MS = 350;
const CONTEXT_RECOVERY_COOLDOWN_MS = 2_500;
const WEBGL_SUPPORT_RETRY_MS = 2_500;

function hexToRgb(hex: string): readonly [number, number, number] {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return [
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  ];
}

function cssRgb(
  color: readonly [number, number, number],
  opacity: number
): string {
  return `rgb(${Math.round(color[0] * 255)} ${Math.round(color[1] * 255)} ${Math.round(color[2] * 255)} / ${Math.max(0, Math.min(1, opacity))})`;
}

function blendRgb(
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  progress: number
): readonly [number, number, number] {
  const amount = Math.max(0, Math.min(1, progress));
  return [
    from[0] + (to[0] - from[0]) * amount,
    from[1] + (to[1] - from[1]) * amount,
    from[2] + (to[2] - from[2]) * amount,
  ];
}

function isGlyphFieldCell(x: number, y: number): boolean {
  const ring = Math.hypot(x, y) > 0.45 && Math.hypot(x, y) < 0.88;
  const opening = x > 0.18 && Math.abs(y) < 0.32;
  const crossbar = x > 0.08 && x < 0.82 && y > -0.08 && y < 0.18;
  return (ring && !opening) || crossbar;
}

function GlyphFieldCanvas({
  active,
  canvasRef,
  captureTimeMs,
  diagnostics: diagnosticsEnabled = false,
  frameRate,
  frameState,
  maxPixelCount,
  patternScale,
  paused,
  renderScale,
  settings,
}: {
  active: boolean;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  captureTimeMs: number | null;
  diagnostics?: boolean;
  frameRate: number;
  frameState?: LiveMaterialFrameState;
  maxPixelCount?: number;
  patternScale: number;
  paused: boolean;
  renderScale: number;
  settings: LiveMaterialSettings;
}) {
  const activeRef = useCommittedRef(active);
  const frameStateRef = useCommittedRef(frameState);
  const captureTimeRef = useCommittedRef(captureTimeMs);
  const frameRateRef = useCommittedRef(frameRate);
  const maxPixelCountRef = useCommittedRef(maxPixelCount);
  const patternScaleRef = useCommittedRef(patternScale);
  const pausedRef = useCommittedRef(paused);
  const settingsRef = useCommittedRef(settings);
  const renderScaleRef = useCommittedRef(renderScale);
  const invalidateRef = useLiveMaterialInvalidation({
    active, captureTimeMs, frameRate, frameState, maxPixelCount, patternScale, paused, renderScale, settings,
  });

  useMountEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d', { alpha: false });
    if (!canvas) return;
    if (!context) {
      canvas.dataset.liveMaterialReady = 'error';
      return;
    }
    const drawingCanvas: HTMLCanvasElement = canvas;
    const drawingContext: CanvasRenderingContext2D = context;
    const diagnostics = createShaderDiagnostics({ canvas, enabled: diagnosticsEnabled, provider: 'glyphfield-canvas2d' });

    const glyphs = 'GLYPHFIELD';
    let didRender = false;
    const clock = createLiveMaterialClock('canvas2d', 'glyphfield-glyph-field');

    function draw(time: number) {
      if (clock.frozen) return;
      const current = settingsRef.current;
      const renderedTime = clock.draw({ now: time, active: activeRef.current || captureTimeRef.current !== null,
        paused: pausedRef.current, captureTimeMs: captureTimeRef.current,
        rate: liveMaterialMotionRate(current.speed), frameState: frameStateRef.current }) / 1000;
      if (!activeRef.current && captureTimeRef.current === null) return;
      const width = Math.max(1, drawingCanvas.clientWidth);
      const height = Math.max(1, drawingCanvas.clientHeight);
      const pixelRatio = resolveLiveMaterialPixelRatio({
        cssHeight: height,
        cssWidth: width,
        devicePixelRatio: window.devicePixelRatio || 1,
        maxDevicePixelRatio: 2.5,
        maxPixelCount: maxPixelCountRef.current,
        renderScale: renderScaleRef.current,
      });
      const outputWidth = Math.round(width * pixelRatio);
      const outputHeight = Math.round(height * pixelRatio);
      if (drawingCanvas.width !== outputWidth || drawingCanvas.height !== outputHeight) {
        drawingCanvas.width = outputWidth;
        drawingCanvas.height = outputHeight;
      }

      drawingContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      const background = hexToRgb(current.colorA);
      const foreground = hexToRgb(current.colorB);
      const accent = hexToRgb(current.colorC);
      // A soft pool of light behind the letterform gives the field depth.
      const backdrop = drawingContext.createRadialGradient(width * 0.5, height * 0.5, 0, width * 0.5, height * 0.5, Math.hypot(width, height) * 0.55);
      backdrop.addColorStop(0, cssRgb(blendRgb(background, foreground, 0.14), 1));
      backdrop.addColorStop(1, cssRgb(blendRgb(background, [0, 0, 0], 0.35), 1));
      drawingContext.fillStyle = backdrop;
      drawingContext.fillRect(0, 0, width, height);
      const columns = Math.round(34 + Math.min(7, current.detail) * 3.2);
      const rows = Math.round(22 + Math.min(7, current.detail) * 2.2);
      const fieldScale = Math.min(width, height) * (0.72 + current.amplitude * 0.025) * patternScaleRef.current;
      const rotation = Math.sin(renderedTime * 0.46) * (0.18 + current.strength * 0.09);
      const cosRotation = Math.cos(rotation);
      const sinRotation = Math.sin(rotation);
      const points: Array<{
        color: readonly [number, number, number];
        glyph: string;
        opacity: number;
        size: number;
        x: number;
        y: number;
        z: number;
      }> = [];

      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const x = (column / (columns - 1)) * 2 - 1;
          const y = (row / (rows - 1)) * 2 - 1;
          const seed = (row * 83 + column * 37) % 101;
          const keep = seed / 100 <= Math.min(1, 0.42 + current.density * 0.68);
          if (!isGlyphFieldCell(x, y) || !keep) continue;

          const wave = Math.sin(x * current.frequency + renderedTime * 1.2)
            * Math.cos(y * (current.frequency * 0.7) - renderedTime * 0.82);
          const depth = wave * (0.12 + current.strength * 0.18)
            + Math.sin((x + y) * current.detail + seed) * 0.035;
          const rotatedX = x * cosRotation + depth * sinRotation;
          const rotatedZ = -x * sinRotation + depth * cosRotation;
          const perspective = 1 / (1.8 - rotatedZ * 0.42);
          const screenX = width * 0.5 + rotatedX * fieldScale * perspective;
          const screenY = height * 0.5 + y * fieldScale * perspective;
          const depthProgress = Math.max(0, Math.min(1, 0.5 + rotatedZ * 0.75));
          const baseColor = blendRgb(foreground, accent, depthProgress * depthProgress);
          points.push({
            color: blendRgb(background, baseColor, 0.78 + depthProgress * 0.22),
            glyph: glyphs[(row * 3 + column) % glyphs.length]!,
            opacity: Math.min(1, (0.4 + depthProgress * 0.6) * current.brightness * 1.3),
            size: Math.max(5.5, Math.min(14, fieldScale / columns * 1.05)) * (0.78 + perspective * 0.55),
            x: screenX,
            y: screenY,
            z: rotatedZ,
          });
        }
      }

      points.sort((a, b) => a.z - b.z);
      drawingContext.textAlign = 'center';
      drawingContext.textBaseline = 'middle';
      // One reusable font keeps continuous perspective sizing out of the font
      // parser/cache. The per-glyph transform preserves smooth, unquantized sizes.
      const glyphFontSize = 32;
      drawingContext.font = `500 ${glyphFontSize}px Switzer, Arial, sans-serif`;
      for (const point of points) {
        drawingContext.fillStyle = cssRgb(point.color, point.opacity);
        drawCanvasGlyph(drawingContext, point.glyph, point.x, point.y, point.size / glyphFontSize, pixelRatio);
      }

      // Bloom: a blurred additive copy of the glyphs, where canvas filters exist.
      if ('filter' in drawingContext) {
        drawingContext.save();
        drawingContext.setTransform(1, 0, 0, 1, 0, 0);
        drawingContext.globalCompositeOperation = 'lighter';
        drawingContext.globalAlpha = Math.min(0.85, 0.35 + current.strength * 0.4);
        drawingContext.filter = `blur(${Math.round(Math.max(4, fieldScale / columns * 0.9) * pixelRatio)}px)`;
        drawingContext.drawImage(drawingCanvas, 0, 0);
        drawingContext.restore();
      }

      const particleCount = Math.round(28 + current.grain * 0.72);
      for (let index = 0; index < particleCount; index += 1) {
        const phase = index * 29.17;
        const particleX = ((Math.sin(phase * 12.9898) * 43758.5453) % 1 + 1) % 1;
        const particleY = ((Math.sin(phase * 78.233) * 15731.743) % 1 + 1) % 1;
        const drift = Math.sin(renderedTime * 0.3 + phase) * 18;
        const color = blendRgb(foreground, accent, index % 5 / 4);
        drawingContext.fillStyle = cssRgb(color, 0.1 + (index % 7) * 0.018);
        drawCanvasGlyph(
          drawingContext, glyphs[index % glyphs.length]!,
          particleX * width + drift, particleY * height,
          (5 + (index % 4)) / glyphFontSize, pixelRatio
        );
      }
      if (!didRender) {
        didRender = true;
        drawingCanvas.dataset.liveMaterialReady = 'true';
        diagnostics?.markReady();
      }
    }

    const loop = createLiveMaterialFrameLoop({
      draw: diagnostics ? (time) => diagnostics.measureFrame(() => draw(time), time) : draw,
      frameRate: () => frameRateRef.current,
      isAnimating: () => !clock.frozen && activeRef.current && !pausedRef.current && captureTimeRef.current === null,
    });
    const unregister = registerLiveMaterialRuntime(drawingCanvas, {
      readFrame: (timeline) => didRender ? clock.read(timeline) : undefined,
      freeze: clock.freeze,
      redraw: loop.invalidate,
      resume: () => { clock.resume(); loop.invalidate(); },
    });
    invalidateRef.current = loop.invalidate;
    const resizeObserver = new ResizeObserver(loop.invalidate);
    resizeObserver.observe(drawingCanvas);
    loop.invalidate();
    return () => {
      unregister();
      invalidateRef.current = null;
      resizeObserver.disconnect();
      loop.dispose();
      diagnostics?.dispose();
    };
  });

  return <canvas className='absolute inset-0 size-full' data-live-material-ready='false' ref={canvasRef} />;
}

function compileShader(
  context: WebGLRenderingContext | WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader {
  const shader = context.createShader(type);
  if (!shader) throw new Error('Shader allocation failed');
  context.shaderSource(shader, source);
  context.compileShader(shader);
  if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
    const message = context.getShaderInfoLog(shader)?.trim()
      || (context.isContextLost()
        ? 'WebGL context lost during shader compilation'
        : 'Shader compilation failed');
    context.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

class WebGLProviderBoundary extends Component<{
  children: ReactNode;
  fallback: ReactNode;
  onFailure: () => void;
}, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    this.props.onFailure();
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function ProviderContextGuard({
  children,
  className = '',
  onContextLost,
}: {
  children: ReactNode;
  className?: string;
  onContextLost: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useMountEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observedCanvases = new Set<HTMLCanvasElement>();
    let disposed = false;
    let recoveryRequested = false;
    let recoveryTimer = 0;

    const requestRecovery = () => {
      if (disposed || recoveryRequested) return;
      recoveryRequested = true;
      host.dataset.liveMaterialReady = 'error';
      recoveryTimer = window.setTimeout(onContextLost, 0);
    };
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      requestRecovery();
    };
    const observeCanvases = () => {
      host.querySelectorAll('canvas').forEach((canvas) => {
        if (observedCanvases.has(canvas)) return;
        cancelWebGLContextRelease(canvas);
        observedCanvases.add(canvas);
        canvas.addEventListener('webglcontextlost', handleContextLost);
      });
    };

    observeCanvases();
    const observer = new MutationObserver(observeCanvases);
    observer.observe(host, { childList: true, subtree: true });
    const healthTimer = window.setTimeout(() => {
      const canvas = host.querySelector('canvas');
      if (!canvas || canvas.width < 1 || canvas.height < 1) requestRecovery();
    }, 1200);

    return () => {
      disposed = true;
      observer.disconnect();
      window.clearTimeout(healthTimer);
      window.clearTimeout(recoveryTimer);
      observedCanvases.forEach((canvas) => {
        canvas.removeEventListener('webglcontextlost', handleContextLost);
        // React's development cleanup can run before a lazy provider creates
        // its context. Never accidentally create a non-readable default
        // buffer here: that first getContext call fixes attributes for life.
        const context = canvas.getContext('webgl2', { preserveDrawingBuffer: true })
          ?? canvas.getContext('webgl', { preserveDrawingBuffer: true });
        if (context) scheduleWebGLContextRelease(canvas, context);
      });
    };
  });

  return (
    <div
      className={`absolute inset-0 size-full min-h-0 min-w-0 overflow-hidden ${className}`}
      ref={hostRef}
      style={{ contain: 'strict', isolation: 'isolate' }}
    >
      {children}
    </div>
  );
}

function SourceAssetOverlay({ opacity, source }: { opacity: number; source?: string }) {
  if (!source) return null;
  return (
    <img
      alt=''
      aria-hidden='true'
      className='pointer-events-none absolute inset-0 z-[2] size-full object-cover'
      src={source}
      style={{ mixBlendMode: 'soft-light', opacity: Math.max(0, Math.min(1, opacity / 100)) }}
    />
  );
}

function OriginalMaterialCanvas({
  active,
  canvasRef,
  captureTimeMs,
  diagnostics: diagnosticsEnabled = false,
  frameRate,
  frameState,
  fragmentSource,
  materialId,
  maxPixelCount,
  onContextLost,
  patternScale,
  paused,
  renderScale,
  settings,
}: WebglLiveMaterialCanvasProps & {
  fragmentSource: string;
  materialId: LiveMaterialId;
}) {
  const { activeRef, captureTimeRef, frameRateRef, patternScaleRef, pausedRef, settingsRef } = useWebglLiveMaterialRefs({ active, captureTimeMs, frameRate, patternScale, paused, settings });
  const maxPixelCountRef = useCommittedRef(maxPixelCount);
  const frameStateRef = useCommittedRef(frameState);
  const renderScaleRef = useCommittedRef(renderScale);
  const invalidateRef = useLiveMaterialInvalidation({
    active, captureTimeMs, frameRate, frameState, maxPixelCount, patternScale, paused, renderScale, settings,
  });

  useMountEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: true,
    });
    if (!context) {
      requestMaterialContextRecovery(canvas, onContextLost);
      return;
    }
    const drawingCanvas: HTMLCanvasElement = canvas;
    const drawingContext: WebGL2RenderingContext = context;
    cancelWebGLContextRelease(drawingCanvas);
    const diagnostics = createShaderDiagnostics({ canvas, enabled: diagnosticsEnabled, gl: context, provider: 'original-webgl' });
    const compile = (type: number, source: string) => diagnostics
      ? diagnostics.measureCompilation(() => compileShader(context, type, source))
      : compileShader(context, type, source);

    let vertexShader: WebGLShader;
    let fragmentShader: WebGLShader;
    try {
      vertexShader = compile(context.VERTEX_SHADER, ORIGINAL_VERTEX_SOURCE);
      fragmentShader = compile(context.FRAGMENT_SHADER, fragmentSource);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production' && !context.isContextLost()) console.error(`[${materialId}]`, error);
      diagnostics?.dispose();
      scheduleWebGLContextRelease(drawingCanvas, context);
      requestMaterialContextRecovery(canvas, onContextLost);
      return;
    }
    const program = context.createProgram();
    if (!program) {
      diagnostics?.dispose();
      context.deleteShader(fragmentShader);
      context.deleteShader(vertexShader);
      scheduleWebGLContextRelease(drawingCanvas, context);
      requestMaterialContextRecovery(canvas, onContextLost);
      return;
    }
    context.attachShader(program, vertexShader);
    context.attachShader(program, fragmentShader);
    if (diagnostics) diagnostics.measureCompilation(() => context.linkProgram(program));
    else context.linkProgram(program);
    if (!context.getProgramParameter(program, context.LINK_STATUS)) {
      diagnostics?.dispose();
      context.deleteProgram(program);
      context.deleteShader(fragmentShader);
      context.deleteShader(vertexShader);
      scheduleWebGLContextRelease(drawingCanvas, context);
      requestMaterialContextRecovery(canvas, onContextLost);
      return;
    }
    const buffer = context.createBuffer();
    if (!buffer) {
      diagnostics?.dispose();
      context.deleteProgram(program);
      context.deleteShader(fragmentShader);
      context.deleteShader(vertexShader);
      scheduleWebGLContextRelease(drawingCanvas, context);
      requestMaterialContextRecovery(canvas, onContextLost);
      return;
    }
    context.bindBuffer(context.ARRAY_BUFFER, buffer);
    context.bufferData(
      context.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      context.STATIC_DRAW
    );
    context.useProgram(program);
    const position = context.getAttribLocation(program, 'a_position');
    context.enableVertexAttribArray(position);
    context.vertexAttribPointer(position, 2, context.FLOAT, false, 0, 0);

    const resolutionLocation = context.getUniformLocation(program, 'u_resolution');
    const pointerLocation = context.getUniformLocation(program, 'u_pointer');
    const timeLocation = context.getUniformLocation(program, 'u_time');
    const colorALocation = context.getUniformLocation(program, 'u_color_a');
    const colorBLocation = context.getUniformLocation(program, 'u_color_b');
    const colorCLocation = context.getUniformLocation(program, 'u_color_c');
    const labALocation = context.getUniformLocation(program, 'u_lab_a');
    const labBLocation = context.getUniformLocation(program, 'u_lab_b');
    const labCLocation = context.getUniformLocation(program, 'u_lab_c');
    const strengthLocation = context.getUniformLocation(program, 'u_strength');
    const detailLocation = context.getUniformLocation(program, 'u_detail');
    const frequencyLocation = context.getUniformLocation(program, 'u_frequency');
    const grainLocation = context.getUniformLocation(program, 'u_grain');
    const amplitudeLocation = context.getUniformLocation(program, 'u_amplitude');
    const densityLocation = context.getUniformLocation(program, 'u_density');
    const brightnessLocation = context.getUniformLocation(program, 'u_brightness');
    const rotationLocation = context.getUniformLocation(program, 'u_rotation');
    const scaleLocation = context.getUniformLocation(program, 'u_scale');

    const clock = createLiveMaterialClock('webgl', materialId);
    let disposed = false;
    let pointerSource = frameStateRef.current;
    let savedPointer = liveMaterialFramePointer(pointerSource, materialId);
    const pointer = { x: savedPointer?.x ?? 0.5, y: savedPointer?.y ?? 0.5 };
    let renderedPointer = { ...pointer };
    let didRender = false;

    function handlePointerMove(event: PointerEvent) {
      const bounds = drawingCanvas.getBoundingClientRect();
      if (bounds.width < 1 || bounds.height < 1) return;
      pointer.x = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
      pointer.y = 1 - Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
    }

    function handlePointerLeave() {
      pointer.x = 0.5;
      pointer.y = 0.5;
    }

    function handleContextLost(event: Event) {
      event.preventDefault();
      loop.dispose();
      if (!disposed) requestMaterialContextRecovery(drawingCanvas, onContextLost, 0);
    }

    drawingCanvas.addEventListener('webglcontextlost', handleContextLost);
    drawingCanvas.addEventListener('pointermove', handlePointerMove);
    drawingCanvas.addEventListener('pointerleave', handlePointerLeave);

    function draw(time: number) {
      if (clock.frozen) return;
      const current = settingsRef.current;
      const renderedTime = clock.draw({ now: time, active: activeRef.current || captureTimeRef.current !== null,
        paused: pausedRef.current, captureTimeMs: captureTimeRef.current,
        rate: liveMaterialMotionRate(current.speed), frameState: frameStateRef.current });
      if (!activeRef.current && captureTimeRef.current === null) return;
      const pointerAnchorChanged = pointerSource !== frameStateRef.current;
      if (pointerAnchorChanged) {
        pointerSource = frameStateRef.current;
        savedPointer = liveMaterialFramePointer(pointerSource, materialId);
      }
      if (savedPointer && (pointerAnchorChanged || captureTimeRef.current !== null)) Object.assign(pointer, savedPointer);
      const cssWidth = Math.max(1, drawingCanvas.clientWidth);
      const cssHeight = Math.max(1, drawingCanvas.clientHeight);
      const pixelRatio = resolveLiveMaterialPixelRatio({
        cssHeight,
        cssWidth,
        devicePixelRatio: window.devicePixelRatio || 1,
        maxDevicePixelRatio: 3,
        maxPixelCount: maxPixelCountRef.current,
        renderScale: renderScaleRef.current,
      });
      const width = Math.max(1, Math.round(cssWidth * pixelRatio));
      const height = Math.max(1, Math.round(cssHeight * pixelRatio));
      if (drawingCanvas.width !== width || drawingCanvas.height !== height) {
        drawingCanvas.width = width;
        drawingCanvas.height = height;
      }
      drawingContext.viewport(0, 0, width, height);
      drawingContext.uniform2f(resolutionLocation, width, height);
      drawingContext.uniform2f(pointerLocation, pointer.x, pointer.y);
      drawingContext.uniform1f(timeLocation, renderedTime / 1000);
      const colorA = shaderColor(current.colorA);
      const colorB = shaderColor(current.colorB);
      const colorC = shaderColor(current.colorC);
      drawingContext.uniform3fv(colorALocation, colorA.linear);
      drawingContext.uniform3fv(colorBLocation, colorB.linear);
      drawingContext.uniform3fv(colorCLocation, colorC.linear);
      drawingContext.uniform3fv(labALocation, colorA.lab);
      drawingContext.uniform3fv(labBLocation, colorB.lab);
      drawingContext.uniform3fv(labCLocation, colorC.lab);
      drawingContext.uniform1f(strengthLocation, current.strength);
      drawingContext.uniform1f(detailLocation, current.detail);
      drawingContext.uniform1f(frequencyLocation, current.frequency);
      drawingContext.uniform1f(grainLocation, current.grain);
      drawingContext.uniform1f(amplitudeLocation, current.amplitude);
      drawingContext.uniform1f(densityLocation, current.density);
      drawingContext.uniform1f(brightnessLocation, current.brightness);
      drawingContext.uniform1f(rotationLocation, current.rotationZ);
      drawingContext.uniform1f(scaleLocation, patternScaleRef.current);
      drawingContext.drawArrays(drawingContext.TRIANGLES, 0, 6);
      renderedPointer = { ...pointer };
      if (!didRender) {
        didRender = true;
        drawingCanvas.dataset.liveMaterialReady = 'true';
        diagnostics?.markReady();
      }
    }

    const loop = createLiveMaterialFrameLoop({
      draw: diagnostics ? (time) => diagnostics.measureFrame(() => draw(time), time) : draw,
      frameRate: () => frameRateRef.current,
      isAnimating: () => !clock.frozen && activeRef.current && !pausedRef.current && captureTimeRef.current === null,
    });
    const unregister = registerLiveMaterialRuntime(drawingCanvas, {
      readFrame: (timeline) => didRender && !drawingContext.isContextLost()
        ? { ...clock.read(timeline), pointer: { ...renderedPointer } } : undefined,
      freeze: clock.freeze,
      redraw: loop.invalidate,
      resume: () => { clock.resume(); loop.invalidate(); },
    });
    invalidateRef.current = loop.invalidate;
    const resizeObserver = new ResizeObserver(loop.invalidate);
    resizeObserver.observe(drawingCanvas);
    loop.invalidate();
    return () => {
      unregister();
      disposed = true;
      invalidateRef.current = null;
      resizeObserver.disconnect();
      loop.dispose();
      diagnostics?.dispose();
      drawingCanvas.removeEventListener('webglcontextlost', handleContextLost);
      drawingCanvas.removeEventListener('pointermove', handlePointerMove);
      drawingCanvas.removeEventListener('pointerleave', handlePointerLeave);
      drawingContext.deleteBuffer(buffer);
      drawingContext.deleteProgram(program);
      drawingContext.deleteShader(fragmentShader);
      drawingContext.deleteShader(vertexShader);
      scheduleWebGLContextRelease(drawingCanvas, drawingContext);
    };
  });

  return <canvas className='absolute inset-0 size-full' data-live-material-ready='false' ref={canvasRef} />;
}

type FluidRenderTarget = {
  framebuffer: WebGLFramebuffer;
  height: number;
  texture: WebGLTexture;
  width: number;
};

type FluidTargetPair = { read: FluidRenderTarget; write: FluidRenderTarget };

type FluidSplat = { radius: number; value: Vec3; x: number; y: number };

function scaleVec3(value: Vec3, amount: number): Vec3 {
  return [value[0] * amount, value[1] * amount, value[2] * amount];
}

type FluidProgram = {
  program: WebGLProgram;
  uniform: (name: string) => WebGLUniformLocation | null;
};

const FLUID_PRESSURE_ITERATIONS = 20;
const FLUID_WARMUP_STEPS = 150;

function resizeFluidCanvas(canvas: HTMLCanvasElement, pixelRatio: number) {
  const width = Math.max(1, Math.round(canvas.clientWidth * pixelRatio));
  const height = Math.max(1, Math.round(canvas.clientHeight * pixelRatio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return { height, width };
}

function fitShortSide(width: number, height: number, shortSide: number) {
  const aspect = width / Math.max(1, height);
  return aspect >= 1
    ? { height: shortSide, width: Math.round(shortSide * aspect) }
    : { height: Math.round(shortSide / aspect), width: shortSide };
}

/** Velocity is solved on a coarse grid; dye is advected near output resolution. */
function fluidSimulationDimensions(
  width: number,
  height: number,
  renderScale: number,
  pixelRatio: number,
  detail: number
) {
  const quality = Math.min(1.25, Math.max(0.6, renderScale * Math.sqrt(pixelRatio)));
  const simulationShort = Math.round(Math.min(224, Math.max(96, 96 + detail * 14)) * quality);
  const dyeShort = Math.round(Math.min(1024, Math.max(192, Math.min(width, height))));
  return {
    dye: fitShortSide(width, height, dyeShort),
    simulation: fitShortSide(width, height, simulationShort),
  };
}

function FluidSimulationCanvas({
  active,
  canvasRef,
  captureTimeMs,
  diagnostics: diagnosticsEnabled = false,
  frameRate,
  frameState,
  maxPixelCount,
  onContextLost,
  patternScale,
  paused,
  renderScale,
  settings,
}: WebglLiveMaterialCanvasProps) {
  const { activeRef, captureTimeRef, frameRateRef, patternScaleRef, pausedRef, settingsRef } = useWebglLiveMaterialRefs({ active, captureTimeMs, frameRate, patternScale, paused, settings });
  const maxPixelCountRef = useCommittedRef(maxPixelCount);
  const frameStateRef = useCommittedRef(frameState);
  const renderScaleRef = useCommittedRef(renderScale);
  const invalidateRef = useLiveMaterialInvalidation({
    active, captureTimeMs, frameRate, frameState, maxPixelCount, patternScale, paused, renderScale, settings,
  });

  useMountEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      preserveDrawingBuffer: true,
      premultipliedAlpha: false,
      stencil: false,
    });
    if (!context) {
      requestMaterialContextRecovery(canvas, onContextLost);
      return;
    }
    const drawingCanvas: HTMLCanvasElement = canvas;
    const gl: WebGL2RenderingContext = context;
    cancelWebGLContextRelease(drawingCanvas);
    const diagnostics = createShaderDiagnostics({ canvas, enabled: diagnosticsEnabled, gl, provider: 'fluid-webgl' });
    // Half-float targets keep velocity and dye smooth instead of quantizing to 8 bits.
    const floatRenderable = gl.getExtension('EXT_color_buffer_float') ?? gl.getExtension('EXT_color_buffer_half_float');

    const shaders: WebGLShader[] = [];
    const programs: WebGLProgram[] = [];
    const targets: FluidRenderTarget[] = [];
    let buffer: WebGLBuffer | null = null;
    let vertexArray: WebGLVertexArrayObject | null = null;
    let disposed = false;

    function createProgram(fragmentSource: string): FluidProgram {
      const vertexShader = compileShader(gl, gl.VERTEX_SHADER, FLUID_VERTEX_SOURCE);
      const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
      shaders.push(vertexShader, fragmentShader);
      const program = gl.createProgram();
      if (!program) throw new Error('Fluid program allocation failed');
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.bindAttribLocation(program, 0, 'a_position');
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const message = gl.getProgramInfoLog(program)?.trim() || 'Fluid program linking failed';
        gl.deleteProgram(program);
        throw new Error(message);
      }
      programs.push(program);
      const locations = new Map<string, WebGLUniformLocation | null>();
      return {
        program,
        uniform: (name) => {
          if (!locations.has(name)) locations.set(name, gl.getUniformLocation(program, name));
          return locations.get(name) ?? null;
        },
      };
    }

    function createTarget(width: number, height: number): FluidRenderTarget {
      const texture = gl.createTexture();
      const framebuffer = gl.createFramebuffer();
      if (!texture || !framebuffer) throw new Error('Fluid render target allocation failed');
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        gl.deleteFramebuffer(framebuffer);
        gl.deleteTexture(texture);
        throw new Error('Fluid framebuffer is incomplete');
      }
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      const target = { framebuffer, height, texture, width };
      targets.push(target);
      return target;
    }

    function createPair(width: number, height: number): FluidTargetPair {
      return { read: createTarget(width, height), write: createTarget(width, height) };
    }

    function swap(pair: FluidTargetPair) {
      const previous = pair.read;
      pair.read = pair.write;
      pair.write = previous;
    }

    function deleteTargets() {
      targets.splice(0).forEach((target) => {
        gl.deleteFramebuffer(target.framebuffer);
        gl.deleteTexture(target.texture);
      });
    }

    function beginPass(program: FluidProgram, target: FluidRenderTarget | null, width: number, height: number, texelX: number, texelY: number) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target?.framebuffer ?? null);
      gl.viewport(0, 0, width, height);
      gl.useProgram(program.program);
      gl.uniform2f(program.uniform('u_texel'), texelX, texelY);
    }

    function bindTexture(program: FluidProgram, name: string, target: FluidRenderTarget, unit: number) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, target.texture);
      gl.uniform1i(program.uniform(name), unit);
    }

    function blit() {
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    let curlProgram: FluidProgram;
    let vorticityProgram: FluidProgram;
    let divergenceProgram: FluidProgram;
    let clearProgram: FluidProgram;
    let pressureProgram: FluidProgram;
    let gradientProgram: FluidProgram;
    let advectionProgram: FluidProgram;
    let emitProgram: FluidProgram;
    let displayProgram: FluidProgram;
    const compile = (source: string) => diagnostics
      ? diagnostics.measureCompilation(() => createProgram(source))
      : createProgram(source);
    try {
      if (!floatRenderable) throw new Error('Float render targets are unavailable');
      curlProgram = compile(FLUID_CURL_SOURCE);
      vorticityProgram = compile(FLUID_VORTICITY_SOURCE);
      divergenceProgram = compile(FLUID_DIVERGENCE_SOURCE);
      clearProgram = compile(FLUID_CLEAR_SOURCE);
      pressureProgram = compile(FLUID_PRESSURE_SOURCE);
      gradientProgram = compile(FLUID_GRADIENT_SOURCE);
      advectionProgram = compile(FLUID_ADVECTION_SOURCE);
      emitProgram = compile(FLUID_EMIT_SOURCE);
      displayProgram = compile(FLUID_DISPLAY_SOURCE);
      buffer = gl.createBuffer();
      vertexArray = gl.createVertexArray();
      if (!buffer || !vertexArray) throw new Error('Fluid geometry allocation failed');
      gl.bindVertexArray(vertexArray);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production' && !gl.isContextLost()) console.error('[pavel-fluid-energy]', error);
      diagnostics?.dispose();
      if (buffer) gl.deleteBuffer(buffer);
      if (vertexArray) gl.deleteVertexArray(vertexArray);
      programs.forEach((program) => gl.deleteProgram(program));
      shaders.forEach((shader) => gl.deleteShader(shader));
      deleteTargets();
      scheduleWebGLContextRelease(drawingCanvas, gl);
      requestMaterialContextRecovery(canvas, onContextLost);
      return;
    }

    let velocity: FluidTargetPair | null = null;
    let dye: FluidTargetPair | null = null;
    let pressure: FluidTargetPair | null = null;
    let curl: FluidRenderTarget | null = null;
    let divergence: FluidRenderTarget | null = null;
    const clock = createLiveMaterialClock('fluid', 'pavel-fluid-energy');
    const pointer = { activeUntil: 0, lastX: 0.5, lastY: 0.5, velocityX: 0, velocityY: 0, x: 0.5, y: 0.5 };
    let didRender = false;

    function emit(target: FluidTargetPair, width: number, height: number, points: readonly FluidSplat[]) {
      beginPass(emitProgram, target.write, width, height, 1 / width, 1 / height);
      bindTexture(emitProgram, 'u_target', target.read, 0);
      gl.uniform1f(emitProgram.uniform('u_aspect'), width / height);
      gl.uniform1i(emitProgram.uniform('u_count'), Math.min(FLUID_EMITTER_COUNT, points.length));
      gl.uniform2fv(emitProgram.uniform('u_points'), points.flatMap((point) => [point.x, point.y]));
      gl.uniform3fv(emitProgram.uniform('u_values'), points.flatMap((point) => [...point.value]));
      gl.uniform1fv(emitProgram.uniform('u_radii'), points.map((point) => point.radius));
      blit();
      swap(target);
    }

    function step(dt: number, time: number, current: LiveMaterialSettings, pointerActive: boolean) {
      if (!velocity || !dye || !pressure || !curl || !divergence) return;
      const simulationWidth = velocity.read.width;
      const simulationHeight = velocity.read.height;
      const texelX = 1 / simulationWidth;
      const texelY = 1 / simulationHeight;
      const palette = [shaderColor(current.colorA).linear, shaderColor(current.colorB).linear, shaderColor(current.colorC).linear] as const;
      const radius = 0.0009 + current.amplitude * 0.00024;
      const acceleration = (5 + current.strength * 9) * simulationHeight * dt;
      const dyeRate = (2.4 + current.density * 3) * dt;
      const jets = fluidEmitters(time, current.frequency / patternScaleRef.current);
      const velocityPoints: FluidSplat[] = jets.map((jet) => ({ radius, value: [jet.dx * acceleration, jet.dy * acceleration, 0], x: jet.x, y: jet.y }));
      const dyePoints: FluidSplat[] = jets.map((jet) => ({ radius: radius * 0.8, value: scaleVec3(palette[jet.color], dyeRate), x: jet.x, y: jet.y }));
      if (pointerActive) {
        velocityPoints.push({ radius: radius * 0.7, value: [pointer.velocityX * simulationHeight * 6, pointer.velocityY * simulationHeight * 6, 0], x: pointer.x, y: pointer.y });
        dyePoints.push({ radius: radius * 0.6, value: scaleVec3(palette[2], 0.35), x: pointer.x, y: pointer.y });
      }
      emit(velocity, simulationWidth, simulationHeight, velocityPoints);
      emit(dye, dye.read.width, dye.read.height, dyePoints);

      beginPass(curlProgram, curl, simulationWidth, simulationHeight, texelX, texelY);
      bindTexture(curlProgram, 'u_velocity', velocity.read, 0);
      blit();

      beginPass(vorticityProgram, velocity.write, simulationWidth, simulationHeight, texelX, texelY);
      bindTexture(vorticityProgram, 'u_velocity', velocity.read, 0);
      bindTexture(vorticityProgram, 'u_curl', curl, 1);
      gl.uniform1f(vorticityProgram.uniform('u_curl_strength'), 14 + current.strength * 22);
      gl.uniform1f(vorticityProgram.uniform('u_dt'), dt);
      blit();
      swap(velocity);

      beginPass(divergenceProgram, divergence, simulationWidth, simulationHeight, texelX, texelY);
      bindTexture(divergenceProgram, 'u_velocity', velocity.read, 0);
      blit();

      beginPass(clearProgram, pressure.write, simulationWidth, simulationHeight, texelX, texelY);
      bindTexture(clearProgram, 'u_source', pressure.read, 0);
      gl.uniform1f(clearProgram.uniform('u_value'), 0.8);
      blit();
      swap(pressure);

      for (let iteration = 0; iteration < FLUID_PRESSURE_ITERATIONS; iteration += 1) {
        beginPass(pressureProgram, pressure.write, simulationWidth, simulationHeight, texelX, texelY);
        bindTexture(pressureProgram, 'u_pressure', pressure.read, 0);
        bindTexture(pressureProgram, 'u_divergence', divergence, 1);
        blit();
        swap(pressure);
      }

      beginPass(gradientProgram, velocity.write, simulationWidth, simulationHeight, texelX, texelY);
      bindTexture(gradientProgram, 'u_pressure', pressure.read, 0);
      bindTexture(gradientProgram, 'u_velocity', velocity.read, 1);
      blit();
      swap(velocity);

      beginPass(advectionProgram, velocity.write, simulationWidth, simulationHeight, texelX, texelY);
      bindTexture(advectionProgram, 'u_velocity', velocity.read, 0);
      bindTexture(advectionProgram, 'u_source', velocity.read, 1);
      gl.uniform2f(advectionProgram.uniform('u_velocity_texel'), texelX, texelY);
      gl.uniform1f(advectionProgram.uniform('u_dt'), dt);
      gl.uniform1f(advectionProgram.uniform('u_dissipation'), 0.25);
      gl.uniform1f(advectionProgram.uniform('u_edge_fade'), 0);
      blit();
      swap(velocity);

      beginPass(advectionProgram, dye.write, dye.read.width, dye.read.height, 1 / dye.read.width, 1 / dye.read.height);
      bindTexture(advectionProgram, 'u_velocity', velocity.read, 0);
      bindTexture(advectionProgram, 'u_source', dye.read, 1);
      gl.uniform2f(advectionProgram.uniform('u_velocity_texel'), texelX, texelY);
      gl.uniform1f(advectionProgram.uniform('u_dt'), dt);
      gl.uniform1f(advectionProgram.uniform('u_dissipation'), 2.1 - Math.min(1.5, current.density) * 0.8);
      gl.uniform1f(advectionProgram.uniform('u_edge_fade'), 6);
      blit();
      swap(dye);
    }

    function initializeTargets(width: number, height: number, current: LiveMaterialSettings, time: number) {
      deleteTargets();
      const dimensions = fluidSimulationDimensions(width, height, renderScaleRef.current, 1, current.detail);
      velocity = createPair(dimensions.simulation.width, dimensions.simulation.height);
      pressure = createPair(dimensions.simulation.width, dimensions.simulation.height);
      curl = createTarget(dimensions.simulation.width, dimensions.simulation.height);
      divergence = createTarget(dimensions.simulation.width, dimensions.simulation.height);
      dye = createPair(dimensions.dye.width, dimensions.dye.height);
      // Start from a developed flow so the first presented frame is never empty.
      for (let index = 0; index < FLUID_WARMUP_STEPS; index += 1) {
        step(1 / 60, time - (FLUID_WARMUP_STEPS - index) / 60, current, false);
      }
    }

    function handlePointerMove(event: PointerEvent) {
      const bounds = drawingCanvas.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      const nextX = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
      const nextY = Math.max(0, Math.min(1, 1 - (event.clientY - bounds.top) / bounds.height));
      pointer.velocityX = Math.max(-0.35, Math.min(0.35, (nextX - pointer.lastX) * 2.8));
      pointer.velocityY = Math.max(-0.35, Math.min(0.35, (nextY - pointer.lastY) * 2.8));
      pointer.x = nextX;
      pointer.y = nextY;
      pointer.lastX = nextX;
      pointer.lastY = nextY;
      pointer.activeUntil = performance.now() + 140;
    }

    function handleContextLost(event: Event) {
      event.preventDefault();
      loop.dispose();
      if (!disposed) requestMaterialContextRecovery(drawingCanvas, onContextLost, 0);
    }

    drawingCanvas.addEventListener('pointermove', handlePointerMove, { passive: true });
    drawingCanvas.addEventListener('webglcontextlost', handleContextLost);

    function draw(time: number) {
      if (clock.frozen) return;
      const current = settingsRef.current;
      const controlledTime = captureTimeRef.current;
      const motionRate = liveMaterialMotionRate(current.speed);
      const previousFrame = clock.frame;
      const renderedTime = clock.draw({ now: time, rate: motionRate,
        active: activeRef.current || controlledTime !== null, paused: pausedRef.current,
        captureTimeMs: controlledTime, frameState: frameStateRef.current }) / 1000;
      if (!activeRef.current && controlledTime === null) return;
      const simulationDeltaMs = Math.max(0, (clock.frame - previousFrame) / Math.max(0.0001, motionRate));
      const pixelRatio = resolveLiveMaterialPixelRatio({
        cssHeight: drawingCanvas.clientHeight,
        cssWidth: drawingCanvas.clientWidth,
        devicePixelRatio: window.devicePixelRatio || 1,
        maxDevicePixelRatio: 2.5,
        maxPixelCount: maxPixelCountRef.current,
        renderScale: renderScaleRef.current,
      });
      const { height, width } = resizeFluidCanvas(drawingCanvas, pixelRatio);

      try {
        // These textures are the in-memory simulation checkpoint. Do not reset
        // them when the editor resizes or an artboard gains focus.
        if (!velocity || !dye) initializeTargets(width, height, current, renderedTime);
        if (!velocity || !dye) return;
        const dt = Math.min(1 / 30, simulationDeltaMs / 1000 * (0.72 + motionRate * 0.6));
        const pointerActive = time < pointer.activeUntil;

        // A seek is not a simulation replay. Retain state for captured/paused
        // frames; zero-dt invalidations must not inject dye or decay velocity.
        if (shouldAdvanceLiveFluid(didRender, controlledTime, pausedRef.current, motionRate, dt) && dt > 0) {
          step(dt, renderedTime, current, pointerActive);
          pointer.velocityX *= 0.82;
          pointer.velocityY *= 0.82;
        }

        beginPass(displayProgram, null, width, height, 1 / dye.read.width, 1 / dye.read.height);
        bindTexture(displayProgram, 'u_dye', dye.read, 0);
        gl.uniform3fv(displayProgram.uniform('u_background'), shaderColor(current.colorA).linear);
        gl.uniform2f(displayProgram.uniform('u_resolution'), width, height);
        gl.uniform1f(displayProgram.uniform('u_brightness'), current.brightness);
        gl.uniform1f(displayProgram.uniform('u_grain'), current.grain);
        gl.uniform1f(displayProgram.uniform('u_time'), renderedTime);
        blit();
      } catch {
        if (!disposed) requestMaterialContextRecovery(drawingCanvas, onContextLost, 0);
        return;
      }
      if (!didRender) {
        didRender = true;
        drawingCanvas.dataset.liveMaterialReady = 'true';
        diagnostics?.markReady();
      }
    }

    const loop = createLiveMaterialFrameLoop({
      draw: diagnostics ? (time) => diagnostics.measureFrame(() => draw(time), time) : draw,
      frameRate: () => frameRateRef.current,
      isAnimating: () => !clock.frozen && activeRef.current && !pausedRef.current && captureTimeRef.current === null,
    });
    const unregister = registerLiveMaterialRuntime(drawingCanvas, {
      readFrame: (timeline) => didRender && !gl.isContextLost()
        ? { ...clock.read(timeline), pointer: { x: pointer.x, y: pointer.y } } : undefined,
      freeze: clock.freeze,
      redraw: loop.invalidate,
      resume: () => { clock.resume(); loop.invalidate(); },
    });
    invalidateRef.current = loop.invalidate;
    const resizeObserver = new ResizeObserver(loop.invalidate);
    resizeObserver.observe(drawingCanvas);
    loop.invalidate();
    return () => {
      unregister();
      disposed = true;
      invalidateRef.current = null;
      resizeObserver.disconnect();
      loop.dispose();
      diagnostics?.dispose();
      drawingCanvas.removeEventListener('pointermove', handlePointerMove);
      drawingCanvas.removeEventListener('webglcontextlost', handleContextLost);
      deleteTargets();
      if (buffer) gl.deleteBuffer(buffer);
      if (vertexArray) gl.deleteVertexArray(vertexArray);
      programs.forEach((program) => gl.deleteProgram(program));
      shaders.forEach((shader) => gl.deleteShader(shader));
      scheduleWebGLContextRelease(drawingCanvas, gl);
    };
  });

  return <canvas aria-label='Interactive WebGL fluid material' className='absolute inset-0 size-full' data-live-material-ready='false' ref={canvasRef} />;
}

function resolvePaperShaderTiming(speed: number, frameRate: number) {
  const cappedFrameRate = Math.min(60, Math.max(1, frameRate));
  const manuallyTimed = speed !== 0 && cappedFrameRate < 55;
  return {
    cappedFrameRate,
    manuallyTimed,
    nativeSpeed: manuallyTimed ? 0 : speed,
  };
}

function useCappedPaperShaderClock(
  surfaceRef: RefObject<PaperShaderElement | null>,
  frameRate: number,
  speed: number,
  enabled: boolean,
  held: RefObject<boolean>
) {
  useEffect(() => {
    if (!enabled) return;

    let animationFrame = 0;
    let disposed = false;
    let startFrame = 0;
    let startTime = 0;
    let timeout = 0;
    const interval = 1000 / frameRate;

    const draw = (time: number) => {
      if (disposed) return;
      if (held.current) {
        startTime = 0;
        timeout = window.setTimeout(schedule, 16);
        return;
      }
      const mount = surfaceRef.current?.paperShaderMount;
      if (!mount) {
        timeout = window.setTimeout(schedule, 16);
        return;
      }
      if (startTime === 0) {
        startTime = time;
        startFrame = mount.getCurrentFrame();
      }
      mount.setFrame(startFrame + (time - startTime) * speed);
      timeout = window.setTimeout(schedule, Math.max(0, interval - 8));
    };
    const schedule = () => {
      if (!disposed) animationFrame = requestAnimationFrame(draw);
    };

    schedule();
    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      window.clearTimeout(timeout);
    };
  }, [enabled, frameRate, held, speed, surfaceRef]);
}

const PAPER_IMAGE_SHADER_FAMILIES = new Set<PaperShaderFamilyId>([
  'fluted-glass',
  'gem-smoke',
  'halftone-cmyk',
  'halftone-dots',
  'heatmap',
  'image-dithering',
  'water',
]);

const PAPER_PROCEDURAL_BACKDROP_FAMILIES = new Set<PaperShaderFamilyId>([
  'gem-smoke',
  'liquid-metal',
]);

function paperShaderMotionTime(
  captureTimeMs: number | null,
  preservePresetAppearance: boolean,
  speed: number
): number | null {
  if (captureTimeMs === null) return null;
  if (preservePresetAppearance) return captureTimeMs;
  return liveMaterialMotionTimeMs(captureTimeMs, speed);
}

function paperShaderFrameAt(
  materialId: PaperLiveMaterialId,
  captureTimeMs: number,
  frameState: LiveMaterialFrameState | undefined,
  preserveGeometry: boolean,
  settings: LiveMaterialSettings
): number {
  const definition = getPaperLiveMaterialDefinition(materialId);
  const renderer = readPaperShaderRenderer(definition.family);
  if (!renderer) throw new Error(`Paper shader ${definition.family} is not ready.`);
  const preset = renderer.presets[definition.presetIndex] ?? renderer.presets[0]!;
  return resolvePaperShaderFrame({
    materialId, timeMs: captureTimeMs, frameState, preserveGeometry,
    speed: settings.speed, preset: preset.params,
  });
}

function applyPaperShaderFrame(
  container: HTMLElement | null,
  materialId: PaperLiveMaterialId,
  captureTimeMs: number,
  frameState: LiveMaterialFrameState | undefined,
  preserveGeometry: boolean,
  settings: LiveMaterialSettings
): boolean {
  const surface = container?.querySelector<PaperShaderElement>('[data-paper-shader]');
  const mount = surface?.paperShaderMount;
  if (!mount || !readPaperShaderRenderer(getPaperLiveMaterialDefinition(materialId).family)) return false;
  mount.setFrame(paperShaderFrameAt(
    materialId,
    captureTimeMs,
    frameState,
    preserveGeometry,
    settings
  ));
  return true;
}

function PaperMaterialGrain({
  preservePresetAppearance,
  settings,
}: {
  preservePresetAppearance: boolean;
  settings: LiveMaterialSettings;
}) {
  const opacity = paperShaderGrainOpacity(preservePresetAppearance, settings);
  if (opacity <= 0) return null;
  return (
    <span
      aria-hidden='true'
      className='paper-material-grain pointer-events-none absolute inset-0'
      style={{ opacity, backgroundImage: `url("${PAPER_MATERIAL_GRAIN_IMAGE}")` }}
    />
  );
}

function paperShaderSettingOverrides(
  presetParams: Readonly<Record<string, unknown>>,
  preservePresetAppearance: boolean,
  preservePresetGeometry: boolean,
  settings: LiveMaterialSettings
) {
  if (preservePresetAppearance) return {};
  return preservePresetGeometry
    ? paperPaletteOverrides(presetParams, settings)
    : paperControlOverrides(presetParams, settings, false);
}

function PaperShaderSurface({
  captureTimeMs,
  frameRate,
  frameState,
  materialId,
  maxPixelCount,
  paperShaderOverrides,
  patternScale,
  paused,
  preservePresetAppearance,
  preservePresetGeometry,
  renderScale,
  renderer,
  settings,
  sourceImage,
}: {
  captureTimeMs: number | null;
  frameRate: number;
  frameState?: LiveMaterialFrameState;
  materialId: PaperLiveMaterialId;
  maxPixelCount?: number;
  paperShaderOverrides?: Readonly<Record<string, unknown>>;
  patternScale: number;
  paused: boolean;
  preservePresetAppearance: boolean;
  preservePresetGeometry: boolean;
  renderScale: number;
  renderer: PaperShaderRenderer;
  settings: LiveMaterialSettings;
  sourceImage?: string;
}) {
  const surfaceRef = useRef<PaperShaderElement>(null);
  const heldRef = useRef(false);
  const [initialFrame, setInitialFrame] = useState<{ frame: number; anchor: number } | null>(null);
  const ready = initialFrame !== null;
  const definition = getPaperLiveMaterialDefinition(materialId);
  const preset = renderer.presets[definition.presetIndex] ?? renderer.presets[0]!;
  const presetSpeed = typeof preset.params.speed === 'number' ? preset.params.speed : 1;
  const motionSpeed = presetSpeed > 0 ? presetSpeed : 0.35;
  const presetFrame = typeof preset.params.frame === 'number' ? preset.params.frame : 0;
  const capturedFrameState = useMemo(() => {
    const state = normalizeLiveMaterialFrameState(frameState);
    return state?.engine === 'paper' && (!state.materialId || state.materialId === materialId) ? state : undefined;
  }, [frameState, materialId]);
  const preserveGeometry = preservePresetAppearance || preservePresetGeometry;
  const motionMultiplier = preserveGeometry ? 1 : liveMaterialMotionRate(settings.speed);
  const controlledMotionTimeMs = paperShaderMotionTime(
    captureTimeMs,
    preserveGeometry,
    settings.speed
  );
  const anchorFrame = capturedFrameState?.frame ?? presetFrame;
  const requestedInitialFrame = captureTimeMs === null ? anchorFrame : paperShaderFrameAt(
    materialId, captureTimeMs, capturedFrameState, preserveGeometry, settings
  );
  const initialFrameRef = useCommittedRef({
    frame: requestedInitialFrame, anchor: anchorFrame, controlled: captureTimeMs !== null,
  });
  useMountEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    return observePaperShaderReadiness(surface, () => {
      const initial = initialFrameRef.current;
      // Paper's async isInitialized effect reapplies its frame prop. Recommit
      // the latest controlled draw before exposing readiness/capture, and keep
      // that same prop after initialization so a delayed effect cannot undo it.
      if (initial.controlled) surface.paperShaderMount?.setFrame(initial.frame);
      setInitialFrame({ frame: initial.frame, anchor: initial.anchor });
    });
  });
  const effectiveSpeed = paused || captureTimeMs !== null ? 0 : motionSpeed * motionMultiplier;
  const { cappedFrameRate, manuallyTimed, nativeSpeed } = resolvePaperShaderTiming(
    effectiveSpeed,
    frameRate
  );
  useCappedPaperShaderClock(surfaceRef, cappedFrameRate, effectiveSpeed, manuallyTimed, heldRef);
  const nativeSpeedRef = useCommittedRef(nativeSpeed);
  const paperSettingsRef = useCommittedRef(settings);
  const preserveAppearanceRef = useCommittedRef(preserveGeometry);
  useEffect(() => {
    const surface = surfaceRef.current;
    const mount = surface?.paperShaderMount;
    const canvas = surface?.querySelector('canvas');
    if (!ready || !mount || !canvas) return;
    return registerLiveMaterialRuntime(canvas, {
      readFrame: (timelineTimeMs) => ({ engine: 'paper', version: 2, materialId,
        frame: mount.getCurrentFrame(), timelineTimeMs: Math.max(0, timelineTimeMs) }),
      freeze: () => { heldRef.current = true; mount.setSpeed(0); },
      redraw: () => mount.setFrame(mount.getCurrentFrame()),
      resume: () => { heldRef.current = false; mount.setSpeed(nativeSpeedRef.current); },
      presentation: () => ({
        filter: paperShaderFilter(preserveAppearanceRef.current, paperSettingsRef.current),
        grainOpacity: paperShaderGrainOpacity(preserveAppearanceRef.current, paperSettingsRef.current),
        grainTileSize: PAPER_MATERIAL_GRAIN_TILE_SIZE * canvas.width / Math.max(1, canvas.clientWidth),
      }),
    });
  }, [materialId, nativeSpeedRef, paperSettingsRef, preserveAppearanceRef, ready]);
  const usesImage = PAPER_IMAGE_SHADER_FAMILIES.has(definition.family)
    && !PAPER_PROCEDURAL_BACKDROP_FAMILIES.has(definition.family);
  const rendersBackdrop = usesImage || PAPER_PROCEDURAL_BACKDROP_FAMILIES.has(definition.family);
  const controlledParams = useMemo(() => {
    const params = {
      ...preset.params,
      ...paperShaderSettingOverrides(
        preset.params,
        preservePresetAppearance,
        preservePresetGeometry,
        settings
      ),
      ...paperShaderOverrides,
    };
    const rotation = typeof params.rotation === 'number' ? params.rotation : 0;
    params.scale = resolvePaperShaderScale(params.scale, patternScale, {
      gemSmoke: definition.family === 'gem-smoke',
      rendersBackdrop,
      rotation,
    });
    return params;
  }, [
    definition.family,
    paperShaderOverrides,
    patternScale,
    preservePresetAppearance,
    preservePresetGeometry,
    preset.params,
    rendersBackdrop,
    settings,
  ]);
  const resolvedScale = Number(controlledParams.scale);
  const backdropParams = useMemo(() => rendersBackdrop ? {
    fit: 'cover',
    worldHeight: 0,
    worldWidth: 0,
  } : {}, [rendersBackdrop]);
  // Canvas-fill mode exposes a flat rectangular plate in these edge-driven shaders.
  // Oversized organic masks keep the material full-bleed without hiding its texture.
  const proceduralBackdropParams = useMemo(() => definition.family === 'gem-smoke'
    ? {
        colorInner: '#00000000',
        image: undefined,
        shape: 'metaballs',
      }
    : definition.family === 'liquid-metal'
      ? {
          image: undefined,
          shape: 'metaballs',
        }
      : {}, [definition.family]);
  const surfaceStyle = useMemo(() => ({
    display: 'block',
    height: '100%',
    inset: 0,
    margin: 0,
    maxHeight: 'none',
    maxWidth: 'none',
    minHeight: 0,
    minWidth: 0,
    overflow: 'hidden',
    position: 'absolute',
    width: '100%',
  } as const), []);
  const webGlContextAttributes = useMemo(() => ({
    alpha: false,
    antialias: false,
    preserveDrawingBuffer: true,
  }), []);
  const surfaceProps: ShaderComponentProps = {
    className: 'absolute inset-0 block size-full max-h-none max-w-none overflow-hidden',
    height: '100%',
    maxPixelCount: maxPixelCount
      ?? Math.max(18_000, Math.round(360_000 * Math.min(2, renderScale * renderScale))),
    // Supersampled capture: Paper renders up to the pixel budget instead of device ratio.
    minPixelRatio: renderScale > 1 && typeof window !== 'undefined' ? (window.devicePixelRatio || 1) * renderScale : 0.5,
    ref: surfaceRef,
    style: surfaceStyle,
    webGlContextAttributes,
    width: '100%',
  };

  useEffect(() => {
    if (controlledMotionTimeMs === null) return;
    let animationFrame = 0;
    let disposed = false;
    const applyFrame = () => {
      if (heldRef.current) return;
      const mount = surfaceRef.current?.paperShaderMount;
      if (!mount) {
        if (!disposed) animationFrame = requestAnimationFrame(applyFrame);
        return;
      }
      mount.setFrame(paperShaderFrameAt(
        materialId,
        captureTimeMs ?? 0,
        capturedFrameState,
        preserveGeometry,
        settings
      ));
    };
    applyFrame();
    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
    };
  }, [captureTimeMs, capturedFrameState, controlledMotionTimeMs, materialId, preserveGeometry, ready, settings, surfaceRef]);

  const surface = createElement(renderer.component, {
    ...surfaceProps,
    ...controlledParams,
    ...backdropParams,
    ...(usesImage ? { image: sourceImage ?? '/shader-source-art.svg' } : {}),
    ...proceduralBackdropParams,
    // Seed both Paper's async constructor and its isInitialized frame reset with
    // the controlled time. Once ready, scrubs remain imperative so they do not
    // rebuild uniforms/decode images on every playhead tick. A new native anchor
    // still restores through the vendor prop as it did before.
    frame: initialFrame
      ? (initialFrame.anchor === anchorFrame ? initialFrame.frame : anchorFrame)
      : requestedInitialFrame,
    speed: nativeSpeed,
  });

  return (
    <div
      aria-label={`Paper Shaders ${definition.name} material`}
      className='paper-shader-host absolute inset-0 size-full min-h-0 min-w-0 overflow-hidden'
      role='img'
      data-live-material-ready={ready}
      data-paper-motion={effectiveSpeed === 0 ? 'paused' : 'running'}
      data-paper-frame-rate={cappedFrameRate}
      data-paper-scale={resolvedScale}
      data-paper-speed={effectiveSpeed}
      data-paper-zoom={clampShaderZoom(patternScale)}
      style={{
        contain: 'strict',
        filter: paperShaderFilter(preserveGeometry, settings),
        isolation: 'isolate',
      }}
    >
      {surface}
      <PaperMaterialGrain
        preservePresetAppearance={preserveGeometry}
        settings={settings}
      />
    </div>
  );
}

function StaticMaterialFallback({
  className,
  unavailable,
  sourceImage,
  sourceImageOpacity,
}: {
  className: string;
  unavailable: boolean;
  sourceImage?: string;
  sourceImageOpacity: number;
}) {
  return (
    <div
      aria-label={unavailable ? 'Shader preview unavailable' : 'Shader preview loading'}
      className={`absolute inset-0 size-full ${className}`}
      data-live-material-ready={unavailable ? 'error' : 'false'}
    >
      <ShaderSkeleton state={unavailable ? 'unavailable' : 'loading'} />
      <SourceAssetOverlay opacity={sourceImageOpacity} source={sourceImage} />
    </div>
  );
}

function LiveMaterialRenderView({
  active,
  canvasRef,
  captureTimeMs,
  className,
  contextVersion,
  diagnostics,
  enabled,
  frameRate,
  frameState,
  loopDurationMs,
  maxPixelCount,
  materialId,
  onContextLost,
  onProviderFailure,
  paperUsesSourceImage,
  paperShaderOverrides,
  patternScale,
  paused,
  preservePresetAppearance,
  preservePresetGeometry,
  recoveryFailed,
  renderScale,
  settings,
  sourceImage,
  sourceImageOpacity,
  webGL2Available,
}: {
  active: boolean;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  captureTimeMs: number | null;
  className: string;
  contextVersion: number;
  diagnostics: boolean;
  enabled: boolean;
  frameRate: number;
  frameState?: LiveMaterialFrameState;
  loopDurationMs: number;
  materialId: LiveMaterialId;
  maxPixelCount?: number;
  onContextLost: () => void;
  onProviderFailure: () => void;
  paperUsesSourceImage: boolean;
  paperShaderOverrides?: Readonly<Record<string, unknown>>;
  patternScale: number;
  paused: boolean;
  preservePresetAppearance: boolean;
  preservePresetGeometry: boolean;
  recoveryFailed: boolean;
  renderScale: number;
  settings: LiveMaterialSettings;
  sourceImage?: string;
  sourceImageOpacity: number;
  webGL2Available: boolean | null;
}) {
  const requiresWebGL2 = materialRequiresWebGL2(materialId);
  if (!enabled || recoveryFailed || (requiresWebGL2 && webGL2Available !== true)) {
    return (
      <StaticMaterialFallback
        className={className}
        unavailable={recoveryFailed || (requiresWebGL2 && webGL2Available === false)}
        sourceImage={sourceImage}
        sourceImageOpacity={sourceImageOpacity}
      />
    );
  }

  if (materialId.startsWith('shader-effects-')) return <ShaderEffectsSurface
    materialId={materialId} settings={settings} active={active} paused={paused}
    captureTimeMs={captureTimeMs} frameState={frameState} frameRate={frameRate}
    maxPixelCount={maxPixelCount} renderScale={renderScale} patternScale={patternScale} sourceImage={sourceImage}
  />;

  if (materialId === 'shadergradient-prismatic-sphere') {
    const providerFallback = (
      <div aria-label='Shader preview unavailable' data-live-material-ready='error'>
        <ShaderSkeleton state='unavailable' />
      </div>
    );
    return (
      <div className={`absolute inset-0 size-full ${className}`}>
        <WebGLProviderBoundary
          fallback={providerFallback}
          key={`shadergradient-boundary-${contextVersion}`}
          onFailure={onProviderFailure}
        >
          <ProviderContextGuard
            key={`shadergradient-${contextVersion}`}
            onContextLost={onProviderFailure}
          >
            <ShaderGradientSurface
              captureTimeMs={captureTimeMs}
              frameState={frameState}
              className=''
              loopDurationMs={loopDurationMs}
              maxPixelCount={maxPixelCount}
              patternScale={patternScale}
              paused={paused || !active}
              renderScale={renderScale}
              settings={settings}
            />
          </ProviderContextGuard>
        </WebGLProviderBoundary>
        <SourceAssetOverlay opacity={sourceImageOpacity} source={sourceImage} />
      </div>
    );
  }

  if (materialId === 'glyphfield-glyph-field') {
    return (
      <div className={`absolute inset-0 size-full ${className}`}>
        <GlyphFieldCanvas
          active={active}
          canvasRef={canvasRef}
          captureTimeMs={captureTimeMs}
          diagnostics={diagnostics}
          frameRate={frameRate}
          frameState={frameState}
          maxPixelCount={maxPixelCount}
          patternScale={patternScale}
          paused={paused || !active}
          renderScale={renderScale}
          settings={settings}
        />
        <SourceAssetOverlay opacity={sourceImageOpacity} source={sourceImage} />
      </div>
    );
  }

  if (materialId === 'pavel-fluid-energy') {
    return (
      <div className={`absolute inset-0 size-full ${className}`}>
        <FluidSimulationCanvas
          active={active}
          canvasRef={canvasRef}
          captureTimeMs={captureTimeMs}
          diagnostics={diagnostics}
          frameRate={frameRate}
          frameState={frameState}
          key={`pavel-fluid-${contextVersion}`}
          maxPixelCount={maxPixelCount}
          onContextLost={onContextLost}
          patternScale={patternScale}
          paused={paused || !active}
          renderScale={renderScale}
          settings={settings}
        />
        <SourceAssetOverlay opacity={sourceImageOpacity} source={sourceImage} />
      </div>
    );
  }

  if (isPaperLiveMaterialId(materialId)) {
    return (
      <div className={`absolute inset-0 size-full ${className}`}>
        <PaperShaderRendererBoundary family={getPaperLiveMaterialDefinition(materialId).family}>
          {(renderer) => <ProviderContextGuard
            key={`paper-${materialId}-${contextVersion}`}
            onContextLost={onProviderFailure}
          >
          <PaperShaderSurface
            captureTimeMs={captureTimeMs}
            frameRate={frameRate}
            frameState={frameState}
            materialId={materialId}
            maxPixelCount={maxPixelCount}
            paperShaderOverrides={paperShaderOverrides}
            patternScale={patternScale}
            paused={paused || !active}
            preservePresetAppearance={preservePresetAppearance}
            preservePresetGeometry={preservePresetGeometry}
            renderScale={renderScale}
            renderer={renderer}
            settings={settings}
            sourceImage={sourceImage}
          />
          </ProviderContextGuard>}
        </PaperShaderRendererBoundary>
        {paperUsesSourceImage ? null : <SourceAssetOverlay opacity={sourceImageOpacity} source={sourceImage} />}
      </div>
    );
  }

  if (!isOriginalMaterialId(materialId)) {
    return <StaticMaterialFallback className={className} sourceImage={sourceImage} sourceImageOpacity={sourceImageOpacity} unavailable />;
  }

  return (
    <div
      className={`absolute inset-0 size-full ${className}`}
    >
      <OriginalMaterialCanvas
        active={active}
        canvasRef={canvasRef}
        captureTimeMs={captureTimeMs}
        diagnostics={diagnostics}
        frameRate={frameRate}
        frameState={frameState}
        materialId={materialId}
        fragmentSource={originalFragmentSource(materialId)}
        key={`${materialId}-${contextVersion}`}
        maxPixelCount={maxPixelCount}
        onContextLost={onContextLost}
        patternScale={patternScale}
        paused={paused || !active}
        renderScale={renderScale}
        settings={settings}
      />
      <SourceAssetOverlay opacity={sourceImageOpacity} source={sourceImage} />
    </div>
  );
}

function LiveMaterialCanvas({
  activeWhileMounted = false,
  className = '',
  captureTimeMs = null,
  diagnostics = false,
  enabled = true,
  frameRate = 60,
  frameState,
  loopDurationMs = 1_600,
  materialId,
  maxPixelCount,
  paperShaderOverrides,
  patternScale = 1,
  paused = false,
  preservePresetAppearance = false,
  preservePresetGeometry = false,
  previewChannel,
  previewGroup,
  renderScale = 1,
  settings,
  sourceImage,
  sourceImageOpacity = 36,
}: LiveMaterialCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const publishPaintedPreview = usePaintedLiveMaterialPreview(containerRef);
  const [workspaceActive, setWorkspaceActive] = useState(true);
  useAncestorWorkspaceActivity(containerRef, setWorkspaceActive);
  const captureTimeMsRef = useCommittedRef(captureTimeMs);
  const patternScaleRef = useCommittedRef(patternScale);
  const settingsRef = useCommittedRef(settings);
  const [timePreview, setTimePreview] = useState<PropBoundPreview<number, number | null> | null>(null);
  const resolvedCaptureTimeMs = resolvePropBoundPreview(timePreview, captureTimeMs, captureTimeMs);
  const resolvedMaterialId = normalizeLiveMaterialId(materialId);
  const previewFrameRate = isPaperLiveMaterialId(resolvedMaterialId)
    ? PAPER_PREVIEW_FRAME_RATE
    : WEBGL_PREVIEW_FRAME_RATE;
  const smoothedPatternScale = useSmoothedShaderZoom(patternScale, resolvedCaptureTimeMs !== null);
  const [patternPreview, setPatternPreview] = useState<PropBoundPreview<number> | null>(null);
  const resolvedPatternScale = resolvePropBoundPreview(
    patternPreview,
    clampShaderZoom(patternScale),
    smoothedPatternScale
  );
  const [settingsPreview, setSettingsPreview] = useState<PropBoundPreview<Partial<LiveMaterialSettings>, LiveMaterialSettings> | null>(null);
  const settingsPreviewRef = useCommittedRef(settingsPreview);
  const resolvedSettings = resolveLiveSettingsPreview(settingsPreview, settings);
  useEffect(() => {
    if (settingsPreview || patternPreview || timePreview) publishPaintedPreview();
  }, [settingsPreview, patternPreview, timePreview, publishPaintedPreview]);
  const [webGL2Available, setWebGL2Available] = useState<boolean | null>(null);
  const [renderVisible, setRenderVisible] = useState(true);
  const [documentVisible, setDocumentVisible] = useState(true);
  const [contextRecovery, setContextRecovery] = useState(() => ({
    failed: false,
    materialId: resolvedMaterialId,
    version: 0,
  }));
  const recoveryTimerRef = useRef(0);
  const activeRecovery = currentContextRecovery(contextRecovery, resolvedMaterialId);
  const renderEnabled = shouldMountLiveMaterial({
    activeWhileMounted,
    captureTimeMs: resolvedCaptureTimeMs,
    enabled,
    renderVisible,
    workspaceActive,
  });
  const renderActive = renderEnabled && documentVisible;
  const requiresWebGL2 = materialRequiresWebGL2(resolvedMaterialId);
  const paperUsesSourceImage = paperMaterialUsesSourceImage(resolvedMaterialId);
  const recoverContext = () => {
    if (recoveryTimerRef.current) return;
    recoveryTimerRef.current = window.setTimeout(() => {
      recoveryTimerRef.current = 0;
      setContextRecovery((current) => {
        const currentVersion = current.materialId === resolvedMaterialId ? current.version : 0;
        return {
          failed: currentVersion >= 5,
          materialId: resolvedMaterialId,
          version: Math.min(5, currentVersion + 1),
        };
      });
    }, CONTEXT_RECOVERY_DELAY_MS);
  };
  const failProviderContext = recoverContext;

  useEffect(() => {
    if (!previewChannel) return;
    let lastPublishedAt = 0;
    let pendingPreview: PropBoundPreview<number> | null = null;
    let timer = 0;
    const publishPreview = () => {
      timer = 0;
      if (!pendingPreview) return;
      lastPublishedAt = performance.now();
      setPatternPreview(pendingPreview);
      pendingPreview = null;
    };
    const previewPatternScale = (event: Event) => {
      const detail = (event as CustomEvent<LiveMaterialPatternScalePreview>).detail;
      if (detail?.channel !== previewChannel) return;
      pendingPreview = {
        base: clampShaderZoom(patternScaleRef.current),
        value: clampShaderZoom(detail.value),
      };
      if (timer) return;
      timer = window.setTimeout(
        publishPreview,
        Math.max(0, 1_000 / previewFrameRate - (performance.now() - lastPublishedAt))
      );
    };
    window.addEventListener(LIVE_MATERIAL_PATTERN_SCALE_PREVIEW_EVENT, previewPatternScale);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(LIVE_MATERIAL_PATTERN_SCALE_PREVIEW_EVENT, previewPatternScale);
    };
  }, [patternScaleRef, previewChannel, previewFrameRate]);

  useEffect(() => {
    if (!previewGroup) return;
    let lastPublishedAt = 0;
    let pendingPreview: PropBoundPreview<number, number | null> | null = null;
    let paperPreviewActive = false;
    let timer = 0;
    const publishPreview = () => {
      timer = 0;
      if (!pendingPreview) return;
      lastPublishedAt = performance.now();
      const nextPreview = pendingPreview;
      pendingPreview = null;
      if (isPaperLiveMaterialId(resolvedMaterialId) && paperPreviewActive) {
        const applied = applyPaperShaderFrame(
          containerRef.current,
          resolvedMaterialId,
          nextPreview.value,
          frameState,
          preservePresetAppearance || preservePresetGeometry,
          settingsRef.current
        );
        if (applied) {
          publishPaintedPreview();
          return;
        }
      }
      paperPreviewActive = isPaperLiveMaterialId(resolvedMaterialId);
      setTimePreview(nextPreview);
    };
    const previewMaterialTime = (event: Event) => {
      const detail = (event as CustomEvent<LiveMaterialTimePreview>).detail;
      if (detail?.group !== previewGroup) return;
      if (detail.timeMs === null) {
        window.clearTimeout(timer);
        timer = 0;
        pendingPreview = null;
        paperPreviewActive = false;
        setTimePreview(null);
        return;
      }
      if (!Number.isFinite(detail.timeMs)) return;
      pendingPreview = {
        base: captureTimeMsRef.current,
        value: Math.max(0, detail.timeMs),
      };
      if (timer) return;
      timer = window.setTimeout(
        publishPreview,
        Math.max(0, 1_000 / previewFrameRate - (performance.now() - lastPublishedAt))
      );
    };
    window.addEventListener(LIVE_MATERIAL_TIME_PREVIEW_EVENT, previewMaterialTime);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(LIVE_MATERIAL_TIME_PREVIEW_EVENT, previewMaterialTime);
    };
  }, [
    captureTimeMsRef,
    containerRef,
    preservePresetAppearance,
    preservePresetGeometry,
    previewFrameRate,
    previewGroup,
    publishPaintedPreview,
    resolvedMaterialId,
    frameState,
    settingsRef,
  ]);

  useEffect(() => {
    if (!previewChannel) return;
    let lastPublishedAt = 0;
    let pendingPreview: PropBoundPreview<Partial<LiveMaterialSettings>, LiveMaterialSettings> | null = null;
    let timer = 0;
    const publishPreview = () => {
      timer = 0;
      if (!pendingPreview) return;
      lastPublishedAt = performance.now();
      setSettingsPreview(pendingPreview);
      pendingPreview = null;
    };
    const previewMaterialSettings = (event: Event) => {
      const detail = (event as CustomEvent<LiveMaterialSettingsPreview>).detail;
      if (detail?.channel !== previewChannel) return;
      const base = settingsRef.current;
      pendingPreview = {
        base,
        value: {
          ...(pendingPreview?.base === base
            ? pendingPreview.value
            : settingsPreviewRef.current?.base === base
              ? settingsPreviewRef.current.value
              : {}),
          ...detail.settings,
        },
      };
      if (timer) return;
      timer = window.setTimeout(
        publishPreview,
        Math.max(0, 1_000 / previewFrameRate - (performance.now() - lastPublishedAt))
      );
    };
    window.addEventListener(LIVE_MATERIAL_SETTINGS_PREVIEW_EVENT, previewMaterialSettings);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(LIVE_MATERIAL_SETTINGS_PREVIEW_EVENT, previewMaterialSettings);
    };
  }, [previewChannel, previewFrameRate, settingsPreviewRef, settingsRef]);

  useEffect(() => {
    if (!requiresWebGL2) {
      setWebGL2Available(null);
      return;
    }

    let disposed = false;
    let retryTimer = 0;
    const checkSupport = () => {
      const available = browserSupportsWebGL2();
      if (disposed) return;
      setWebGL2Available(available);
      if (!available) retryTimer = window.setTimeout(checkSupport, WEBGL_SUPPORT_RETRY_MS);
    };
    checkSupport();
    return () => {
      disposed = true;
      window.clearTimeout(retryTimer);
    };
  }, [requiresWebGL2]);

  useEffect(() => () => {
    window.clearTimeout(recoveryTimerRef.current);
    recoveryTimerRef.current = 0;
  }, [resolvedMaterialId]);

  useEffect(() => {
    if (!activeRecovery.failed || !enabled) return;
    const retryTimer = window.setTimeout(() => {
      setContextRecovery({ failed: false, materialId: resolvedMaterialId, version: 0 });
    }, CONTEXT_RECOVERY_COOLDOWN_MS);
    return () => window.clearTimeout(retryTimer);
  }, [activeRecovery.failed, enabled, resolvedMaterialId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let intersecting = true;
    const updateVisibility = () => {
      setRenderVisible((current) => current === intersecting ? current : intersecting);
      setDocumentVisible(document.visibilityState !== 'hidden');
    };
    const observer = new IntersectionObserver(([entry]) => {
      intersecting = entry?.isIntersecting ?? true;
      updateVisibility();
    }, { rootMargin: '160px' });
    observer.observe(container);
    updateVisibility();
    document.addEventListener('visibilitychange', updateVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', updateVisibility);
    };
  }, [activeRecovery.version, enabled, resolvedMaterialId, webGL2Available]);

  return (
    <div
      className={`absolute inset-0 size-full min-h-0 min-w-0 overflow-hidden ${className}`}
      data-live-material-surface={resolvedMaterialId}
      data-live-material-editing={hasUncommittedShaderPreview(settingsPreview, settings, patternPreview, patternScale, timePreview, captureTimeMs) ? 'true' : undefined}
      data-live-material-ready={liveMaterialReadinessStatus(requiresWebGL2, webGL2Available, activeRecovery.failed)}
      ref={containerRef}
      style={{
        contain: 'strict',
        isolation: 'isolate',
      }}
    >
      <LiveMaterialRenderView
        active={renderActive}
        canvasRef={canvasRef}
        captureTimeMs={resolvedCaptureTimeMs}
        className=''
        contextVersion={activeRecovery.version}
        diagnostics={diagnostics}
        enabled={renderEnabled}
        frameRate={frameRate}
        frameState={frameState}
        loopDurationMs={loopDurationMs}
        materialId={resolvedMaterialId}
        maxPixelCount={maxPixelCount}
        onContextLost={recoverContext}
        onProviderFailure={failProviderContext}
        paperUsesSourceImage={paperUsesSourceImage}
        paperShaderOverrides={paperShaderOverrides}
        patternScale={resolvedPatternScale}
        paused={paused}
        preservePresetAppearance={preservePresetAppearance}
        preservePresetGeometry={preservePresetGeometry}
        recoveryFailed={activeRecovery.failed}
        renderScale={renderScale}
        settings={resolvedSettings}
        sourceImage={sourceImage}
        sourceImageOpacity={sourceImageOpacity}
        webGL2Available={webGL2Available}
      />
      <ShaderSkeleton className='live-material-loading' />
    </div>
  );
}

export default memo(LiveMaterialCanvas);
