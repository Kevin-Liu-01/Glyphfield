'use client';

import { DotLottie, type Fit, type Mode } from '@lottiefiles/dotlottie-web/webgl';
import { T, useGT } from 'gt-next';
import {
  Download,
  ExternalLink,
  ImageDown,
  Pause,
  Play,
  RotateCcw,
  Upload,
} from '@/components/ui/SolidIcons';
import { useMemo, useRef, useState, type ReactNode } from 'react';

import CanvasViewport from '@/components/CanvasViewport';
import DesignVersionControls from '@/components/DesignVersionControls';
import ExportPreview, { type ExportPreviewAsset } from '@/components/ExportPreview';
import LiveMaterialCanvas from '@/components/LiveMaterialCanvas';
import LiveMaterialControls from '@/components/LiveMaterialControls';
import { LabInspectorSection, LabPanelHeading, StudioSidebar } from '@/components/LabWorkspace';
import SourceCodeDrawer, { SourceCodeButton } from '@/components/SourceCodeDrawer';
import { useStudioExportProgress } from '@/components/StudioExportProgress';
import StudioRangeLabel from '@/components/StudioRangeLabel';
import StudioToolHeader from '@/components/StudioToolHeader';
import { Button } from '@/components/ui/Button';
import ColorControl from '@/components/ui/ColorControl';
import StudioSelect from '@/components/ui/StudioSelect';
import { useCommittedRef } from '@/hooks/useCommittedRef';
import { useMountEffect } from '@/hooks/useMountEffect';
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
import { blobToDataUrl, imageUrlToDataUrl } from '@/lib/download';
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
} from '@/lib/lottieCanvasDocument';
import {
  customizeLottieDocument,
  LOTTIE_EXAMPLES,
  type LottieAppearance,
  type LottieDocument,
} from '@/lib/lottieExamples';
import { isSupportedLottieFile } from '@/lib/studio';
import { savedDesignStorageKey } from '@/lib/savedDesigns';
import {
  createStudioCanvasDocument,
} from '@/lib/studioCanvasDocument';
import { templateBrandLogo } from '@/lib/templateAssets';
import type { BackgroundStyle } from '@/lib/renderFrame';

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
  fileName: 'dashboard-launch.json',
  format: 'json',
  id: LOTTIE_EXAMPLES[0]?.id ?? 'dashboard-launch',
  name: LOTTIE_EXAMPLES[0]?.name ?? 'Dashboard launch',
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

const DEFAULT_LOTTIE_BACKGROUND = '#0B0D10';
const DEFAULT_LOTTIE_CORNER_RADIUS = 8;
const DEFAULT_LOTTIE_STROKE_WIDTH = 2;

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
  return (
    <label className='flex flex-col gap-2'>
      <StudioRangeLabel
        className='text-sm'
        label={label}
        value={<output className='text-xs tabular-nums text-muted-foreground'>{value}{suffix}</output>}
      />
      <input
        className='studio-range'
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type='range'
        value={value}
      />
    </label>
  );
}

function resolveSourceData(
  source: LottieSource,
  colors: readonly string[],
  cornerRadius: number,
  strokeWidth: number,
  fontFamily: string,
  brandLogo?: LottieAppearance['brandLogo'],
) {
  return source.format === 'json'
    ? customizeLottieDocument(source.data as LottieDocument, {
        brandLogo,
        colors,
        cornerRadius,
        fontFamily,
        strokeWidth,
      })
    : source.data;
}

function rasterizeImageDataUrl(
  source: string,
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
      resolve({ dataUrl: canvas.toDataURL('image/png'), height, width });
    };
    image.addEventListener('load', finish, { once: true });
    image.addEventListener('error', () => reject(new DOMException('The brand logo could not be loaded.')), { once: true });
    image.src = source;
  });
}

export default function LottieStudio({ identity }: { identity: BrandIdentity }) {
  const gt = useGT();
  const studioExport = useStudioExportProgress(`${identity.id}:lottie`);
  const brandFontFamily = brandTypographyFamily(identity, 'Display');
  const brandDisplayTypography = brandTypographyRole(identity, 'Display');
  const brandDisplayFont = brandFontAssets(identity).find(({ id }) => id === brandDisplayTypography.fontId);
  const brandLogoAsset = templateBrandLogo(identity, 'blog', true);
  const defaultSurface = identity.colors.find(({ id }) => id === 'paper')?.hex ?? '#FFFFFF';
  const brandMaterialColors = brandMaterialPalette(identity).colors;
  const defaultSecondary = identity.colors.find(({ id }) => id === 'progress')?.hex
    ?? identity.colors.find(({ id }) => id === 'error')?.hex
    ?? brandMaterialColors[1];
  const defaultAccent = identity.colors.find(({ id }) => id === 'emphasis')?.hex
    ?? identity.colors.find(({ id }) => id === 'success')?.hex
    ?? brandMaterialColors[2];
  const defaultMaterialSettings: LiveMaterialSettings = {
    ...DEFAULT_LIVE_MATERIAL_SETTINGS,
    colorA: brandMaterialColors[0],
    colorB: brandMaterialColors[1],
    colorC: brandMaterialColors[2],
  };
  const [source, setSource] = useState<LottieSource>(DEFAULT_SOURCE);
  const [canvasPreset, setCanvasPreset] = useStudioDraft<CanvasPreset>(identity.id, 'lottie', 'canvas-preset', 'landscape');
  const [background, setBackground] = useStudioDraft(identity.id, 'lottie', 'background-v3', DEFAULT_LOTTIE_BACKGROUND);
  const [backgroundStyle, setBackgroundStyle] = useStudioDraft<BackgroundStyle>(identity.id, 'lottie', 'background-style-v3', 'solid');
  const [materialId, setMaterialId] = useStudioDraft<LiveMaterialId>(identity.id, 'lottie', 'material-id', DEFAULT_LIVE_MATERIAL_ID);
  const [materialSettings, setMaterialSettings] = useStudioDraft<LiveMaterialSettings>(identity.id, 'lottie', 'material-settings', defaultMaterialSettings);
  const [transparent, setTransparent] = useStudioDraft(identity.id, 'lottie', 'transparent', false);
  const [artColor, setArtColor] = useStudioDraft(identity.id, 'lottie', 'art-color-v3', defaultSurface);
  const [secondaryColor, setSecondaryColor] = useStudioDraft(identity.id, 'lottie', 'secondary-color-v3', defaultSecondary);
  const [accentColor, setAccentColor] = useStudioDraft(identity.id, 'lottie', 'accent-color-v3', defaultAccent);
  const [cornerRadius, setCornerRadius] = useStudioDraft(identity.id, 'lottie', 'corner-radius-v2', DEFAULT_LOTTIE_CORNER_RADIUS);
  const [strokeWidth, setStrokeWidth] = useStudioDraft(identity.id, 'lottie', 'stroke-width-v3', DEFAULT_LOTTIE_STROKE_WIDTH);
  const [speed, setSpeed] = useStudioDraft(identity.id, 'lottie', 'speed', 1);
  const [loop, setLoop] = useStudioDraft(identity.id, 'lottie', 'loop', true);
  const [interpolate, setInterpolate] = useStudioDraft(identity.id, 'lottie', 'interpolate', true);
  const [fit, setFit] = useStudioDraft<Fit>(identity.id, 'lottie', 'fit', 'contain');
  const [mode, setMode] = useStudioDraft<Mode>(identity.id, 'lottie', 'mode', 'forward');
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(240);
  const [duration, setDuration] = useState(4);
  const [segmentStart, setSegmentStart] = useState(0);
  const [segmentEnd, setSegmentEnd] = useState(239);
  const [isSourceTransitioning, setIsSourceTransitioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [lastExport, setLastExport] = useState<ExportPreviewAsset | null>(null);
  const [documentCreatedAt] = useState(() => new Date().toISOString());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shaderLayerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<DotLottie | null>(null);
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
  const brandLogoRef = useRef<LottieAppearance['brandLogo']>(undefined);
  const desiredPlayingRef = useRef(true);
  const lastFrameUpdateRef = useRef(0);
  const reloadFrameRef = useRef<number | null>(null);
  const sourceTransitionRef = useRef<number | null>(null);
  const segmentStartRef = useCommittedRef(segmentStart);
  const segmentEndRef = useCommittedRef(segmentEnd);
  const restoredSegmentRef = useRef<{ end: number; start: number } | null>(null);

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
      cornerRadius,
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
    fit,
    interpolate,
    loop,
    materialId,
    materialSettings,
    mode,
    secondaryColor,
    segmentEnd,
    segmentStart,
    serializableSource,
    speed,
    strokeWidth,
    transparent,
  ]);
  const lottieRevision = useMemo(
    () => JSON.stringify({ binarySource: source.portableDataUrl ?? null, state: lottieState }),
    [lottieState, source.portableDataUrl]
  );
  const lottieDocument = useMemo(() => createStudioCanvasDocument({
    background: transparent ? '#00000000' : background,
    brandId: identity.id,
    createdAt: documentCreatedAt,
    height: canvas.height,
    id: `${identity.id}:lottie:composition`,
    layers: [
      {
        bounds: { height: canvas.height, rotation: 0, width: canvas.width, x: 0, y: 0 },
        data: { materialId, materialSettings, style: backgroundStyle, transparent },
        hidden: transparent,
        id: 'lottie-background',
        kind: backgroundStyle === 'shader' ? 'shader' as const : 'shape' as const,
        name: 'Canvas background',
      },
      {
        ...(source.format === 'dotlottie' && source.portableDataUrl ? {
          asset: {
            kind: 'binary' as const,
            name: source.fileName,
            source: source.portableDataUrl,
          },
        } : {}),
        bounds: { height: canvas.height, rotation: 0, width: canvas.width, x: 0, y: 0 },
        data: { fit, format: source.format, sourceId: source.id },
        id: 'lottie-animation',
        kind: 'component' as const,
        name: source.name,
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
    state: lottieState,
    title: `${identity.name} Lottie`,
    toolId: 'lottie',
    updatedAt: documentCreatedAt,
    width: canvas.width,
  }), [
    background,
    backgroundStyle,
    brandDisplayFont,
    canvas.height,
    canvas.width,
    documentCreatedAt,
    fit,
    identity.id,
    identity.name,
    lottieRevision,
    lottieState,
    materialId,
    materialSettings,
    source.fileName,
    source.format,
    source.id,
    source.name,
    source.portableDataUrl,
    transparent,
  ]);
  const lottieWorkspaceKey = useMemo(
    () => savedDesignStorageKey(identity.id, 'lottie'),
    [identity.id]
  );
  const portableLottie = usePortableCanvasWorkspace({
    applySource: applyWorkspaceSource,
    document: lottieDocument,
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
    const player = playerRef.current;
    if (!player) return;
    setError(null);
    setCurrentFrame(0);
    player.load({
      data: resolveSourceData(
        nextSource,
        [artColorRef.current, secondaryColorRef.current, accentColorRef.current],
        cornerRadiusRef.current,
        strokeWidthRef.current,
        brandFontFamilyRef.current,
        brandLogoRef.current,
      ),
    });
  }

  function scheduleSourceReload() {
    if (sourceRef.current.format !== 'json') return;
    if (reloadFrameRef.current !== null) {
      window.cancelAnimationFrame(reloadFrameRef.current);
    }
    reloadFrameRef.current = window.requestAnimationFrame(() => {
      reloadFrameRef.current = null;
      loadSource(sourceRef.current);
    });
  }

  useMountEffect(() => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;
    let disposed = false;
    const player = new DotLottie({
      autoplay: true,
      backgroundColor:
        transparentRef.current || backgroundStyleRef.current === 'shader'
          ? 'transparent'
          : backgroundRef.current,
      canvas: canvasElement,
      data: resolveSourceData(
        sourceRef.current,
        [artColorRef.current, secondaryColorRef.current, accentColorRef.current],
        cornerRadiusRef.current,
        strokeWidthRef.current,
        brandFontFamilyRef.current,
        brandLogoRef.current,
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

    if (brandLogoAsset) {
      void imageUrlToDataUrl(brandLogoAsset.path)
        .then(async (sourceDataUrl) => {
          const logo = await rasterizeImageDataUrl(sourceDataUrl);
          if (disposed) return;
          brandLogoRef.current = {
            dataUrl: logo.dataUrl,
            height: logo.height,
            label: identity.name,
            width: logo.width,
          };
          scheduleSourceReload();
        })
        .catch(() => {
          brandLogoRef.current = undefined;
        });
    }

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
      if (desiredPlayingRef.current) player.play();
      else player.pause();
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setIsSourceTransitioning(false));
      });
      setError(null);
    };
    const handleFrame = ({ currentFrame: nextFrame }: { currentFrame: number }) => {
      const now = performance.now();
      if (now - lastFrameUpdateRef.current < 40) return;
      lastFrameUpdateRef.current = now;
      setCurrentFrame(Math.round(nextFrame));
    };
    const handleLoadError = () => setError(gt('This Lottie file could not be loaded.'));
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleStop = () => {
      setCurrentFrame(segmentStartRef.current);
      setIsPlaying(false);
    };
    player.addEventListener('load', handleLoad);
    player.addEventListener('frame', handleFrame);
    player.addEventListener('loadError', handleLoadError);
    player.addEventListener('play', handlePlay);
    player.addEventListener('pause', handlePause);
    player.addEventListener('stop', handleStop);

    return () => {
      disposed = true;
      if (reloadFrameRef.current !== null) {
        window.cancelAnimationFrame(reloadFrameRef.current);
      }
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
  });

  function selectSource(nextSource: LottieSource) {
    setSource(nextSource);
    desiredPlayingRef.current = true;
    setIsPlaying(true);
    setIsSourceTransitioning(true);
    if (sourceTransitionRef.current !== null) {
      window.clearTimeout(sourceTransitionRef.current);
    }
    sourceTransitionRef.current = window.setTimeout(() => {
      sourceTransitionRef.current = null;
      loadSource(nextSource);
    }, 220);
  }

  async function applyWorkspaceSource(nextSource: string) {
    const parsed = parseLottieWorkspaceSource(nextSource, lottieState);
    const restored = parsed.state;
    let nextData: ArrayBuffer | LottieDocument = restored.source.data ?? {};
    if (restored.source.format === 'dotlottie') {
      const response = await fetch(parsed.binarySource!);
      if (!response.ok) throw new TypeError('The embedded .lottie bundle could not be read.');
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
    selectSource(nextLottieSource);
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
    if (source.format === 'dotlottie') {
      setLastExport({
        blob: new Blob([source.data as ArrayBuffer], { type: 'application/zip+dotlottie' }),
        fileName: source.fileName,
        format: 'LOTTIE',
        previewKind: 'file',
      });
      return;
    }
    const data = resolveSourceData(
      source,
      [artColor, secondaryColor, accentColor],
      cornerRadius,
      strokeWidth,
      brandFontFamily,
      brandLogoRef.current,
    ) as LottieDocument;
    const previewText = JSON.stringify(data, null, 2);
    setLastExport({
      blob: new Blob([previewText], { type: 'application/json' }),
      fileName: source.fileName,
      format: 'JSON',
      previewText,
    });
  }

  async function downloadPng() {
    const lottieCanvas = canvasRef.current;
    const portableDocument = portableLottie.document;
    if (!lottieCanvas || !portableDocument) return;
    studioExport.start('Rendering Lottie frame preview');
    const fileName = `${source.id}-frame-${Math.round(currentFrame)}.png`;
    try {
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
              lottieCanvas,
              outputBounds.x,
              outputBounds.y,
              outputBounds.width,
              outputBounds.height
            );
          }
        },
        width: canvas.width,
      });
      setLastExport({
        blob: exported.blob,
        fileName,
        format: 'PNG',
        height: exported.height,
        width: exported.width,
      });
    } finally {
      studioExport.finish();
    }
  }

  function resetEditor() {
    setBackground(DEFAULT_LOTTIE_BACKGROUND);
    updateBackgroundStyle('solid');
    setMaterialId(DEFAULT_LIVE_MATERIAL_ID);
    setMaterialSettings(defaultMaterialSettings);
    setTransparent(false);
    setArtColor(defaultSurface);
    setSecondaryColor(defaultSecondary);
    setAccentColor(defaultAccent);
    setCornerRadius(DEFAULT_LOTTIE_CORNER_RADIUS);
    setStrokeWidth(DEFAULT_LOTTIE_STROKE_WIDTH);
    setSpeed(1);
    setLoop(true);
    setInterpolate(true);
    setFit('contain');
    setMode('forward');
    updateCanvasPreset('landscape');
    backgroundRef.current = DEFAULT_LOTTIE_BACKGROUND;
    transparentRef.current = false;
    artColorRef.current = defaultSurface;
    secondaryColorRef.current = defaultSecondary;
    accentColorRef.current = defaultAccent;
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
          <SourceCodeButton disabled={portableLottie.source === null} onClick={() => setSourceOpen(true)} />
          <ExportPreview asset={lastExport} />
          <Button aria-label={gt('Reset Lottie editor')} onClick={resetEditor} size='icon' type='button' variant='outline'>
            <RotateCcw aria-hidden='true' />
          </Button>
          <Button disabled={!portableLottie.document} onClick={() => void downloadPng()} type='button' variant='outline'>
            <ImageDown aria-hidden='true' />
            <T>Export frame</T>
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
            <label className='flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2 text-sm'><span><T>Loop</T></span><input checked={loop} onChange={(event) => { setLoop(event.target.checked); loopRef.current = event.target.checked; playerRef.current?.setLoop(event.target.checked); }} type='checkbox' /></label>
            <label className='flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2 text-sm'><span><T>Frame interpolation</T></span><input checked={interpolate} onChange={(event) => { setInterpolate(event.target.checked); interpolateRef.current = event.target.checked; playerRef.current?.setUseFrameInterpolation(event.target.checked); }} type='checkbox' /></label>
            <div className='grid grid-cols-2 gap-3'>
              <RangeControl label={<T>In</T>} max={Math.max(1, segmentEnd - 1)} min={0} onChange={(value) => updateSegment(value, segmentEnd)} value={segmentStart} />
              <RangeControl label={<T>Out</T>} max={Math.max(1, totalFrames - 1)} min={Math.min(totalFrames - 1, segmentStart + 1)} onChange={(value) => updateSegment(segmentStart, value)} value={segmentEnd} />
            </div>
          </InspectorSection>

          <InspectorSection index='03' title={<T>Appearance</T>}>
            <StudioSelect ariaLabel={gt('Canvas size')} onValueChange={(value) => updateCanvasPreset(value as CanvasPreset)} options={Object.entries(CANVAS_PRESETS).map(([value, preset]) => ({ label: gt(preset.label), value }))} value={canvasPreset} />
            <StudioSelect ariaLabel={gt('Animation fit')} onValueChange={(value) => { const next = value as Fit; setFit(next); fitRef.current = next; playerRef.current?.setLayout({ align: [0.5, 0.5], fit: next }); }} options={[
              { label: gt('Contain'), value: 'contain' },
              { label: gt('Cover'), value: 'cover' },
              { label: gt('Fill'), value: 'fill' },
              { label: gt('Fit width'), value: 'fit-width' },
              { label: gt('Fit height'), value: 'fit-height' },
            ]} value={fit} />
            <label className='flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2 text-sm'><span><T>Transparent background</T></span><input checked={transparent} onChange={(event) => updateTransparency(event.target.checked)} type='checkbox' /></label>
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
                <div className='flex items-center justify-between gap-3'>
                  <p className='text-xs leading-5 text-muted-foreground'><T>Preset artwork starts with this brand’s color system. Every palette slot and geometric detail remains editable.</T></p>
                  <Button className='shrink-0' onClick={useBrandPalette} size='sm' type='button' variant='outline'><T>Brand colors</T></Button>
                </div>
                <ColorControl ariaLabel={gt('Primary artwork color')} label={<T>Primary</T>} onChange={updateArtColor} value={artColor} />
                <ColorControl ariaLabel={gt('Secondary artwork color')} label={<T>Secondary</T>} onChange={updateSecondaryColor} value={secondaryColor} />
                <ColorControl ariaLabel={gt('Accent artwork color')} label={<T>Accent</T>} onChange={updateAccentColor} value={accentColor} />
                <RangeControl label={<T>Corner radius</T>} max={48} min={0} onChange={updateCornerRadius} suffix=' px' value={cornerRadius} />
                <RangeControl label={<T>Stroke width</T>} max={16} min={1} onChange={updateStrokeWidth} suffix=' px' value={strokeWidth} />
              </div>
            ) : <p className='text-xs leading-5 text-muted-foreground'><T>Generic .lottie bundles keep their embedded colors. Recolor JSON artwork here, or use named dotLottie themes when the source provides them.</T></p>}
          </InspectorSection>

          {transparent || backgroundStyle !== 'shader' ? null : (
            <InspectorSection index='04' title={<T>Live material</T>}>
              <p className='text-xs leading-5 text-muted-foreground'><T>Use the same shaders, palettes, look presets, and motion parameters available in Design Lab, Playground, and Animation.</T></p>
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
                  <LiveMaterialCanvas materialId={materialId} paused={!isPlaying} settings={materialSettings} />
                </div>
              )}
              <canvas
                aria-label={gt('Lottie animation preview')}
                className={`absolute inset-0 z-10 size-full transition-[opacity,transform] duration-[360ms] [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] ${isSourceTransitioning ? 'translate-y-0.5 scale-[.996] opacity-0' : 'translate-y-0 scale-100 opacity-100'}`}
                ref={canvasRef}
              />
            </div>
          </CanvasViewport>
          <div className='grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-t border-border bg-background px-4 py-3'>
            <Button aria-label={isPlaying ? gt('Pause animation') : gt('Play animation')} onClick={togglePlayback} size='icon-sm' type='button' variant='outline'>{isPlaying ? <Pause aria-hidden='true' /> : <Play aria-hidden='true' />}</Button>
            <input aria-label={gt('Animation frame')} className='studio-range' max={Math.max(1, segmentEnd)} min={segmentStart} onChange={(event) => { const frame = Number(event.target.value); playerRef.current?.pause(); desiredPlayingRef.current = false; setIsPlaying(false); playerRef.current?.setFrame(frame); setCurrentFrame(frame); }} type='range' value={Math.min(currentFrame, segmentEnd)} />
            <output className='min-w-24 text-right text-xs tabular-nums text-muted-foreground'>{Math.round(currentFrame)} / {Math.max(0, totalFrames - 1)}</output>
          </div>
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
    <div className='source-code-host flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground'>
      {renderHeader()}
      <div className='lottie-editor-body lab-workspace min-h-0 flex-1'>
        {renderSourceLibrary()}
        {renderProperties()}
        {renderCanvasPanel()}
      </div>
      {renderSourceDrawer()}
    </div>
  );
}
