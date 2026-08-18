'use client';

import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  CircleGauge,
  Clapperboard,
  Clock3,
  Code2,
  Copy,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  FileImage,
  Film,
  Grid3X3,
  ImageDown,
  ImagePlus,
  Layers3,
  MonitorUp,
  Pause,
  Play,
  Repeat2,
  RotateCcw,
  Ruler,
  Search,
  Sparkles,
  Trash2,
  Type,
  WandSparkles,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode, type WheelEvent as ReactWheelEvent } from 'react';
import { flushSync } from 'react-dom';

import CanvasViewport from '@/components/CanvasViewport';
import CanvasSelectionMenu, { type CanvasSelectionMenuPosition } from '@/components/CanvasSelectionMenu';
import AuthenticShaderPreview from '@/components/AuthenticShaderPreview';
import AssetConversionLibrary from '@/components/AssetConversionLibrary';
import CompositionEffectThumbnail from '@/components/CompositionEffectThumbnail';
import DesignVersionControls from '@/components/DesignVersionControls';
import EditableCanvasLayer, {
  alignCanvasSelection,
  canvasLayerDimensions,
  canvasSelectionBounds,
  isAdditiveCanvasSelection,
  nextCanvasLayerSelection,
  type CanvasLayerAlignment,
  type CanvasLayerBounds,
  type CanvasSelectionItem,
  type CanvasLayerTransform,
} from '@/components/EditableCanvasLayer';
import ExportPreview, { type ExportPreviewAsset } from '@/components/ExportPreview';
import { LabInspectorSection, LabPanelHeading } from '@/components/LabWorkspace';
import LiveMaterialCanvas from '@/components/LazyLiveMaterialCanvas';
import { LiveMaterialSourceTag } from '@/components/LiveMaterialSourceLabel';
import LogoAppearanceControls from '@/components/LogoAppearanceControls';
import LogoAppearancePreview, { AppearanceFilteredContent } from '@/components/LogoAppearancePreview';
import SourceCodeDrawer, { SourceCodeButton } from '@/components/SourceCodeDrawer';
import { useStudioExportProgress } from '@/components/StudioExportProgress';
import StudioRangeLabel from '@/components/StudioRangeLabel';
import StudioToolHeader from '@/components/StudioToolHeader';
import TextEffectThumbnail from '@/components/TextEffectThumbnail';
import { Button } from '@/components/ui/Button';
import ColorControl from '@/components/ui/ColorControl';
import StudioSelect from '@/components/ui/StudioSelect';
import { useConvertedAssets } from '@/hooks/useConvertedAssets';
import { useStudioDraft } from '@/hooks/usePersistentState';
import {
  brandAssetPath,
  brandFontAssets,
  brandTypographyFamily,
  brandTypographyRole,
  brandTypographyWeightRange,
  resolveBrandTypographyWeight,
  type BrandIdentity,
  type BrandTypography,
} from '@/lib/brandIdentity';
import {
  canvasTextCharacters,
  canvasTextLineX,
  layoutCanvasText,
  trackedTextWidth,
  type CanvasTextAlign,
  type CanvasTextWrap,
} from '@/lib/canvasText';
import {
  canvasToImageBlob,
  encodeCanvasGif,
  encodeCanvasMp4,
  resolveExportDimensions,
  resolveSeamlessLoopOverlapFrames,
  type MotionLoopMode,
  type MotionLoopReport,
  type MotionExportQuality,
  type MotionFrame,
  type StillImageFormat,
} from '@/lib/canvasExport';
import type { ConvertedAsset } from '@/lib/convertedAssets';
import {
  applyCompositionEffect,
  COMPOSITION_EFFECT_PRESETS,
  createCompositionEffectScratch,
  defaultCompositionEffectSettings,
  type CompositionEffectScratch,
  type CompositionEffectKind,
  type CompositionEffectSettings,
} from '@/lib/compositionEffects';
import {
  DEFAULT_LIVE_MATERIAL_SETTINGS,
  LIVE_MATERIAL_PALETTES,
  brandMaterialPalette,
  getLiveMaterial,
  isPaperLiveMaterialId,
  normalizeLiveMaterialId,
  type LiveMaterialId,
  type LiveMaterialOption,
  type LiveMaterialSettings,
} from '@/lib/liveMaterials';
import {
  DEFAULT_LOGO_APPEARANCE,
  drawLogoAppearanceLayer,
  type LogoAppearanceSettings,
} from '@/lib/logoAppearance';
import {
  SHADER_LAB_CATEGORIES,
  shaderLabCategoryCount,
  shaderLabMaterials,
  shaderLabSettingsFor,
  shaderPreviewAssetPath,
  type ShaderLabCategory,
} from '@/lib/shaderLab';
import {
  clampShaderZoom,
  formatShaderZoom,
  shaderZoomFromSlider,
  shaderZoomToSlider,
  SHADER_ZOOM_SLIDER_MAX,
  SHADER_ZOOM_SLIDER_MIN,
  SHADER_ZOOM_SLIDER_STEP,
  stepShaderZoom,
} from '@/lib/shaderZoom';
import type { StudioTool } from '@/lib/studioCatalog';
import {
  applyTextEffectMask,
  createTextEffectGradient,
  DEFAULT_TEXT_EFFECT,
  resolveTextEffectSettings,
  textEffectCssStyle,
  TEXT_EFFECT_PRESETS,
  type TextEffectSettings,
} from '@/lib/textEffects';

type ShaderRatio = 'wide' | 'square' | 'opengraph';
type ShaderBlendMode = 'multiply' | 'normal' | 'overlay' | 'screen';
type ShaderLayerId = `shader-${string}`;
type EffectLayerId = `effect-${string}`;
type LogoLayerId = `logo-${string}`;
type TextLayerId = `text-${string}`;
type AssetLayerId = `asset-${string}`;
type ContentLayerId = LogoLayerId | TextLayerId | AssetLayerId;
type CompositionLayerId = ShaderLayerId | EffectLayerId | ContentLayerId;
type CompositionLayerGroupId = `group-${string}`;

type CompositionLayerGroup = {
  id: CompositionLayerGroupId;
  layerIds: ContentLayerId[];
  name: string;
};

type ShaderApplication = {
  blendMode: ShaderBlendMode;
  materialId: LiveMaterialId;
  opacity: number;
  settings: LiveMaterialSettings;
  shaderSize: number;
};

type CompositionShaderLayer = ShaderApplication & {
  id: ShaderLayerId;
  name: string;
  visible: boolean;
};

type CompositionEffectLayer = {
  id: EffectLayerId;
  name: string;
  opacity: number;
  settings: CompositionEffectSettings;
  visible: boolean;
};


type CompositionLogoLayer = {
  appearance?: LogoAppearanceSettings;
  color?: string;
  convertedAssetId?: string;
  id: LogoLayerId;
  name: string;
  opacity?: number;
  transform: CanvasLayerTransform;
  url: string;
  visible: boolean;
};

type CompositionAsset = {
  appearance?: LogoAppearanceSettings;
  id: AssetLayerId;
  name: string;
  opacity?: number;
  transform: CanvasLayerTransform;
  url: string;
  visible: boolean;
};

type CompositionTextLayer = {
  align: CanvasTextAlign;
  color?: string;
  fontRole?: BrandTypography['role'];
  id: TextLayerId;
  lineHeight: number;
  name: string;
  opacity?: number;
  outlineColor?: string;
  outlineEnabled?: boolean;
  outlineWidth?: number;
  shadowBlur?: number;
  shadowColor?: string;
  shadowEnabled?: boolean;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowOpacity?: number;
  textEffect?: TextEffectSettings;
  tracking: number;
  transform: CanvasLayerTransform;
  value: string;
  visible: boolean;
  weight: number;
  wrap: CanvasTextWrap;
};

type LayerGeometry = {
  baseHeight: number;
  baseWidth: number;
  baseX: number;
  baseY: number;
};

type TextAppearanceSettings = {
  color: string;
  fontRole: BrandTypography['role'];
  opacity: number;
  outlineColor: string;
  outlineEnabled: boolean;
  outlineWidth: number;
  shadowBlur: number;
  shadowColor: string;
  shadowEnabled: boolean;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowOpacity: number;
  textEffect: TextEffectSettings;
};

type TextEffectRenderScratch = {
  fill: HTMLCanvasElement;
  mask: HTMLCanvasElement;
  shadow: HTMLCanvasElement;
};

type DesignExportSettings = {
  durationMs: number;
  fps: number;
  gifLoop: MotionLoopMode;
  quality: MotionExportQuality;
  width: number;
};

type DesignExportFormat = 'gif' | 'jpg' | 'mp4' | 'png';

type DesignExportRequest = {
  format: DesignExportFormat;
  settingsSignature: string;
};

const RATIO_OPTIONS: readonly { height: number; label: string; value: ShaderRatio; width: number }[] = [
  { height: 9, label: '16:9', value: 'wide', width: 16 },
  { height: 1, label: '1:1', value: 'square', width: 1 },
  { height: 630, label: 'OG', value: 'opengraph', width: 1200 },
];

const CANVAS_DIMENSIONS: Record<ShaderRatio, { height: number; width: number }> = {
  opengraph: { height: 630, width: 1200 },
  square: { height: 1200, width: 1200 },
  wide: { height: 900, width: 1600 },
};

const DEFAULT_EXPORT_SETTINGS: DesignExportSettings = {
  durationMs: 1_600,
  fps: 15,
  gifLoop: 'seamless',
  quality: 'balanced',
  width: 960,
};
const EXPORT_WIDTH_PRESETS = [
  { label: 'Compact', width: 640 },
  { label: 'Standard', width: 960 },
  { label: 'Large', width: 1_280 },
  { label: 'Full', width: 1_920 },
] as const;
const EXPORT_QUALITY_OPTIONS: readonly { description: string; label: string; value: MotionExportQuality }[] = [
  { description: 'Quick preview', label: 'Fast', value: 'fast' },
  { description: 'Everyday export', label: 'Balanced', value: 'balanced' },
  { description: 'Most detail', label: 'Best', value: 'best' },
];

function normalizeDesignExportSettings(settings?: Partial<DesignExportSettings>): DesignExportSettings {
  return {
    durationMs: settings?.durationMs && [1_200, 1_600, 2_400, 4_000].includes(settings.durationMs)
      ? settings.durationMs
      : DEFAULT_EXPORT_SETTINGS.durationMs,
    fps: settings?.fps && [12, 15, 24, 30].includes(settings.fps)
      ? settings.fps
      : DEFAULT_EXPORT_SETTINGS.fps,
    gifLoop: settings?.gifLoop === 'raw' ? 'raw' : 'seamless',
    quality: settings?.quality && EXPORT_QUALITY_OPTIONS.some(({ value }) => value === settings.quality)
      ? settings.quality
      : DEFAULT_EXPORT_SETTINGS.quality,
    width: Number.isFinite(settings?.width) && (settings?.width ?? 0) > 0
      ? settings!.width!
      : DEFAULT_EXPORT_SETTINGS.width,
  };
}

function designExportSettingsSignature(ratio: ShaderRatio, settings: DesignExportSettings): string {
  return [ratio, settings.width, settings.quality, settings.durationMs, settings.fps, settings.gifLoop].join(':');
}

function DesignExportControls({
  onChange,
  ratioOption,
  settings,
}: {
  onChange: (patch: Partial<DesignExportSettings>) => void;
  ratioOption: (typeof RATIO_OPTIONS)[number];
  settings: DesignExportSettings;
}) {
  const dimensions = resolveExportDimensions({
    aspectHeight: ratioOption.height,
    aspectWidth: ratioOption.width,
    width: settings.width,
  });
  const frameCount = Math.max(2, Math.round(settings.durationMs / (1_000 / settings.fps)));
  const loopOverlapFrames = resolveSeamlessLoopOverlapFrames({
    durationMs: settings.durationMs,
    fps: settings.fps,
    height: dimensions.height,
    width: dimensions.width,
  });

  return (
    <div className='shader-lab-v2-output-controls'>
      <div className='shader-lab-v2-export-overview' aria-label='Current output settings'>
        <div>
          <MonitorUp aria-hidden='true' />
          <span><small>Output size</small><strong>{dimensions.width} × {dimensions.height}</strong></span>
        </div>
        <div>
          <Film aria-hidden='true' />
          <span><small>Animation · {frameCount} frames</small><strong>{settings.durationMs / 1_000}s · {settings.fps} FPS</strong></span>
        </div>
      </div>
      <div className='shader-lab-v2-export-presets' aria-label='Export size presets'>
        {EXPORT_WIDTH_PRESETS.map((preset) => {
          const presetDimensions = resolveExportDimensions({
            aspectHeight: ratioOption.height,
            aspectWidth: ratioOption.width,
            width: preset.width,
          });
          return (
            <button
              aria-pressed={dimensions.width === presetDimensions.width}
              key={preset.width}
              onClick={() => onChange({ width: preset.width })}
              type='button'
            >
              <strong>{preset.label}</strong>
              <small>{presetDimensions.width}×{presetDimensions.height}</small>
            </button>
          );
        })}
      </div>
      <label className='shader-lab-v2-export-width'>
        <span><Ruler aria-hidden='true' />Custom width</span>
        <span>
          <input
            aria-label='Export width in pixels'
            max={3_840}
            min={320}
            onBlur={() => onChange({ width: dimensions.width })}
            onChange={(event) => {
              const width = Number(event.target.value);
              if (Number.isFinite(width)) onChange({ width });
            }}
            step={2}
            type='number'
            value={settings.width}
          />
          <i>px</i>
        </span>
      </label>
      <div className='shader-lab-v2-export-quality'>
        <span><CircleGauge aria-hidden='true' />Quality</span>
        <div>
          {EXPORT_QUALITY_OPTIONS.map((option) => {
            const QualityIcon = option.value === 'fast' ? Zap : option.value === 'balanced' ? CircleGauge : Sparkles;
            return (
              <button
                aria-pressed={settings.quality === option.value}
                key={option.value}
                onClick={() => onChange({ quality: option.value })}
                title={option.description}
                type='button'
              >
                <QualityIcon aria-hidden='true' />
                <span><strong>{option.label}</strong><small>{option.description}</small></span>
              </button>
            );
          })}
        </div>
      </div>
      <div className='shader-lab-v2-export-motion'>
        <label>
          <span><Clock3 aria-hidden='true' />Duration</span>
          <StudioSelect
            ariaLabel='Export duration'
            onValueChange={(value) => onChange({ durationMs: Number(value) })}
            options={[
              { label: '1.2 seconds', value: '1200' },
              { label: '1.6 seconds', value: '1600' },
              { label: '2.4 seconds', value: '2400' },
              { label: '4 seconds', value: '4000' },
            ]}
            value={String(settings.durationMs)}
          />
        </label>
        <label>
          <span><Film aria-hidden='true' />Frame rate</span>
          <StudioSelect
            ariaLabel='Export frame rate'
            onValueChange={(value) => onChange({ fps: Number(value) })}
            options={[12, 15, 24, 30].map((fps) => ({ label: `${fps} FPS`, value: String(fps) }))}
            value={String(settings.fps)}
          />
        </label>
      </div>
      <div className='shader-lab-v2-export-quality shader-lab-v2-export-loop'>
        <span><Repeat2 aria-hidden='true' />GIF loop</span>
        <div>
          <button
            aria-pressed={settings.gifLoop === 'seamless'}
            onClick={() => onChange({ gifLoop: 'seamless' })}
            title='Blend and verify the closing frame for a smooth loop.'
            type='button'
          >Seamless</button>
          <button
            aria-pressed={settings.gifLoop === 'raw'}
            onClick={() => onChange({ gifLoop: 'raw' })}
            title='Repeat captured frames without correcting the seam.'
            type='button'
          >Raw motion</button>
        </div>
        <small>{settings.gifLoop === 'seamless'
          ? `Smooth close · ${loopOverlapFrames}-frame overlap verified after render`
          : 'Direct repeat · best for shaders that already loop naturally'}</small>
      </div>
    </div>
  );
}

function ShaderFrameHistoryControl({
  durationMs,
  fps,
  frame,
  onFramePreview,
  onPauseAtFrame,
  onPlay,
  onScrub,
  playing,
}: {
  durationMs: number;
  fps: number;
  frame: number;
  onFramePreview: (frame: number) => void;
  onPauseAtFrame: (frame: number) => void;
  onPlay: () => void;
  onScrub: (frame: number) => void;
  playing: boolean;
}) {
  const frameCount = Math.max(2, Math.round(durationMs / (1_000 / fps)));
  const boundedFrame = Math.min(frameCount - 1, Math.max(0, Math.round(frame)));
  const [displayFrame, setDisplayFrame] = useState(boundedFrame);

  useEffect(() => {
    if (!playing) setDisplayFrame(boundedFrame);
  }, [boundedFrame, playing]);

  useEffect(() => {
    if (!playing) return;
    const frameDurationMs = 1_000 / fps;
    const startedAt = performance.now() - boundedFrame * frameDurationMs;
    let animationFrame = 0;
    let previousFrame = -1;
    const tick = (now: number) => {
      const nextFrame = Math.floor(((now - startedAt) % durationMs) / frameDurationMs) % frameCount;
      if (nextFrame !== previousFrame) {
        previousFrame = nextFrame;
        onFramePreview(nextFrame);
        setDisplayFrame(nextFrame);
      }
      animationFrame = requestAnimationFrame(tick);
    };
    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [boundedFrame, durationMs, fps, frameCount, onFramePreview, playing]);

  const seconds = displayFrame / fps;
  return (
    <section className='shader-lab-v2-frame-history' data-canvas-selection-preserve>
      <button
        aria-label={playing ? 'Pause at current shader frame' : 'Play shader history'}
        onClick={() => playing ? onPauseAtFrame(displayFrame) : onPlay()}
        title={playing ? 'Pause at this frame' : 'Resume live shader motion'}
        type='button'
      >
        {playing ? <Pause aria-hidden='true' /> : <Play aria-hidden='true' />}
      </button>
      <div className='shader-lab-v2-frame-history-copy'>
        <span><Clock3 aria-hidden='true' />Frame history</span>
        <small>{playing ? 'Live' : 'Selected'} · {seconds.toFixed(2)}s</small>
      </div>
      <input
        aria-label='Shader frame history'
        max={frameCount - 1}
        min={0}
        onInput={(event) => onScrub(Number(event.currentTarget.value))}
        step={1}
        type='range'
        value={displayFrame}
      />
      <output aria-live='off'>
        <strong>{String(displayFrame + 1).padStart(2, '0')}</strong>
        <span>/ {String(frameCount).padStart(2, '0')}</span>
      </output>
    </section>
  );
}

const DEFAULT_LAYER_TRANSFORM: CanvasLayerTransform = { scale: 1, x: 0, y: 0 };
const DEFAULT_CANVAS_SHADER_ID = 'shader-canvas-1' as const satisfies ShaderLayerId;
const DEFAULT_CANVAS_BACKGROUND = '#111216';
const DEFAULT_LOGO_LAYER_ID = 'logo-brand' as const satisfies LogoLayerId;
const DEFAULT_TEXT_LAYER_TRANSFORM: CanvasLayerTransform = {
  ...DEFAULT_LAYER_TRANSFORM,
  heightScale: 1,
  widthScale: 1,
};
const DEFAULT_TEXT_APPEARANCE: TextAppearanceSettings = {
  color: '#FFFFFF',
  fontRole: 'Display',
  opacity: 1,
  outlineColor: '#000000',
  outlineEnabled: false,
  outlineWidth: 1,
  shadowBlur: 18,
  shadowColor: '#000000',
  shadowEnabled: false,
  shadowOffsetX: 0,
  shadowOffsetY: 8,
  shadowOpacity: 35,
  textEffect: { ...DEFAULT_TEXT_EFFECT },
};

function fileDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new TypeError(`Could not read ${file.name}.`));
    }, { once: true });
    reader.addEventListener('error', () => reject(reader.error ?? new TypeError(`Could not read ${file.name}.`)), { once: true });
    reader.readAsDataURL(file);
  });
}

function normalizedLayerTransform(
  transform: Partial<CanvasLayerTransform> | undefined,
  fallback: CanvasLayerTransform
): CanvasLayerTransform {
  const finite = (value: unknown, defaultValue: number) => (
    typeof value === 'number' && Number.isFinite(value) ? value : defaultValue
  );
  const next: CanvasLayerTransform = {
    scale: Math.max(0.01, finite(transform?.scale, fallback.scale)),
    x: finite(transform?.x, fallback.x),
    y: finite(transform?.y, fallback.y),
  };
  const widthScale = finite(transform?.widthScale, fallback.widthScale ?? 1);
  const heightScale = finite(transform?.heightScale, fallback.heightScale ?? 1);
  if (transform?.widthScale !== undefined || fallback.widthScale !== undefined) next.widthScale = Math.max(0.01, widthScale);
  if (transform?.heightScale !== undefined || fallback.heightScale !== undefined) next.heightScale = Math.max(0.01, heightScale);
  return next;
}

function isTextLayerId(layerId: CompositionLayerId | null): layerId is TextLayerId {
  return layerId?.startsWith('text-') ?? false;
}

function isShaderLayerId(layerId: CompositionLayerId | null): layerId is ShaderLayerId {
  return layerId?.startsWith('shader-') ?? false;
}

function isEffectLayerId(layerId: CompositionLayerId | null): layerId is EffectLayerId {
  return layerId?.startsWith('effect-') ?? false;
}

function isLogoLayerId(layerId: CompositionLayerId | null): layerId is LogoLayerId {
  return layerId?.startsWith('logo-') ?? false;
}

function isAssetLayerId(layerId: CompositionLayerId | null): layerId is AssetLayerId {
  return layerId?.startsWith('asset-') ?? false;
}

function isContentLayerId(layerId: CompositionLayerId | null): layerId is ContentLayerId {
  return isLogoLayerId(layerId) || isTextLayerId(layerId) || isAssetLayerId(layerId);
}

function resolvedTextTransform(transform: CanvasLayerTransform): CanvasLayerTransform {
  return {
    ...transform,
    heightScale: transform.heightScale ?? 1,
    widthScale: transform.widthScale ?? 1,
  };
}

function resolvedTextAppearance(layer: CompositionTextLayer): TextAppearanceSettings {
  return {
    color: layer.color ?? DEFAULT_TEXT_APPEARANCE.color,
    fontRole: layer.fontRole ?? DEFAULT_TEXT_APPEARANCE.fontRole,
    opacity: layer.opacity ?? DEFAULT_TEXT_APPEARANCE.opacity,
    outlineColor: layer.outlineColor ?? DEFAULT_TEXT_APPEARANCE.outlineColor,
    outlineEnabled: layer.outlineEnabled ?? DEFAULT_TEXT_APPEARANCE.outlineEnabled,
    outlineWidth: layer.outlineWidth ?? DEFAULT_TEXT_APPEARANCE.outlineWidth,
    shadowBlur: layer.shadowBlur ?? DEFAULT_TEXT_APPEARANCE.shadowBlur,
    shadowColor: layer.shadowColor ?? DEFAULT_TEXT_APPEARANCE.shadowColor,
    shadowEnabled: layer.shadowEnabled ?? DEFAULT_TEXT_APPEARANCE.shadowEnabled,
    shadowOffsetX: layer.shadowOffsetX ?? DEFAULT_TEXT_APPEARANCE.shadowOffsetX,
    shadowOffsetY: layer.shadowOffsetY ?? DEFAULT_TEXT_APPEARANCE.shadowOffsetY,
    shadowOpacity: layer.shadowOpacity ?? DEFAULT_TEXT_APPEARANCE.shadowOpacity,
    textEffect: resolveTextEffectSettings(layer.textEffect),
  };
}

function resolvedLogoAppearance(settings?: LogoAppearanceSettings): LogoAppearanceSettings {
  return { ...DEFAULT_LOGO_APPEARANCE, ...settings };
}

function colorWithOpacity(color: string, opacity: number): string {
  const hex = color.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(hex)) return color;
  const value = Number.parseInt(hex, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${Math.max(0, Math.min(1, opacity))})`;
}

function scrollLayerDockWithWheel(event: ReactWheelEvent<HTMLDivElement>) {
  if (event.ctrlKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
  const dock = event.currentTarget;
  const maximumScroll = Math.max(0, dock.scrollWidth - dock.clientWidth);
  if (maximumScroll === 0) return;
  const unit = event.deltaMode === 1
    ? 16
    : event.deltaMode === 2
      ? dock.clientWidth
      : 1;
  const nextScroll = Math.max(0, Math.min(maximumScroll, dock.scrollLeft + event.deltaY * unit));
  if (nextScroll === dock.scrollLeft) return;
  event.preventDefault();
  dock.scrollLeft = nextScroll;
}

function textShadowStyle(settings: TextAppearanceSettings): string | undefined {
  if (!settings.shadowEnabled) return undefined;
  return `${settings.shadowOffsetX}px ${settings.shadowOffsetY}px ${settings.shadowBlur}px ${colorWithOpacity(settings.shadowColor, settings.shadowOpacity / 100)}`;
}

function CanvasEditableText({
  className,
  label,
  onChange,
  onFocus,
  style,
  value,
}: {
  className: string;
  label: string;
  onChange: (value: string) => void;
  onFocus: () => void;
  style: CSSProperties;
  value: string;
}) {
  const textRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const text = textRef.current;
    if (!text || document.activeElement === text || text.innerText === value) return;
    text.innerText = value;
  }, [value]);

  return (
    <span
      aria-label={label}
      aria-multiline='true'
      className={className}
      contentEditable='plaintext-only'
      data-canvas-editable='true'
      onBlur={(event) => onChange(event.currentTarget.innerText.replace(/\r\n/g, '\n'))}
      onFocus={onFocus}
      onInput={(event) => onChange(event.currentTarget.innerText.replace(/\r\n/g, '\n'))}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Escape') event.currentTarget.blur();
      }}
      onPointerDown={(event) => {
        if (isAdditiveCanvasSelection(event)) {
          event.preventDefault();
          return;
        }
        event.stopPropagation();
      }}
      ref={textRef}
      role='textbox'
      spellCheck
      style={style}
      suppressContentEditableWarning
      tabIndex={0}
    />
  );
}

function layerGeometry(layerId: ContentLayerId, ratio: ShaderRatio): LayerGeometry {
  const canvas = CANVAS_DIMENSIONS[ratio];
  if (isTextLayerId(layerId)) {
    const baseWidth = canvas.width * 0.72;
    const baseHeight = canvas.height * 0.25;
    return {
      baseHeight,
      baseWidth,
      baseX: (canvas.width - baseWidth) / 2,
      baseY: (canvas.height - baseHeight) / 2,
    };
  }
  if (isLogoLayerId(layerId)) {
    const baseWidth = canvas.width * 0.42;
    const baseHeight = canvas.height * 0.32;
    return {
      baseHeight,
      baseWidth,
      baseX: (canvas.width - baseWidth) / 2,
      baseY: (canvas.height - baseHeight) / 2,
    };
  }
  const baseWidth = canvas.width * 0.34;
  const baseHeight = canvas.height * 0.38;
  return {
    baseHeight,
    baseWidth,
    baseX: (canvas.width - baseWidth) / 2,
    baseY: (canvas.height - baseHeight) / 2,
  };
}

const PRIMARY_CONTROLS: readonly {
  key: keyof Pick<LiveMaterialSettings, 'speed' | 'frequency' | 'strength' | 'detail' | 'grain' | 'brightness'>;
  label: string;
  max: number;
  min: number;
  step: number;
}[] = [
  { key: 'speed', label: 'Shader speed', max: 1.5, min: 0, step: 0.01 },
  { key: 'frequency', label: 'Frequency', max: 12, min: 0.5, step: 0.1 },
  { key: 'strength', label: 'Warp', max: 1.5, min: 0, step: 0.01 },
  { key: 'detail', label: 'Detail', max: 9, min: 0.5, step: 0.1 },
  { key: 'grain', label: 'Texture', max: 100, min: 0, step: 1 },
  { key: 'brightness', label: 'Light', max: 1.6, min: 0.35, step: 0.01 },
];

const ADVANCED_CONTROLS: readonly {
  key: keyof Pick<LiveMaterialSettings, 'amplitude' | 'density' | 'rotationZ'>;
  label: string;
  max: number;
  min: number;
  step: number;
}[] = [
  { key: 'amplitude', label: 'Amplitude', max: 10, min: 0, step: 0.1 },
  { key: 'density', label: 'Density', max: 2, min: 0.1, step: 0.01 },
  { key: 'rotationZ', label: 'Rotation', max: 180, min: -180, step: 1 },
];

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (character) => ({
    '"': '&quot;',
    '&': '&amp;',
    "'": '&apos;',
    '<': '&lt;',
    '>': '&gt;',
  })[character] ?? character);
}

function monogramDataUrl(identity: Pick<BrandIdentity, 'shortName'>): string {
  const label = escapeXml(identity.shortName.slice(0, 3).toUpperCase());
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 320"><text x="320" y="214" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-size="164" font-weight="700">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

function drawCover(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  width: number,
  height: number
) {
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawnWidth = sourceWidth * scale;
  const drawnHeight = sourceHeight * scale;
  context.drawImage(source, (width - drawnWidth) / 2, (height - drawnHeight) / 2, drawnWidth, drawnHeight);
}

function paintFallback(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  settings: LiveMaterialSettings
) {
  const gradient = context.createLinearGradient(0, height, width, 0);
  gradient.addColorStop(0, settings.colorA);
  gradient.addColorStop(0.52, settings.colorB);
  gradient.addColorStop(1, settings.colorC);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
}

function shaderApplicationFor(
  materialId: LiveMaterialId,
  colors: readonly [string, string, string] | readonly string[],
  overrides: Partial<Pick<ShaderApplication, 'blendMode' | 'opacity' | 'shaderSize'>> = {}
): ShaderApplication {
  return {
    blendMode: overrides.blendMode ?? 'normal',
    materialId,
    opacity: overrides.opacity ?? 1,
    settings: shaderLabSettingsFor(materialId, {
      ...DEFAULT_LIVE_MATERIAL_SETTINGS,
      colorA: colors[0] ?? DEFAULT_LIVE_MATERIAL_SETTINGS.colorA,
      colorB: colors[1] ?? DEFAULT_LIVE_MATERIAL_SETTINGS.colorB,
      colorC: colors[2] ?? DEFAULT_LIVE_MATERIAL_SETTINGS.colorC,
    }),
    shaderSize: clampShaderZoom(overrides.shaderSize ?? 1),
  };
}

function shaderBlendStyle(blendMode: ShaderBlendMode): CSSProperties['mixBlendMode'] {
  return blendMode === 'normal' ? 'normal' : blendMode;
}

function RangeControl({
  formatValue,
  label,
  max,
  min,
  onChange,
  step,
  value,
}: {
  formatValue?: (value: number) => string;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step: number;
  value: number;
}) {
  return (
    <label className='shader-lab-v2-range'>
      <StudioRangeLabel
        label={label}
        value={<output>{formatValue?.(value) ?? (Number.isInteger(step) ? Math.round(value) : value.toFixed(2))}</output>}
      />
      <input
        aria-label={label}
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

function ShaderZoomControl({
  onChange,
  value,
}: {
  onChange: (value: number) => void;
  value: number;
}) {
  const zoom = clampShaderZoom(value);
  return (
    <div className='shader-lab-v2-range shader-lab-v2-zoom-control'>
      <StudioRangeLabel
        label='Shader zoom'
        value={<output>{formatShaderZoom(zoom)}</output>}
      />
      <div className='shader-lab-v2-zoom-input'>
        <button
          aria-label='Zoom shader out'
          disabled={zoom <= 0.1}
          onClick={() => onChange(stepShaderZoom(zoom, -1))}
          title='Zoom shader out'
          type='button'
        ><ZoomOut aria-hidden='true' /></button>
        <input
          aria-label='Shader zoom'
          className='studio-range'
          max={SHADER_ZOOM_SLIDER_MAX}
          min={SHADER_ZOOM_SLIDER_MIN}
          onInput={(event) => onChange(shaderZoomFromSlider(Number(event.currentTarget.value)))}
          step={SHADER_ZOOM_SLIDER_STEP}
          type='range'
          value={shaderZoomToSlider(zoom)}
        />
        <button
          aria-label='Zoom shader in'
          disabled={zoom >= 10}
          onClick={() => onChange(stepShaderZoom(zoom, 1))}
          title='Zoom shader in'
          type='button'
        ><ZoomIn aria-hidden='true' /></button>
      </div>
      <div aria-hidden='true' className='shader-lab-v2-zoom-scale'>
        <span>0.1×</span><span>1×</span><span>10×</span>
      </div>
    </div>
  );
}

const ShaderMaterialCard = memo(function ShaderMaterialCard({
  material,
  onSelect,
  selected,
}: {
  material: LiveMaterialOption;
  onSelect: (materialId: LiveMaterialId) => void;
  selected: boolean;
}) {
  return (
    <button
      aria-pressed={selected}
      className='shader-lab-v2-material-card'
      onClick={() => onSelect(material.id)}
      type='button'
    >
      <span className='shader-lab-v2-material-preview'>
        <AuthenticShaderPreview materialId={material.id} />
        <LiveMaterialSourceTag material={material} />
      </span>
      <span className='shader-lab-v2-material-copy'>
        <strong>{material.name}</strong>
      </span>
    </button>
  );
});

export default function ShaderLabStudio({
  identity,
  navigation,
  tool,
}: {
  identity: BrandIdentity;
  navigation?: ReactNode;
  tool: StudioTool;
}) {
  const studioExport = useStudioExportProgress(`${identity.id}:${tool.id}:design-lab`);
  const brandPalette = brandMaterialPalette(identity);
  const initialSettings = shaderLabSettingsFor('holo-cloth-silk', {
    ...DEFAULT_LIVE_MATERIAL_SETTINGS,
    colorA: brandPalette.colors[0],
    colorB: brandPalette.colors[1],
    colorC: brandPalette.colors[2],
  });
  const builtInLogo = brandAssetPath(identity, 'mark-light')
    ?? brandAssetPath(identity, 'logo-light')
    ?? brandAssetPath(identity, 'mark-dark')
    ?? monogramDataUrl(identity);
  const initialShaderLayer: CompositionShaderLayer = {
    ...shaderApplicationFor('holo-cloth-silk', brandPalette.colors),
    id: DEFAULT_CANVAS_SHADER_ID,
    name: 'Canvas shader 1',
    visible: true,
  };
  const stageRef = useRef<HTMLDivElement>(null);
  const effectCanvasRefs = useRef<Map<EffectLayerId, HTMLCanvasElement>>(new Map());
  const effectScratchRefs = useRef<Map<EffectLayerId, CompositionEffectScratch>>(new Map());
  const effectPreviewBufferRef = useRef<HTMLCanvasElement | null>(null);
  const textEffectScratchRefs = useRef<Map<TextLayerId, TextEffectRenderScratch>>(new Map());
  const logoInputRef = useRef<HTMLInputElement>(null);
  const assetInputRef = useRef<HTMLInputElement>(null);
  const selectMaterialRef = useRef<(materialId: LiveMaterialId) => void>(() => undefined);
  const handleMaterialSelect = useCallback((materialId: LiveMaterialId) => {
    selectMaterialRef.current(materialId);
  }, []);
  const convertedAssetLibrary = useConvertedAssets();
  const compositionAssetUrlsRef = useRef<string[]>([]);
  const previewFrameRef = useRef(0);
  const [shaderLayers, setShaderLayers] = useStudioDraft<CompositionShaderLayer[]>(
    identity.id,
    tool.id,
    'shader-lab-v3-canvas-shaders',
    [initialShaderLayer]
  );
  const [effectLayers, setEffectLayers] = useStudioDraft<CompositionEffectLayer[]>(
    identity.id,
    tool.id,
    'shader-lab-v4-composition-effects',
    []
  );
  const [layerShaders, setLayerShaders] = useStudioDraft<Partial<Record<ContentLayerId, ShaderApplication>>>(
    identity.id,
    tool.id,
    'shader-lab-v3-layer-shaders',
    {}
  );
  const [ratio, setRatio] = useStudioDraft<ShaderRatio>(identity.id, tool.id, 'shader-lab-v2-ratio', 'wide');
  const [exportSettings, setExportSettings] = useStudioDraft<DesignExportSettings>(
    identity.id,
    tool.id,
    'shader-lab-v3-export-settings',
    DEFAULT_EXPORT_SETTINGS
  );
  const [canvasBackground, setCanvasBackground] = useStudioDraft(
    identity.id,
    tool.id,
    'shader-lab-v3-canvas-background',
    DEFAULT_CANVAS_BACKGROUND
  );
  const [textLayers, setTextLayers] = useStudioDraft<CompositionTextLayer[]>(
    identity.id,
    tool.id,
    'shader-lab-v2-text-layers-v1',
    []
  );
  const [layerGroups, setLayerGroups] = useStudioDraft<CompositionLayerGroup[]>(
    identity.id,
    tool.id,
    'shader-lab-v1-layer-groups',
    []
  );
  const [paused, setPaused] = useState(false);
  const [previewFrame, setPreviewFrame] = useState(0);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ShaderLabCategory>('all');
  const [logoLayers, setLogoLayers] = useState<CompositionLogoLayer[]>([{
    appearance: { ...DEFAULT_LOGO_APPEARANCE },
    color: '#FFFFFF',
    id: DEFAULT_LOGO_LAYER_ID,
    name: 'Brand mark',
    opacity: 1,
    transform: DEFAULT_LAYER_TRANSFORM,
    url: builtInLogo,
    visible: true,
  }]);
  const [compositionAssets, setCompositionAssets] = useState<CompositionAsset[]>([]);
  const [layerOrder, setLayerOrder] = useState<CompositionLayerId[]>([DEFAULT_CANVAS_SHADER_ID, DEFAULT_LOGO_LAYER_ID]);
  const [selectedLayerId, setSelectedLayerId] = useState<CompositionLayerId | null>(DEFAULT_CANVAS_SHADER_ID);
  const [selectedCanvasLayerIds, setSelectedCanvasLayerIds] = useState<ContentLayerId[]>([]);
  const [selectionMenuPosition, setSelectionMenuPosition] = useState<CanvasSelectionMenuPosition | null>(null);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [captureTimeMs, setCaptureTimeMs] = useState<number | null>(null);
  const [exporting, setExporting] = useState<'gif' | 'jpg' | 'mp4' | 'png' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [lastExport, setLastExport] = useState<ExportPreviewAsset | null>(null);
  const [lastExportRequest, setLastExportRequest] = useState<DesignExportRequest | null>(null);
  const ratioOption = RATIO_OPTIONS.find((option) => option.value === ratio) ?? RATIO_OPTIONS[0]!;
  const canvasDimensions = CANVAS_DIMENSIONS[ratio];
  const normalizedExportSettings = normalizeDesignExportSettings(exportSettings);
  const previewFrameCount = Math.max(
    2,
    Math.round(normalizedExportSettings.durationMs / (1_000 / normalizedExportSettings.fps))
  );
  const boundedPreviewFrame = Math.min(previewFrameCount - 1, Math.max(0, Math.round(previewFrame)));
  const previewCaptureTimeMs = boundedPreviewFrame / normalizedExportSettings.fps * 1_000;
  const exportDimensions = resolveExportDimensions({
    aspectHeight: ratioOption.height,
    aspectWidth: ratioOption.width,
    width: normalizedExportSettings.width,
  });
  const compositionSignature = useMemo(() => JSON.stringify({
    background: canvasBackground,
    frameHistory: { frame: boundedPreviewFrame, paused },
    layerOrder,
    layerGroups,
    layerShaders,
    layers: {
      assets: compositionAssets,
      effects: effectLayers,
      logos: logoLayers,
      shaders: shaderLayers,
      text: textLayers,
    },
  }), [boundedPreviewFrame, canvasBackground, compositionAssets, effectLayers, layerGroups, layerOrder, layerShaders, logoLayers, paused, shaderLayers, textLayers]);
  const currentExportSettingsSignature = `${designExportSettingsSignature(ratio, normalizedExportSettings)}:${compositionSignature}`;
  const previewNeedsRefresh = Boolean(
    lastExportRequest && lastExportRequest.settingsSignature !== currentExportSettingsSignature
  );
  const materials = useMemo(() => shaderLabMaterials(query, category), [category, query]);
  const selectedShaderLayer = isShaderLayerId(selectedLayerId)
    ? shaderLayers.find(({ id }) => id === selectedLayerId) ?? null
    : null;
  const selectedEffectLayer = isEffectLayerId(selectedLayerId)
    ? effectLayers.find(({ id }) => id === selectedLayerId) ?? null
    : null;
  const selectedContentLayerId = isContentLayerId(selectedLayerId)
    ? selectedLayerId
    : null;
  const selectedLayerShader = selectedContentLayerId ? layerShaders[selectedContentLayerId] ?? null : null;
  const editingShader = selectedShaderLayer ?? selectedLayerShader;
  const activeMaterialId = normalizeLiveMaterialId(
    editingShader?.materialId ?? shaderLayers.at(-1)?.materialId ?? 'holo-cloth-silk'
  );
  const material = getLiveMaterial(activeMaterialId);
  const settings = editingShader?.settings ?? initialSettings;
  const shaderSize = clampShaderZoom(editingShader?.shaderSize ?? 1);
  const selectedTextLayer = isTextLayerId(selectedLayerId)
    ? textLayers.find(({ id }) => id === selectedLayerId) ?? null
    : null;
  const selectedTextTransform = selectedTextLayer
    ? resolvedTextTransform(selectedTextLayer.transform)
    : null;
  const selectedTextAppearance = selectedTextLayer
    ? resolvedTextAppearance(selectedTextLayer)
    : null;
  const selectedTextWeightRange = selectedTextAppearance
    ? brandTypographyWeightRange(identity, selectedTextAppearance.fontRole)
    : { max: 900, min: 100 };
  const selectedTextRenderedWeight = selectedTextLayer && selectedTextAppearance
    ? resolveBrandTypographyWeight(identity, selectedTextAppearance.fontRole, selectedTextLayer.weight)
    : 400;
  const selectedLogoLayer = isLogoLayerId(selectedLayerId)
    ? logoLayers.find(({ id }) => id === selectedLayerId) ?? null
    : null;
  const selectedAsset = isAssetLayerId(selectedLayerId)
    ? compositionAssets.find(({ id }) => id === selectedLayerId) ?? null
    : null;
  const selectedLogoAppearance = selectedLogoLayer
    ? resolvedLogoAppearance(selectedLogoLayer.appearance)
    : null;
  const selectedAssetAppearance = selectedAsset
    ? resolvedLogoAppearance(selectedAsset.appearance)
    : null;
  const selectedCanvasItems = selectedCanvasLayerIds.flatMap((layerId): CanvasSelectionItem[] => {
    const transform = contentLayerTransform(layerId);
    return transform ? [{ geometry: layerGeometry(layerId, ratio), transform }] : [];
  });
  const selectedCanvasBounds = canvasSelectionBounds(selectedCanvasItems);
  const selectedCanvasGroup = layerGroups.find((group) => (
    group.layerIds.length === selectedCanvasLayerIds.length
    && group.layerIds.every((layerId) => selectedCanvasLayerIds.includes(layerId))
  )) ?? null;
  const selectedGroupedAssemblies = layerGroups.filter((group) => (
    group.layerIds.some((layerId) => selectedCanvasLayerIds.includes(layerId))
  ));
  const contentLayerIdSignature = [
    ...logoLayers.map(({ id }) => id),
    ...textLayers.map(({ id }) => id),
    ...compositionAssets.map(({ id }) => id),
  ].join('|');

  useEffect(() => () => {
    compositionAssetUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    previewFrameRef.current = boundedPreviewFrame;
    if (previewFrame !== boundedPreviewFrame) setPreviewFrame(boundedPreviewFrame);
  }, [boundedPreviewFrame, previewFrame]);

  const trackPreviewFrame = useCallback((frame: number) => {
    previewFrameRef.current = frame;
  }, []);

  function pauseAtPreviewFrame(frame: number) {
    const nextFrame = Math.min(previewFrameCount - 1, Math.max(0, Math.round(frame)));
    previewFrameRef.current = nextFrame;
    setPreviewFrame(nextFrame);
    setPaused(true);
  }

  function playShaderHistory() {
    setPaused(false);
  }

  function toggleShaderHistory() {
    if (paused) {
      playShaderHistory();
      return;
    }
    pauseAtPreviewFrame(previewFrameRef.current);
  }

  useEffect(() => {
    setDraftHydrated(true);
  }, []);

  useEffect(() => {
    if (!draftHydrated) return;
    const existingIds = new Set<ContentLayerId>([
      ...logoLayers.map(({ id }) => id),
      ...textLayers.map(({ id }) => id),
      ...compositionAssets.map(({ id }) => id),
    ]);
    setLayerGroups((current) => {
      let changed = false;
      const next = current.flatMap((group): CompositionLayerGroup[] => {
        const layerIds = group.layerIds.filter((layerId) => existingIds.has(layerId));
        if (layerIds.length < 2) {
          changed = true;
          return [];
        }
        if (layerIds.length !== group.layerIds.length) changed = true;
        return [{ ...group, layerIds }];
      });
      return changed ? next : current;
    });
    setSelectedCanvasLayerIds((current) => {
      const next = current.filter((layerId) => existingIds.has(layerId));
      return next.length === current.length ? current : next;
    });
  }, [contentLayerIdSignature, draftHydrated, setLayerGroups]);

  useEffect(() => {
    setLayerOrder((current) => {
      const textIds = new Set(textLayers.map(({ id }) => id));
      const shaderIds = new Set(shaderLayers.map(({ id }) => id));
      const effectIds = new Set(effectLayers.map(({ id }) => id));
      const retained = current.filter((id) => (
        (!isTextLayerId(id) || textIds.has(id))
        && (!isShaderLayerId(id) || shaderIds.has(id))
        && (!isEffectLayerId(id) || effectIds.has(id))
      ));
      const missingShaders = shaderLayers.map(({ id }) => id).filter((id) => !retained.includes(id));
      const firstContentIndex = retained.findIndex((id) => !isShaderLayerId(id));
      const shaderInsertionIndex = firstContentIndex < 0 ? retained.length : firstContentIndex;
      const next = [
        ...retained.slice(0, shaderInsertionIndex),
        ...missingShaders,
        ...retained.slice(shaderInsertionIndex),
        ...textLayers.map(({ id }) => id).filter((id) => !retained.includes(id)),
        ...effectLayers.map(({ id }) => id).filter((id) => !retained.includes(id)),
      ];
      return next.length === current.length && next.every((id, index) => id === current[index])
        ? current
        : next;
    });
    setSelectedLayerId((current) =>
      (isTextLayerId(current) && !textLayers.some(({ id }) => id === current))
      || (isShaderLayerId(current) && !shaderLayers.some(({ id }) => id === current))
      || (isEffectLayerId(current) && !effectLayers.some(({ id }) => id === current))
        ? null
        : current
    );
  }, [effectLayers, shaderLayers, textLayers]);

  useEffect(() => {
    const needsWeightNormalization = textLayers.some((layer) => {
      const fontRole = resolvedTextAppearance(layer).fontRole;
      return layer.weight !== resolveBrandTypographyWeight(identity, fontRole, layer.weight);
    });
    if (!needsWeightNormalization) return;
    setTextLayers((current) => current.map((layer) => {
      const fontRole = resolvedTextAppearance(layer).fontRole;
      return {
        ...layer,
        weight: resolveBrandTypographyWeight(identity, fontRole, layer.weight),
      };
    }));
  }, [identity, setTextLayers, textLayers]);

  function updateSelectedShader(update: Partial<ShaderApplication>) {
    const normalizedUpdate = update.shaderSize === undefined
      ? update
      : { ...update, shaderSize: clampShaderZoom(update.shaderSize) };
    if (selectedShaderLayer) {
      setShaderLayers((current) => current.map((layer) => (
        layer.id === selectedShaderLayer.id ? { ...layer, ...normalizedUpdate } : layer
      )));
      return;
    }
    if (!selectedContentLayerId) return;
    setLayerShaders((current) => ({
      ...current,
      [selectedContentLayerId]: {
        ...(current[selectedContentLayerId] ?? shaderApplicationFor(activeMaterialId, brandPalette.colors)),
        ...normalizedUpdate,
      },
    }));
  }

  function updateSetting<Key extends keyof LiveMaterialSettings>(key: Key, value: LiveMaterialSettings[Key]) {
    updateSelectedShader({ settings: { ...settings, [key]: value } });
  }

  function selectMaterial(nextId: LiveMaterialId) {
    const nextApplication = shaderApplicationFor(nextId, brandPalette.colors, {
      blendMode: editingShader?.blendMode,
      opacity: editingShader?.opacity,
      shaderSize: editingShader?.shaderSize,
    });
    if (selectedShaderLayer) {
      setShaderLayers((current) => current.map((layer) => (
        layer.id === selectedShaderLayer.id ? { ...layer, ...nextApplication } : layer
      )));
      return;
    }
    if (selectedContentLayerId) {
      setLayerShaders((current) => ({ ...current, [selectedContentLayerId]: nextApplication }));
      return;
    }
    addCanvasShader(nextId);
  }

  function selectRandomMaterial() {
    const visibleChoices = materials.filter(({ id }) => id !== activeMaterialId);
    const choices = visibleChoices.length > 0
      ? visibleChoices
      : shaderLabMaterials('', 'all').filter(({ id }) => id !== activeMaterialId);
    const next = choices[Math.floor(Math.random() * choices.length)];
    if (next) selectMaterial(next.id);
  }

  selectMaterialRef.current = selectMaterial;

  function addCanvasShader(materialId: LiveMaterialId = activeMaterialId) {
    const id = `shader-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as ShaderLayerId;
    const number = shaderLayers.length + 1;
    const layer: CompositionShaderLayer = {
      ...shaderApplicationFor(materialId, brandPalette.colors, {
        blendMode: shaderLayers.length === 0 ? 'normal' : 'screen',
        opacity: shaderLayers.length === 0 ? 1 : 0.72,
      }),
      id,
      name: `Canvas shader ${number}`,
      visible: true,
    };
    setShaderLayers((current) => [...current, layer]);
    setLayerOrder((current) => {
      const firstContent = current.findIndex((layerId) => !isShaderLayerId(layerId));
      const index = firstContent < 0 ? current.length : firstContent;
      return [...current.slice(0, index), id, ...current.slice(index)];
    });
    setSelectedLayerId(id);
    setSelectedCanvasLayerIds([]);
  }

  function addEffectLayer(kind: CompositionEffectKind = 'bayer') {
    const id = `effect-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as EffectLayerId;
    const preset = COMPOSITION_EFFECT_PRESETS.find((option) => option.kind === kind)!;
    const number = effectLayers.filter((layer) => layer.settings.kind === kind).length + 1;
    const layer: CompositionEffectLayer = {
      id,
      name: `${preset.label} ${number}`,
      opacity: 1,
      settings: defaultCompositionEffectSettings(kind),
      visible: true,
    };
    setEffectLayers((current) => [...current, layer]);
    setLayerOrder((current) => [...current, id]);
    setSelectedLayerId(id);
    setSelectedCanvasLayerIds([]);
  }

  function updateEffectLayer(id: EffectLayerId, update: Partial<Omit<CompositionEffectLayer, 'id'>>) {
    setEffectLayers((current) => current.map((layer) => layer.id === id ? { ...layer, ...update } : layer));
  }

  function selectEffectPreset(layer: CompositionEffectLayer, kind: CompositionEffectKind) {
    const preset = COMPOSITION_EFFECT_PRESETS.find((option) => option.kind === kind)!;
    updateEffectLayer(layer.id, {
      name: preset.label,
      settings: defaultCompositionEffectSettings(kind),
    });
  }

  function removeEffectLayer(id: EffectLayerId) {
    setEffectLayers((current) => current.filter((layer) => layer.id !== id));
    setLayerOrder((current) => current.filter((layerId) => layerId !== id));
    setSelectedLayerId((current) => current === id ? null : current);
  }

  function addBrandMarkLayer() {
    const id = `logo-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as LogoLayerId;
    const number = logoLayers.length + 1;
    const offset = (logoLayers.length % 8) * 28;
    const layer: CompositionLogoLayer = {
      appearance: { ...DEFAULT_LOGO_APPEARANCE },
      color: '#FFFFFF',
      id,
      name: number === 1 ? 'Brand mark' : `Brand mark ${number}`,
      opacity: 1,
      transform: { ...DEFAULT_LAYER_TRANSFORM, x: offset, y: offset },
      url: builtInLogo,
      visible: true,
    };
    setLogoLayers((current) => [...current, layer]);
    setLayerOrder((current) => [...current, id]);
    setSelectedLayerId(id);
    setSelectedCanvasLayerIds([id]);
  }

  async function addLogoFiles(files: FileList | null) {
    const images = Array.from(files ?? []);
    if (images.length === 0) return;
    try {
      const converted = await convertedAssetLibrary.importFiles(images, 2048);
      const nextLayers = converted.map((asset, index): CompositionLogoLayer => {
      return {
        appearance: { ...DEFAULT_LOGO_APPEARANCE },
        color: '#FFFFFF',
        convertedAssetId: asset.id,
        id: `logo-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${index}`}`,
        name: asset.originalName,
        opacity: 1,
        transform: { ...DEFAULT_LAYER_TRANSFORM, x: index * 28, y: index * 24 },
        url: asset.convertedDataUrl,
        visible: true,
      };
      });
      setLogoLayers((current) => [...current, ...nextLayers]);
      setLayerOrder((current) => [...current, ...nextLayers.map(({ id }) => id)]);
      setSelectedLayerId(nextLayers.at(-1)?.id ?? null);
      setSelectedCanvasLayerIds(nextLayers.map(({ id }) => id));
    } catch {
      // The converted asset library owns the user-facing error state.
    } finally {
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  }

  function addTextLayer() {
    const id = `text-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as TextLayerId;
    const placement = [
      { x: 0, y: -220 },
      { x: 0, y: 220 },
      { x: -300, y: 0 },
      { x: 300, y: 0 },
      { x: -260, y: 260 },
      { x: 260, y: -260 },
    ][textLayers.length % 6] ?? { x: 0, y: 0 };
    const nextNumber = textLayers.reduce((largest, layer) => {
      const match = /^Text (\d+)$/.exec(layer.name);
      return Math.max(largest, Number(match?.[1] ?? 0));
    }, 0) + 1;
    const layer: CompositionTextLayer = {
      align: 'center',
      ...DEFAULT_TEXT_APPEARANCE,
      id,
      lineHeight: 0.95,
      name: `Text ${nextNumber}`,
      tracking: -0.06,
      transform: { ...DEFAULT_TEXT_LAYER_TRANSFORM, ...placement },
      value: nextNumber === 1 ? identity.name : `Text ${nextNumber}`,
      visible: true,
      weight: resolveBrandTypographyWeight(
        identity,
        DEFAULT_TEXT_APPEARANCE.fontRole,
        brandTypographyRole(identity, DEFAULT_TEXT_APPEARANCE.fontRole).weight ?? 500
      ),
      wrap: 'wrap',
    };
    setTextLayers((current) => [...current, layer]);
    setLayerOrder((current) => [...current, id]);
    setSelectedLayerId(id);
    setSelectedCanvasLayerIds([id]);
  }

  function updateTextLayer(
    id: TextLayerId,
    update: Partial<Omit<CompositionTextLayer, 'id'>>
  ) {
    setTextLayers((current) => current.map((layer) =>
      layer.id === id ? { ...layer, ...update } : layer
    ));
  }

  function removeTextLayer(id: TextLayerId) {
    textEffectScratchRefs.current.delete(id);
    setTextLayers((current) => current.filter((layer) => layer.id !== id));
    setLayerShaders((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setLayerOrder((current) => current.filter((layerId) => layerId !== id));
    setSelectedLayerId((current) => current === id ? null : current);
  }

  function toggleTextLayerVisibility(layer: CompositionTextLayer) {
    updateTextLayer(layer.id, { visible: !layer.visible });
    if (selectedLayerId === layer.id && layer.visible) setSelectedLayerId(null);
  }

  function updateLogoTransform(id: LogoLayerId, transform: CanvasLayerTransform) {
    setLogoLayers((current) => current.map((layer) => layer.id === id ? { ...layer, transform } : layer));
  }

  function updateLogoLayer(id: LogoLayerId, update: Partial<Omit<CompositionLogoLayer, 'id'>>) {
    setLogoLayers((current) => current.map((layer) => layer.id === id ? { ...layer, ...update } : layer));
  }

  function selectConvertedLogo(asset: ConvertedAsset | null) {
    if (!selectedLogoLayer) return;
    updateLogoLayer(selectedLogoLayer.id, asset ? {
      convertedAssetId: asset.id,
      name: asset.originalName,
      url: asset.convertedDataUrl,
    } : {
      convertedAssetId: undefined,
      name: 'Brand mark',
      url: builtInLogo,
    });
  }

  function removeLogoLayer(id: LogoLayerId) {
    setLogoLayers((current) => {
      const removed = current.find((layer) => layer.id === id);
      const remaining = current.filter((layer) => layer.id !== id);
      if (removed?.url.startsWith('blob:') && removed.id !== DEFAULT_LOGO_LAYER_ID && !remaining.some((layer) => layer.url === removed.url)) {
        URL.revokeObjectURL(removed.url);
        compositionAssetUrlsRef.current = compositionAssetUrlsRef.current.filter((url) => url !== removed.url);
      }
      return remaining;
    });
    setLayerShaders((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setLayerOrder((current) => current.filter((layerId) => layerId !== id));
    setSelectedLayerId((current) => current === id ? null : current);
  }

  async function addAssets(files: FileList | null) {
    const images = Array.from(files ?? []).filter((file) => file.type.startsWith('image/'));
    if (images.length === 0) return;
    const results = await Promise.allSettled(images.map(async (file, index): Promise<CompositionAsset> => ({
        appearance: { ...DEFAULT_LOGO_APPEARANCE },
        id: `asset-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${index}`}`,
        name: file.name,
        opacity: 1,
        transform: { ...DEFAULT_LAYER_TRANSFORM, x: index * 28, y: index * 24 },
        url: await fileDataUrl(file),
        visible: true,
      })));
    const nextAssets = results.flatMap((result): CompositionAsset[] => result.status === 'fulfilled' ? [result.value] : []);
    if (assetInputRef.current) assetInputRef.current.value = '';
    if (nextAssets.length === 0) return;
    setCompositionAssets((current) => [...current, ...nextAssets]);
    setLayerOrder((current) => [...current, ...nextAssets.map(({ id }) => id)]);
    setSelectedLayerId(nextAssets.at(-1)?.id ?? null);
    setSelectedCanvasLayerIds(nextAssets.map(({ id }) => id));
  }

  function removeAsset(id: AssetLayerId) {
    setCompositionAssets((current) => {
      const removed = current.find((asset) => asset.id === id);
      const remaining = current.filter((asset) => asset.id !== id);
      if (removed?.url.startsWith('blob:') && !remaining.some((asset) => asset.url === removed.url)) {
        URL.revokeObjectURL(removed.url);
        compositionAssetUrlsRef.current = compositionAssetUrlsRef.current.filter((url) => url !== removed.url);
      }
      return remaining;
    });
    setLayerShaders((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setLayerOrder((current) => current.filter((layerId) => layerId !== id));
    setSelectedLayerId((current) => current === id ? null : current);
  }

  function moveLayer(id: CompositionLayerId, direction: -1 | 1) {
    setLayerOrder((current) => {
      const index = current.indexOf(id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex]!, next[index]!];
      return next;
    });
  }

  function updateAssetTransform(id: AssetLayerId, transform: CanvasLayerTransform) {
    setCompositionAssets((current) => current.map((asset) => asset.id === id ? { ...asset, transform } : asset));
  }

  function updateAssetLayer(id: AssetLayerId, update: Partial<Omit<CompositionAsset, 'id'>>) {
    setCompositionAssets((current) => current.map((asset) => asset.id === id ? { ...asset, ...update } : asset));
  }

  function contentLayerTransform(id: ContentLayerId): CanvasLayerTransform | null {
    if (isTextLayerId(id)) {
      const layer = textLayers.find((candidate) => candidate.id === id);
      return layer ? resolvedTextTransform(layer.transform) : null;
    }
    if (isLogoLayerId(id)) {
      return logoLayers.find((candidate) => candidate.id === id)?.transform ?? null;
    }
    return compositionAssets.find((candidate) => candidate.id === id)?.transform ?? null;
  }

  function updateContentLayerTransforms(updates: ReadonlyMap<ContentLayerId, CanvasLayerTransform>) {
    setTextLayers((current) => current.map((layer) => {
      const transform = updates.get(layer.id);
      return transform ? { ...layer, transform } : layer;
    }));
    setLogoLayers((current) => current.map((layer) => {
      const transform = updates.get(layer.id);
      return transform ? { ...layer, transform } : layer;
    }));
    setCompositionAssets((current) => current.map((layer) => {
      const transform = updates.get(layer.id);
      return transform ? { ...layer, transform } : layer;
    }));
  }

  function groupForLayer(id: ContentLayerId) {
    return layerGroups.find((group) => group.layerIds.includes(id)) ?? null;
  }

  function selectableAssemblyFor(id: ContentLayerId): ContentLayerId[] {
    const group = groupForLayer(id);
    const ids = group?.layerIds ?? [id];
    return ids.filter((layerId) => layerVisible(layerId));
  }

  function selectCanvasAssembly(id: ContentLayerId, additive = false) {
    const targetIds = selectableAssemblyFor(id);
    setSelectedCanvasLayerIds((current) => nextCanvasLayerSelection(current, targetIds, id, additive));
    if (additive && targetIds.every((layerId) => selectedCanvasLayerIds.includes(layerId))) {
      const remaining = selectedCanvasLayerIds.filter((layerId) => !targetIds.includes(layerId));
      setSelectedLayerId(remaining.at(-1) ?? null);
    } else {
      setSelectedLayerId(id);
    }
    setSelectionMenuPosition(null);
  }

  function deselectCanvasLayers() {
    setSelectedCanvasLayerIds([]);
    setSelectedLayerId(null);
    setSelectionMenuPosition(null);
  }

  function selectLayerFromStack(id: CompositionLayerId) {
    setSelectedLayerId(id);
    setSelectedCanvasLayerIds(isContentLayerId(id) ? selectableAssemblyFor(id) : []);
    setSelectionMenuPosition(null);
  }

  function updateCanvasLayerTransform(id: ContentLayerId, nextTransform: CanvasLayerTransform) {
    const currentTransform = contentLayerTransform(id);
    if (!currentTransform) return;
    const selectedIds = selectedCanvasLayerIds.includes(id)
      ? selectedCanvasLayerIds
      : selectableAssemblyFor(id);
    if (selectedIds.length <= 1) {
      updateContentLayerTransforms(new Map([[id, nextTransform]]));
      return;
    }
    const deltaX = nextTransform.x - currentTransform.x;
    const deltaY = nextTransform.y - currentTransform.y;
    const updates = new Map<ContentLayerId, CanvasLayerTransform>();
    selectedIds.forEach((layerId) => {
      const transform = contentLayerTransform(layerId);
      if (!transform) return;
      updates.set(layerId, {
        ...transform,
        x: transform.x + deltaX,
        y: transform.y + deltaY,
      });
    });
    updateContentLayerTransforms(updates);
  }

  function movementBoundsFor(id: ContentLayerId): CanvasLayerBounds | null {
    const layerIds = selectedCanvasLayerIds.includes(id) && selectedCanvasLayerIds.length > 1
      ? selectedCanvasLayerIds
      : groupForLayer(id)?.layerIds ?? [];
    if (layerIds.length < 2) return null;
    return canvasSelectionBounds(layerIds.flatMap((layerId): CanvasSelectionItem[] => {
      const transform = contentLayerTransform(layerId);
      return transform ? [{ geometry: layerGeometry(layerId, ratio), transform }] : [];
    }));
  }

  function openCanvasSelectionMenu(id: ContentLayerId, event: ReactMouseEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!selectedCanvasLayerIds.includes(id)) selectCanvasAssembly(id);
    setSelectionMenuPosition({ x: event.clientX, y: event.clientY });
  }

  function groupCanvasSelection() {
    if (selectedCanvasLayerIds.length < 2) return;
    const layerIds = [...selectedCanvasLayerIds];
    const id = `group-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as CompositionLayerGroupId;
    setLayerGroups((current) => {
      const nextNumber = current.reduce((largest, group) => {
        const match = /^Group (\d+)$/.exec(group.name);
        return Math.max(largest, Number(match?.[1] ?? 0));
      }, 0) + 1;
      return [
        ...current.filter((group) => !group.layerIds.some((layerId) => layerIds.includes(layerId))),
        { id, layerIds, name: `Group ${nextNumber}` },
      ];
    });
  }

  function ungroupCanvasSelection() {
    if (selectedCanvasLayerIds.length === 0) return;
    setLayerGroups((current) => current.filter((group) => (
      !group.layerIds.some((layerId) => selectedCanvasLayerIds.includes(layerId))
    )));
  }

  function alignCanvasAssembly(alignment: CanvasLayerAlignment) {
    if (selectedCanvasItems.length === 0) return;
    const transforms = alignCanvasSelection(
      selectedCanvasItems,
      canvasDimensions.width,
      canvasDimensions.height,
      alignment
    );
    const updates = new Map<ContentLayerId, CanvasLayerTransform>();
    selectedCanvasLayerIds.forEach((layerId, index) => {
      const transform = transforms[index];
      if (transform) updates.set(layerId, transform);
    });
    updateContentLayerTransforms(updates);
  }

  function moveCanvasSelection(direction: -1 | 1) {
    const selected = new Set<CompositionLayerId>(selectedCanvasLayerIds);
    setLayerOrder((current) => {
      const next = [...current];
      if (direction > 0) {
        for (let index = next.length - 2; index >= 0; index -= 1) {
          if (selected.has(next[index]!) && !selected.has(next[index + 1]!)) {
            [next[index], next[index + 1]] = [next[index + 1]!, next[index]!];
          }
        }
      } else {
        for (let index = 1; index < next.length; index += 1) {
          if (selected.has(next[index]!) && !selected.has(next[index - 1]!)) {
            [next[index], next[index - 1]] = [next[index - 1]!, next[index]!];
          }
        }
      }
      return next;
    });
  }

  function removeCanvasSelection() {
    const ids = [...selectedCanvasLayerIds];
    if (ids.length === 0) return;
    ids.forEach(removeLayer);
    setLayerGroups((current) => current.filter((group) => (
      !group.layerIds.some((layerId) => ids.includes(layerId))
    )));
    deselectCanvasLayers();
  }

  function duplicateCanvasSelection() {
    const sourceIds = layerOrder.filter((layerId): layerId is ContentLayerId => (
      isContentLayerId(layerId) && selectedCanvasLayerIds.includes(layerId)
    ));
    const nextIds = sourceIds.flatMap((layerId): ContentLayerId[] => {
      const nextId = duplicateLayer(layerId);
      return nextId && isContentLayerId(nextId) ? [nextId] : [];
    });
    if (nextIds.length === 0) return;
    if (selectedCanvasGroup && nextIds.length > 1) {
      const id = `group-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as CompositionLayerGroupId;
      setLayerGroups((current) => [...current, {
        id,
        layerIds: nextIds,
        name: `${selectedCanvasGroup.name} copy`,
      }]);
    }
    setSelectedCanvasLayerIds(nextIds);
    setSelectedLayerId(nextIds.at(-1) ?? null);
  }

  function handleCanvasAssemblyKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (
      event.target instanceof HTMLElement
      && (event.target.isContentEditable || event.target.closest('input, textarea, select'))
    ) return;
    const command = event.metaKey || event.ctrlKey;
    if (command && event.key.toLowerCase() === 'g') {
      event.preventDefault();
      if (event.shiftKey) ungroupCanvasSelection();
      else groupCanvasSelection();
      return;
    }
    if (command && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      duplicateCanvasSelection();
      return;
    }
    if ((event.key === 'Backspace' || event.key === 'Delete') && selectedCanvasLayerIds.length > 0) {
      event.preventDefault();
      removeCanvasSelection();
    }
  }

  function placeLayerAfter(sourceId: CompositionLayerId, nextId: CompositionLayerId) {
    setLayerOrder((current) => {
      const sourceIndex = current.indexOf(sourceId);
      if (sourceIndex < 0) return [...current, nextId];
      return [...current.slice(0, sourceIndex + 1), nextId, ...current.slice(sourceIndex + 1)];
    });
    setSelectedLayerId(nextId);
  }

  function duplicateLayer(id: CompositionLayerId): CompositionLayerId | null {
    if (isShaderLayerId(id)) {
      const source = shaderLayers.find((layer) => layer.id === id);
      if (!source) return null;
      const nextId = `shader-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as ShaderLayerId;
      setShaderLayers((current) => [...current, {
        ...source,
        id: nextId,
        name: `${source.name} copy`,
        settings: { ...source.settings },
      }]);
      placeLayerAfter(id, nextId);
      return nextId;
    }
    if (isEffectLayerId(id)) {
      const source = effectLayers.find((layer) => layer.id === id);
      if (!source) return null;
      const nextId = `effect-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as EffectLayerId;
      setEffectLayers((current) => [...current, {
        ...source,
        id: nextId,
        name: `${source.name} copy`,
        settings: { ...source.settings },
      }]);
      placeLayerAfter(id, nextId);
      return nextId;
    }
    if (isTextLayerId(id)) {
      const source = textLayers.find((layer) => layer.id === id);
      if (!source) return null;
      const nextId = `text-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as TextLayerId;
      const transform = resolvedTextTransform(source.transform);
      setTextLayers((current) => [...current, {
        ...source,
        id: nextId,
        name: `${source.name} copy`,
        textEffect: source.textEffect ? { ...source.textEffect } : undefined,
        transform: { ...transform, x: transform.x + 32, y: transform.y + 32 },
      }]);
      if (layerShaders[id]) {
        setLayerShaders((current) => ({ ...current, [nextId]: { ...layerShaders[id]!, settings: { ...layerShaders[id]!.settings } } }));
      }
      placeLayerAfter(id, nextId);
      return nextId;
    }
    if (isLogoLayerId(id)) {
      const source = logoLayers.find((layer) => layer.id === id);
      if (!source) return null;
      const nextId = `logo-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as LogoLayerId;
      setLogoLayers((current) => [...current, {
        ...source,
        appearance: source.appearance ? { ...source.appearance } : undefined,
        id: nextId,
        name: `${source.name} copy`,
        transform: { ...source.transform, x: source.transform.x + 32, y: source.transform.y + 32 },
      }]);
      if (layerShaders[id]) {
        setLayerShaders((current) => ({ ...current, [nextId]: { ...layerShaders[id]!, settings: { ...layerShaders[id]!.settings } } }));
      }
      placeLayerAfter(id, nextId);
      return nextId;
    }
    const source = compositionAssets.find((asset) => asset.id === id);
    if (!source) return null;
    const nextId = `asset-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as AssetLayerId;
    setCompositionAssets((current) => [...current, {
      ...source,
      appearance: source.appearance ? { ...source.appearance } : undefined,
      id: nextId,
      name: `${source.name} copy`,
      transform: { ...source.transform, x: source.transform.x + 32, y: source.transform.y + 32 },
    }]);
    if (layerShaders[id]) {
      setLayerShaders((current) => ({ ...current, [nextId]: { ...layerShaders[id]!, settings: { ...layerShaders[id]!.settings } } }));
    }
    placeLayerAfter(id, nextId);
    return nextId;
  }

  function removeLayer(id: CompositionLayerId) {
    if (isShaderLayerId(id)) removeShaderLayer(id);
    else if (isEffectLayerId(id)) removeEffectLayer(id);
    else if (isLogoLayerId(id)) removeLogoLayer(id);
    else if (isTextLayerId(id)) removeTextLayer(id);
    else removeAsset(id);
  }

  function layerVisible(id: CompositionLayerId) {
    if (isShaderLayerId(id)) return shaderLayers.find((layer) => layer.id === id)?.visible ?? false;
    if (isEffectLayerId(id)) return effectLayers.find((layer) => layer.id === id)?.visible ?? false;
    if (isLogoLayerId(id)) return logoLayers.find((layer) => layer.id === id)?.visible ?? false;
    if (isTextLayerId(id)) return textLayers.find((layer) => layer.id === id)?.visible ?? false;
    return compositionAssets.find((asset) => asset.id === id)?.visible ?? false;
  }

  function layerKind(id: CompositionLayerId) {
    if (isShaderLayerId(id)) return 'Shader';
    if (isEffectLayerId(id)) return 'Converter';
    if (isLogoLayerId(id)) return 'Brand mark';
    if (isTextLayerId(id)) return 'Editable text';
    return 'Image';
  }

  const visibleLayerIds = layerOrder.filter((id) => {
    return layerVisible(id);
  });
  const listedLayerIds = layerOrder.filter((id) =>
    (isShaderLayerId(id) && shaderLayers.some((layer) => layer.id === id))
    || (isEffectLayerId(id) && effectLayers.some((layer) => layer.id === id))
    || (isLogoLayerId(id) && logoLayers.some((layer) => layer.id === id))
    || (isTextLayerId(id) && textLayers.some((layer) => layer.id === id))
    || compositionAssets.some((asset) => asset.id === id)
  );

  function toggleLayerVisibility(id: CompositionLayerId) {
    if (isShaderLayerId(id)) {
      setShaderLayers((current) => current.map((layer) => layer.id === id ? { ...layer, visible: !layer.visible } : layer));
      return;
    }
    if (isEffectLayerId(id)) {
      setEffectLayers((current) => current.map((layer) => layer.id === id ? { ...layer, visible: !layer.visible } : layer));
      return;
    }
    if (isLogoLayerId(id)) {
      setLogoLayers((current) => current.map((layer) => layer.id === id ? { ...layer, visible: !layer.visible } : layer));
      return;
    }
    if (isTextLayerId(id)) {
      const layer = textLayers.find((candidate) => candidate.id === id);
      if (layer) toggleTextLayerVisibility(layer);
      return;
    }
    setCompositionAssets((current) => current.map((asset) => asset.id === id ? { ...asset, visible: !asset.visible } : asset));
  }

  function removeShaderLayer(id: ShaderLayerId) {
    setShaderLayers((current) => current.filter((layer) => layer.id !== id));
    setLayerOrder((current) => current.filter((layerId) => layerId !== id));
    setSelectedLayerId((current) => current === id ? null : current);
  }

  function removeShaderFromSelectedContent() {
    if (!selectedContentLayerId) return;
    setLayerShaders((current) => {
      const next = { ...current };
      delete next[selectedContentLayerId];
      return next;
    });
  }

  function layerLabel(id: CompositionLayerId) {
    if (isShaderLayerId(id)) return shaderLayers.find((layer) => layer.id === id)?.name ?? 'Canvas shader';
    if (isEffectLayerId(id)) return effectLayers.find((layer) => layer.id === id)?.name ?? 'Converter';
    if (isLogoLayerId(id)) return logoLayers.find((layer) => layer.id === id)?.name ?? 'Mark';
    if (isTextLayerId(id)) return textLayers.find((layer) => layer.id === id)?.name ?? 'Text';
    return compositionAssets.find((asset) => asset.id === id)?.name ?? 'Image';
  }

  function compositionSetupSource() {
    return JSON.stringify({
      version: 2,
      composition: {
        assets: compositionAssets,
        backgroundColor: canvasBackground,
        effectLayers,
        groups: layerGroups,
        layerOrder,
        layerShaders,
        logos: logoLayers,
        shaderLayers,
        textLayers,
      },
      exportSettings: normalizedExportSettings,
      ratio,
      timeline: {
        frame: boundedPreviewFrame,
        paused,
      },
    }, null, 2);
  }

  function applyCompositionSource(source: string) {
    const parsed = JSON.parse(source) as {
      composition?: {
        assets?: Array<Partial<CompositionAsset> & Pick<CompositionAsset, 'id'>>;
        backgroundColor?: string;
        effectLayers?: CompositionEffectLayer[];
        groups?: CompositionLayerGroup[];
        layerOrder?: CompositionLayerId[];
        layerShaders?: Partial<Record<ContentLayerId, ShaderApplication>>;
        logos?: Array<Partial<CompositionLogoLayer> & Pick<CompositionLogoLayer, 'id'>>;
        shaderLayers?: CompositionShaderLayer[];
        textLayers?: CompositionTextLayer[];
      };
      exportSettings?: Partial<DesignExportSettings>;
      ratio?: ShaderRatio;
      timeline?: {
        frame?: number;
        paused?: boolean;
      };
      version?: number;
    };
    if (!parsed || typeof parsed !== 'object' || !parsed.composition) throw new TypeError('A composition object is required.');
    if (parsed.ratio && !RATIO_OPTIONS.some(({ value }) => value === parsed.ratio)) throw new TypeError('Unknown canvas ratio.');
    if (parsed.composition.backgroundColor && !/^#[\dA-F]{6}$/i.test(parsed.composition.backgroundColor)) throw new TypeError('Canvas background must be a six-digit HEX color.');
    if (parsed.composition.shaderLayers && (!Array.isArray(parsed.composition.shaderLayers) || parsed.composition.shaderLayers.some((layer) => !layer.id?.startsWith('shader-')))) throw new TypeError('Shader layers are invalid.');
    if (parsed.composition.effectLayers && (!Array.isArray(parsed.composition.effectLayers) || parsed.composition.effectLayers.some((layer) => !layer.id?.startsWith('effect-')))) throw new TypeError('Converter layers are invalid.');
    if (parsed.composition.textLayers && (!Array.isArray(parsed.composition.textLayers) || parsed.composition.textLayers.some((layer) => !layer.id?.startsWith('text-') || typeof layer.value !== 'string'))) throw new TypeError('Text layers are invalid.');
    if (parsed.composition.logos && (!Array.isArray(parsed.composition.logos) || parsed.composition.logos.some((layer) => !layer.id?.startsWith('logo-')))) throw new TypeError('Mark layers are invalid.');
    if (parsed.composition.assets && (!Array.isArray(parsed.composition.assets) || parsed.composition.assets.some((layer) => !layer.id?.startsWith('asset-')))) throw new TypeError('Image layers are invalid.');
    if (parsed.composition.groups && (!Array.isArray(parsed.composition.groups) || parsed.composition.groups.some((group) => !group.id?.startsWith('group-') || !Array.isArray(group.layerIds)))) throw new TypeError('Layer groups are invalid.');
    if (parsed.composition.layerOrder && (!Array.isArray(parsed.composition.layerOrder) || parsed.composition.layerOrder.some((id) => typeof id !== 'string'))) throw new TypeError('Layer order is invalid.');
    if (parsed.timeline?.frame !== undefined && (!Number.isFinite(parsed.timeline.frame) || parsed.timeline.frame < 0)) throw new TypeError('Shader frame history is invalid.');

    const nextShaderLayers = (parsed.composition.shaderLayers ?? shaderLayers).map((layer) => ({
      ...layer,
      settings: { ...layer.settings },
      shaderSize: clampShaderZoom(layer.shaderSize),
    }));
    const nextEffectLayers = (parsed.composition.effectLayers ?? effectLayers).map((layer) => ({ ...layer, settings: { ...layer.settings } }));
    const nextTextLayers = (parsed.composition.textLayers ?? textLayers).map((layer) => ({
      ...layer,
      textEffect: layer.textEffect ? { ...layer.textEffect } : layer.textEffect,
      transform: normalizedLayerTransform(layer.transform, DEFAULT_TEXT_LAYER_TRANSFORM),
    }));
    const currentLogosById = new Map(logoLayers.map((layer) => [layer.id, layer]));
    const nextLogoLayers: CompositionLogoLayer[] = parsed.composition.logos
      ? parsed.composition.logos.map((savedLayer) => {
          const current = currentLogosById.get(savedLayer.id);
          return {
            appearance: savedLayer.appearance ? { ...savedLayer.appearance } : current?.appearance ?? { ...DEFAULT_LOGO_APPEARANCE },
            color: savedLayer.color ?? current?.color ?? '#FFFFFF',
            convertedAssetId: savedLayer.convertedAssetId,
            id: savedLayer.id,
            name: savedLayer.name ?? current?.name ?? 'Brand mark',
            opacity: savedLayer.opacity ?? current?.opacity ?? 1,
            transform: normalizedLayerTransform(savedLayer.transform, current?.transform ?? DEFAULT_LAYER_TRANSFORM),
            url: savedLayer.url ?? current?.url ?? builtInLogo,
            visible: savedLayer.visible ?? current?.visible ?? true,
          };
        })
      : logoLayers.map((layer) => ({ ...layer, appearance: layer.appearance ? { ...layer.appearance } : undefined, transform: { ...layer.transform } }));
    const currentAssetsById = new Map(compositionAssets.map((asset) => [asset.id, asset]));
    const nextAssets: CompositionAsset[] = parsed.composition.assets
      ? parsed.composition.assets.flatMap((savedAsset) => {
          const current = currentAssetsById.get(savedAsset.id);
          const url = savedAsset.url ?? current?.url;
          if (!url) return [];
          return [{
            appearance: savedAsset.appearance ? { ...savedAsset.appearance } : current?.appearance ?? { ...DEFAULT_LOGO_APPEARANCE },
            id: savedAsset.id,
            name: savedAsset.name ?? current?.name ?? 'Image',
            opacity: savedAsset.opacity ?? current?.opacity ?? 1,
            transform: normalizedLayerTransform(savedAsset.transform, current?.transform ?? DEFAULT_LAYER_TRANSFORM),
            url,
            visible: savedAsset.visible ?? current?.visible ?? true,
          }];
        })
      : compositionAssets.map((asset) => ({ ...asset, appearance: asset.appearance ? { ...asset.appearance } : undefined, transform: { ...asset.transform } }));
    const allowedIds = new Set<CompositionLayerId>([
      ...nextShaderLayers.map(({ id }) => id),
      ...nextEffectLayers.map(({ id }) => id),
      ...nextTextLayers.map(({ id }) => id),
      ...nextLogoLayers.map(({ id }) => id),
      ...nextAssets.map(({ id }) => id),
    ]);
    const requestedOrder = parsed.composition.layerOrder ?? layerOrder;
    const nextOrder = requestedOrder.filter((id, index) => allowedIds.has(id) && requestedOrder.indexOf(id) === index);
    allowedIds.forEach((id) => {
      if (!nextOrder.includes(id)) nextOrder.push(id);
    });
    const nextLayerShaders = Object.fromEntries(
      Object.entries(parsed.composition.layerShaders ?? layerShaders)
        .filter(([id]) => allowedIds.has(id as CompositionLayerId) && isContentLayerId(id as CompositionLayerId))
        .map(([id, application]) => [id, application ? {
          ...application,
          settings: { ...application.settings },
          shaderSize: clampShaderZoom(application.shaderSize),
        } : application])
    ) as Partial<Record<ContentLayerId, ShaderApplication>>;
    const nextGroups = (parsed.composition.groups ?? layerGroups).flatMap((group): CompositionLayerGroup[] => {
      const seen = new Set<ContentLayerId>();
      const layerIds = group.layerIds.filter((id) => {
        if (!allowedIds.has(id) || !isContentLayerId(id) || seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      return layerIds.length >= 2 ? [{ ...group, layerIds }] : [];
    });
    const nextExportSettings = parsed.exportSettings
      ? normalizeDesignExportSettings(parsed.exportSettings)
      : normalizedExportSettings;
    const nextPreviewFrameCount = Math.max(2, Math.round(nextExportSettings.durationMs / (1_000 / nextExportSettings.fps)));
    const nextPreviewFrame = Math.min(
      nextPreviewFrameCount - 1,
      Math.max(0, Math.round(parsed.timeline?.frame ?? boundedPreviewFrame))
    );

    if (parsed.ratio) setRatio(parsed.ratio);
    if (parsed.composition.backgroundColor) setCanvasBackground(parsed.composition.backgroundColor.toUpperCase());
    setShaderLayers(nextShaderLayers);
    setEffectLayers(nextEffectLayers);
    setTextLayers(nextTextLayers);
    setLayerGroups(nextGroups);
    setLayerShaders(nextLayerShaders);
    setLogoLayers(nextLogoLayers);
    setCompositionAssets(nextAssets);
    if (parsed.exportSettings) setExportSettings(nextExportSettings);
    setLayerOrder(nextOrder);
    previewFrameRef.current = nextPreviewFrame;
    setPreviewFrame(nextPreviewFrame);
    if (parsed.timeline?.paused !== undefined) setPaused(parsed.timeline.paused);
    setSelectedLayerId(null);
    setSelectedCanvasLayerIds([]);
  }

  async function copySetup() {
    const setup = compositionSetupSource();
    try {
      await navigator.clipboard.writeText(setup);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_600);
    } catch {
      setCopied(false);
    }
  }

  function paintShaderApplication(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    instanceKey: string,
    application: ShaderApplication
  ) {
    const liveCanvas = stageRef.current?.querySelector<HTMLElement>(`[data-shader-instance="${instanceKey}"]`)?.querySelector('canvas');
    if (liveCanvas?.width && liveCanvas.height) {
      try {
        drawCover(context, liveCanvas, liveCanvas.width, liveCanvas.height, width, height);
        return;
      } catch {
        paintFallback(context, width, height, application.settings);
        return;
      }
    }
    paintFallback(context, width, height, application.settings);
  }

  function drawContained(
    context: CanvasRenderingContext2D,
    source: CanvasImageSource,
    sourceWidth: number,
    sourceHeight: number,
    x: number,
    y: number,
    width: number,
    height: number
  ) {
    const scale = Math.min(width / sourceWidth, height / sourceHeight);
    const drawnWidth = sourceWidth * scale;
    const drawnHeight = sourceHeight * scale;
    context.drawImage(source, x + (width - drawnWidth) / 2, y + (height - drawnHeight) / 2, drawnWidth, drawnHeight);
  }

  function createContainedLayer(
    image: HTMLImageElement,
    width: number,
    height: number,
    color?: string
  ) {
    const layer = document.createElement('canvas');
    layer.width = Math.max(1, Math.round(width));
    layer.height = Math.max(1, Math.round(height));
    const layerContext = layer.getContext('2d');
    if (!layerContext) return layer;
    drawContained(
      layerContext,
      image,
      image.naturalWidth || 1,
      image.naturalHeight || 1,
      0,
      0,
      layer.width,
      layer.height
    );
    if (color) {
      layerContext.globalCompositeOperation = 'source-in';
      layerContext.fillStyle = color;
      layerContext.fillRect(0, 0, layer.width, layer.height);
    }
    return layer;
  }

  function outputLayerBox(
    layerId: ContentLayerId,
    transform: CanvasLayerTransform,
    outputWidth: number,
    outputHeight: number
  ) {
    const geometry = layerGeometry(layerId, ratio);
    const centerX = geometry.baseX + transform.x + geometry.baseWidth / 2;
    const centerY = geometry.baseY + transform.y + geometry.baseHeight / 2;
    const dimensions = canvasLayerDimensions(transform, geometry);
    const width = dimensions.width / canvasDimensions.width * outputWidth;
    const height = dimensions.height / canvasDimensions.height * outputHeight;
    return {
      height,
      width,
      x: centerX / canvasDimensions.width * outputWidth - width / 2,
      y: centerY / canvasDimensions.height * outputHeight - height / 2,
    };
  }

  function textEffectScratchFor(layerId: TextLayerId) {
    const current = textEffectScratchRefs.current.get(layerId);
    if (current) return current;
    const scratch = {
      fill: document.createElement('canvas'),
      mask: document.createElement('canvas'),
      shadow: document.createElement('canvas'),
    };
    textEffectScratchRefs.current.set(layerId, scratch);
    return scratch;
  }

  function resetTextEffectContext(canvas: HTMLCanvasElement, width: number, height: number) {
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const scratchContext = canvas.getContext('2d');
    if (!scratchContext) return null;
    scratchContext.setTransform(1, 0, 0, 1, 0, 0);
    scratchContext.clearRect(0, 0, width, height);
    scratchContext.filter = 'none';
    scratchContext.globalAlpha = 1;
    scratchContext.globalCompositeOperation = 'source-over';
    scratchContext.shadowBlur = 0;
    scratchContext.shadowColor = 'transparent';
    scratchContext.shadowOffsetX = 0;
    scratchContext.shadowOffsetY = 0;
    return scratchContext;
  }

  function composeFrame(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    images: Map<string, HTMLImageElement>,
    frameLayerIds: readonly CompositionLayerId[] = visibleLayerIds,
    onEffectPainted?: (effectId: EffectLayerId, source: HTMLCanvasElement) => void
  ) {
    context.clearRect(0, 0, width, height);
    context.fillStyle = canvasBackground;
    context.fillRect(0, 0, width, height);

    frameLayerIds.forEach((layerId) => {
      if (isShaderLayerId(layerId)) {
        const shaderLayer = shaderLayers.find((layer) => layer.id === layerId);
        if (!shaderLayer) return;
        context.save();
        context.globalAlpha = shaderLayer.opacity;
        context.globalCompositeOperation = shaderLayer.blendMode === 'normal'
          ? 'source-over'
          : shaderLayer.blendMode;
        paintShaderApplication(context, width, height, `canvas-${layerId}`, shaderLayer);
        context.restore();
        return;
      }

      if (isEffectLayerId(layerId)) {
        const effectLayer = effectLayers.find((layer) => layer.id === layerId);
        if (!effectLayer) return;
        let scratch = effectScratchRefs.current.get(layerId);
        if (!scratch) {
          scratch = createCompositionEffectScratch() ?? undefined;
          if (scratch) effectScratchRefs.current.set(layerId, scratch);
        }
        applyCompositionEffect(context, width, height, {
          ...effectLayer.settings,
          cellSize: effectLayer.settings.cellSize * width / 960,
        }, effectLayer.opacity, scratch);
        onEffectPainted?.(layerId, context.canvas);
        return;
      }

      if (isLogoLayerId(layerId) || isAssetLayerId(layerId)) {
        const layer = isLogoLayerId(layerId)
          ? logoLayers.find((candidate) => candidate.id === layerId)
          : compositionAssets.find((candidate) => candidate.id === layerId);
        const image = layer ? images.get(layer.id) : null;
        if (!layer || !image) return;
        const box = outputLayerBox(layer.id, layer.transform, width, height);
        const application = layerShaders[layer.id];
        const appearance = resolvedLogoAppearance(layer.appearance);
        const layerOpacity = layer.opacity ?? 1;
        if (!application) {
          const contained = createContainedLayer(
            image,
            box.width,
            box.height,
            isLogoLayerId(layerId) ? (layer as CompositionLogoLayer).color ?? '#FFFFFF' : undefined
          );
          drawLogoAppearanceLayer(context, contained, box.x, box.y, box.width, box.height, appearance, layerOpacity);
          return;
        }

        const materialLayer = document.createElement('canvas');
        materialLayer.width = Math.max(1, Math.round(box.width));
        materialLayer.height = Math.max(1, Math.round(box.height));
        const materialContext = materialLayer.getContext('2d');
        if (!materialContext) return;
        paintShaderApplication(
          materialContext,
          materialLayer.width,
          materialLayer.height,
          `content-${layerId}`,
          application
        );
        materialContext.globalCompositeOperation = 'destination-in';
        drawContained(
          materialContext,
          image,
          image.naturalWidth || 1,
          image.naturalHeight || 1,
          0,
          0,
          materialLayer.width,
          materialLayer.height
        );
        context.save();
        context.globalAlpha = application.opacity;
        context.globalCompositeOperation = application.blendMode === 'normal'
          ? 'source-over'
          : application.blendMode;
        drawLogoAppearanceLayer(
          context,
          materialLayer,
          box.x,
          box.y,
          box.width,
          box.height,
          appearance,
          layerOpacity
        );
        context.restore();
        return;
      }

      if (isTextLayerId(layerId)) {
        const textLayer = textLayers.find((layer) => layer.id === layerId);
        if (!textLayer || !textLayer.value) return;
        const transform = resolvedTextTransform(textLayer.transform);
        const box = outputLayerBox(layerId, transform, width, height);
        const value = textLayer.value;
        const textAppearance = resolvedTextAppearance(textLayer);
        context.save();
        context.textAlign = 'left';
        context.textBaseline = 'alphabetic';
        const fontSize = Math.max(18, height * 0.17 * transform.scale);
        const lineHeight = fontSize * textLayer.lineHeight;
        const spacing = textLayer.tracking * fontSize;
        const fontWeight = resolveBrandTypographyWeight(identity, textAppearance.fontRole, textLayer.weight);
        const fontFamily = `${JSON.stringify(brandTypographyFamily(identity, textAppearance.fontRole))}, Arial, sans-serif`;
        context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        context.fontKerning = 'normal';
        const supportsNativeLetterSpacing = typeof context.letterSpacing === 'string';
        if (supportsNativeLetterSpacing) context.letterSpacing = `${spacing}px`;
        const measureText = (text: string) => context.measureText(text).width;
        const lines = layoutCanvasText(
          value,
          box.width,
          measureText,
          spacing,
          textLayer.wrap,
          supportsNativeLetterSpacing ? measureText : undefined
        );
        const metrics = context.measureText('Mg');
        const ascent = metrics.fontBoundingBoxAscent || metrics.actualBoundingBoxAscent || fontSize * 0.8;
        const descent = metrics.fontBoundingBoxDescent || metrics.actualBoundingBoxDescent || fontSize * 0.2;
        const lineBoxBaseline = (lineHeight - ascent - descent) / 2 + ascent;
        const totalHeight = Math.max(lineHeight, lines.length * lineHeight);
        const firstBaseline = box.y + Math.max(0, (box.height - totalHeight) / 2) + lineBoxBaseline;
        const application = layerShaders[layerId];
        let materialLayer: HTMLCanvasElement | null = null;
        let pattern: CanvasPattern | null = null;
        if (application) {
          materialLayer = document.createElement('canvas');
          materialLayer.width = Math.max(1, Math.round(box.width));
          materialLayer.height = Math.max(1, Math.round(box.height));
          const materialContext = materialLayer.getContext('2d');
          if (materialContext) {
            paintShaderApplication(
              materialContext,
              materialLayer.width,
              materialLayer.height,
              `content-${layerId}`,
              application
            );
            pattern = context.createPattern(materialLayer, 'repeat');
            pattern?.setTransform(new DOMMatrix().translate(box.x, box.y));
          }
        }
        context.globalAlpha = textAppearance.opacity * (application?.opacity ?? 1);
        context.globalCompositeOperation = application?.blendMode && application.blendMode !== 'normal'
          ? application.blendMode
          : 'source-over';
        context.lineJoin = 'round';
        context.lineWidth = Math.max(0.5, textAppearance.outlineWidth * 2);
        context.strokeStyle = textAppearance.outlineColor;
        const configureTextContext = (target: CanvasRenderingContext2D) => {
          target.textAlign = 'left';
          target.textBaseline = 'alphabetic';
          target.font = context.font;
          target.fontKerning = 'normal';
          if (supportsNativeLetterSpacing) target.letterSpacing = `${spacing}px`;
          target.lineJoin = 'round';
          target.lineWidth = context.lineWidth;
          target.strokeStyle = textAppearance.outlineColor;
        };
        const paintTextLines = (target: CanvasRenderingContext2D, mode: 'fill' | 'stroke') => {
          configureTextContext(target);
          lines.forEach((line, lineIndex) => {
            const baseline = firstBaseline + lineIndex * lineHeight;
            if (supportsNativeLetterSpacing) {
              const lineWidth = measureText(line);
              const lineX = canvasTextLineX(textLayer.align, box.x, box.width, lineWidth);
              if (mode === 'stroke') target.strokeText(line, lineX, baseline);
              else target.fillText(line, lineX, baseline);
              return;
            }
            const characters = canvasTextCharacters(line);
            const lineWidth = trackedTextWidth(line, measureText, spacing);
            let cursor = canvasTextLineX(textLayer.align, box.x, box.width, lineWidth);
            characters.forEach((character) => {
              if (mode === 'stroke') target.strokeText(character, cursor, baseline);
              else target.fillText(character, cursor, baseline);
              cursor += measureText(character) + spacing;
            });
          });
        };

        if (textAppearance.textEffect.kind === 'solid') {
          context.fillStyle = pattern ?? textAppearance.color;
          if (textAppearance.shadowEnabled) {
            context.shadowBlur = textAppearance.shadowBlur;
            context.shadowColor = colorWithOpacity(textAppearance.shadowColor, textAppearance.shadowOpacity / 100);
            context.shadowOffsetX = textAppearance.shadowOffsetX;
            context.shadowOffsetY = textAppearance.shadowOffsetY;
          }
          if (textAppearance.outlineEnabled) paintTextLines(context, 'stroke');
          paintTextLines(context, 'fill');
        } else {
          const textEffectScratch = textEffectScratchFor(layerId);
          if (textAppearance.shadowEnabled) {
            const shadowLayer = textEffectScratch.shadow;
            const shadowContext = resetTextEffectContext(shadowLayer, width, height);
            if (shadowContext) {
              const shadowColor = colorWithOpacity(textAppearance.shadowColor, textAppearance.shadowOpacity / 100);
              shadowContext.fillStyle = shadowColor;
              shadowContext.shadowBlur = textAppearance.shadowBlur;
              shadowContext.shadowColor = shadowColor;
              shadowContext.shadowOffsetX = textAppearance.shadowOffsetX;
              shadowContext.shadowOffsetY = textAppearance.shadowOffsetY;
              paintTextLines(shadowContext, 'fill');
              shadowContext.globalCompositeOperation = 'destination-out';
              shadowContext.shadowColor = 'transparent';
              shadowContext.shadowBlur = 0;
              shadowContext.shadowOffsetX = 0;
              shadowContext.shadowOffsetY = 0;
              paintTextLines(shadowContext, 'fill');
              context.drawImage(shadowLayer, 0, 0);
            }
          }
          if (textAppearance.outlineEnabled) paintTextLines(context, 'stroke');

          const textMask = textEffectScratch.mask;
          const textMaskContext = resetTextEffectContext(textMask, width, height);
          const fillLayer = textEffectScratch.fill;
          const fillContext = resetTextEffectContext(fillLayer, width, height);
          if (textMaskContext && fillContext) {
            if (textAppearance.textEffect.kind !== 'gradient') {
              context.fillStyle = textAppearance.textEffect.backgroundColor;
              paintTextLines(context, 'fill');
            }
            textMaskContext.fillStyle = '#FFFFFF';
            paintTextLines(textMaskContext, 'fill');
            applyTextEffectMask(
              textMaskContext,
              box,
              textAppearance.textEffect,
              width / canvasDimensions.width
            );
            if (materialLayer) {
              fillContext.drawImage(materialLayer, box.x, box.y, box.width, box.height);
              fillContext.globalCompositeOperation = 'color';
              fillContext.fillStyle = textAppearance.textEffect.kind === 'gradient'
                ? createTextEffectGradient(fillContext, box, textAppearance.textEffect, textAppearance.color)
                : textAppearance.color;
              fillContext.fillRect(box.x, box.y, box.width, box.height);
            } else {
              fillContext.fillStyle = textAppearance.textEffect.kind === 'gradient'
                ? createTextEffectGradient(fillContext, box, textAppearance.textEffect, textAppearance.color)
                : textAppearance.color;
              fillContext.fillRect(box.x, box.y, box.width, box.height);
            }
            fillContext.globalCompositeOperation = 'destination-in';
            fillContext.drawImage(textMask, 0, 0);
            context.drawImage(fillLayer, 0, 0);
          }
        }
        context.restore();
        return;
      }
    });
  }

  async function waitForCompositionFonts() {
    if (!document.fonts) return;
    const visibleTextLayers = textLayers.filter((layer) => (
      layer.visible && visibleLayerIds.includes(layer.id) && layer.value.length > 0
    ));
    if (visibleTextLayers.length === 0) return;

    await document.fonts.ready;
    await Promise.all(visibleTextLayers.map(async (layer) => {
      const appearance = resolvedTextAppearance(layer);
      const family = brandTypographyFamily(identity, appearance.fontRole);
      const weight = resolveBrandTypographyWeight(identity, appearance.fontRole, layer.weight);
      const faces = await document.fonts.load(
        `${weight} 64px ${JSON.stringify(family)}`,
        layer.value || 'Ag'
      );
      const isBundledBrandFont = brandFontAssets(identity).some((font) => (
        font.family === family && font.style === 'normal'
      ));
      if (isBundledBrandFont && faces.length === 0) {
        throw new Error(`${family} ${weight} could not be loaded for export.`);
      }
    }));
    await document.fonts.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }

  async function loadCompositionImages() {
    const entries: [string, string][] = [
      ...logoLayers.map((layer): [string, string] => [layer.id, layer.url]),
      ...compositionAssets.map((asset): [string, string] => [asset.id, asset.url]),
    ];
    return new Map(await Promise.all(entries.map(async ([id, source]) => [id, await loadImage(source)] as const)));
  }

  const composeFrameRef = useRef(composeFrame);
  composeFrameRef.current = composeFrame;
  const lastPreviewEffectIndex = visibleLayerIds.findLastIndex(isEffectLayerId);
  const effectPreviewOrderSignature = lastPreviewEffectIndex < 0
    ? ''
    : visibleLayerIds.slice(0, lastPreviewEffectIndex + 1).join('|');
  const compositionImageSignature = [
    ...logoLayers.map(({ id, url }) => `${id}:${url}`),
    ...compositionAssets.map(({ id, url }) => `${id}:${url}`),
  ].join('|');
  const pausedEffectPreviewSignature = paused ? compositionSignature : '';

  useEffect(() => {
    const activeEffectIds = visibleLayerIds.filter(isEffectLayerId);
    if (activeEffectIds.length === 0) return;

    let animationFrame = 0;
    let cancelled = false;
    let inViewport = true;
    let lastRenderedAt = -Infinity;
    let rendering = false;
    let previewWidth = Math.min(640, canvasDimensions.width);
    let targetFrameRate = 60;
    let renderDurationTotal = 0;
    let renderSamples = 0;
    const observer = typeof IntersectionObserver === 'undefined' || !stageRef.current
      ? null
      : new IntersectionObserver(([entry]) => {
          inViewport = entry?.isIntersecting ?? true;
        }, { rootMargin: '120px' });
    if (observer && stageRef.current) observer.observe(stageRef.current);

    void loadCompositionImages().then((images) => {
      if (cancelled) return;
      const tick = (now: number) => {
        if (cancelled) return;
        const shouldRender = inViewport && !document.hidden && !rendering && (paused || now - lastRenderedAt >= 1000 / targetFrameRate);
        if (shouldRender) {
          rendering = true;
          const renderStartedAt = performance.now();
          const previewHeight = Math.max(1, Math.round(previewWidth * canvasDimensions.height / canvasDimensions.width));
          const buffer = effectPreviewBufferRef.current ?? document.createElement('canvas');
          effectPreviewBufferRef.current = buffer;
          if (buffer.width !== previewWidth) buffer.width = previewWidth;
          if (buffer.height !== previewHeight) buffer.height = previewHeight;
          const context = buffer.getContext('2d', { willReadFrequently: true });
          const lastEffectIndex = Math.max(...activeEffectIds.map((effectId) => visibleLayerIds.indexOf(effectId)));
          if (context) {
            composeFrameRef.current(
              context,
              previewWidth,
              previewHeight,
              images,
              visibleLayerIds.slice(0, lastEffectIndex + 1),
              (effectId, source) => {
                const canvas = effectCanvasRefs.current.get(effectId);
                if (!canvas) return;
                if (canvas.width !== previewWidth) canvas.width = previewWidth;
                if (canvas.height !== previewHeight) canvas.height = previewHeight;
                const visibleContext = canvas.getContext('2d');
                if (!visibleContext) return;
                visibleContext.clearRect(0, 0, previewWidth, previewHeight);
                visibleContext.drawImage(source, 0, 0);
              }
            );
          }
          renderDurationTotal += performance.now() - renderStartedAt;
          renderSamples += 1;
          if (renderSamples >= 8) {
            const averageDuration = renderDurationTotal / renderSamples;
            if (averageDuration > 14) {
              if (previewWidth > 360) previewWidth = Math.max(360, Math.round(previewWidth * 0.84));
              else targetFrameRate = 30;
            } else if (averageDuration < 9) {
              targetFrameRate = 60;
              previewWidth = Math.min(640, canvasDimensions.width, Math.round(previewWidth * 1.12));
            }
            renderDurationTotal = 0;
            renderSamples = 0;
          }
          lastRenderedAt = now;
          rendering = false;
        }
        if (!paused) animationFrame = requestAnimationFrame(tick);
      };
      animationFrame = requestAnimationFrame(tick);
    }).catch(() => {
      // Imported image errors should not take down the editable composition.
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
      cancelAnimationFrame(animationFrame);
    };
  }, [compositionImageSignature, effectPreviewOrderSignature, paused, pausedEffectPreviewSignature, ratio]);

  function createExportCanvas() {
    const output = document.createElement('canvas');
    output.width = exportDimensions.width;
    output.height = exportDimensions.height;
    return output;
  }

  function gifProtectedCompositionColors(): string[] {
    const colors: string[] = [];
    visibleLayerIds.forEach((layerId) => {
      if (isTextLayerId(layerId) && !layerShaders[layerId]) {
        const layer = textLayers.find((candidate) => candidate.id === layerId);
        if (!layer) return;
        const appearance = resolvedTextAppearance(layer);
        colors.push(appearance.color);
        if (appearance.textEffect.kind !== 'solid') colors.push(appearance.textEffect.backgroundColor);
        if (appearance.outlineEnabled) colors.push(appearance.outlineColor);
        if (appearance.shadowEnabled) colors.push(appearance.shadowColor);
        return;
      }
      if (isLogoLayerId(layerId) && !layerShaders[layerId]) {
        const layer = logoLayers.find((candidate) => candidate.id === layerId);
        if (layer?.color) colors.push(layer.color);
      }
    });
    colors.push(canvasBackground);
    return colors;
  }

  async function exportStill(format: StillImageFormat) {
    if (exporting) return;
    const settingsSignature = currentExportSettingsSignature;
    const resumeAfterExport = !paused;
    const stillFrame = paused ? boundedPreviewFrame : previewFrameRef.current;
    flushSync(() => {
      setExporting(format);
      setCaptureTimeMs(stillFrame / normalizedExportSettings.fps * 1_000);
      setPaused(true);
    });
    setExportError(null);
    studioExport.start(`Rendering ${format.toUpperCase()} preview`);
    try {
      const startedAt = performance.now();
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      await waitForCompositionFonts();
      const output = createExportCanvas();
      const context = output.getContext('2d');
      if (!context) throw new Error('Canvas rendering is unavailable.');
      const images = await loadCompositionImages();
      composeFrame(context, output.width, output.height, images);
      const quality = normalizedExportSettings.quality === 'fast'
        ? 0.82
        : normalizedExportSettings.quality === 'best'
          ? 0.96
          : 0.9;
      const blob = await canvasToImageBlob(output, format, quality);
      const label = format === 'jpg' ? 'JPG' : 'PNG';
      const fileName = `${identity.id}-design-lab-${output.width}x${output.height}.${format}`;
      setLastExport({
        blob,
        elapsedMs: performance.now() - startedAt,
        fileName,
        format: label,
        height: output.height,
        width: output.width,
      });
      setLastExportRequest({ format, settingsSignature });
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'The still image could not be exported.');
    } finally {
      setCaptureTimeMs(null);
      setExporting(null);
      if (resumeAfterExport) setPaused(false);
      studioExport.finish();
    }
  }

  async function waitForCapturedFrame(frame: MotionFrame) {
    flushSync(() => setCaptureTimeMs(frame.timeMs));
    await new Promise<void>((resolve) => {
      // Provider renderers stop their live loop before accepting the controlled clock.
      let remainingFrames = frame.index === 0 ? 10 : 3;
      const settleFrame = () => {
        remainingFrames -= 1;
        if (remainingFrames === 0) resolve();
        else requestAnimationFrame(settleFrame);
      };
      requestAnimationFrame(settleFrame);
    });
  }

  async function exportMotion(format: 'gif' | 'mp4') {
    if (exporting) return;
    const settingsSignature = currentExportSettingsSignature;
    setExporting(format);
    setExportError(null);
    studioExport.start(`Rendering ${format.toUpperCase()} preview`, 0);
    try {
      const startedAt = performance.now();
      await waitForCompositionFonts();
      const { durationMs, fps, quality } = normalizedExportSettings;
      const output = createExportCanvas();
      const context = output.getContext('2d', { willReadFrequently: format === 'gif' });
      if (!context) throw new Error('Canvas rendering is unavailable.');
      const images = await loadCompositionImages();
      const renderFrame = async (frame: MotionFrame) => {
        await waitForCapturedFrame(frame);
        composeFrame(context, output.width, output.height, images);
      };
      const sharedOptions = {
        canvas: output,
        durationMs,
        onProgress: studioExport.update,
        renderFrame,
      };
      let loopReport: MotionLoopReport | undefined;
      const blob = format === 'gif'
        ? await encodeCanvasGif({
            ...sharedOptions,
            colors: quality === 'fast' ? 64 : quality === 'best' ? 256 : 128,
            fps,
            loopMode: normalizedExportSettings.gifLoop,
            onLoopReport: (report) => { loopReport = report; },
            paletteFormat: quality === 'fast' ? 'rgb444' : 'rgb565',
            paletteStrategy: quality === 'best' ? 'per-frame' : 'global',
            protectedColors: gifProtectedCompositionColors(),
          })
        : await encodeCanvasMp4({ ...sharedOptions, fps, quality });
      const label = format === 'gif' ? 'GIF' : 'MP4';
      const fileName = `${identity.id}-design-lab-${output.width}x${output.height}.${format}`;
      setLastExport({
        blob,
        elapsedMs: performance.now() - startedAt,
        fileName,
        format: label,
        height: output.height,
        loopReport,
        width: output.width,
      });
      setLastExportRequest({ format, settingsSignature });
    } catch (error) {
      setExportError(error instanceof Error ? error.message : `The ${format.toUpperCase()} could not be exported.`);
    } finally {
      setCaptureTimeMs(null);
      setExporting(null);
      studioExport.finish();
    }
  }

  function updateExportSettings(patch: Partial<DesignExportSettings>) {
    setExportSettings((current) => ({ ...current, ...patch }));
  }

  function refreshExportPreview() {
    if (!lastExportRequest || exporting) return;
    if (lastExportRequest.format === 'gif' || lastExportRequest.format === 'mp4') {
      void exportMotion(lastExportRequest.format);
      return;
    }
    void exportStill(lastExportRequest.format);
  }

  function renderLiveMaterial(application: ShaderApplication, instanceKey: string) {
    const controlledTimeMs = captureTimeMs ?? (paused ? previewCaptureTimeMs : null);
    return (
      <LiveMaterialCanvas
        captureTimeMs={controlledTimeMs}
        className='absolute inset-0 size-full'
        key={instanceKey}
        materialId={application.materialId}
        patternScale={clampShaderZoom(application.shaderSize)}
        paused={paused || controlledTimeMs !== null}
        renderScale={1}
        settings={application.settings}
      />
    );
  }

  return (
    <div className='shader-lab-v2 tool-shell h-full min-h-0'>
      <StudioToolHeader
        actions={(
          <>
          <SourceCodeButton onClick={() => setSourceOpen(true)} />
          <ExportPreview
            asset={lastExport}
            needsRefresh={previewNeedsRefresh}
            onRefresh={refreshExportPreview}
            refreshKey={currentExportSettingsSignature}
            refreshing={Boolean(exporting)}
          />
          {exportError ? <span className='max-w-44 truncate text-[10px] text-status-error' role='alert' title={exportError}>{exportError}</span> : null}
          <Button aria-label={paused ? 'Play shader' : 'Pause shader'} onClick={toggleShaderHistory} size='icon' type='button' variant='outline'>
            {paused ? <Play aria-hidden='true' /> : <Pause aria-hidden='true' />}
          </Button>
          <Button aria-label='Preview PNG export' disabled={Boolean(exporting)} onClick={() => void exportStill('png')} type='button' variant='outline'>
            <Download aria-hidden='true' />
            <span className='responsive-toolbar-label'>PNG</span>
          </Button>
          <Button aria-label='Preview JPG export' disabled={Boolean(exporting)} onClick={() => void exportStill('jpg')} type='button' variant='outline'>
            <Download aria-hidden='true' />
            <span className='responsive-toolbar-label'>JPG</span>
          </Button>
          <Button aria-label='Preview animated GIF export' disabled={Boolean(exporting)} onClick={() => void exportMotion('gif')} type='button' variant='outline'>
            <Download aria-hidden='true' />
            <span className='responsive-toolbar-label'>GIF</span>
          </Button>
          <Button aria-label='Preview MP4 video export' disabled={Boolean(exporting)} onClick={() => void exportMotion('mp4')} type='button'>
            <Download aria-hidden='true' />
            <span className='responsive-toolbar-label'>MP4</span>
          </Button>
          </>
        )}
        metadata='Type · marks · images · live materials'
        navigation={navigation}
        navigationLabel='Design Lab view'
        status={(
          <DesignVersionControls
            identityId={identity.id}
            onOpen={applyCompositionSource}
            source={compositionSetupSource}
            toolId={tool.id}
            workspaceLabel='Design Lab'
          />
        )}
        title={tool.name}
        toolId={tool.id}
      />

      <div className='shader-lab-v2-layout studio-scroll-area'>
        <aside className='shader-lab-v2-library studio-sidebar lab-sidebar lab-sidebar-left studio-scroll-area' aria-label='Shader library' data-canvas-selection-preserve>
          <LabPanelHeading
            action={<button aria-label='Choose a random shader' onClick={selectRandomMaterial} title='Random shader' type='button'>
              <Sparkles aria-hidden='true' />
            </button>}
            className='shader-lab-v2-panel-heading'
            description={`${materials.length} of ${shaderLabCategoryCount('all')} materials`}
            title='Shader library'
          />
          <label className='shader-lab-v2-search'>
            <Search aria-hidden='true' />
            <input aria-label='Search shaders' onChange={(event) => setQuery(event.target.value)} placeholder={`Search all ${shaderLabCategoryCount('all')} shaders`} type='search' value={query} />
          </label>
          <div className='shader-lab-v2-categories' role='list' aria-label='Shader categories'>
            {SHADER_LAB_CATEGORIES.map((option) => (
              <button
                aria-pressed={category === option.id}
                key={option.id}
                onClick={() => setCategory(option.id)}
                type='button'
              >
                {option.label}<span>{shaderLabCategoryCount(option.id)}</span>
              </button>
            ))}
          </div>
          <div className='shader-lab-v2-material-grid studio-scroll-area'>
            {materials.map((option) => (
              <ShaderMaterialCard
                key={option.id}
                material={option}
                onSelect={handleMaterialSelect}
                selected={editingShader?.materialId === option.id}
              />
            ))}
          </div>
        </aside>

        <main className='shader-lab-v2-workspace'>
          <CanvasViewport
            className='shader-lab-v2-composer-viewport'
            draftKey='shader-lab-v2-canvas-zoom'
            identityId={identity.id}
            maxZoom={220}
            onDeselect={deselectCanvasLayers}
            toolId={tool.id}
          >
            <div className='shader-lab-v2-stage-wrap'>
              <div
                className={`shader-lab-v2-stage shader-lab-v2-stage-${ratio}`}
                data-material-id={editingShader?.materialId}
                data-testid='shader-lab-live-stage'
                onKeyDown={handleCanvasAssemblyKeyDown}
                onPointerDown={deselectCanvasLayers}
                ref={stageRef}
                style={{
                  aspectRatio: `${ratioOption.width} / ${ratioOption.height}`,
                  backgroundColor: canvasBackground,
                }}
              >
                {visibleLayerIds.map((layerId, index) => {
                  const zIndex = 4 + index;
                  if (isShaderLayerId(layerId)) {
                    const shaderLayer = shaderLayers.find((layer) => layer.id === layerId);
                    if (!shaderLayer) return null;
                    return (
                      <div
                        className='shader-lab-v2-canvas-material'
                        data-shader-instance={`canvas-${layerId}`}
                        key={layerId}
                        style={{
                          mixBlendMode: shaderBlendStyle(shaderLayer.blendMode),
                          opacity: shaderLayer.opacity,
                          zIndex,
                        }}
                      >
                        {renderLiveMaterial(shaderLayer, `canvas-${layerId}`)}
                      </div>
                    );
                  }

                  if (isEffectLayerId(layerId)) {
                    const effectLayer = effectLayers.find((layer) => layer.id === layerId);
                    if (!effectLayer) return null;
                    return (
                      <canvas
                        aria-hidden='true'
                        className='shader-lab-v2-composition-effect'
                        data-effect-kind={effectLayer.settings.kind}
                        key={layerId}
                        ref={(canvas) => {
                          if (canvas) effectCanvasRefs.current.set(layerId, canvas);
                          else effectCanvasRefs.current.delete(layerId);
                        }}
                        style={{ zIndex }}
                      />
                    );
                  }

                  const geometry = layerGeometry(layerId, ratio);
                  if (isLogoLayerId(layerId)) {
                    const logoLayer = logoLayers.find((layer) => layer.id === layerId);
                    if (!logoLayer) return null;
                    const application = layerShaders[layerId];
                    const appearance = resolvedLogoAppearance(logoLayer.appearance);
                    const maskStyle: CSSProperties = {
                      WebkitMaskImage: `url("${logoLayer.url}")`,
                      WebkitMaskPosition: 'center',
                      WebkitMaskRepeat: 'no-repeat',
                      WebkitMaskSize: 'contain',
                      maskImage: `url("${logoLayer.url}")`,
                      maskMode: 'alpha',
                      maskPosition: 'center',
                      maskRepeat: 'no-repeat',
                      maskSize: 'contain',
                    };
                    return (
                      <EditableCanvasLayer
                        {...geometry}
                        canvasHeight={canvasDimensions.height}
                        canvasWidth={canvasDimensions.width}
                        className='shader-lab-v2-composition-layer'
                        key={layerId}
                        label={logoLayer.name}
                        movementBounds={movementBoundsFor(layerId)}
                        onChange={(transform) => updateCanvasLayerTransform(layerId, transform)}
                        onContextMenu={(event) => openCanvasSelectionMenu(layerId, event)}
                        onDeselect={deselectCanvasLayers}
                        onSelect={(additive) => selectCanvasAssembly(layerId, additive)}
                        selected={selectedCanvasLayerIds.includes(layerId)}
                        selectionMember={selectedCanvasLayerIds.includes(layerId)}
                        showSelectionControls={selectedCanvasLayerIds.length <= 1}
                        transform={logoLayer.transform}
                        zIndex={zIndex}
                      >
                        {application ? (
                          <div
                            className='shader-lab-v2-appearance-preview shader-lab-v2-appearance-stack'
                            style={{
                              mixBlendMode: shaderBlendStyle(application.blendMode),
                              opacity: (logoLayer.opacity ?? 1) * application.opacity,
                            }}
                          >
                            {appearance.borderEnabled ? (
                              <LogoAppearancePreview
                                ariaLabel={`${logoLayer.name} silhouette effects`}
                                className='shader-lab-v2-appearance-stack-layer'
                                color={appearance.borderColor}
                                logoPath={logoLayer.url}
                                settings={{
                                  ...appearance,
                                  ditherEnabled: false,
                                  invert: false,
                                  shadowEnabled: false,
                                }}
                                showSource={false}
                              />
                            ) : null}
                            <AppearanceFilteredContent
                              ariaLabel={`${logoLayer.name} material`}
                              className='shader-lab-v2-appearance-stack-layer'
                              settings={{
                                ...appearance,
                                borderEnabled: false,
                              }}
                            >
                              <div
                                className='shader-lab-v2-layer-logo-mask'
                                data-shader-instance={`content-${layerId}`}
                                style={maskStyle}
                              >
                                {renderLiveMaterial(application, `content-${layerId}`)}
                              </div>
                            </AppearanceFilteredContent>
                          </div>
                        ) : (
                          <LogoAppearancePreview
                            ariaLabel={`${identity.name} logo`}
                            className='shader-lab-v2-appearance-preview'
                            color={logoLayer.color ?? '#FFFFFF'}
                            logoPath={logoLayer.url}
                            opacity={logoLayer.opacity ?? 1}
                            settings={appearance}
                          />
                        )}
                      </EditableCanvasLayer>
                    );
                  }
                  if (isTextLayerId(layerId)) {
                    const textLayer = textLayers.find((layer) => layer.id === layerId);
                    if (!textLayer) return null;
                    const application = layerShaders[layerId];
                    const transform = resolvedTextTransform(textLayer.transform);
                    const textAppearance = resolvedTextAppearance(textLayer);
                    const textFontSizeCqw = canvasDimensions.height / canvasDimensions.width * 17 * transform.scale;
                    return (
                      <EditableCanvasLayer
                        {...geometry}
                        allowContentInteraction
                        canvasHeight={canvasDimensions.height}
                        canvasWidth={canvasDimensions.width}
                        className='shader-lab-v2-composition-layer'
                        key={layerId}
                        label={textLayer.name}
                        movementBounds={movementBoundsFor(layerId)}
                        onChange={(nextTransform) => updateCanvasLayerTransform(layerId, nextTransform)}
                        onContextMenu={(event) => openCanvasSelectionMenu(layerId, event)}
                        onDeselect={deselectCanvasLayers}
                        onSelect={(additive) => selectCanvasAssembly(layerId, additive)}
                        resizeMode='box'
                        selected={selectedCanvasLayerIds.includes(layerId)}
                        selectionMember={selectedCanvasLayerIds.includes(layerId)}
                        showSelectionControls={selectedCanvasLayerIds.length <= 1}
                        transform={transform}
                        zIndex={zIndex}
                      >
                        {application ? (
                          <div
                            aria-hidden='true'
                            className='pointer-events-none absolute inset-0 opacity-0'
                            data-shader-instance={`content-${layerId}`}
                            key='material-source'
                          >
                            {renderLiveMaterial(application, `content-${layerId}`)}
                          </div>
                        ) : null}
                        <CanvasEditableText
                          className={`shader-lab-v2-layer-text ${application ? 'shader-lab-v2-layer-text-material' : ''}`}
                          key='editable-text'
                          label={`Edit ${textLayer.name}`}
                          onChange={(value) => updateTextLayer(layerId, { value })}
                          onFocus={() => selectCanvasAssembly(layerId)}
                          style={{
                            caretColor: textAppearance.color,
                            color: textAppearance.color,
                            fontFamily: `${JSON.stringify(brandTypographyFamily(identity, textAppearance.fontRole))}, Arial, sans-serif`,
                            fontSize: `${textFontSizeCqw}cqw`,
                            fontWeight: resolveBrandTypographyWeight(
                              identity,
                              textAppearance.fontRole,
                              textLayer.weight
                            ),
                            letterSpacing: `${textLayer.tracking}em`,
                            lineHeight: textLayer.lineHeight,
                            justifyContent: textLayer.align === 'left'
                              ? 'flex-start'
                              : textLayer.align === 'right'
                                ? 'flex-end'
                                : 'center',
                            overflowWrap: textLayer.wrap === 'wrap' ? 'anywhere' : 'normal',
                            opacity: textAppearance.opacity * (application?.opacity ?? 1),
                            textAlign: textLayer.align,
                            textShadow: textShadowStyle(textAppearance),
                            WebkitTextStroke: textAppearance.outlineEnabled
                              ? `${textAppearance.outlineWidth}px ${textAppearance.outlineColor}`
                              : undefined,
                            whiteSpace: textLayer.wrap === 'wrap' ? 'pre-wrap' : 'pre',
                            ...textEffectCssStyle(
                              textAppearance.textEffect,
                              textAppearance.color,
                              application ? `url("${shaderPreviewAssetPath(application.materialId)}")` : undefined
                            ),
                            ...(application ? {
                              mixBlendMode: shaderBlendStyle(application.blendMode),
                            } : {}),
                          }}
                          value={textLayer.value}
                        />
                      </EditableCanvasLayer>
                    );
                  }
                  const asset = compositionAssets.find(({ id }) => id === layerId);
                  if (!asset) return null;
                  const application = layerShaders[layerId];
                  const appearance = resolvedLogoAppearance(asset.appearance);
                  const maskStyle: CSSProperties = {
                    WebkitMaskImage: `url("${asset.url}")`,
                    WebkitMaskPosition: 'center',
                    WebkitMaskRepeat: 'no-repeat',
                    WebkitMaskSize: 'contain',
                    maskImage: `url("${asset.url}")`,
                    maskMode: 'alpha',
                    maskPosition: 'center',
                    maskRepeat: 'no-repeat',
                    maskSize: 'contain',
                  };
                  return (
                    <EditableCanvasLayer
                      {...geometry}
                      canvasHeight={canvasDimensions.height}
                      canvasWidth={canvasDimensions.width}
                      className='shader-lab-v2-composition-layer'
                      key={layerId}
                      label={asset.name}
                      movementBounds={movementBoundsFor(layerId)}
                      onChange={(transform) => updateCanvasLayerTransform(layerId, transform)}
                      onContextMenu={(event) => openCanvasSelectionMenu(layerId, event)}
                      onDeselect={deselectCanvasLayers}
                      onSelect={(additive) => selectCanvasAssembly(layerId, additive)}
                      selected={selectedCanvasLayerIds.includes(layerId)}
                      selectionMember={selectedCanvasLayerIds.includes(layerId)}
                      showSelectionControls={selectedCanvasLayerIds.length <= 1}
                      transform={asset.transform}
                      zIndex={zIndex}
                    >
                      {application ? (
                        <div
                          className='shader-lab-v2-appearance-preview shader-lab-v2-appearance-stack'
                          style={{
                            mixBlendMode: shaderBlendStyle(application.blendMode),
                            opacity: (asset.opacity ?? 1) * application.opacity,
                          }}
                        >
                          {appearance.borderEnabled ? (
                            <LogoAppearancePreview
                              ariaLabel={`${asset.name} silhouette effects`}
                              className='shader-lab-v2-appearance-stack-layer'
                              color={appearance.borderColor}
                              logoPath={asset.url}
                              settings={{
                                ...appearance,
                                ditherEnabled: false,
                                invert: false,
                                shadowEnabled: false,
                              }}
                              showSource={false}
                            />
                          ) : null}
                          <AppearanceFilteredContent
                            ariaLabel={`${asset.name} material`}
                            className='shader-lab-v2-appearance-stack-layer'
                            settings={{
                              ...appearance,
                              borderEnabled: false,
                            }}
                          >
                            <div
                              className='shader-lab-v2-layer-logo-mask'
                              data-shader-instance={`content-${layerId}`}
                              style={maskStyle}
                            >
                              {renderLiveMaterial(application, `content-${layerId}`)}
                            </div>
                          </AppearanceFilteredContent>
                        </div>
                      ) : (
                        <LogoAppearancePreview
                          ariaLabel={asset.name}
                          className='shader-lab-v2-appearance-preview'
                          color='#FFFFFF'
                          logoPath={asset.url}
                          opacity={asset.opacity ?? 1}
                          preserveColors
                          settings={appearance}
                        />
                      )}
                    </EditableCanvasLayer>
                  );
                })}
                {selectedCanvasLayerIds.length > 1 && selectedCanvasBounds ? (
                  <div
                    aria-hidden='true'
                    className='canvas-selection-assembly'
                    style={{
                      height: `${selectedCanvasBounds.height / canvasDimensions.height * 100}%`,
                      left: `${selectedCanvasBounds.left / canvasDimensions.width * 100}%`,
                      top: `${selectedCanvasBounds.top / canvasDimensions.height * 100}%`,
                      width: `${selectedCanvasBounds.width / canvasDimensions.width * 100}%`,
                    }}
                  >
                    <span className='canvas-selection-assembly__label'>
                      {selectedCanvasGroup?.name ?? `${selectedCanvasLayerIds.length} layers`}
                    </span>
                  </div>
                ) : null}
                <span aria-live='polite' className='sr-only'>
                  {selectedCanvasLayerIds.length > 0
                    ? `${selectedCanvasLayerIds.length} canvas layer${selectedCanvasLayerIds.length === 1 ? '' : 's'} selected${selectedCanvasGroup ? ` in ${selectedCanvasGroup.name}` : ''}.`
                    : 'Canvas selection cleared.'}
                </span>
                <div className='shader-lab-v2-stage-shade' aria-hidden='true' />
              </div>
            </div>
          </CanvasViewport>
          <CanvasSelectionMenu
            canGroup={selectedCanvasLayerIds.length > 1 && !selectedCanvasGroup}
            canUngroup={selectedGroupedAssemblies.length > 0}
            count={selectedCanvasLayerIds.length}
            groupName={selectedCanvasGroup?.name}
            onAlign={alignCanvasAssembly}
            onBringForward={() => moveCanvasSelection(1)}
            onClose={() => setSelectionMenuPosition(null)}
            onDelete={removeCanvasSelection}
            onDuplicate={duplicateCanvasSelection}
            onGroup={groupCanvasSelection}
            onSendBackward={() => moveCanvasSelection(-1)}
            onUngroup={ungroupCanvasSelection}
            position={selectionMenuPosition}
          />
          <ShaderFrameHistoryControl
            durationMs={normalizedExportSettings.durationMs}
            fps={normalizedExportSettings.fps}
            frame={boundedPreviewFrame}
            onFramePreview={trackPreviewFrame}
            onPauseAtFrame={pauseAtPreviewFrame}
            onPlay={playShaderHistory}
            onScrub={pauseAtPreviewFrame}
            playing={!paused && captureTimeMs === null}
          />
          <div className='shader-lab-v2-bottom-dock' data-canvas-selection-preserve>
            <input accept='image/*,.svg,.avif,.bmp' className='sr-only' multiple onChange={(event) => void addLogoFiles(event.target.files)} ref={logoInputRef} type='file' />
            <input accept='image/*' className='sr-only' multiple onChange={(event) => void addAssets(event.target.files)} ref={assetInputRef} type='file' />
            <div className='shader-lab-v2-dock-create'>
              <div className='shader-lab-v2-dock-heading'>
                <span><Layers3 aria-hidden='true' />Layers</span>
                <small>{listedLayerIds.length} total · front to back</small>
              </div>
              <div className='shader-lab-v2-dock-add' aria-label='Add canvas layer'>
                <button onClick={addTextLayer} type='button'><Type aria-hidden='true' /><span>Text</span></button>
                <button onClick={() => addCanvasShader()} type='button'><Sparkles aria-hidden='true' /><span>Shader</span></button>
                <button onClick={() => addEffectLayer()} type='button'><Grid3X3 aria-hidden='true' /><span>Effect</span></button>
                <button aria-label='Add brand mark' onClick={addBrandMarkLayer} type='button'><Layers3 aria-hidden='true' /><span>Mark</span></button>
                <button onClick={() => assetInputRef.current?.click()} type='button'><ImagePlus aria-hidden='true' /><span>Image</span></button>
              </div>
            </div>

            <div
              aria-label='Canvas layer stack'
              className='shader-lab-v2-dock-stack studio-scroll-area'
              onWheel={scrollLayerDockWithWheel}
              tabIndex={0}
            >
              {[...listedLayerIds].reverse().map((layerId, index) => {
                const layerIsVisible = layerVisible(layerId);
                const orderIndex = layerOrder.indexOf(layerId);
                const shaderLayer = isShaderLayerId(layerId)
                  ? shaderLayers.find(({ id }) => id === layerId)
                  : null;
                const effectLayer = isEffectLayerId(layerId)
                  ? effectLayers.find(({ id }) => id === layerId)
                  : null;
                const textLayer = isTextLayerId(layerId)
                  ? textLayers.find(({ id }) => id === layerId)
                  : null;
                const logoLayer = isLogoLayerId(layerId)
                  ? logoLayers.find(({ id }) => id === layerId)
                  : null;
                const assetLayer = isAssetLayerId(layerId)
                  ? compositionAssets.find(({ id }) => id === layerId)
                  : null;
                const appliedShader = shaderLayer ?? (isContentLayerId(layerId) ? layerShaders[layerId] : null);
                const layerGroup = isContentLayerId(layerId) ? groupForLayer(layerId) : null;
                const textAppearance = textLayer ? resolvedTextAppearance(textLayer) : null;
                const previewUrl = logoLayer?.url ?? assetLayer?.url;
                return (
                  <div
                    aria-selected={selectedLayerId === layerId || (isContentLayerId(layerId) && selectedCanvasLayerIds.includes(layerId))}
                    className='shader-lab-v2-dock-layer'
                    data-kind={layerKind(layerId).toLocaleLowerCase().replaceAll(' ', '-')}
                    data-material={appliedShader ? 'true' : 'false'}
                    data-visible={layerIsVisible}
                    key={layerId}
                  >
                    <button
                      className='shader-lab-v2-dock-layer-select'
                      onClick={() => selectLayerFromStack(layerId)}
                      title={`Select ${layerLabel(layerId)}`}
                      type='button'
                    >
                      <span className='shader-lab-v2-dock-layer-icon'>{isShaderLayerId(layerId)
                        ? <Sparkles aria-hidden='true' />
                        : isEffectLayerId(layerId)
                          ? <Grid3X3 aria-hidden='true' />
                          : isTextLayerId(layerId)
                            ? <Type aria-hidden='true' />
                            : isLogoLayerId(layerId)
                              ? <Layers3 aria-hidden='true' />
                              : <ImagePlus aria-hidden='true' />}</span>
                      <span className='shader-lab-v2-dock-layer-copy'>
                        <strong>{layerLabel(layerId)}</strong>
                        <small>{String(index + 1).padStart(2, '0')} · {layerKind(layerId)}{layerGroup ? ` · ${layerGroup.name}` : ''}</small>
                      </span>
                    </button>
                    <div className='shader-lab-v2-dock-layer-preview'>
                      {appliedShader ? (
                        <span className='shader-lab-v2-dock-material-frame'>
                          <AuthenticShaderPreview materialId={appliedShader.materialId} />
                        </span>
                      ) : null}
                      {textLayer && textAppearance ? (
                        <input
                          aria-label={`Edit ${textLayer.name}`}
                          onChange={(event) => updateTextLayer(textLayer.id, { value: event.target.value })}
                          onFocus={() => selectLayerFromStack(textLayer.id)}
                          onKeyDown={(event) => event.stopPropagation()}
                          style={{
                            color: textAppearance.color,
                            fontFamily: `${JSON.stringify(brandTypographyFamily(identity, textAppearance.fontRole))}, sans-serif`,
                            fontWeight: resolveBrandTypographyWeight(
                              identity,
                              textAppearance.fontRole,
                              textLayer.weight
                            ),
                            letterSpacing: `${textLayer.tracking}em`,
                            opacity: textAppearance.opacity,
                          }}
                          type='text'
                          value={textLayer.value}
                        />
                      ) : (
                        <button className='shader-lab-v2-dock-preview-select' aria-label={`Select ${layerLabel(layerId)} preview`} onClick={() => selectLayerFromStack(layerId)} type='button'>
                          {effectLayer ? (
                            <CompositionEffectThumbnail kind={effectLayer.settings.kind} />
                          ) : previewUrl ? <img alt='' draggable={false} src={previewUrl} /> : <span aria-hidden='true' />}
                        </button>
                      )}
                    </div>
                    <div className='shader-lab-v2-dock-layer-actions'>
                      <button aria-label={`Duplicate ${layerLabel(layerId)}`} onClick={() => duplicateLayer(layerId)} title='Duplicate' type='button'><Copy aria-hidden='true' /></button>
                      <button aria-label={`Move ${layerLabel(layerId)} forward`} disabled={orderIndex === layerOrder.length - 1} onClick={() => moveLayer(layerId, 1)} title='Move forward' type='button'><ArrowUp aria-hidden='true' /></button>
                      <button aria-label={`Move ${layerLabel(layerId)} backward`} disabled={orderIndex === 0} onClick={() => moveLayer(layerId, -1)} title='Move backward' type='button'><ArrowDown aria-hidden='true' /></button>
                      <button aria-label={`${layerIsVisible ? 'Hide' : 'Show'} ${layerLabel(layerId)}`} aria-pressed={layerIsVisible} onClick={() => toggleLayerVisibility(layerId)} title={layerIsVisible ? 'Hide layer' : 'Show layer'} type='button'>{layerIsVisible ? <Eye aria-hidden='true' /> : <EyeOff aria-hidden='true' />}</button>
                      <button aria-label={`Delete ${layerLabel(layerId)}`} onClick={() => removeLayer(layerId)} title='Delete' type='button'><Trash2 aria-hidden='true' /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </main>

        <aside className='shader-lab-v2-inspector studio-sidebar lab-sidebar lab-sidebar-right studio-scroll-area' aria-label='Design Lab controls' data-canvas-selection-preserve>
          <LabPanelHeading
            className='shader-lab-v2-inspector-intro'
            description={selectedShaderLayer
              ? 'Tune this full-canvas material, then place it anywhere in the layer stack.'
              : selectedEffectLayer
                ? 'Convert every layer beneath this point without flattening the composition.'
              : selectedContentLayerId
                ? `Style, position, and export this layer${selectedLayerShader ? ` with ${material.name} applied` : ''}.`
                : 'Select a layer to edit its content and appearance, or add a new one below.'}
            title={selectedLayerId ? layerLabel(selectedLayerId) : 'Design Lab'}
          />

          {!selectedLayerId ? <>
            <LabInspectorSection className='shader-lab-v2-control-section shader-lab-v2-composition-setup' meta={`${canvasDimensions.width} × ${canvasDimensions.height}`} title='Composition setup'>
              <div className='shader-lab-v2-composition-ratios' aria-label='Composition aspect ratio'>
                {RATIO_OPTIONS.map((option) => (
                  <button aria-pressed={ratio === option.value} key={option.value} onClick={() => setRatio(option.value)} type='button'>
                    <i aria-hidden='true' style={{ aspectRatio: `${option.width} / ${option.height}` }} />
                    <span><strong>{option.label}</strong><small>{option.value === 'wide' ? 'Wide' : option.value === 'square' ? 'Square' : 'Social'}</small></span>
                  </button>
                ))}
              </div>
              <dl className='shader-lab-v2-composition-metrics'>
                <div><dt>Layers</dt><dd>{visibleLayerIds.length} / {listedLayerIds.length}</dd></div>
                <div><dt>Shaders</dt><dd>{shaderLayers.filter(({ visible }) => visible).length}</dd></div>
                <div><dt>Motion</dt><dd>{paused ? 'Paused' : 'Live'}</dd></div>
              </dl>

              <div className='shader-lab-v2-composition-group'>
                <div className='shader-lab-v2-composition-subhead'><h4>Layers</h4><span>Add to front</span></div>
                <div className='shader-lab-v2-composition-add' aria-label='Add composition layer'>
                  <button onClick={addTextLayer} type='button'><Type aria-hidden='true' /><span><strong>Text</strong><small>{textLayers.length} layers</small></span></button>
                  <button onClick={() => addCanvasShader()} type='button'><Sparkles aria-hidden='true' /><span><strong>Shader</strong><small>{shaderLayers.length} layers</small></span></button>
                  <button onClick={() => addEffectLayer()} type='button'><Grid3X3 aria-hidden='true' /><span><strong>Effect</strong><small>{effectLayers.length} layers</small></span></button>
                  <button onClick={addBrandMarkLayer} type='button'><Layers3 aria-hidden='true' /><span><strong>Mark</strong><small>{logoLayers.length} layers</small></span></button>
                  <button onClick={() => assetInputRef.current?.click()} type='button'><ImagePlus aria-hidden='true' /><span><strong>Image</strong><small>{compositionAssets.length} layers</small></span></button>
                </div>
              </div>

              <div className='shader-lab-v2-composition-group'>
                <div className='shader-lab-v2-composition-subhead'><h4>Output</h4><span>{exportDimensions.width} × {exportDimensions.height}</span></div>
                <DesignExportControls
                  onChange={updateExportSettings}
                  ratioOption={ratioOption}
                  settings={normalizedExportSettings}
                />
                <div className='shader-lab-v2-composition-output'>
                  <button disabled={Boolean(exporting)} onClick={() => void exportStill('png')} type='button'><ImageDown aria-hidden='true' /><span><strong>PNG</strong><small>Image</small></span></button>
                  <button disabled={Boolean(exporting)} onClick={() => void exportStill('jpg')} type='button'><FileImage aria-hidden='true' /><span><strong>JPG</strong><small>Image</small></span></button>
                  <button disabled={Boolean(exporting)} onClick={() => void exportMotion('gif')} type='button'><Film aria-hidden='true' /><span><strong>GIF</strong><small>Loop</small></span></button>
                  <button disabled={Boolean(exporting)} onClick={() => void exportMotion('mp4')} type='button'><Clapperboard aria-hidden='true' /><span><strong>MP4</strong><small>Video</small></span></button>
                </div>
              </div>
            </LabInspectorSection>
          </> : null}

          <LabInspectorSection className='shader-lab-v2-control-section' meta='Background' title='Canvas'>
            <ColorControl
              ariaLabel='Canvas background color'
              label='Background color'
              onChange={setCanvasBackground}
              value={canvasBackground}
            />
          </LabInspectorSection>

          {selectedEffectLayer ? (
            <LabInspectorSection className='shader-lab-v2-control-section shader-lab-v2-effect-inspector' meta='Post-process' title='Converter'>
              <div className='shader-lab-v2-effect-presets' aria-label='Converter type'>
                {COMPOSITION_EFFECT_PRESETS.map((preset) => (
                  <button
                    aria-pressed={selectedEffectLayer.settings.kind === preset.kind}
                    key={preset.kind}
                    onClick={() => selectEffectPreset(selectedEffectLayer, preset.kind)}
                    type='button'
                  >
                    <CompositionEffectThumbnail kind={preset.kind} />
                    <span><strong>{preset.label}</strong><small>{preset.description}</small></span>
                  </button>
                ))}
              </div>
              <div className='shader-lab-v2-ranges'>
                <RangeControl
                  formatValue={(value) => `${Math.round(value * 100)}%`}
                  label='Layer opacity'
                  max={1}
                  min={0}
                  onChange={(opacity) => updateEffectLayer(selectedEffectLayer.id, { opacity })}
                  step={0.01}
                  value={selectedEffectLayer.opacity}
                />
                <RangeControl
                  formatValue={(value) => `${Math.round(value)}px`}
                  label='Cell size'
                  max={28}
                  min={selectedEffectLayer.settings.kind === 'ascii' ? 7 : selectedEffectLayer.settings.kind === 'halftone' ? 4 : 1}
                  onChange={(cellSize) => updateEffectLayer(selectedEffectLayer.id, {
                    settings: { ...selectedEffectLayer.settings, cellSize },
                  })}
                  step={1}
                  value={selectedEffectLayer.settings.cellSize}
                />
                <RangeControl
                  formatValue={(value) => `${value.toFixed(2)}×`}
                  label='Contrast'
                  max={2.4}
                  min={0.4}
                  onChange={(contrast) => updateEffectLayer(selectedEffectLayer.id, {
                    settings: { ...selectedEffectLayer.settings, contrast },
                  })}
                  step={0.02}
                  value={selectedEffectLayer.settings.contrast}
                />
                <RangeControl
                  formatValue={(value) => `${value >= 0.5 ? '+' : ''}${Math.round((value - 0.5) * 200)}%`}
                  label='Brightness'
                  max={1}
                  min={0}
                  onChange={(threshold) => updateEffectLayer(selectedEffectLayer.id, {
                    settings: { ...selectedEffectLayer.settings, threshold },
                  })}
                  step={0.01}
                  value={selectedEffectLayer.settings.threshold}
                />
                {selectedEffectLayer.settings.kind === 'posterize' ? (
                  <RangeControl
                    formatValue={(value) => `${Math.round(value)} tones`}
                    label='Tone count'
                    max={8}
                    min={2}
                    onChange={(levels) => updateEffectLayer(selectedEffectLayer.id, {
                      settings: { ...selectedEffectLayer.settings, levels },
                    })}
                    step={1}
                    value={selectedEffectLayer.settings.levels}
                  />
                ) : null}
              </div>
              <div className='shader-lab-v2-effect-colors'>
                <ColorControl
                  ariaLabel='Converter foreground color'
                  label='Foreground'
                  onChange={(foreground) => updateEffectLayer(selectedEffectLayer.id, {
                    settings: { ...selectedEffectLayer.settings, foreground },
                  })}
                  value={selectedEffectLayer.settings.foreground}
                />
                <ColorControl
                  ariaLabel='Converter background color'
                  label='Background'
                  onChange={(background) => updateEffectLayer(selectedEffectLayer.id, {
                    settings: { ...selectedEffectLayer.settings, background },
                  })}
                  value={selectedEffectLayer.settings.background}
                />
              </div>
              <div className='shader-lab-v2-effect-group'>
                <label>
                  <span>Invert luminance</span>
                  <input
                    checked={selectedEffectLayer.settings.invert}
                    onChange={(event) => updateEffectLayer(selectedEffectLayer.id, {
                      settings: { ...selectedEffectLayer.settings, invert: event.target.checked },
                    })}
                    type='checkbox'
                  />
                </label>
              </div>
            </LabInspectorSection>
          ) : null}

          {editingShader ? <>
          <LabInspectorSection className='shader-lab-v2-control-section' meta={material.name} title='Shader color'>
            <div className='shader-lab-v2-colors'>
              {([
                { key: 'colorA', label: 'Base color' },
                { key: 'colorB', label: 'Mid color' },
                { key: 'colorC', label: 'Light color' },
              ] as const).map(({ key, label }) => (
                <ColorControl
                  ariaLabel={`Shader ${label.toLowerCase()}`}
                  key={key}
                  label={label}
                  onChange={(color) => updateSetting(key, color)}
                  value={settings[key]}
                />
              ))}
            </div>
            <div className='shader-lab-v2-palettes'>
              {[brandPalette, ...LIVE_MATERIAL_PALETTES.slice(0, 7)].map((palette) => (
                <button
                  aria-label={`Apply ${palette.name} palette`}
                  key={palette.id}
                  onClick={() => updateSelectedShader({
                    settings: {
                      ...settings,
                      colorA: palette.colors[0],
                      colorB: palette.colors[1],
                      colorC: palette.colors[2],
                    },
                  })}
                  title={palette.name}
                  type='button'
                >
                  {palette.colors.map((color) => <i key={color} style={{ background: color }} />)}
                </button>
              ))}
            </div>
            <div className='shader-lab-v2-shader-meta'>
              <button
                onClick={() => updateSelectedShader({
                  settings: shaderLabSettingsFor(editingShader.materialId, initialSettings),
                  shaderSize: 1,
                })}
                type='button'
              ><RotateCcw aria-hidden='true' />Reset shader</button>
              {material.sourceUrl ? (
                <a href={material.sourceUrl} rel='noreferrer' target='_blank'>{material.sourceLabel ?? 'View source'}<ExternalLink aria-hidden='true' /></a>
              ) : null}
            </div>
          </LabInspectorSection>

          <LabInspectorSection className='shader-lab-v2-control-section' meta='Essentials' title='Shader settings'>
            <div className='shader-lab-v2-ranges'>
              <ShaderZoomControl
                onChange={(value) => updateSelectedShader({ shaderSize: value })}
                value={shaderSize}
              />
              <RangeControl
                formatValue={(value) => `${Math.round(value * 100)}%`}
                label='Layer opacity'
                max={1}
                min={0}
                onChange={(value) => updateSelectedShader({ opacity: value })}
                step={0.01}
                value={editingShader.opacity}
              />
              <div className='shader-lab-v2-text-options'>
                <span>Blend</span>
                <div>
                  {(['normal', 'screen', 'overlay', 'multiply'] as const).map((value) => (
                    <button
                      aria-pressed={editingShader.blendMode === value}
                      key={value}
                      onClick={() => updateSelectedShader({ blendMode: value })}
                      type='button'
                    >
                      {value.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
              {isPaperLiveMaterialId(editingShader.materialId) ? (
                <>
                  <RangeControl
                    formatValue={(value) => `${Math.round(value * 100)}%`}
                    label='Center X'
                    max={1}
                    min={0}
                    onChange={(value) => updateSetting('centerX', value)}
                    step={0.01}
                    value={settings.centerX ?? 0.5}
                  />
                  <RangeControl
                    formatValue={(value) => `${Math.round(value * 100)}%`}
                    label='Center Y'
                    max={1}
                    min={0}
                    onChange={(value) => updateSetting('centerY', value)}
                    step={0.01}
                    value={settings.centerY ?? 0.5}
                  />
                </>
              ) : null}
              {PRIMARY_CONTROLS.map((control) => (
                <RangeControl
                  {...control}
                  formatValue={control.key === 'speed' ? (value) => `${value.toFixed(2)}×` : undefined}
                  key={control.key}
                  onChange={(value) => updateSetting(control.key, value)}
                  value={settings[control.key]}
                />
              ))}
            </div>
          </LabInspectorSection>
          </> : null}

          {selectedContentLayerId ? <LabInspectorSection className='shader-lab-v2-control-section shader-lab-v2-layer-inspector' data-canvas-selection-preserve meta={layerKind(selectedContentLayerId)} title='Selected layer'>
            {selectedTextLayer && selectedTextTransform && selectedTextAppearance ? (
              <>
                <label className='shader-lab-v2-text-input'>
                  <Type aria-hidden='true' />
                  <textarea
                    aria-label={`${selectedTextLayer.name} content`}
                    onChange={(event) => updateTextLayer(selectedTextLayer.id, { value: event.target.value })}
                    placeholder='Type something'
                    rows={2}
                    value={selectedTextLayer.value}
                  />
                </label>
                <div aria-label='Typography' className='shader-lab-v2-text-controls'>
                  <label className='shader-lab-v2-field'>
                    <span>Brand font</span>
                    <StudioSelect
                      ariaLabel='Text font role'
                      onValueChange={(fontRole) => {
                        const nextRole = fontRole as BrandTypography['role'];
                        updateTextLayer(selectedTextLayer.id, {
                          fontRole: nextRole,
                          weight: resolveBrandTypographyWeight(
                            identity,
                            nextRole,
                            brandTypographyRole(identity, nextRole).weight ?? selectedTextLayer.weight
                          ),
                        });
                      }}
                      options={(['Display', 'Body', 'Accent', 'Code'] as const).map((role) => ({
                        label: `${role} · ${brandTypographyFamily(identity, role)}`,
                        value: role,
                      }))}
                      value={selectedTextAppearance.fontRole}
                    />
                  </label>
                  <ColorControl
                    ariaLabel='Text color'
                    label='Text color'
                    onChange={(color) => updateTextLayer(selectedTextLayer.id, { color })}
                    value={selectedTextAppearance.color}
                  />
                  <div className='shader-lab-v2-text-options'>
                    <span>Wrap</span>
                    <div>
                      {(['wrap', 'nowrap'] as const).map((value) => (
                        <button
                          aria-pressed={selectedTextLayer.wrap === value}
                          key={value}
                          onClick={() => updateTextLayer(selectedTextLayer.id, { wrap: value })}
                          type='button'
                        >
                          {value === 'wrap' ? 'On' : 'Off'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className='shader-lab-v2-text-options'>
                    <span>Align</span>
                    <div>
                      {(['left', 'center', 'right'] as const).map((value) => (
                        <button
                          aria-pressed={selectedTextLayer.align === value}
                          key={value}
                          onClick={() => updateTextLayer(selectedTextLayer.id, { align: value })}
                          type='button'
                        >
                          {value[0]!.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                  <RangeControl
                    formatValue={(value) => `${Math.round(value * 100)}%`}
                    label='Text size'
                    max={3}
                    min={0.2}
                    onChange={(scale) => updateTextLayer(selectedTextLayer.id, {
                      transform: { ...selectedTextTransform, scale },
                    })}
                    step={0.05}
                    value={selectedTextTransform.scale}
                  />
                  <RangeControl
                    formatValue={(value) => `${Math.round(value * 100)}%`}
                    label='Text box width'
                    max={3}
                    min={0.25}
                    onChange={(widthScale) => updateTextLayer(selectedTextLayer.id, {
                      transform: { ...selectedTextTransform, widthScale },
                    })}
                    step={0.05}
                    value={selectedTextTransform.widthScale ?? 1}
                  />
                  <RangeControl
                    formatValue={(value) => `${Math.round(value * 100)}%`}
                    label='Layer opacity'
                    max={1}
                    min={0}
                    onChange={(opacity) => updateTextLayer(selectedTextLayer.id, { opacity })}
                    step={0.01}
                    value={selectedTextAppearance.opacity}
                  />
                  <RangeControl
                    formatValue={(value) => value.toFixed(2)}
                    label='Line height'
                    max={1.8}
                    min={0.7}
                    onChange={(lineHeight) => updateTextLayer(selectedTextLayer.id, { lineHeight })}
                    step={0.05}
                    value={selectedTextLayer.lineHeight}
                  />
                  <RangeControl
                    formatValue={(value) => String(Math.round(value))}
                    label='Font weight'
                    max={selectedTextWeightRange.max}
                    min={selectedTextWeightRange.min}
                    onChange={(weight) => updateTextLayer(selectedTextLayer.id, {
                      weight: resolveBrandTypographyWeight(
                        identity,
                        selectedTextAppearance.fontRole,
                        weight
                      ),
                    })}
                    step={selectedTextWeightRange.max - selectedTextWeightRange.min <= 100 ? 100 : 50}
                    value={selectedTextRenderedWeight}
                  />
                  <RangeControl
                    formatValue={(value) => `${value.toFixed(2)}em`}
                    label='Tracking'
                    max={0.2}
                    min={-0.12}
                    onChange={(tracking) => updateTextLayer(selectedTextLayer.id, { tracking })}
                    step={0.01}
                    value={selectedTextLayer.tracking}
                  />
                  <div className='shader-lab-v2-text-effects-panel'>
                    <div className='shader-lab-v2-text-effects-heading'>
                      <span><WandSparkles aria-hidden='true' />Text effects</span>
                      <small>Glyph fill</small>
                    </div>
                    <div aria-label='Text effect presets' className='shader-lab-v2-text-effect-presets'>
                      {TEXT_EFFECT_PRESETS.map((preset) => (
                        <button
                          aria-pressed={selectedTextAppearance.textEffect.kind === preset.settings.kind}
                          key={preset.settings.kind}
                          onClick={() => updateTextLayer(selectedTextLayer.id, { textEffect: { ...preset.settings } })}
                          title={preset.description}
                          type='button'
                        >
                          <TextEffectThumbnail settings={preset.settings} />
                          <span><strong>{preset.label}</strong><small>{preset.description}</small></span>
                        </button>
                      ))}
                    </div>
                    {selectedTextAppearance.textEffect.kind !== 'solid' ? (
                      <div className='shader-lab-v2-text-effect-tuning'>
                        <div className='shader-lab-v2-effect-colors'>
                          <ColorControl
                            ariaLabel='Text effect foreground color'
                            label='Foreground'
                            onChange={(color) => updateTextLayer(selectedTextLayer.id, { color })}
                            value={selectedTextAppearance.color}
                          />
                          <ColorControl
                            ariaLabel='Text effect background color'
                            label='Background'
                            onChange={(backgroundColor) => updateTextLayer(selectedTextLayer.id, {
                              textEffect: { ...selectedTextAppearance.textEffect, backgroundColor },
                            })}
                            value={selectedTextAppearance.textEffect.backgroundColor}
                          />
                        </div>
                        {selectedTextAppearance.textEffect.kind !== 'gradient' ? (
                          <RangeControl
                            formatValue={(value) => `${Math.round(value)}%`}
                            label='Effect strength'
                            max={100}
                            min={0}
                            onChange={(amount) => updateTextLayer(selectedTextLayer.id, {
                              textEffect: { ...selectedTextAppearance.textEffect, amount },
                            })}
                            step={1}
                            value={selectedTextAppearance.textEffect.amount}
                          />
                        ) : null}
                        {selectedTextAppearance.textEffect.kind !== 'gradient' ? (
                          <RangeControl
                            formatValue={(value) => `${Math.round(value)}px`}
                            label='Pattern scale'
                            max={36}
                            min={4}
                            onChange={(scale) => updateTextLayer(selectedTextLayer.id, {
                              textEffect: { ...selectedTextAppearance.textEffect, scale },
                            })}
                            step={1}
                            value={selectedTextAppearance.textEffect.scale}
                          />
                        ) : null}
                        {selectedTextAppearance.textEffect.kind !== 'halftone' ? (
                          <RangeControl
                            formatValue={(value) => `${Math.round(value)}°`}
                            label='Effect angle'
                            max={180}
                            min={-180}
                            onChange={(angle) => updateTextLayer(selectedTextLayer.id, {
                              textEffect: { ...selectedTextAppearance.textEffect, angle },
                            })}
                            step={1}
                            value={selectedTextAppearance.textEffect.angle}
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className='shader-lab-v2-effect-group'>
                    <label>
                      <span>Text outline</span>
                      <input checked={selectedTextAppearance.outlineEnabled} onChange={(event) => updateTextLayer(selectedTextLayer.id, { outlineEnabled: event.target.checked })} type='checkbox' />
                    </label>
                    {selectedTextAppearance.outlineEnabled ? <>
                      <ColorControl
                        ariaLabel='Text outline color'
                        label='Outline color'
                        onChange={(outlineColor) => updateTextLayer(selectedTextLayer.id, { outlineColor })}
                        value={selectedTextAppearance.outlineColor}
                      />
                      <RangeControl label='Outline width' max={12} min={0.5} onChange={(outlineWidth) => updateTextLayer(selectedTextLayer.id, { outlineWidth })} step={0.5} value={selectedTextAppearance.outlineWidth} />
                    </> : null}
                  </div>
                  <div className='shader-lab-v2-effect-group'>
                    <label>
                      <span>Text shadow</span>
                      <input checked={selectedTextAppearance.shadowEnabled} onChange={(event) => updateTextLayer(selectedTextLayer.id, { shadowEnabled: event.target.checked })} type='checkbox' />
                    </label>
                    {selectedTextAppearance.shadowEnabled ? <>
                      <ColorControl
                        ariaLabel='Text shadow color'
                        label='Shadow color'
                        onChange={(shadowColor) => updateTextLayer(selectedTextLayer.id, { shadowColor })}
                        value={selectedTextAppearance.shadowColor}
                      />
                      <RangeControl label='Shadow blur' max={64} min={0} onChange={(shadowBlur) => updateTextLayer(selectedTextLayer.id, { shadowBlur })} step={1} value={selectedTextAppearance.shadowBlur} />
                      <RangeControl label='Shadow X' max={48} min={-48} onChange={(shadowOffsetX) => updateTextLayer(selectedTextLayer.id, { shadowOffsetX })} step={1} value={selectedTextAppearance.shadowOffsetX} />
                      <RangeControl label='Shadow Y' max={48} min={-48} onChange={(shadowOffsetY) => updateTextLayer(selectedTextLayer.id, { shadowOffsetY })} step={1} value={selectedTextAppearance.shadowOffsetY} />
                      <RangeControl formatValue={(value) => `${Math.round(value)}%`} label='Shadow opacity' max={100} min={0} onChange={(shadowOpacity) => updateTextLayer(selectedTextLayer.id, { shadowOpacity })} step={1} value={selectedTextAppearance.shadowOpacity} />
                    </> : null}
                  </div>
                </div>
              </>
            ) : null}
            {selectedLogoLayer && selectedLogoAppearance ? (
              <div aria-label='Mark appearance' className='shader-lab-v2-layer-settings'>
                <div className='shader-lab-v2-layer-settings-heading'>
                  <strong>Mark appearance</strong>
                  <span>SVG-safe</span>
                </div>
                <ColorControl
                  ariaLabel='Mark color'
                  label='Mark color'
                  onChange={(color) => updateLogoLayer(selectedLogoLayer.id, { color })}
                  value={selectedLogoLayer.color ?? '#FFFFFF'}
                />
                <RangeControl
                  formatValue={(value) => `${Math.round(value * 100)}%`}
                  label='Layer opacity'
                  max={1}
                  min={0}
                  onChange={(opacity) => updateLogoLayer(selectedLogoLayer.id, { opacity })}
                  step={0.01}
                  value={selectedLogoLayer.opacity ?? 1}
                />
                <LogoAppearanceControls
                  onChange={(patch) => updateLogoLayer(selectedLogoLayer.id, { appearance: { ...selectedLogoAppearance, ...patch } })}
                  settings={selectedLogoAppearance}
                />
                <details className='shader-lab-v2-asset-conversion'>
                  <summary><span>SVG conversion & mark library</span><ChevronDown aria-hidden='true' /></summary>
                  <AssetConversionLibrary
                    compact
                    library={convertedAssetLibrary}
                    onSelect={selectConvertedLogo}
                    selectedAssetId={selectedLogoLayer.convertedAssetId ?? null}
                  />
                </details>
              </div>
            ) : null}
            {selectedAsset && selectedAssetAppearance ? (
              <div aria-label='Image appearance' className='shader-lab-v2-layer-settings'>
                <div className='shader-lab-v2-layer-settings-heading'>
                  <strong>Image appearance</strong>
                  <span>Non-destructive</span>
                </div>
                <RangeControl
                  formatValue={(value) => `${Math.round(value * 100)}%`}
                  label='Layer opacity'
                  max={1}
                  min={0}
                  onChange={(opacity) => updateAssetLayer(selectedAsset.id, { opacity })}
                  step={0.01}
                  value={selectedAsset.opacity ?? 1}
                />
                <LogoAppearanceControls
                  kind='image'
                  onChange={(patch) => updateAssetLayer(selectedAsset.id, { appearance: { ...selectedAssetAppearance, ...patch } })}
                  settings={selectedAssetAppearance}
                />
              </div>
            ) : null}
            {selectedLayerShader ? (
              <Button className='mt-2 w-full' onClick={removeShaderFromSelectedContent} size='sm' type='button' variant='ghost'>
                <X aria-hidden='true' />Remove shader from layer
              </Button>
            ) : null}
            {selectedLogoLayer ? <Button className='mt-2 w-full' onClick={() => updateLogoTransform(selectedLogoLayer.id, DEFAULT_LAYER_TRANSFORM)} size='sm' type='button' variant='ghost'><RotateCcw aria-hidden='true' />Reset mark position</Button> : null}
            {selectedAsset ? <Button className='mt-2 w-full' onClick={() => updateAssetTransform(selectedAsset.id, DEFAULT_LAYER_TRANSFORM)} size='sm' type='button' variant='ghost'><RotateCcw aria-hidden='true' />Reset image position</Button> : null}
            {selectedTextLayer ? (
              <Button
                className='mt-2 w-full'
                onClick={() => updateTextLayer(selectedTextLayer.id, { transform: DEFAULT_TEXT_LAYER_TRANSFORM })}
                size='sm'
                type='button'
                variant='ghost'
              ><RotateCcw aria-hidden='true' />Reset text box</Button>
            ) : null}
          </LabInspectorSection> : null}

          {editingShader ? <details className='shader-lab-v2-advanced'>
            <summary>Advanced <ChevronDown aria-hidden='true' /></summary>
            <div className='shader-lab-v2-ranges'>
              {ADVANCED_CONTROLS.map((control) => (
                <RangeControl {...control} key={control.key} onChange={(value) => updateSetting(control.key, value)} value={settings[control.key]} />
              ))}
            </div>
          </details> : null}

          <section className='shader-lab-v2-handoff'>
            <Code2 aria-hidden='true' />
            <div><strong>Developer handoff</strong><span>Layer order + exact shader settings</span></div>
            <button onClick={() => void copySetup()} type='button'>{copied ? <Check aria-hidden='true' /> : 'Copy'}</button>
          </section>
        </aside>
      </div>
      {sourceOpen ? (
        <SourceCodeDrawer
          format='JSON · Design Lab composition'
          onApply={applyCompositionSource}
          onClose={() => setSourceOpen(false)}
          source={compositionSetupSource()}
          title='Composition code'
        />
      ) : null}
    </div>
  );
}
