'use client';

import { DotLottie, type Fit, type Mode } from '@lottiefiles/dotlottie-web/webgl';
import { T as GTText } from 'gt-next';
import {
  Clapperboard,
  Download,
  ExternalLink,
  ImageDown,
  Pause,
  Play,
  RotateCcw,
  Upload,
} from '@/components/ui/SolidIcons';
import { memo, startTransition, useCallback, useId, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';

import CanvasViewport from '@/components/CanvasViewport';
import DesignVersionControls from '@/components/DesignVersionControls';
import ExportPreview, { type ExportPreviewAsset } from '@/components/ExportPreview';
import LiveMaterialCanvas from '@/components/LiveMaterialCanvas';
import LiveMaterialControls from '@/components/LiveMaterialControls';
import { MotionTranslationContext } from '@/components/MotionTranslation';
import {
  BrandTokenChips,
  LottieLayerControls,
  LottieMarkerControls,
  LottieBrandLogoToggle,
  LottieRecolorModeToggle,
  LottieSourceColorControls,
  LottieTransport,
  useFrameSubscription,
  type BrandToken,
} from '@/components/LottieEditorPanels';
import { LabInspectorSection, LabPanelHeading, StudioSidebar } from '@/components/LabWorkspace';
import SourceCodeDrawer from '@/components/LazySourceCodeDrawer';
import StudioFileMenu from '@/components/StudioFileMenu';
import { useStudioExportProgress } from '@/components/StudioExportProgress';
import StudioRangeLabel from '@/components/StudioRangeLabel';
import StudioToolHeader from '@/components/StudioToolHeader';
import { Button } from '@/components/ui/Button';
import ColorControl from '@/components/ui/ColorControl';
import StudioCheckbox from '@/components/ui/StudioCheckbox';
import StudioRange from '@/components/ui/StudioRange';
import StudioSelect from '@/components/ui/StudioSelect';
import { useAncestorWorkspaceActivity } from '@/hooks/useAncestorWorkspaceActivity';
import { useCachedGT } from '@/hooks/useCachedGT';
import { useCommittedRef } from '@/hooks/useCommittedRef';
import { useStudioDraft } from '@/hooks/usePersistentState';
import { usePortableCanvasWorkspace } from '@/hooks/usePortableCanvasWorkspace';
import {
  brandFontAssets,
  brandTypographyFamily,
  brandTypographyRole,
  type BrandIdentity,
} from '@/lib/brandIdentity';
import { canvasRevisionFromSignature } from '@/lib/canvasDocument';
import { exportCanvasDocumentStill } from '@/lib/canvasExport';
import { blobToDataUrl, imageUrlToDataUrl, resolveLocalAssetUrl } from '@/lib/download';
import {
  brandMaterialPalette,
  DEFAULT_LIVE_MATERIAL_ID,
  DEFAULT_LIVE_MATERIAL_SETTINGS,
  type LiveMaterialId,
  type LiveMaterialSettings,
} from '@/lib/liveMaterials';
import {
  parseLottieDocument,
  parseLottieWorkspaceSource,
  type LottieCanvasState,
  type LottieRecolorMode,
} from '@/lib/lottieCanvasDocument';
import {
  appendLottieMarker,
  applyLottieEdits,
  brandLottieColorMap,
  EMPTY_LOTTIE_EDITS,
  listLottieColors,
  listLottieLayers,
  listLottieMarkers,
  listLottieTextLayers,
  MAX_LOTTIE_MARKERS,
  normalizeLottieEdits,
  type LottieEdits,
  type LottieMarker,
} from '@/lib/lottieEditing';
import { blendPremultipliedFrame, fillOpaque, lottieExportDurationMs, lottieExportFrameAt } from '@/lib/lottieMotionExport';
import {
  customizeLottieDocument,
  LOTTIE_EXAMPLES,
  type LottieAppearance,
  type LottieDocument,
} from '@/lib/lottieExamples';
import { isSupportedLottieFile } from '@/lib/studio';
import { savedDesignStorageKey } from '@/lib/savedDesigns';
import { studioToolActionNames } from '@/lib/studioAgentCapabilities';
import { downloadStudioArtifact, registerStudioAutomation } from '@/lib/studioAutomation';
import {
  createStudioCanvasDocument,
} from '@/lib/studioCanvasDocument';
import { templateBrandLogo } from '@/lib/templateAssets';
import type { BackgroundStyle } from '@/lib/renderFrame';

// Locale negotiation runs per translated node; memoized nodes and cached
// strings keep slider ticks from repeating it across the whole editor.
const T = memo(GTText);
T.displayName = 'LottieStudioTranslation';

type LottieSource = {
  category: string;
  data: ArrayBuffer | LottieDocument;
  description: string;
  fileName: string;
  format: 'dotlottie' | 'json';
  id: string;
  name: string;
  portableDataUrl?: string;
  provenance: 'Glyphfield example' | 'Local import';
};

const DEFAULT_SOURCE: LottieSource = {
  category: LOTTIE_EXAMPLES[0]?.category ?? 'Product',
  data: LOTTIE_EXAMPLES[0]?.data ?? {},
  description: LOTTIE_EXAMPLES[0]?.description ?? '',
  fileName: `${LOTTIE_EXAMPLES[0]?.id ?? 'signal-relay'}.json`,
  format: 'json',
  id: LOTTIE_EXAMPLES[0]?.id ?? 'signal-relay',
  name: LOTTIE_EXAMPLES[0]?.name ?? 'Signal relay',
  provenance: 'Glyphfield example',
};

const EXAMPLE_SOURCES: readonly LottieSource[] = LOTTIE_EXAMPLES.map((example) => ({
  category: example.category,
  data: example.data,
  description: example.description,
  fileName: `${example.id}.json`,
  format: 'json',
  id: example.id,
  name: example.name,
  provenance: 'Glyphfield example',
}));

const CANVAS_PRESETS = {
  landscape: { height: 750, label: 'Landscape · 1200 × 750', width: 1200 },
  portrait: { height: 1200, label: 'Portrait · 750 × 1200', width: 750 },
  square: { height: 960, label: 'Square · 960 × 960', width: 960 },
} as const;

const DEFAULT_LOTTIE_BACKGROUND = '#F3F0E8';
const DEFAULT_LOTTIE_ART_COLOR = '#262923';
const DEFAULT_LOTTIE_SECONDARY_COLOR = '#67665F';
const DEFAULT_LOTTIE_ACCENT_COLOR = '#BF4B2E';
const DEFAULT_LOTTIE_CORNER_RADIUS = 8;
const DEFAULT_LOTTIE_STROKE_WIDTH = 1;
const DOTLOTTIE_WASM_URL = '/vendor/dotlottie-player-webgl-0.78.2.wasm';
let lottieRuntimePreload: Promise<void> | null = null;

export function preloadLottieRuntime(): Promise<void> {
  DotLottie.setWasmUrl(DOTLOTTIE_WASM_URL);
  lottieRuntimePreload ??= DotLottie.preload();
  return lottieRuntimePreload;
}

type CanvasPreset = keyof typeof CANVAS_PRESETS;

function InspectorSection({
  children,
  index,
  title,
}: {
  children: ReactNode;
  index: string;
  title: React.ReactNode;
}) {
  return (
    <LabInspectorSection index={index} title={title}>
      {children}
    </LabInspectorSection>
  );
}

function RangeControl({
  label,
  max,
  min,
  onChange,
  step = 1,
  suffix = '',
  value,
}: {
  label: ReactNode;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step?: number;
  suffix?: string;
  value: number;
}) {
  const rangeLabelId = useId();
  return (
    <label htmlFor={`${rangeLabelId}-input`} className='flex flex-col gap-2'>
      <StudioRangeLabel id={rangeLabelId}
        className='text-sm'
        label={label}
        value={<output className='text-xs tabular-nums text-muted-foreground'>{value}{suffix}</output>}
      />
      <StudioRange id={`${rangeLabelId}-input`} aria-labelledby={rangeLabelId}
        max={max}
        min={min}
        onChange={(event) => {
          const next = Number(event.target.value);
          startTransition(() => onChange(next));
        }}
        step={step}
        value={value}
      />
    </label>
  );
}

function customizeSource(
  source: LottieSource,
  colors: readonly string[],
  cornerRadius: number,
  strokeWidth: number,
  fontFamily: string,
  brandLogo: LottieAppearance['brandLogo'],
  recolor: LottieRecolorMode,
): LottieDocument {
  // Palette mode restyles the whole file; source mode keeps its authored colours and geometry.
  const palette = recolor === 'palette';
  return customizeLottieDocument(source.data as LottieDocument, {
    brandLogo,
    colors,
    cornerRadius: palette ? cornerRadius : undefined,
    fontFamily,
    recolorUnnamed: palette,
    strokeWidth: palette ? strokeWidth : undefined,
  });
}

/** The exact data the player, PNG/GIF/MP4 export, and JSON download use: appearance, then edits. */
function resolveSourceData(
  source: LottieSource,
  colors: readonly string[],
  cornerRadius: number,
  strokeWidth: number,
  fontFamily: string,
  brandLogo?: LottieAppearance['brandLogo'],
  recolor: LottieRecolorMode = 'palette',
  edits: LottieEdits = EMPTY_LOTTIE_EDITS,
) {
  return source.format === 'json'
    ? applyLottieEdits(customizeSource(source, colors, cornerRadius, strokeWidth, fontFamily, brandLogo, recolor), edits)
    : source.data;
}

/** First-visit Lottie palette from the identity: paper field, ink art, a quiet secondary, one accent. */
function brandLottieDefaults(identity: BrandIdentity) {
  const color = (id: string, fallback: string) => identity.colors.find((entry) => entry.id === id)?.hex ?? fallback;
  return {
    accent: color('emphasis', DEFAULT_LOTTIE_ACCENT_COLOR),
    art: color('ink', DEFAULT_LOTTIE_ART_COLOR),
    background: color('paper', DEFAULT_LOTTIE_BACKGROUND),
    secondary: color('progress', DEFAULT_LOTTIE_SECONDARY_COLOR),
  };
}

const lottieDataSignatures = new WeakMap<object, string>();

/** One hash per immutable Lottie document, so state edits never re-serialize the animation data. */
function lottieDataSignature(data: LottieDocument | null): string {
  if (!data) return 'none';
  let signature = lottieDataSignatures.get(data);
  if (!signature) {
    signature = String(canvasRevisionFromSignature(JSON.stringify(data)));
    lottieDataSignatures.set(data, signature);
  }
  return signature;
}

/** One stable object whose methods call the latest render's handlers, so memoized panels skip unrelated renders. */
function useStableLottieHandlers<H extends Record<string, (...args: never[]) => unknown>>(handlers: H): H {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });
  const [stable] = useState(() => Object.fromEntries(Object.keys(handlers).map((key) => [
    key,
    (...args: unknown[]) => (handlersRef.current[key] as unknown as (...input: unknown[]) => unknown)(...args),
  ])) as unknown as H);
  return stable;
}

function useSettledLottieValue<T>(value: T, delayMs: number): { pending: boolean; value: T } {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    if (settled === value) return;
    const timer = window.setTimeout(() => startTransition(() => setSettled(value)), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, settled, value]);
  return { pending: settled !== value, value: settled };
}

/** Reads the WebGL frame into a reusable 2D target, flipping rows without per-frame allocation churn. */
function parseLottieExportRequest(input: unknown): { download: boolean; format: 'gif' | 'mp4' | 'png' | 'source' } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError("lottie.export requires { format: 'png' | 'source' | 'gif' | 'mp4', download? }.");
  }
  const request = input as { download?: unknown; format?: unknown };
  if (request.format !== 'png' && request.format !== 'source' && request.format !== 'gif' && request.format !== 'mp4') {
    throw new TypeError('lottie.export format must be png, source, gif, or mp4.');
  }
  if (request.download !== undefined && typeof request.download !== 'boolean') {
    throw new TypeError('lottie.export download must be Boolean.');
  }
  return { download: request.download === true, format: request.format };
}

/** Describe and edit actions; undefined means the action is not an editing action. */
function invokeLottieEditing(
  automation: {
    applyEditPatch: (input: unknown) => unknown;
    describe: () => unknown;
    mapColorsToBrand: () => unknown;
    setSegment: (input: unknown) => unknown;
  },
  action: string,
  input: unknown
): unknown {
  if (action === 'lottie.describe') return automation.describe();
  if (action === 'lottie.edit') return automation.applyEditPatch(input);
  if (action === 'lottie.colors.brand') return automation.mapColorsToBrand();
  if (action === 'lottie.segment.set') return automation.setSegment(input);
  return undefined;
}

function loadExportPlayer(data: ArrayBuffer | LottieDocument, fit: Fit, width: number, height: number, interpolate: boolean): Promise<{ player: DotLottie; surface: HTMLCanvasElement }> {
  return new Promise((resolve, reject) => {
    const surface = document.createElement('canvas');
    surface.width = width;
    surface.height = height;
    void preloadLottieRuntime();
    const player = new DotLottie({
      autoplay: false,
      backgroundColor: 'transparent',
      canvas: surface,
      data,
      layout: { align: [0.5, 0.5], fit },
      loop: false,
      renderConfig: { autoResize: false, devicePixelRatio: 1, freezeOnOffscreen: false, quality: 100 },
      useFrameInterpolation: interpolate,
    });
    const timeout = window.setTimeout(() => { player.destroy(); reject(new Error('The Lottie animation took too long to load for export.')); }, 10_000);
    player.addEventListener('load', () => { window.clearTimeout(timeout); resolve({ player, surface }); });
    player.addEventListener('loadError', () => { window.clearTimeout(timeout); player.destroy(); reject(new Error('The Lottie animation could not be loaded for export.')); });
  });
}

function rasterizeImageDataUrl(
  source: string,
  color: string,
): Promise<{ dataUrl: string; height: number; width: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const finish = () => {
      const sourceWidth = Math.max(1, image.naturalWidth || image.width || 128);
      const sourceHeight = Math.max(1, image.naturalHeight || image.height || 128);
      const rasterScale = Math.min(1, 512 / Math.max(sourceWidth, sourceHeight));
      const width = Math.max(1, Math.round(sourceWidth * rasterScale));
      const height = Math.max(1, Math.round(sourceHeight * rasterScale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { alpha: true });

      if (!context) {
        reject(new DOMException('The brand logo could not be rasterized.'));
        return;
      }

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, 0, 0, width, height);
      context.globalCompositeOperation = 'source-in';
      context.fillStyle = color;
      context.fillRect(0, 0, width, height);
      resolve({ dataUrl: canvas.toDataURL('image/png'), height, width });
    };
    image.addEventListener('load', finish, { once: true });
    image.addEventListener('error', () => reject(new DOMException('The brand logo could not be loaded.')), { once: true });
    image.src = source;
  });
}

function copyWebGlFrame(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
  if (!gl) throw new Error('The Lottie frame buffer is unavailable.');
  const width = gl.drawingBufferWidth;
  const height = gl.drawingBufferHeight;
  const source = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, source);

  const stride = width * 4;
  const flipped = new Uint8ClampedArray(source.length);
  for (let row = 0; row < height; row += 1) {
    const sourceStart = (height - row - 1) * stride;
    flipped.set(source.subarray(sourceStart, sourceStart + stride), row * stride);
  }

  const snapshot = document.createElement('canvas');
  snapshot.width = width;
  snapshot.height = height;
  const context = snapshot.getContext('2d');
  if (!context) throw new Error('The Lottie export surface is unavailable.');
  context.putImageData(new ImageData(flipped, width, height), 0, 0);
  return snapshot;
}

function renderLottieFrame({
  data,
  fit,
  frame,
  height,
  width,
}: {
  data: ArrayBuffer | LottieDocument;
  fit: Fit;
  frame: number;
  height: number;
  width: number;
}): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const surface = document.createElement('canvas');
    surface.width = width;
    surface.height = height;
    let settled = false;
    let player: DotLottie;
    const timeout = window.setTimeout(() => finish(new Error('The Lottie frame took too long to render.')), 8000);

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      player.removeEventListener('load', handleLoad);
      player.removeEventListener('loadError', handleError);
      player.removeEventListener('renderError', handleError);
      if (error) {
        player.destroy();
        reject(error);
        return;
      }
      try {
        const snapshot = copyWebGlFrame(surface);
        player.destroy();
        resolve(snapshot);
      } catch (captureError) {
        player.destroy();
        reject(captureError);
      }
    };
    const handleLoad = () => {
      // Loading paints the initial frame; setFrame synchronously paints a new
      // pose. A same-frame seek emits no render event (notably at frame zero).
      player.setFrame(Math.max(0, Math.min(frame, player.totalFrames - 1)));
      finish();
    };
    const handleError = () => finish(new Error('The Lottie frame could not be rendered.'));

    void preloadLottieRuntime();
    player = new DotLottie({
      autoplay: false,
      backgroundColor: 'transparent',
      canvas: surface,
      data,
      layout: { align: [0.5, 0.5], fit },
      loop: false,
      renderConfig: {
        autoResize: false,
        devicePixelRatio: 1,
        freezeOnOffscreen: false,
        quality: 100,
      },
      useFrameInterpolation: true,
    });
    player.addEventListener('load', handleLoad);
    player.addEventListener('loadError', handleError);
    player.addEventListener('renderError', handleError);
  });
}

export default function LottieStudio({ active = true, identity }: { active?: boolean; identity: BrandIdentity }) {
  const gt = useCachedGT();
  const translateRef = useCommittedRef(gt);
  // Stable translator for memoized panels; see AnimationStudio.
  const [motionGT] = useState(() => ((message: string, options?: Parameters<typeof gt>[1]) => translateRef.current(message, options)) as typeof gt);
  const studioExport = useStudioExportProgress(`${identity.id}:lottie`);
  const brandFontFamily = brandTypographyFamily(identity, 'Display');
  const brandDisplayTypography = brandTypographyRole(identity, 'Display');
  const brandDisplayFont = brandFontAssets(identity).find(({ id }) => id === brandDisplayTypography.fontId);
  const brandLogoAsset = templateBrandLogo(identity, 'blog', true);
  const brandMaterialColors = brandMaterialPalette(identity).colors;
  const defaultMaterialSettings: LiveMaterialSettings = {
    ...DEFAULT_LIVE_MATERIAL_SETTINGS,
    colorA: brandMaterialColors[0],
    colorB: brandMaterialColors[1],
    colorC: brandMaterialColors[2],
  };
  const brandDefaults = useMemo(() => brandLottieDefaults(identity), [identity]);
  const [source, setSource] = useState<LottieSource>(DEFAULT_SOURCE);
  const [canvasPreset, setCanvasPreset] = useStudioDraft<CanvasPreset>(identity.id, 'lottie', 'canvas-preset', 'landscape');
  const [background, setBackground] = useStudioDraft(identity.id, 'lottie', 'background-v4', brandDefaults.background);
  const [backgroundStyle, setBackgroundStyle] = useStudioDraft<BackgroundStyle>(identity.id, 'lottie', 'background-style-v4', 'solid');
  const [materialId, setMaterialId] = useStudioDraft<LiveMaterialId>(identity.id, 'lottie', 'material-id', DEFAULT_LIVE_MATERIAL_ID);
  const [materialSettings, setMaterialSettings] = useStudioDraft<LiveMaterialSettings>(identity.id, 'lottie', 'material-settings', defaultMaterialSettings);
  const [transparent, setTransparent] = useStudioDraft(identity.id, 'lottie', 'transparent', false);
  const [artColor, setArtColor] = useStudioDraft(identity.id, 'lottie', 'art-color-v4', brandDefaults.art);
  const [secondaryColor, setSecondaryColor] = useStudioDraft(identity.id, 'lottie', 'secondary-color-v4', brandDefaults.secondary);
  const [accentColor, setAccentColor] = useStudioDraft(identity.id, 'lottie', 'accent-color-v4', brandDefaults.accent);
  const [cornerRadius, setCornerRadius] = useStudioDraft(identity.id, 'lottie', 'corner-radius-v4', DEFAULT_LOTTIE_CORNER_RADIUS);
  const [strokeWidth, setStrokeWidth] = useStudioDraft(identity.id, 'lottie', 'stroke-width-v4', DEFAULT_LOTTIE_STROKE_WIDTH);
  const [speed, setSpeed] = useStudioDraft(identity.id, 'lottie', 'speed', 1);
  const [loop, setLoop] = useStudioDraft(identity.id, 'lottie', 'loop', true);
  const [interpolate, setInterpolate] = useStudioDraft(identity.id, 'lottie', 'interpolate', true);
  const [fit, setFit] = useStudioDraft<Fit>(identity.id, 'lottie', 'fit', 'contain');
  const [mode, setMode] = useStudioDraft<Mode>(identity.id, 'lottie', 'mode', 'forward');
  const [recolor, setRecolor] = useStudioDraft<LottieRecolorMode>(identity.id, 'lottie', 'recolor-v1', 'palette');
  // Built-in studies carry the identity's logo; imports get it only when turned on.
  const [showBrandLogo, setShowBrandLogo] = useStudioDraft(identity.id, 'lottie', 'brand-logo-v1', true);
  const [edits, setEdits] = useState<LottieEdits>(EMPTY_LOTTIE_EDITS);
  const [bundleMarkers, setBundleMarkers] = useState<LottieMarker[]>([]);
  const [shaderCaptureTimeMs, setShaderCaptureTimeMs] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const exportJobRef = useRef(false);
  const frames = useFrameSubscription();
  const [isPlaying, setIsPlaying] = useState(true);
  const [totalFrames, setTotalFrames] = useState(240);
  const [duration, setDuration] = useState(4);
  const [segmentStart, setSegmentStart] = useState(0);
  const [segmentEnd, setSegmentEnd] = useState(239);
  const [isSourceTransitioning, setIsSourceTransitioning] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [lastExport, setLastExport] = useState<ExportPreviewAsset | null>(null);
  const [documentCreatedAt] = useState(() => new Date().toISOString());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const studioRootRef = useRef<HTMLDivElement>(null);
  const shaderLayerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<DotLottie | null>(null);
  const [playerGeneration, setPlayerGeneration] = useState(0);
  const playerSourceRef = useRef(source);
  const sourceRef = useCommittedRef(source);
  const artColorRef = useCommittedRef(artColor);
  const secondaryColorRef = useCommittedRef(secondaryColor);
  const accentColorRef = useCommittedRef(accentColor);
  const cornerRadiusRef = useCommittedRef(cornerRadius);
  const strokeWidthRef = useCommittedRef(strokeWidth);
  const speedRef = useCommittedRef(speed);
  const loopRef = useCommittedRef(loop);
  const interpolateRef = useCommittedRef(interpolate);
  const fitRef = useCommittedRef(fit);
  const modeRef = useCommittedRef(mode);
  const transparentRef = useCommittedRef(transparent);
  const backgroundRef = useCommittedRef(background);
  const backgroundStyleRef = useCommittedRef(backgroundStyle);
  const brandFontFamilyRef = useCommittedRef(brandFontFamily);
  const recolorRef = useCommittedRef(recolor);
  const showBrandLogoRef = useCommittedRef(showBrandLogo);
  const editsRef = useCommittedRef(edits);
  const brandLogoRef = useRef<LottieAppearance['brandLogo']>(undefined);
  /** The rasterized logo when this source shows it; every preview and export reads it here. */
  const activeBrandLogo = () => showBrandLogoRef.current ? brandLogoRef.current : undefined;
  const desiredPlayingRef = useRef(true);
  const reducedMotionRef = useRef(false);
  const lastFrameUpdateRef = useRef(0);
  const reloadFrameRef = useRef<number | null>(null);
  const reloadTimerRef = useRef<number | null>(null);
  const lastReloadRef = useRef(0);
  const sourceTransitionRef = useRef<number | null>(null);
  const segmentStartRef = useCommittedRef(segmentStart);
  const segmentEndRef = useCommittedRef(segmentEnd);
  const restoredSegmentRef = useRef<{ end: number; start: number } | null>(null);
  const projectWorkspaceActiveRef = useAncestorWorkspaceActivity(canvasRef, (workspaceActive) => {
    const player = playerRef.current;
    if (!player) return;
    if (!active || !workspaceActive) {
      player.freeze();
      return;
    }
    player.unfreeze();
    if (desiredPlayingRef.current) player.play();
  });

  const canvas = CANVAS_PRESETS[canvasPreset];
  const serializableSource = useMemo(() => ({
    category: source.category,
    data: source.format === 'json' ? source.data : null,
    description: source.description,
    fileName: source.fileName,
    format: source.format,
    id: source.id,
    name: source.name,
    provenance: source.provenance,
  }), [source]);
  const lottieState = useMemo<LottieCanvasState>(() => ({
    appearance: {
      accentColor,
      artColor,
      brandLogo: showBrandLogo,
      cornerRadius,
      recolor,
      secondaryColor,
      strokeWidth,
    },
    background: {
      color: background,
      materialId,
      materialSettings,
      style: backgroundStyle,
      transparent,
    },
    canvasPreset,
    edits,
    playback: {
      fit,
      interpolate,
      loop,
      mode,
      segmentEnd,
      segmentStart,
      speed,
    },
    source: serializableSource as LottieCanvasState['source'],
  }), [
    accentColor,
    artColor,
    background,
    backgroundStyle,
    canvasPreset,
    cornerRadius,
    edits,
    fit,
    interpolate,
    loop,
    materialId,
    materialSettings,
    mode,
    recolor,
    secondaryColor,
    segmentEnd,
    segmentStart,
    serializableSource,
    showBrandLogo,
    speed,
    strokeWidth,
    transparent,
  ]);
  // Slider drags settle before the portable document is rebuilt and serialized.
  const settledLottieState = useSettledLottieValue(lottieState, 180);
  const settledState = settledLottieState.value;
  const lottieRevision = useMemo(
    () => JSON.stringify({
      binarySource: source.portableDataUrl ? lottieDataSignature({ url: source.portableDataUrl }) : null,
      data: lottieDataSignature(settledState.source.data),
      state: { ...settledState, source: { ...settledState.source, data: null } },
    }),
    [settledState, source.portableDataUrl]
  );
  const lottieDocument = useMemo(() => {
    const settledCanvas = CANVAS_PRESETS[settledState.canvasPreset];
    const settledBackground = settledState.background;
    return createStudioCanvasDocument({
      background: settledBackground.transparent ? '#00000000' : settledBackground.color,
      brandId: identity.id,
      createdAt: documentCreatedAt,
      height: settledCanvas.height,
      id: `${identity.id}:lottie:composition`,
      layers: [
        {
          bounds: { height: settledCanvas.height, rotation: 0, width: settledCanvas.width, x: 0, y: 0 },
          data: { materialId: settledBackground.materialId, materialSettings: settledBackground.materialSettings, style: settledBackground.style, transparent: settledBackground.transparent },
          hidden: settledBackground.transparent,
          id: 'lottie-background',
          kind: settledBackground.style === 'shader' ? 'shader' as const : 'shape' as const,
          name: 'Canvas background',
        },
        {
          ...(settledState.source.format === 'dotlottie' && source.portableDataUrl ? {
            asset: {
              kind: 'binary' as const,
              name: settledState.source.fileName,
              source: source.portableDataUrl,
            },
          } : {}),
          bounds: { height: settledCanvas.height, rotation: 0, width: settledCanvas.width, x: 0, y: 0 },
          data: { fit: settledState.playback.fit, format: settledState.source.format, sourceId: settledState.source.id },
          id: 'lottie-animation',
          kind: 'component' as const,
          name: settledState.source.name,
        },
        ...(brandDisplayFont ? [{
          asset: {
            kind: 'font' as const,
            name: brandDisplayFont.label,
            source: brandDisplayFont.path,
          },
          bounds: { height: 1, rotation: 0, width: 1, x: 0, y: 0 },
          hidden: true,
          id: 'lottie-font',
          kind: 'component' as const,
          name: 'Display font',
        }] : []),
      ],
      revision: canvasRevisionFromSignature(lottieRevision),
      state: settledState,
      title: `${identity.name} Lottie`,
      toolId: 'lottie',
      updatedAt: documentCreatedAt,
      width: settledCanvas.width,
    });
  }, [brandDisplayFont, documentCreatedAt, identity.id, identity.name, lottieRevision, settledState, source.portableDataUrl]);
  const lottieWorkspaceKey = useMemo(
    () => savedDesignStorageKey(identity.id, 'lottie'),
    [identity.id]
  );
  const portableLottie = usePortableCanvasWorkspace({
    applySource: applyWorkspaceSource,
    document: lottieDocument,
    suspendAutosave: settledLottieState.pending,
    workspaceKey: lottieWorkspaceKey,
  });

  function applyPlaybackSettings(player: DotLottie) {
    player.setSpeed(speedRef.current);
    player.setLoop(loopRef.current);
    player.setUseFrameInterpolation(interpolateRef.current);
    player.setMode(modeRef.current);
    player.setBackgroundColor(
      transparentRef.current || backgroundStyleRef.current === 'shader'
        ? 'transparent'
        : backgroundRef.current
    );
    player.setLayout({ align: [0.5, 0.5], fit: fitRef.current });
  }

  function loadSource(nextSource: LottieSource) {
    setError(null);
    setIsSourceTransitioning(true);
    frames.publish(0);
    // The WebGL player can repaint its original scene when seeking after load().
    // Give each replacement a fresh native timeline and rendering surface.
    playerSourceRef.current = nextSource;
    setPlayerGeneration((generation) => generation + 1);
  }

  /**
   * Rebuilding the native player costs a WebGL context and a WASM parse, so
   * continuous colour or edit drags reload at most every 150ms, with a trailing
   * reload for the final value.
   */
  function scheduleSourceReload() {
    if (sourceRef.current.format !== 'json') return;
    if (reloadFrameRef.current !== null) window.cancelAnimationFrame(reloadFrameRef.current);
    if (reloadTimerRef.current !== null) window.clearTimeout(reloadTimerRef.current);
    const run = () => {
      reloadFrameRef.current = null;
      reloadTimerRef.current = null;
      lastReloadRef.current = performance.now();
      loadSource(sourceRef.current);
    };
    const wait = 150 - (performance.now() - lastReloadRef.current);
    if (wait <= 0) reloadFrameRef.current = window.requestAnimationFrame(run);
    else reloadTimerRef.current = window.setTimeout(run, wait);
  }

  useEffect(() => {
    if (!brandLogoAsset) return;
    let disposed = false;
    void imageUrlToDataUrl(brandLogoAsset.path)
      .then((dataUrl) => rasterizeImageDataUrl(dataUrl, artColor))
      .then((logo) => {
        if (disposed) return;
        brandLogoRef.current = { ...logo, label: identity.name };
        scheduleSourceReload();
      })
      .catch(() => { if (!disposed) brandLogoRef.current = undefined; });
    return () => { disposed = true; };
  }, [artColor, brandLogoAsset, identity.name]);

  useEffect(() => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    reducedMotionRef.current = prefersReducedMotion;
    if (prefersReducedMotion) desiredPlayingRef.current = false;
    setIsPlaying(desiredPlayingRef.current);
    void preloadLottieRuntime();
    const player = new DotLottie({
      autoplay: desiredPlayingRef.current,
      backgroundColor:
        transparentRef.current || backgroundStyleRef.current === 'shader'
          ? 'transparent'
          : backgroundRef.current,
      canvas: canvasElement,
      data: resolveSourceData(
        playerSourceRef.current,
        [artColorRef.current, secondaryColorRef.current, accentColorRef.current],
        cornerRadiusRef.current,
        strokeWidthRef.current,
        brandFontFamilyRef.current,
        activeBrandLogo(),
        recolorRef.current,
        editsRef.current,
      ),
      layout: { align: [0.5, 0.5], fit: fitRef.current },
      loop: loopRef.current,
      mode: modeRef.current,
      renderConfig: {
        autoResize: false,
        // Keep one stable native-density render target. dotLottie currently
        // races its WASM pixel buffer when a live canvas target is resized;
        // CSS can scale this preview without reallocating that buffer.
        devicePixelRatio: Math.min(window.devicePixelRatio, 2),
        freezeOnOffscreen: true,
        quality: 100,
      },
      speed: speedRef.current,
      useFrameInterpolation: interpolateRef.current,
    });
    playerRef.current = player;

    const handleLoad = () => {
      const frameCount = Math.max(1, Math.floor(player.totalFrames));
      const restoredSegment = restoredSegmentRef.current;
      const restoredStart = restoredSegment
        ? Math.max(0, Math.min(restoredSegment.start, frameCount - 2))
        : 0;
      const restoredEnd = restoredSegment
        ? Math.max(restoredStart + 1, Math.min(restoredSegment.end, frameCount - 1))
        : frameCount - 1;
      restoredSegmentRef.current = null;
      setTotalFrames(frameCount);
      setDuration(player.duration);
      setSegmentStart(restoredStart);
      setSegmentEnd(restoredEnd);
      segmentStartRef.current = restoredStart;
      segmentEndRef.current = restoredEnd;
      player.setSegment(restoredStart, restoredEnd);
      applyPlaybackSettings(player);
      setBundleMarkers(playerSourceRef.current.format === 'dotlottie'
        ? player.markers().map(({ duration, name, time }) => ({ duration, frame: time, name }))
        : []);
      if (desiredPlayingRef.current) {
        player.setFrame(restoredStart);
        player.play();
      } else {
        player.setFrame(Math.round((restoredStart + restoredEnd) / 2));
        player.pause();
      }
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setIsSourceTransitioning(false));
      });
      setError(null);
    };
    const handleFrame = ({ currentFrame: nextFrame }: { currentFrame: number }) => {
      const now = performance.now();
      if (now - lastFrameUpdateRef.current < 40) return;
      lastFrameUpdateRef.current = now;
      frames.publish(Math.round(nextFrame));
    };
    const handleLoadError = () => setError(gt('This Lottie file could not be loaded.'));
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => {
      // Flush the exact stopped pose instead of retaining a throttled display
      // value. Otherwise seeking to that displayed value can be a DOM no-op.
      frames.publish(Math.round(player.currentFrame));
      setIsPlaying(false);
    };
    const handleStop = () => {
      frames.publish(segmentStartRef.current);
      setIsPlaying(false);
    };
    player.addEventListener('load', handleLoad);
    player.addEventListener('frame', handleFrame);
    player.addEventListener('loadError', handleLoadError);
    player.addEventListener('play', handlePlay);
    player.addEventListener('pause', handlePause);
    player.addEventListener('stop', handleStop);

    return () => {
      if (reloadFrameRef.current !== null) {
        window.cancelAnimationFrame(reloadFrameRef.current);
      }
      if (reloadTimerRef.current !== null) window.clearTimeout(reloadTimerRef.current);
      if (sourceTransitionRef.current !== null) {
        window.clearTimeout(sourceTransitionRef.current);
      }
      player.removeEventListener('load', handleLoad);
      player.removeEventListener('frame', handleFrame);
      player.removeEventListener('loadError', handleLoadError);
      player.removeEventListener('play', handlePlay);
      player.removeEventListener('pause', handlePause);
      player.removeEventListener('stop', handleStop);
      player.destroy();
      playerRef.current = null;
    };
  }, [playerGeneration]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    if (!active || !projectWorkspaceActiveRef.current) {
      player.freeze();
      return;
    }
    player.unfreeze();
    if (desiredPlayingRef.current) player.play();
  }, [active, playerGeneration, projectWorkspaceActiveRef]);

  /**
   * A new source starts with no edits; built-in studies use palette slots and
   * the brand logo, imports keep their colours and get no logo.
   */
  function selectSource(nextSource: LottieSource, restored?: { brandLogo?: boolean; edits: LottieEdits; recolor: LottieRecolorMode }) {
    const example = nextSource.provenance === 'Glyphfield example';
    const nextEdits = restored?.edits ?? EMPTY_LOTTIE_EDITS;
    const nextRecolor = restored?.recolor ?? (example ? 'palette' : 'source');
    const nextBrandLogo = restored?.brandLogo ?? example;
    editsRef.current = nextEdits;
    recolorRef.current = nextRecolor;
    showBrandLogoRef.current = nextBrandLogo;
    setEdits(nextEdits);
    setRecolor(nextRecolor);
    setShowBrandLogo(nextBrandLogo);
    setSource(nextSource);
    desiredPlayingRef.current = !reducedMotionRef.current;
    setIsPlaying(!reducedMotionRef.current);
    setIsSourceTransitioning(true);
    if (sourceTransitionRef.current !== null) {
      window.clearTimeout(sourceTransitionRef.current);
    }
    sourceTransitionRef.current = window.setTimeout(() => {
      sourceTransitionRef.current = null;
      loadSource(nextSource);
    }, 110);
  }

  async function applyWorkspaceSource(nextSource: string) {
    const parsed = parseLottieWorkspaceSource(nextSource, lottieState);
    const restored = parsed.state;
    let nextData: ArrayBuffer | LottieDocument = restored.source.data ?? {};
    if (restored.source.format === 'dotlottie') {
      const href = parsed.binarySource ? resolveLocalAssetUrl(parsed.binarySource) : null;
      const response = href ? await fetch(href) : null;
      if (!response?.ok) throw new TypeError('The embedded .lottie bundle could not be read.');
      nextData = await response.arrayBuffer();
    }
    const nextLottieSource: LottieSource = {
      category: restored.source.category,
      data: nextData,
      description: restored.source.description,
      fileName: restored.source.fileName,
      format: restored.source.format,
      id: parsed.legacy ? `code-${crypto.randomUUID()}` : restored.source.id,
      name: restored.source.name,
      portableDataUrl: parsed.binarySource ?? undefined,
      provenance: restored.source.provenance,
    };

    artColorRef.current = restored.appearance.artColor;
    secondaryColorRef.current = restored.appearance.secondaryColor;
    accentColorRef.current = restored.appearance.accentColor;
    cornerRadiusRef.current = restored.appearance.cornerRadius;
    strokeWidthRef.current = restored.appearance.strokeWidth;
    backgroundRef.current = restored.background.color;
    backgroundStyleRef.current = restored.background.style;
    transparentRef.current = restored.background.transparent;
    speedRef.current = restored.playback.speed;
    loopRef.current = restored.playback.loop;
    interpolateRef.current = restored.playback.interpolate;
    fitRef.current = restored.playback.fit as Fit;
    modeRef.current = restored.playback.mode as Mode;
    restoredSegmentRef.current = {
      end: restored.playback.segmentEnd,
      start: restored.playback.segmentStart,
    };

    setBackground(restored.background.color);
    setBackgroundStyle(restored.background.style);
    setMaterialId(restored.background.materialId);
    setMaterialSettings(restored.background.materialSettings);
    setTransparent(restored.background.transparent);
    setArtColor(restored.appearance.artColor);
    setSecondaryColor(restored.appearance.secondaryColor);
    setAccentColor(restored.appearance.accentColor);
    setCornerRadius(restored.appearance.cornerRadius);
    setStrokeWidth(restored.appearance.strokeWidth);
    setSpeed(restored.playback.speed);
    setLoop(restored.playback.loop);
    setInterpolate(restored.playback.interpolate);
    setFit(restored.playback.fit as Fit);
    setMode(restored.playback.mode as Mode);
    updateCanvasPreset(restored.canvasPreset);
    selectSource(nextLottieSource, {
      brandLogo: restored.appearance.brandLogo,
      edits: restored.edits ?? EMPTY_LOTTIE_EDITS,
      recolor: restored.appearance.recolor ?? (parsed.legacy ? 'source' : 'palette'),
    });
  }

  async function importFile(file: File) {
    if (!isSupportedLottieFile(file.name, file.type)) {
      setError(gt('Choose a .lottie file or Lottie JSON document.'));
      return;
    }
    try {
      const isDotLottie = file.name.toLowerCase().endsWith('.lottie');
      const [data, portableDataUrl] = isDotLottie
        ? await Promise.all([file.arrayBuffer(), blobToDataUrl(file)])
        : [parseLottieDocument(JSON.parse(await file.text()) as Record<string, unknown>), undefined];
      const nextSource: LottieSource = {
        category: gt('Imported'),
        data,
        description: gt('Local file. It remains in this browser session.'),
        fileName: file.name,
        format: isDotLottie ? 'dotlottie' : 'json',
        id: crypto.randomUUID(),
        name: file.name.replace(/\.(json|lottie)$/i, ''),
        portableDataUrl,
        provenance: 'Local import',
      };
      selectSource(nextSource);
    } catch {
      setError(gt('The selected file is not valid Lottie data.'));
    }
  }

  function togglePlayback() {
    const player = playerRef.current;
    if (!player) return;
    if (player.isPlaying) {
      desiredPlayingRef.current = false;
      player.pause();
    } else {
      desiredPlayingRef.current = true;
      if (player.currentFrame >= segmentEndRef.current) player.setFrame(segmentStartRef.current);
      player.play();
    }
  }

  const scrubToFrame = useCallback((frame: number) => {
    const player = playerRef.current;
    player?.pause();
    desiredPlayingRef.current = false;
    setIsPlaying(false);
    player?.setFrame(frame);
    frames.publish(frame);
  }, [frames]);

  function restart() {
    const player = playerRef.current;
    if (!player) return;
    player.setFrame(segmentStartRef.current);
    desiredPlayingRef.current = true;
    player.play();
  }

  function updateSegment(start: number, end: number) {
    const resolvedStart = Math.max(0, Math.min(start, end - 1));
    const resolvedEnd = Math.min(totalFrames - 1, Math.max(end, resolvedStart + 1));
    setSegmentStart(resolvedStart);
    setSegmentEnd(resolvedEnd);
    segmentStartRef.current = resolvedStart;
    segmentEndRef.current = resolvedEnd;
    playerRef.current?.setSegment(resolvedStart, resolvedEnd);
  }

  function updateArtColor(value: string) {
    setArtColor(value);
    artColorRef.current = value;
    scheduleSourceReload();
  }

  function updateSecondaryColor(value: string) {
    setSecondaryColor(value);
    secondaryColorRef.current = value;
    scheduleSourceReload();
  }

  function updateAccentColor(value: string) {
    setAccentColor(value);
    accentColorRef.current = value;
    scheduleSourceReload();
  }

  function updateCornerRadius(value: number) {
    setCornerRadius(value);
    cornerRadiusRef.current = value;
    scheduleSourceReload();
  }

  function updateStrokeWidth(value: number) {
    setStrokeWidth(value);
    strokeWidthRef.current = value;
    scheduleSourceReload();
  }

  function useBrandPalette() {
    const [primary, secondary, accent] = brandMaterialColors;
    setArtColor(primary);
    setSecondaryColor(secondary);
    setAccentColor(accent);
    artColorRef.current = primary;
    secondaryColorRef.current = secondary;
    accentColorRef.current = accent;
    scheduleSourceReload();
  }

  function useStudioPalette() {
    updateBackground(DEFAULT_LOTTIE_BACKGROUND);
    setArtColor(DEFAULT_LOTTIE_ART_COLOR);
    setSecondaryColor(DEFAULT_LOTTIE_SECONDARY_COLOR);
    setAccentColor(DEFAULT_LOTTIE_ACCENT_COLOR);
    artColorRef.current = DEFAULT_LOTTIE_ART_COLOR;
    secondaryColorRef.current = DEFAULT_LOTTIE_SECONDARY_COLOR;
    accentColorRef.current = DEFAULT_LOTTIE_ACCENT_COLOR;
    scheduleSourceReload();
  }

  function useMonochromePalette() {
    updateBackground('#161816');
    setArtColor('#FFFFFF');
    setSecondaryColor('#8A8F98');
    setAccentColor('#FFFFFF');
    artColorRef.current = '#FFFFFF';
    secondaryColorRef.current = '#8A8F98';
    accentColorRef.current = '#FFFFFF';
    scheduleSourceReload();
  }

  function updateBackground(value: string) {
    setBackground(value);
    backgroundRef.current = value;
    if (!transparentRef.current && backgroundStyleRef.current === 'solid') {
      playerRef.current?.setBackgroundColor(value);
    }
  }

  function updateTransparency(value: boolean) {
    setTransparent(value);
    transparentRef.current = value;
    playerRef.current?.setBackgroundColor(
      value || backgroundStyleRef.current === 'shader'
        ? 'transparent'
        : backgroundRef.current
    );
  }

  function updateBackgroundStyle(value: BackgroundStyle) {
    setBackgroundStyle(value);
    backgroundStyleRef.current = value;
    playerRef.current?.setBackgroundColor(
      transparentRef.current || value === 'shader'
        ? 'transparent'
        : backgroundRef.current
    );
  }

  function updateCanvasPreset(value: CanvasPreset) {
    setCanvasPreset(value);
    const nextCanvas = CANVAS_PRESETS[value];
    const canvasElement = canvasRef.current;
    if (canvasElement) {
      canvasElement.width = nextCanvas.width;
      canvasElement.height = nextCanvas.height;
      window.requestAnimationFrame(() => playerRef.current?.resize());
    }
  }

  function downloadSource() {
    let asset: ExportPreviewAsset;
    if (source.format === 'dotlottie') {
      asset = {
        blob: new Blob([source.data as ArrayBuffer], { type: 'application/zip+dotlottie' }),
        fileName: source.fileName,
        format: 'LOTTIE',
        previewKind: 'file',
      };
      setLastExport(asset);
      return asset;
    }
    const data = resolveSourceData(
      source,
      [artColor, secondaryColor, accentColor],
      cornerRadius,
      strokeWidth,
      brandFontFamily,
      activeBrandLogo(),
      recolor,
      edits,
    ) as LottieDocument;
    const previewText = JSON.stringify(data, null, 2);
    asset = {
      blob: new Blob([previewText], { type: 'application/json' }),
      fileName: source.fileName,
      format: 'JSON',
      previewText,
    };
    setLastExport(asset);
    return asset;
  }

  async function downloadPng() {
    const lottieCanvas = canvasRef.current;
    const portableDocument = portableLottie.document;
    if (!lottieCanvas || !portableDocument) throw new Error('The portable Lottie composition is still preparing.');
    studioExport.start('Rendering Lottie frame preview');
    // The inspector display is throttled; capture the player's actual pose,
    // including a seek immediately followed by an export action.
    const exportFrame = playerRef.current?.currentFrame ?? frames.frameRef.current;
    const fileName = `${source.id}-frame-${Math.round(exportFrame)}.png`;
    try {
      const renderedLottie = await renderLottieFrame({
        data: resolveSourceData(
          source,
          [artColor, secondaryColor, accentColor],
          cornerRadius,
          strokeWidth,
          brandFontFamily,
          activeBrandLogo(),
          recolor,
          edits,
        ),
        fit,
        frame: exportFrame,
        height: canvas.height,
        width: canvas.width,
      });
      const shaderCanvas = shaderLayerRef.current?.querySelector('canvas') ?? null;
      const exported = await exportCanvasDocumentStill({
        canvasDocument: portableDocument,
        height: canvas.height,
        renderElement: (context, { element, outputBounds }) => {
          if (element.id === 'lottie-background') {
            if (element.kind === 'shader' && shaderCanvas) {
              context.drawImage(
                shaderCanvas,
                outputBounds.x,
                outputBounds.y,
                outputBounds.width,
                outputBounds.height
              );
            }
            return;
          }
          if (element.id === 'lottie-animation') {
            context.drawImage(
              renderedLottie,
              outputBounds.x,
              outputBounds.y,
              outputBounds.width,
              outputBounds.height
            );
          }
        },
        width: canvas.width,
      });
      const asset: ExportPreviewAsset = {
        blob: exported.blob,
        fileName,
        format: 'PNG',
        height: exported.height,
        width: exported.width,
      };
      setLastExport(asset);
      return asset;
    } finally {
      studioExport.finish();
    }
  }

  const sourceDocument = source.format === 'json' ? source.data as LottieDocument : null;
  const layerSummaries = useMemo(() => (sourceDocument ? listLottieLayers(sourceDocument) : []), [sourceDocument]);
  const textLayers = useMemo(() => (sourceDocument ? listLottieTextLayers(sourceDocument) : []), [sourceDocument]);
  const authoredMarkers = useMemo(() => (sourceDocument ? listLottieMarkers(sourceDocument) : []), [sourceDocument]);
  const activeMarkers = source.format === 'dotlottie' ? bundleMarkers : edits.markers ?? authoredMarkers;
  // Colours as the player shows them before the colour map: palette slots and geometry applied.
  const discoveredColors = useMemo(() => (sourceDocument
    ? listLottieColors(customizeSource(source, [artColor, secondaryColor, accentColor], cornerRadius, strokeWidth, brandFontFamily, undefined, recolor))
    : []), [accentColor, artColor, brandFontFamily, cornerRadius, recolor, secondaryColor, source, sourceDocument, strokeWidth]);
  const brandTokens = useMemo<BrandToken[]>(() => identity.colors.map(({ hex, id, name }) => ({ hex, id, name })), [identity.colors]);

  function updateEdits(update: (current: LottieEdits) => LottieEdits) {
    const next = update(editsRef.current);
    if (next === editsRef.current) return;
    editsRef.current = next;
    setEdits(next);
    scheduleSourceReload();
  }

  function setLayerVisibility(key: string, visible: boolean) {
    updateEdits((current) => ({
      ...current,
      hiddenLayers: visible ? current.hiddenLayers.filter((entry) => entry !== key) : [...new Set([...current.hiddenLayers, key])],
    }));
  }

  function setLayerText(key: string, text: string | null) {
    updateEdits((current) => {
      const textOverrides = { ...current.textOverrides };
      if (text === null) delete textOverrides[key];
      else textOverrides[key] = text.slice(0, 500);
      return { ...current, textOverrides };
    });
  }

  function setColorReplacement(from: string, to: string | null) {
    updateEdits((current) => {
      const colorMap = { ...current.colorMap };
      if (to === null) delete colorMap[from];
      else colorMap[from] = to.toUpperCase();
      return { ...current, colorMap };
    });
  }

  function mapColorsToBrand() {
    updateEdits((current) => ({ ...current, colorMap: brandLottieColorMap(discoveredColors.map(({ hex }) => hex), identity.colors) }));
  }

  function setMarkers(markers: LottieMarker[]) {
    // A draft restores at most MAX_LOTTIE_MARKERS, including edits to an imported file with more.
    updateEdits((current) => ({ ...current, markers: markers.slice(0, MAX_LOTTIE_MARKERS) }));
  }

  function addMarker() {
    const frame = Math.round(frames.frameRef.current);
    const end = frame < segmentEndRef.current ? segmentEndRef.current : Math.max(frame + 1, totalFrames - 1);
    const next = appendLottieMarker(activeMarkers, { duration: Math.max(1, end - frame), frame, name: `Segment ${activeMarkers.length + 1}` });
    if (next !== activeMarkers) setMarkers([...next]);
  }

  function playMarker(marker: LottieMarker) {
    const end = Math.min(totalFrames - 1, marker.frame + Math.max(1, marker.duration));
    updateSegment(marker.frame, end);
    const player = playerRef.current;
    if (!player) return;
    player.setFrame(marker.frame);
    desiredPlayingRef.current = true;
    player.play();
  }

  function setRecolorMode(mode: LottieRecolorMode) {
    recolorRef.current = mode;
    setRecolor(mode);
    scheduleSourceReload();
  }

  function setBrandLogoVisible(visible: boolean) {
    showBrandLogoRef.current = visible;
    setShowBrandLogo(visible);
    scheduleSourceReload();
  }

  function describeLottie() {
    return {
      colors: discoveredColors,
      edits: editsRef.current,
      format: source.format,
      frameRate: duration > 0 ? totalFrames / duration : 0,
      layers: layerSummaries,
      brandLogo: showBrandLogoRef.current,
      markers: activeMarkers,
      recolor: recolorRef.current,
      segment: { end: segmentEndRef.current, start: segmentStartRef.current },
      source: { id: source.id, name: source.name },
      textLayers,
      totalFrames,
    };
  }

  /** Validated patch over the current edits; every listed field replaces the stored one. */
  function applyLottieEditPatch(input: unknown) {
    if (source.format !== 'json') throw new Error('Layer, colour, and text edits apply to Lottie JSON. .lottie bundles keep their embedded artwork.');
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('lottie.edit requires { hiddenLayers?, colorMap?, textOverrides?, markers?, recolor?, brandLogo? }.');
    const patch = input as Record<string, unknown>;
    const allowed = new Set(['brandLogo', 'colorMap', 'hiddenLayers', 'markers', 'recolor', 'textOverrides']);
    for (const key of Object.keys(patch)) if (!allowed.has(key)) throw new TypeError(`lottie.edit does not accept ${key}.`);
    if (patch.recolor !== undefined && patch.recolor !== 'palette' && patch.recolor !== 'source') throw new TypeError("lottie.edit recolor must be 'palette' or 'source'.");
    if (patch.brandLogo !== undefined && typeof patch.brandLogo !== 'boolean') throw new TypeError('lottie.edit brandLogo must be true or false.');
    const next = normalizeLottieEdits({ ...editsRef.current, ...patch, brandLogo: undefined, recolor: undefined });
    const knownLayers = new Set(layerSummaries.map(({ key }) => key));
    const unknownLayer = [...next.hiddenLayers, ...Object.keys(next.textOverrides)].find((key) => !knownLayers.has(key));
    if (unknownLayer) throw new RangeError(`lottie.edit layer ${unknownLayer} is not in this document. Read lottie.describe for layer keys.`);
    flushSync(() => {
      if (patch.recolor === 'palette' || patch.recolor === 'source') setRecolorMode(patch.recolor);
      if (typeof patch.brandLogo === 'boolean') setBrandLogoVisible(patch.brandLogo);
      updateEdits(() => next);
    });
    return describeLottie();
  }

  function setSegmentFromInput(input: unknown) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('lottie.segment.set requires { marker } or { start, end }.');
    const request = input as { end?: unknown; marker?: unknown; start?: unknown };
    if (typeof request.marker === 'string') {
      const marker = activeMarkers.find(({ name }) => name === request.marker);
      if (!marker) throw new RangeError(`lottie.segment.set marker ${request.marker} is not in this document.`);
      flushSync(() => playMarker(marker));
      return describeLottie();
    }
    if (typeof request.start !== 'number' || typeof request.end !== 'number' || !Number.isFinite(request.start) || !Number.isFinite(request.end)) {
      throw new TypeError('lottie.segment.set start and end must be frame numbers.');
    }
    flushSync(() => updateSegment(Math.round(request.start as number), Math.round(request.end as number)));
    return describeLottie();
  }

  /**
   * Renders the trimmed segment through a dedicated player at output size, with
   * the composited background and live material at each output time.
   */
  async function exportMotion(format: 'gif' | 'mp4'): Promise<ExportPreviewAsset> {
    if (exportJobRef.current) throw new Error('Wait for the current Lottie export before starting another one.');
    exportJobRef.current = true;
    setExporting(true);
    studioExport.start(format === 'gif' ? 'Rendering Lottie GIF' : 'Rendering Lottie MP4', 0);
    const wasPlaying = desiredPlayingRef.current;
    playerRef.current?.pause();
    let exportPlayer: DotLottie | null = null;
    let shaderExport: { dispose: () => void; refresh: () => Promise<void>; sources: readonly { background?: { image?: CanvasImageSource } }[] } | null = null;
    try {
      const data = resolveSourceData(source, [artColor, secondaryColor, accentColor], cornerRadius, strokeWidth, brandFontFamily, activeBrandLogo(), recolor, edits);
      const loaded = await loadExportPlayer(data, fit, canvas.width, canvas.height, interpolate);
      exportPlayer = loaded.player;
      const timing = {
        frameRate: exportPlayer.duration > 0 ? exportPlayer.totalFrames / exportPlayer.duration : 60,
        mode,
        segmentEnd: segmentEndRef.current,
        segmentStart: segmentStartRef.current,
        speed,
      };
      const usesShader = !transparent && backgroundStyle === 'shader';
      if (usesShader) {
        const { createAnimationShaderExport } = await import('@/lib/animationShaderExport');
        shaderExport = createAnimationShaderExport(
          [{ background: { angle: 0, colorA: materialSettings.colorA, colorB: materialSettings.colorB, colorC: materialSettings.colorC, materialId, materialSettings, style: 'shader' }, id: 'lottie-background', kind: 'text', text: '' }],
          () => ({ key: 'lottie-background', root: () => shaderLayerRef.current })
        );
      }
      const output = document.createElement('canvas');
      output.width = canvas.width;
      output.height = canvas.height;
      const context = output.getContext('2d', { willReadFrequently: true });
      const gl = loaded.surface.getContext('webgl2') ?? loaded.surface.getContext('webgl');
      if (!context || !gl) throw new Error('Canvas rendering is unavailable.');
      const readback = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
      const frame = new ImageData(gl.drawingBufferWidth, gl.drawingBufferHeight);
      const renderFrame = async ({ timeMs }: { timeMs: number }) => {
        if (shaderExport) {
          flushSync(() => setShaderCaptureTimeMs(timeMs));
          await shaderExport.refresh();
          const image = shaderExport.sources[0]?.background?.image;
          if (image) context.drawImage(image, 0, 0, output.width, output.height);
          frame.data.set(context.getImageData(0, 0, output.width, output.height).data);
        } else {
          // GIF and MP4 have no alpha: a transparent canvas flattens onto its colour.
          fillOpaque(frame.data, background);
        }
        exportPlayer!.setFrame(Math.max(0, Math.min(exportPlayer!.totalFrames - 1, lottieExportFrameAt(timeMs, timing))));
        gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, readback);
        blendPremultipliedFrame(readback, frame.data, gl.drawingBufferWidth, gl.drawingBufferHeight);
        context.putImageData(frame, 0, 0);
      };
      const onProgress = (progress: number) => studioExport.update(progress);
      const durationMs = lottieExportDurationMs(timing);
      const { encodeCanvasGif, encodeCanvasMp4 } = await import('@/lib/canvasExport');
      const blob = format === 'gif'
        ? await encodeCanvasGif({ canvas: output, colors: 256, durationMs, fps: 25, onProgress, paletteFormat: 'rgb565', paletteStrategy: 'global', protectedColors: [artColor, secondaryColor, accentColor], renderFrame })
        : await encodeCanvasMp4({ canvas: output, durationMs, fps: 30, onProgress, quality: 'balanced', renderFrame });
      const asset: ExportPreviewAsset = {
        blob,
        fileName: `${source.id}.${format}`,
        format: format === 'gif' ? 'GIF' : 'MP4',
        height: output.height,
        width: output.width,
      };
      setLastExport(asset);
      return asset;
    } finally {
      exportPlayer?.destroy();
      shaderExport?.dispose();
      setShaderCaptureTimeMs(null);
      exportJobRef.current = false;
      setExporting(false);
      studioExport.finish();
      if (wasPlaying) playerRef.current?.play();
    }
  }

  async function requestMotionExport(format: 'gif' | 'mp4') {
    try {
      setError(null);
      await exportMotion(format);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : gt('The Lottie motion export failed.'));
    }
  }

  const panelActions = useStableLottieHandlers({
    addMarker,
    mapColorsToBrand,
    playMarker,
    removeMarker: (index: number) => setMarkers(activeMarkers.filter((_, position) => position !== index)),
    renameMarker: (index: number, name: string) => setMarkers(activeMarkers.map((marker, position) => position === index ? { ...marker, name: name.slice(0, 64) || marker.name } : marker)),
    resetColorMap: () => updateEdits((current) => ({ ...current, colorMap: {} })),
    setColorReplacement,
    setLayerText,
    setLayerVisibility,
    updateAccentColor,
    updateArtColor,
    updateSecondaryColor,
  });

  const lottieAutomationRef = useCommittedRef({
    applyEditPatch: applyLottieEditPatch,
    applySource: applyWorkspaceSource,
    describe: describeLottie,
    downloadPng,
    downloadSource,
    exportMotion,
    mapColorsToBrand: () => {
      if (source.format !== 'json') throw new Error('Brand token mapping applies to Lottie JSON.');
      flushSync(mapColorsToBrand);
      return describeLottie();
    },
    setSegment: setSegmentFromInput,
    source: portableLottie.source,
  });
  useEffect(() => registerStudioAutomation({
    actions: studioToolActionNames('lottie'),
    applySource: (source) => lottieAutomationRef.current.applySource(source),
    getSource: () => {
      const source = lottieAutomationRef.current.source;
      if (source === null) throw new Error('The portable Lottie source is still preparing.');
      return source;
    },
    invoke: async (action, input) => {
      let asset: ExportPreviewAsset;
      let download = false;
      const automation = lottieAutomationRef.current;
      const editing = invokeLottieEditing(automation, action, input);
      if (editing !== undefined) return editing;
      if (action === 'lottie.export') {
        const request = parseLottieExportRequest(input);
        download = request.download;
        asset = request.format === 'png'
          ? await automation.downloadPng()
          : request.format === 'source'
            ? automation.downloadSource()
            : await automation.exportMotion(request.format);
      } else if (action === 'lottie.export.gif' || action === 'lottie.export.mp4') {
        asset = await automation.exportMotion(action === 'lottie.export.gif' ? 'gif' : 'mp4');
      } else if (action === 'lottie.export.frame.png') {
        asset = await lottieAutomationRef.current.downloadPng();
      } else if (action === 'lottie.export.source') {
        asset = lottieAutomationRef.current.downloadSource();
      } else {
        throw new RangeError(`Unknown Lottie action: ${action}.`);
      }
      if (download) downloadStudioArtifact(asset);
      return asset;
    },
    toolId: 'lottie',
  }, studioRootRef.current), [lottieAutomationRef]);

  function resetEditor() {
    setBackground(brandDefaults.background);
    updateBackgroundStyle('solid');
    setMaterialId(DEFAULT_LIVE_MATERIAL_ID);
    setMaterialSettings(defaultMaterialSettings);
    setTransparent(false);
    setArtColor(brandDefaults.art);
    setSecondaryColor(brandDefaults.secondary);
    setAccentColor(brandDefaults.accent);
    setCornerRadius(DEFAULT_LOTTIE_CORNER_RADIUS);
    setStrokeWidth(DEFAULT_LOTTIE_STROKE_WIDTH);
    setSpeed(1);
    setLoop(true);
    setInterpolate(true);
    setFit('contain');
    setMode('forward');
    updateCanvasPreset('landscape');
    backgroundRef.current = brandDefaults.background;
    transparentRef.current = false;
    artColorRef.current = brandDefaults.art;
    secondaryColorRef.current = brandDefaults.secondary;
    accentColorRef.current = brandDefaults.accent;
    cornerRadiusRef.current = DEFAULT_LOTTIE_CORNER_RADIUS;
    strokeWidthRef.current = DEFAULT_LOTTIE_STROKE_WIDTH;
    speedRef.current = 1;
    loopRef.current = true;
    interpolateRef.current = true;
    fitRef.current = 'contain';
    modeRef.current = 'forward';
    selectSource(DEFAULT_SOURCE);
  }

  function renderHeader() {
    return (
      <StudioToolHeader
        actions={(
          <>
          <StudioFileMenu sourceDisabled={portableLottie.source === null} onSource={() => setSourceOpen(true)} sections={[
            { label: gt('Workspace'), items: [{ id: 'reset', label: gt('Reset Lottie editor'), description: gt('Return to the starting animation and settings.'), icon: <RotateCcw />, onSelect: resetEditor }] },
          ]} />
          <ExportPreview asset={lastExport} />
          <Button disabled={!portableLottie.document || isSourceTransitioning || exporting} onClick={() => void downloadPng()} type='button' variant='outline'>
            <ImageDown aria-hidden='true' />
            <T>Export frame</T>
          </Button>
          <Button aria-label={gt('Export Lottie GIF')} disabled={isSourceTransitioning || exporting} onClick={() => void requestMotionExport('gif')} type='button' variant='outline'>
            <Download aria-hidden='true' />
            <T>GIF</T>
          </Button>
          <Button aria-label={gt('Export Lottie MP4')} disabled={isSourceTransitioning || exporting} onClick={() => void requestMotionExport('mp4')} type='button' variant='outline'>
            <Clapperboard aria-hidden='true' />
            <T>MP4</T>
          </Button>
          <Button onClick={downloadSource} type='button'>
            <Download aria-hidden='true' />
            {source.format === 'dotlottie' ? <T>Export .lottie</T> : <T>Export JSON</T>}
          </Button>
          </>
        )}
        metadata={source.name}
        status={(
          <DesignVersionControls
            autosaveState={portableLottie.autosaveState}
            identityId={identity.id}
            onOpen={applyWorkspaceSource}
            revision={String(lottieDocument.revision)}
            source={() => portableLottie.source}
            toolId='lottie'
            workspaceLabel='Lottie'
          />
        )}
        title={<T>Lottie</T>}
        toolId='lottie'
      />
    );
  }

  function renderSourceLibrary() {
    return (
        <StudioSidebar
          className='lottie-source-sidebar min-h-0'
          density='compact'
          kind='library'
          label={gt('Lottie sources')}
          storageKey={`lottie-source-v2-${identity.id}`}
        >
          <LabPanelHeading
            description={<T>Import a file or start from a production-ready motion study.</T>}
            title={<T>Lottie sources</T>}
          />
          <InspectorSection index='01' title={<T>Source</T>}>
            <label className='flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-input px-4 py-5 text-sm font-medium hover:bg-muted'>
              <Upload aria-hidden='true' className='size-4' />
              <T>Import .lottie or JSON</T>
              <input
                accept='.lottie,.json,application/json,application/zip+dotlottie'
                className='sr-only'
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importFile(file);
                  event.target.value = '';
                }}
                type='file'
              />
            </label>
            <div className='grid gap-1.5'>
              {EXAMPLE_SOURCES.map((example, index) => (
                <button
                  aria-pressed={source.id === example.id}
                  className={`grid min-h-[68px] grid-cols-[38px_minmax(0,1fr)] items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors ${source.id === example.id ? 'border-border bg-muted' : 'border-border bg-background hover:bg-muted/60'}`}
                  key={example.id}
                  onClick={() => selectSource(example)}
                  type='button'
                >
                  <span className={`grid size-[38px] place-items-center rounded-sm text-xs font-semibold tabular-nums ${source.id === example.id ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>{String(index + 1).padStart(2, '0')}</span>
                  <span className='min-w-0'>
                    <span className='block truncate text-sm font-medium leading-5'>{example.name}</span>
                    <span className='mt-0.5 line-clamp-2 block text-xs leading-4 text-muted-foreground'>{example.description}</span>
                  </span>
                </button>
              ))}
            </div>
            <p className='text-xs leading-5 text-muted-foreground'>{source.provenance} · {source.format === 'dotlottie' ? '.lottie' : 'JSON'} · {source.category}</p>
            <a className='inline-flex items-center gap-2 text-xs font-medium underline decoration-border underline-offset-4 hover:decoration-foreground' href='https://lottiefiles.com/free-animations' rel='noreferrer' target='_blank'>
              <T>Browse LottieFiles</T>
              <ExternalLink aria-hidden='true' className='size-3.5' />
            </a>
            <p className='text-xs leading-5 text-muted-foreground'><T>Imported files stay local. Verify the license before redistributing third-party animation work.</T></p>
          </InspectorSection>
        </StudioSidebar>
    );
  }

  function renderProperties() {
    return (
        <StudioSidebar
          className='lottie-properties-sidebar min-h-0'
          density='compact'
          label={gt('Lottie properties')}
          side='right'
          storageKey={`lottie-properties-v2-${identity.id}`}
        >
          <LabPanelHeading
            description={<T>Shape playback, art direction, and delivery for this animation.</T>}
            title={source.name}
          />
          <InspectorSection index='02' title={<T>Playback</T>}>
            <div className='grid grid-cols-2 gap-2'>
              <Button onClick={togglePlayback} type='button' variant='outline'>
                {isPlaying ? <Pause aria-hidden='true' /> : <Play aria-hidden='true' />}
                {isPlaying ? <T>Pause</T> : <T>Play</T>}
              </Button>
              <Button onClick={restart} type='button' variant='outline'><RotateCcw aria-hidden='true' /><T>Restart</T></Button>
            </div>
            <RangeControl label={<T>Speed</T>} max={3} min={0.1} onChange={(value) => { setSpeed(value); speedRef.current = value; playerRef.current?.setSpeed(value); }} step={0.1} suffix='×' value={speed} />
            <StudioSelect ariaLabel={gt('Playback direction')} onValueChange={(value) => { const next = value as Mode; setMode(next); modeRef.current = next; playerRef.current?.setMode(next); }} options={[
              { label: gt('Forward'), value: 'forward' },
              { label: gt('Reverse'), value: 'reverse' },
              { label: gt('Bounce'), value: 'bounce' },
              { label: gt('Reverse bounce'), value: 'reverse-bounce' },
            ]} value={mode} />
            <label className='flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2 text-sm'><span><T>Loop</T></span><StudioCheckbox checked={loop} onChange={(event) => { setLoop(event.target.checked); loopRef.current = event.target.checked; playerRef.current?.setLoop(event.target.checked); }} /></label>
            <label className='flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2 text-sm'><span><T>Frame interpolation</T></span><StudioCheckbox checked={interpolate} onChange={(event) => { setInterpolate(event.target.checked); interpolateRef.current = event.target.checked; playerRef.current?.setUseFrameInterpolation(event.target.checked); }} /></label>
            <div className='grid grid-cols-2 gap-3'>
              <RangeControl label={<T>In</T>} max={Math.max(1, segmentEnd - 1)} min={0} onChange={(value) => updateSegment(value, segmentEnd)} value={segmentStart} />
              <RangeControl label={<T>Out</T>} max={Math.max(1, totalFrames - 1)} min={Math.min(totalFrames - 1, segmentStart + 1)} onChange={(value) => updateSegment(segmentStart, value)} value={segmentEnd} />
            </div>
          </InspectorSection>

          <InspectorSection index='03' title={<T>Markers</T>}>
            <LottieMarkerControls
              editable={source.format === 'json'}
              markers={activeMarkers}
              onAddMarker={panelActions.addMarker}
              onPlayMarker={panelActions.playMarker}
              onRemoveMarker={panelActions.removeMarker}
              onRenameMarker={panelActions.renameMarker}
            />
          </InspectorSection>

          <InspectorSection index='04' title={<T>Layers</T>}>
            {source.format === 'json' ? (
              <>
                <p className='text-xs leading-5 text-muted-foreground'><T>Hide layers or rewrite text. Edits stay non-destructive: the source document is kept and exports carry the edited result.</T></p>
                <LottieLayerControls
                  hiddenLayers={edits.hiddenLayers}
                  layers={layerSummaries}
                  onTextChange={panelActions.setLayerText}
                  onVisibilityChange={panelActions.setLayerVisibility}
                  textLayers={textLayers}
                  textOverrides={edits.textOverrides}
                />
              </>
            ) : <p className='text-xs leading-5 text-muted-foreground'><T>.lottie bundles keep their embedded layers. Import the JSON to hide layers or edit text.</T></p>}
          </InspectorSection>

          <InspectorSection index='05' title={<T>Appearance</T>}>
            <StudioSelect ariaLabel={gt('Canvas size')} onValueChange={(value) => updateCanvasPreset(value as CanvasPreset)} options={Object.entries(CANVAS_PRESETS).map(([value, preset]) => ({ label: gt(preset.label), value }))} value={canvasPreset} />
            <StudioSelect ariaLabel={gt('Animation fit')} onValueChange={(value) => { const next = value as Fit; setFit(next); fitRef.current = next; playerRef.current?.setLayout({ align: [0.5, 0.5], fit: next }); }} options={[
              { label: gt('Contain'), value: 'contain' },
              { label: gt('Cover'), value: 'cover' },
              { label: gt('Fill'), value: 'fill' },
              { label: gt('Fit width'), value: 'fit-width' },
              { label: gt('Fit height'), value: 'fit-height' },
            ]} value={fit} />
            <label className='flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2 text-sm'><span><T>Transparent background</T></span><StudioCheckbox checked={transparent} onChange={(event) => updateTransparency(event.target.checked)} /></label>
            {transparent ? null : (
              <StudioSelect
                ariaLabel={gt('Canvas background type')}
                onValueChange={(value) => updateBackgroundStyle(value as BackgroundStyle)}
                options={[
                  { label: gt('Solid color'), value: 'solid' },
                  { label: gt('Live material'), value: 'shader' },
                ]}
                value={backgroundStyle}
              />
            )}
            {transparent || backgroundStyle === 'shader' ? null : <ColorControl ariaLabel={gt('Canvas background')} label={<T>Canvas background</T>} onChange={updateBackground} value={background} />}
            {source.format === 'json' ? (
              <div className='flex flex-col gap-3'>
                <p className='text-xs leading-5 text-muted-foreground'><T>Start with a crisp studio palette, switch to monochrome, or pull colors from this brand. Every slot stays editable.</T></p>
                <div className='grid grid-cols-3 gap-1.5'>
                  <Button onClick={useStudioPalette} size='sm' type='button' variant='outline'><T>Studio</T></Button>
                  <Button onClick={useMonochromePalette} size='sm' type='button' variant='outline'><T>Mono</T></Button>
                  <Button onClick={useBrandPalette} size='sm' type='button' variant='outline'><T>Brand</T></Button>
                </div>
                <ColorControl ariaLabel={gt('Primary artwork color')} label={<T>Primary</T>} onChange={updateArtColor} value={artColor} />
                <BrandTokenChips onSelect={panelActions.updateArtColor} target={gt('Primary')} tokens={brandTokens} value={artColor} />
                <ColorControl ariaLabel={gt('Secondary artwork color')} label={<T>Secondary</T>} onChange={updateSecondaryColor} value={secondaryColor} />
                <BrandTokenChips onSelect={panelActions.updateSecondaryColor} target={gt('Secondary')} tokens={brandTokens} value={secondaryColor} />
                <ColorControl ariaLabel={gt('Accent artwork color')} label={<T>Accent</T>} onChange={updateAccentColor} value={accentColor} />
                <BrandTokenChips onSelect={panelActions.updateAccentColor} target={gt('Accent')} tokens={brandTokens} value={accentColor} />
                {recolor === 'palette' ? (
                  <>
                    <RangeControl label={<T>Corner radius</T>} max={48} min={0} onChange={updateCornerRadius} suffix=' px' value={cornerRadius} />
                    <RangeControl label={<T>Stroke width</T>} max={16} min={1} onChange={updateStrokeWidth} suffix=' px' value={strokeWidth} />
                  </>
                ) : null}
                <LottieRecolorModeToggle checked={recolor === 'palette'} onChange={(checked) => setRecolorMode(checked ? 'palette' : 'source')} />
                {brandLogoAsset ? <LottieBrandLogoToggle checked={showBrandLogo} onChange={setBrandLogoVisible} /> : null}
                {recolor === 'source' ? (
                  <div className='flex flex-col gap-2 border-t border-border pt-3'>
                    <p className='text-sm font-medium'><T>Document colours</T></p>
                    <LottieSourceColorControls
                      colorMap={edits.colorMap}
                      colors={discoveredColors}
                      onBrandMap={panelActions.mapColorsToBrand}
                      onChange={panelActions.setColorReplacement}
                      onReset={panelActions.resetColorMap}
                      tokens={brandTokens}
                    />
                  </div>
                ) : null}
              </div>
            ) : <p className='text-xs leading-5 text-muted-foreground'><T>Generic .lottie bundles keep their embedded colors. Recolor JSON artwork here, or use named dotLottie themes when the source provides them.</T></p>}
          </InspectorSection>

          {transparent || backgroundStyle !== 'shader' ? null : (
            <InspectorSection index='06' title={<T>Live material</T>}>
              <p className='text-xs leading-5 text-muted-foreground'><T>Use the same shaders, palettes, look presets, and motion parameters available in Design Lab and Animation.</T></p>
              <LiveMaterialControls
                identity={identity}
                materialId={materialId}
                onMaterialIdChange={setMaterialId}
                onSettingsChange={setMaterialSettings}
                settings={materialSettings}
              />
            </InspectorSection>
          )}
        </StudioSidebar>
    );
  }

  function renderCanvasPanel() {
    return (
        <section className='lottie-canvas flex min-h-0 min-w-0 flex-col bg-muted/20'>
          <div className='flex h-10 items-center justify-between border-b border-border bg-background px-4 text-xs text-muted-foreground'>
            <span>{canvas.width} × {canvas.height}</span>
            <span>{Math.round(totalFrames)} <T>frames</T> · {duration.toFixed(2)}s · {speed.toFixed(1)}×</span>
          </div>
          <CanvasViewport
            className='min-h-0 flex-1'
            identityId={identity.id}
            stageClassName='studio-stage flex min-h-full items-center justify-center p-8'
            toolId='lottie'
          >
            <div className='relative w-full max-w-6xl overflow-hidden rounded-sm smooth-shadow-ring-lg' style={{ aspectRatio: `${canvas.width} / ${canvas.height}`, backgroundColor: transparent || backgroundStyle === 'shader' ? undefined : background, backgroundImage: transparent ? 'linear-gradient(45deg,var(--color-muted)_25%,transparent_25%),linear-gradient(-45deg,var(--color-muted)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--color-muted)_75%),linear-gradient(-45deg,transparent_75%,var(--color-muted)_75%)' : undefined, backgroundPosition: transparent ? '0 0,0 8px,8px -8px,-8px 0' : undefined, backgroundSize: transparent ? '16px 16px' : undefined }}>
              {transparent || backgroundStyle !== 'shader' ? null : (
                <div className='absolute inset-0' ref={shaderLayerRef}>
                  <LiveMaterialCanvas captureTimeMs={shaderCaptureTimeMs} enabled={active || exporting} materialId={materialId} paused={!exporting && (!active || !isPlaying)} settings={materialSettings} />
                </div>
              )}
              <canvas
                key={playerGeneration}
                aria-label={gt('Lottie animation preview')}
                className={`absolute inset-0 z-10 size-full transition-[opacity,transform] duration-200 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${isSourceTransitioning ? 'translate-y-px scale-[.998] opacity-0' : 'translate-y-0 scale-100 opacity-100'}`}
                ref={canvasRef}
              />
            </div>
          </CanvasViewport>
          <LottieTransport
            isPlaying={isPlaying}
            markers={activeMarkers}
            onScrub={scrubToFrame}
            onTogglePlayback={togglePlayback}
            segmentEnd={segmentEnd}
            segmentStart={segmentStart}
            subscribeToFrame={frames.subscribe}
            totalFrames={totalFrames}
          />
          {error ? <div className='border-t border-status-error-border bg-status-error-background px-4 py-3 text-sm text-status-error' role='alert'>{error}</div> : null}
        </section>
    );
  }

  function renderSourceDrawer() {
    return sourceOpen && portableLottie.source ? (
        <SourceCodeDrawer
          format='JSON · portable Lottie composition'
          onApply={applyWorkspaceSource}
          onClose={() => setSourceOpen(false)}
          source={portableLottie.source}
          title={gt('Lottie composition code')}
        />
    ) : null;
  }

  return (
    <MotionTranslationContext.Provider value={motionGT}>
    <div className='source-code-host tool-shell flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground' ref={studioRootRef}>
      {renderHeader()}
      <div className='lottie-editor-body lab-workspace min-h-0 flex-1'>
        {renderSourceLibrary()}
        {renderProperties()}
        {renderCanvasPanel()}
      </div>
      {renderSourceDrawer()}
    </div>
    </MotionTranslationContext.Provider>
  );
}
