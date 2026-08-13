'use client';

import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Code2,
  Copy,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  ImagePlus,
  Layers3,
  Pause,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { flushSync } from 'react-dom';

import CanvasViewport from '@/components/CanvasViewport';
import AuthenticShaderPreview from '@/components/AuthenticShaderPreview';
import AssetConversionLibrary from '@/components/AssetConversionLibrary';
import EditableCanvasLayer, {
  canvasLayerDimensions,
  type CanvasLayerTransform,
} from '@/components/EditableCanvasLayer';
import ExportPreview, { type ExportPreviewAsset } from '@/components/ExportPreview';
import LiveMaterialCanvas from '@/components/LazyLiveMaterialCanvas';
import { LiveMaterialSourceTag } from '@/components/LiveMaterialSourceLabel';
import LogoAppearanceControls from '@/components/LogoAppearanceControls';
import LogoAppearancePreview, { AppearanceFilteredContent } from '@/components/LogoAppearancePreview';
import SourceCodeDrawer, { SourceCodeButton } from '@/components/SourceCodeDrawer';
import { useStudioExportProgress } from '@/components/StudioExportProgress';
import StudioRangeLabel from '@/components/StudioRangeLabel';
import StudioToolHeader from '@/components/StudioToolHeader';
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
import type { StudioTool } from '@/lib/studioCatalog';

type ShaderRatio = 'wide' | 'square' | 'opengraph';
type ShaderBlendMode = 'multiply' | 'normal' | 'overlay' | 'screen';
type ShaderLayerId = `shader-${string}`;
type LogoLayerId = `logo-${string}`;
type TextLayerId = `text-${string}`;
type AssetLayerId = `asset-${string}`;
type ContentLayerId = LogoLayerId | TextLayerId | AssetLayerId;
type CompositionLayerId = ShaderLayerId | ContentLayerId;

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
const EXPORT_WIDTH_PRESETS = [640, 960, 1_280, 1_920] as const;
const EXPORT_QUALITY_OPTIONS: readonly { description: string; label: string; value: MotionExportQuality }[] = [
  { description: 'Smallest and quickest', label: 'Fast', value: 'fast' },
  { description: 'Clean everyday output', label: 'Balanced', value: 'balanced' },
  { description: 'Maximum color detail', label: 'Best', value: 'best' },
];

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
      <div className='shader-lab-v2-export-presets' aria-label='Export size presets'>
        {EXPORT_WIDTH_PRESETS.map((width) => {
          const presetDimensions = resolveExportDimensions({
            aspectHeight: ratioOption.height,
            aspectWidth: ratioOption.width,
            width,
          });
          return (
            <button
              aria-pressed={dimensions.width === presetDimensions.width}
              key={width}
              onClick={() => onChange({ width })}
              type='button'
            >
              <strong>{width}</strong>
              <small>{presetDimensions.width}×{presetDimensions.height}</small>
            </button>
          );
        })}
      </div>
      <label className='shader-lab-v2-export-width'>
        <span>Exact width</span>
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
        <span>Quality</span>
        <div>
          {EXPORT_QUALITY_OPTIONS.map((option) => (
            <button
              aria-pressed={settings.quality === option.value}
              key={option.value}
              onClick={() => onChange({ quality: option.value })}
              title={option.description}
              type='button'
            >{option.label}</button>
          ))}
        </div>
      </div>
      <div className='shader-lab-v2-export-motion'>
        <label>
          <span>Duration</span>
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
          <span>Frame rate</span>
          <StudioSelect
            ariaLabel='Export frame rate'
            onValueChange={(value) => onChange({ fps: Number(value) })}
            options={[12, 15, 24, 30].map((fps) => ({ label: `${fps} FPS`, value: String(fps) }))}
            value={String(settings.fps)}
          />
        </label>
      </div>
      <div className='shader-lab-v2-export-quality shader-lab-v2-export-loop'>
        <span>GIF loop</span>
        <div>
          <button
            aria-pressed={settings.gifLoop === 'seamless'}
            onClick={() => onChange({ gifLoop: 'seamless' })}
            title='Blend a continuous tail into the matching head and verify the closing boundary.'
            type='button'
          >Seamless</button>
          <button
            aria-pressed={settings.gifLoop === 'raw'}
            onClick={() => onChange({ gifLoop: 'raw' })}
            title='Repeat the captured shader frames without correcting the seam.'
            type='button'
          >Raw motion</button>
        </div>
        <small>{settings.gifLoop === 'seamless'
          ? `${loopOverlapFrames}-frame temporal overlap · pixel boundary checked after render`
          : 'No seam correction · useful when the source shader is already periodic'}</small>
      </div>
      <p className='shader-lab-v2-export-summary'>
        {dimensions.width} × {dimensions.height} · {frameCount} motion frames · {EXPORT_QUALITY_OPTIONS.find(({ value }) => value === settings.quality)?.description}
      </p>
    </div>
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
};

function isTextLayerId(layerId: CompositionLayerId | null): layerId is TextLayerId {
  return layerId?.startsWith('text-') ?? false;
}

function isShaderLayerId(layerId: CompositionLayerId | null): layerId is ShaderLayerId {
  return layerId?.startsWith('shader-') ?? false;
}

function isLogoLayerId(layerId: CompositionLayerId | null): layerId is LogoLayerId {
  return layerId?.startsWith('logo-') ?? false;
}

function isAssetLayerId(layerId: CompositionLayerId | null): layerId is AssetLayerId {
  return layerId?.startsWith('asset-') ?? false;
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
      onPointerDown={(event) => event.stopPropagation()}
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
    shaderSize: overrides.shaderSize ?? 1,
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
  const logoInputRef = useRef<HTMLInputElement>(null);
  const assetInputRef = useRef<HTMLInputElement>(null);
  const selectMaterialRef = useRef<(materialId: LiveMaterialId) => void>(() => undefined);
  const handleMaterialSelect = useCallback((materialId: LiveMaterialId) => {
    selectMaterialRef.current(materialId);
  }, []);
  const convertedAssetLibrary = useConvertedAssets();
  const compositionAssetUrlsRef = useRef<string[]>([]);
  const [shaderLayers, setShaderLayers] = useStudioDraft<CompositionShaderLayer[]>(
    identity.id,
    tool.id,
    'shader-lab-v3-canvas-shaders',
    [initialShaderLayer]
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
  const [paused, setPaused] = useState(false);
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
  const [copied, setCopied] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [captureTimeMs, setCaptureTimeMs] = useState<number | null>(null);
  const [exporting, setExporting] = useState<'gif' | 'jpg' | 'mp4' | 'png' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [lastExport, setLastExport] = useState<ExportPreviewAsset | null>(null);
  const [lastExportRequest, setLastExportRequest] = useState<DesignExportRequest | null>(null);
  const ratioOption = RATIO_OPTIONS.find((option) => option.value === ratio) ?? RATIO_OPTIONS[0]!;
  const canvasDimensions = CANVAS_DIMENSIONS[ratio];
  const normalizedExportSettings: DesignExportSettings = {
    durationMs: [1_200, 1_600, 2_400, 4_000].includes(exportSettings.durationMs)
      ? exportSettings.durationMs
      : DEFAULT_EXPORT_SETTINGS.durationMs,
    fps: [12, 15, 24, 30].includes(exportSettings.fps)
      ? exportSettings.fps
      : DEFAULT_EXPORT_SETTINGS.fps,
    gifLoop: exportSettings.gifLoop === 'raw' ? 'raw' : 'seamless',
    quality: EXPORT_QUALITY_OPTIONS.some(({ value }) => value === exportSettings.quality)
      ? exportSettings.quality
      : DEFAULT_EXPORT_SETTINGS.quality,
    width: Number.isFinite(exportSettings.width)
      ? exportSettings.width
      : DEFAULT_EXPORT_SETTINGS.width,
  };
  const exportDimensions = resolveExportDimensions({
    aspectHeight: ratioOption.height,
    aspectWidth: ratioOption.width,
    width: normalizedExportSettings.width,
  });
  const compositionSignature = useMemo(() => JSON.stringify({
    background: canvasBackground,
    layerOrder,
    layerShaders,
    layers: {
      assets: compositionAssets,
      logos: logoLayers,
      shaders: shaderLayers,
      text: textLayers,
    },
  }), [canvasBackground, compositionAssets, layerOrder, layerShaders, logoLayers, shaderLayers, textLayers]);
  const currentExportSettingsSignature = `${designExportSettingsSignature(ratio, normalizedExportSettings)}:${compositionSignature}`;
  const previewNeedsRefresh = Boolean(
    lastExportRequest && lastExportRequest.settingsSignature !== currentExportSettingsSignature
  );
  const materials = useMemo(() => shaderLabMaterials(query, category), [category, query]);
  const selectedShaderLayer = isShaderLayerId(selectedLayerId)
    ? shaderLayers.find(({ id }) => id === selectedLayerId) ?? null
    : null;
  const selectedContentLayerId = selectedLayerId && !isShaderLayerId(selectedLayerId)
    ? selectedLayerId
    : null;
  const selectedLayerShader = selectedContentLayerId ? layerShaders[selectedContentLayerId] ?? null : null;
  const editingShader = selectedShaderLayer ?? selectedLayerShader;
  const activeMaterialId = normalizeLiveMaterialId(
    editingShader?.materialId ?? shaderLayers.at(-1)?.materialId ?? 'holo-cloth-silk'
  );
  const material = getLiveMaterial(activeMaterialId);
  const settings = editingShader?.settings ?? initialSettings;
  const shaderSize = editingShader?.shaderSize ?? 1;
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

  useEffect(() => () => {
    compositionAssetUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    setLayerOrder((current) => {
      const textIds = new Set(textLayers.map(({ id }) => id));
      const shaderIds = new Set(shaderLayers.map(({ id }) => id));
      const retained = current.filter((id) => (
        (!isTextLayerId(id) || textIds.has(id))
        && (!isShaderLayerId(id) || shaderIds.has(id))
      ));
      const missingShaders = shaderLayers.map(({ id }) => id).filter((id) => !retained.includes(id));
      const firstContentIndex = retained.findIndex((id) => !isShaderLayerId(id));
      const shaderInsertionIndex = firstContentIndex < 0 ? retained.length : firstContentIndex;
      const next = [
        ...retained.slice(0, shaderInsertionIndex),
        ...missingShaders,
        ...retained.slice(shaderInsertionIndex),
        ...textLayers.map(({ id }) => id).filter((id) => !retained.includes(id)),
      ];
      return next.length === current.length && next.every((id, index) => id === current[index])
        ? current
        : next;
    });
    setSelectedLayerId((current) =>
      (isTextLayerId(current) && !textLayers.some(({ id }) => id === current))
      || (isShaderLayerId(current) && !shaderLayers.some(({ id }) => id === current))
        ? null
        : current
    );
  }, [shaderLayers, textLayers]);

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
    if (selectedShaderLayer) {
      setShaderLayers((current) => current.map((layer) => (
        layer.id === selectedShaderLayer.id ? { ...layer, ...update } : layer
      )));
      return;
    }
    if (!selectedContentLayerId) return;
    setLayerShaders((current) => ({
      ...current,
      [selectedContentLayerId]: {
        ...(current[selectedContentLayerId] ?? shaderApplicationFor(activeMaterialId, brandPalette.colors)),
        ...update,
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
      if (removed && removed.id !== DEFAULT_LOGO_LAYER_ID && !remaining.some((layer) => layer.url === removed.url)) {
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

  function addAssets(files: FileList | null) {
    const images = Array.from(files ?? []).filter((file) => file.type.startsWith('image/'));
    if (images.length === 0) return;
    const nextAssets = images.map((file, index): CompositionAsset => {
      const url = URL.createObjectURL(file);
      compositionAssetUrlsRef.current.push(url);
      return {
        appearance: { ...DEFAULT_LOGO_APPEARANCE },
        id: `asset-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${index}`}`,
        name: file.name,
        opacity: 1,
        transform: { ...DEFAULT_LAYER_TRANSFORM, x: index * 28, y: index * 24 },
        url,
        visible: true,
      };
    });
    setCompositionAssets((current) => [...current, ...nextAssets]);
    setLayerOrder((current) => [...current, ...nextAssets.map(({ id }) => id)]);
    setSelectedLayerId(nextAssets.at(-1)?.id ?? null);
    if (assetInputRef.current) assetInputRef.current.value = '';
  }

  function removeAsset(id: AssetLayerId) {
    setCompositionAssets((current) => {
      const removed = current.find((asset) => asset.id === id);
      const remaining = current.filter((asset) => asset.id !== id);
      if (removed && !remaining.some((asset) => asset.url === removed.url)) {
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

  function placeLayerAfter(sourceId: CompositionLayerId, nextId: CompositionLayerId) {
    setLayerOrder((current) => {
      const sourceIndex = current.indexOf(sourceId);
      if (sourceIndex < 0) return [...current, nextId];
      return [...current.slice(0, sourceIndex + 1), nextId, ...current.slice(sourceIndex + 1)];
    });
    setSelectedLayerId(nextId);
  }

  function duplicateLayer(id: CompositionLayerId) {
    if (isShaderLayerId(id)) {
      const source = shaderLayers.find((layer) => layer.id === id);
      if (!source) return;
      const nextId = `shader-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as ShaderLayerId;
      setShaderLayers((current) => [...current, {
        ...source,
        id: nextId,
        name: `${source.name} copy`,
        settings: { ...source.settings },
      }]);
      placeLayerAfter(id, nextId);
      return;
    }
    if (isTextLayerId(id)) {
      const source = textLayers.find((layer) => layer.id === id);
      if (!source) return;
      const nextId = `text-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as TextLayerId;
      const transform = resolvedTextTransform(source.transform);
      setTextLayers((current) => [...current, {
        ...source,
        id: nextId,
        name: `${source.name} copy`,
        transform: { ...transform, x: transform.x + 32, y: transform.y + 32 },
      }]);
      if (layerShaders[id]) {
        setLayerShaders((current) => ({ ...current, [nextId]: { ...layerShaders[id]!, settings: { ...layerShaders[id]!.settings } } }));
      }
      placeLayerAfter(id, nextId);
      return;
    }
    if (isLogoLayerId(id)) {
      const source = logoLayers.find((layer) => layer.id === id);
      if (!source) return;
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
      return;
    }
    const source = compositionAssets.find((asset) => asset.id === id);
    if (!source) return;
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
  }

  function removeLayer(id: CompositionLayerId) {
    if (isShaderLayerId(id)) removeShaderLayer(id);
    else if (isLogoLayerId(id)) removeLogoLayer(id);
    else if (isTextLayerId(id)) removeTextLayer(id);
    else removeAsset(id);
  }

  function layerVisible(id: CompositionLayerId) {
    if (isShaderLayerId(id)) return shaderLayers.find((layer) => layer.id === id)?.visible ?? false;
    if (isLogoLayerId(id)) return logoLayers.find((layer) => layer.id === id)?.visible ?? false;
    if (isTextLayerId(id)) return textLayers.find((layer) => layer.id === id)?.visible ?? false;
    return compositionAssets.find((asset) => asset.id === id)?.visible ?? false;
  }

  function layerKind(id: CompositionLayerId) {
    if (isShaderLayerId(id)) return 'Shader';
    if (isLogoLayerId(id)) return 'Brand mark';
    if (isTextLayerId(id)) return 'Editable text';
    return 'Image';
  }

  const visibleLayerIds = layerOrder.filter((id) => {
    return layerVisible(id);
  });
  const listedLayerIds = layerOrder.filter((id) =>
    (isShaderLayerId(id) && shaderLayers.some((layer) => layer.id === id))
    || (isLogoLayerId(id) && logoLayers.some((layer) => layer.id === id))
    || (isTextLayerId(id) && textLayers.some((layer) => layer.id === id))
    || compositionAssets.some((asset) => asset.id === id)
  );

  function toggleLayerVisibility(id: CompositionLayerId) {
    if (isShaderLayerId(id)) {
      setShaderLayers((current) => current.map((layer) => layer.id === id ? { ...layer, visible: !layer.visible } : layer));
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
    if (isLogoLayerId(id)) return logoLayers.find((layer) => layer.id === id)?.name ?? 'Mark';
    if (isTextLayerId(id)) return textLayers.find((layer) => layer.id === id)?.name ?? 'Text';
    return compositionAssets.find((asset) => asset.id === id)?.name ?? 'Image';
  }

  function compositionSetupSource() {
    return JSON.stringify({
      composition: {
        assets: compositionAssets.map(({ appearance, id, name, opacity, transform }) => ({ appearance, id, name, opacity, transform })),
        backgroundColor: canvasBackground,
        layerOrder,
        layerShaders,
        logos: logoLayers.map(({ appearance, color, convertedAssetId, id, name, opacity, transform }) => ({ appearance, color, convertedAssetId, id, name, opacity, transform })),
        shaderLayers,
        textLayers,
      },
      ratio,
    }, null, 2);
  }

  function applyCompositionSource(source: string) {
    const parsed = JSON.parse(source) as {
      composition?: {
        assets?: Array<Omit<CompositionAsset, 'url'>>;
        backgroundColor?: string;
        layerOrder?: CompositionLayerId[];
        layerShaders?: Partial<Record<ContentLayerId, ShaderApplication>>;
        logos?: Array<Omit<CompositionLogoLayer, 'url'>>;
        shaderLayers?: CompositionShaderLayer[];
        textLayers?: CompositionTextLayer[];
      };
      ratio?: ShaderRatio;
    };
    if (!parsed || typeof parsed !== 'object' || !parsed.composition) throw new TypeError('A composition object is required.');
    if (parsed.ratio && !RATIO_OPTIONS.some(({ value }) => value === parsed.ratio)) throw new TypeError('Unknown canvas ratio.');
    if (parsed.composition.backgroundColor && !/^#[\dA-F]{6}$/i.test(parsed.composition.backgroundColor)) throw new TypeError('Canvas background must be a six-digit HEX color.');
    if (parsed.composition.shaderLayers && (!Array.isArray(parsed.composition.shaderLayers) || parsed.composition.shaderLayers.some((layer) => !layer.id?.startsWith('shader-')))) throw new TypeError('Shader layers are invalid.');
    if (parsed.composition.textLayers && (!Array.isArray(parsed.composition.textLayers) || parsed.composition.textLayers.some((layer) => !layer.id?.startsWith('text-') || typeof layer.value !== 'string'))) throw new TypeError('Text layers are invalid.');
    if (parsed.composition.layerOrder && (!Array.isArray(parsed.composition.layerOrder) || parsed.composition.layerOrder.some((id) => typeof id !== 'string'))) throw new TypeError('Layer order is invalid.');

    const nextShaderLayers = parsed.composition.shaderLayers ?? shaderLayers;
    const nextTextLayers = parsed.composition.textLayers ?? textLayers;
    const allowedIds = new Set<CompositionLayerId>([
      ...nextShaderLayers.map(({ id }) => id),
      ...nextTextLayers.map(({ id }) => id),
      ...logoLayers.map(({ id }) => id),
      ...compositionAssets.map(({ id }) => id),
    ]);
    const requestedOrder = parsed.composition.layerOrder ?? layerOrder;
    const nextOrder = requestedOrder.filter((id) => allowedIds.has(id));
    allowedIds.forEach((id) => {
      if (!nextOrder.includes(id)) nextOrder.push(id);
    });

    if (parsed.ratio) setRatio(parsed.ratio);
    if (parsed.composition.backgroundColor) setCanvasBackground(parsed.composition.backgroundColor.toUpperCase());
    if (parsed.composition.shaderLayers) setShaderLayers(parsed.composition.shaderLayers);
    if (parsed.composition.textLayers) setTextLayers(parsed.composition.textLayers);
    if (parsed.composition.layerShaders) setLayerShaders(parsed.composition.layerShaders);
    if (parsed.composition.logos) {
      const updates = new Map(parsed.composition.logos.map((layer) => [layer.id, layer]));
      setLogoLayers((current) => current.map((layer) => {
        const update = updates.get(layer.id);
        return update ? { ...layer, ...update, id: layer.id, url: layer.url } : layer;
      }));
    }
    if (parsed.composition.assets) {
      const updates = new Map(parsed.composition.assets.map((layer) => [layer.id, layer]));
      setCompositionAssets((current) => current.map((layer) => {
        const update = updates.get(layer.id);
        return update ? { ...layer, ...update, id: layer.id, url: layer.url } : layer;
      }));
    }
    setLayerOrder(nextOrder);
    setSelectedLayerId(null);
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

  function composeFrame(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    images: Map<string, HTMLImageElement>
  ) {
    context.clearRect(0, 0, width, height);
    context.fillStyle = canvasBackground;
    context.fillRect(0, 0, width, height);

    visibleLayerIds.forEach((layerId) => {
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
        let pattern: CanvasPattern | null = null;
        if (application) {
          const materialLayer = document.createElement('canvas');
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
        context.fillStyle = pattern ?? textAppearance.color;
        context.globalAlpha = textAppearance.opacity * (application?.opacity ?? 1);
        context.globalCompositeOperation = application?.blendMode && application.blendMode !== 'normal'
          ? application.blendMode
          : 'source-over';
        if (textAppearance.shadowEnabled) {
          context.shadowBlur = textAppearance.shadowBlur;
          context.shadowColor = colorWithOpacity(textAppearance.shadowColor, textAppearance.shadowOpacity / 100);
          context.shadowOffsetX = textAppearance.shadowOffsetX;
          context.shadowOffsetY = textAppearance.shadowOffsetY;
        }
        context.lineJoin = 'round';
        context.lineWidth = Math.max(0.5, textAppearance.outlineWidth * 2);
        context.strokeStyle = textAppearance.outlineColor;
        lines.forEach((line, lineIndex) => {
          const baseline = firstBaseline + lineIndex * lineHeight;
          if (supportsNativeLetterSpacing) {
            const lineWidth = measureText(line);
            const lineX = canvasTextLineX(textLayer.align, box.x, box.width, lineWidth);
            if (textAppearance.outlineEnabled) context.strokeText(line, lineX, baseline);
            context.fillText(line, lineX, baseline);
            return;
          }
          const characters = canvasTextCharacters(line);
          const lineWidth = trackedTextWidth(line, measureText, spacing);
          let cursor = canvasTextLineX(textLayer.align, box.x, box.width, lineWidth);
          characters.forEach((character) => {
            if (textAppearance.outlineEnabled) {
              context.strokeText(character, cursor, baseline);
            }
            context.fillText(character, cursor, baseline);
            cursor += measureText(character) + spacing;
          });
        });
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
    flushSync(() => {
      setExporting(format);
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
    return (
      <LiveMaterialCanvas
        captureTimeMs={captureTimeMs}
        className='absolute inset-0 size-full'
        key={instanceKey}
        materialId={application.materialId}
        patternScale={application.shaderSize}
        paused={paused || captureTimeMs !== null}
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
          <Button aria-label={paused ? 'Play shader' : 'Pause shader'} onClick={() => setPaused((current) => !current)} size='icon' type='button' variant='outline'>
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
        title={tool.name}
        toolId={tool.id}
      />

      <div className='shader-lab-v2-layout studio-scroll-area'>
        <aside className='shader-lab-v2-library studio-scroll-area' aria-label='Shader library' data-canvas-selection-preserve>
          <div className='shader-lab-v2-panel-heading'>
            <div>
              <p>Shader library</p>
              <span>{materials.length} of {shaderLabCategoryCount('all')} materials</span>
            </div>
            <button aria-label='Choose a random shader' onClick={selectRandomMaterial} title='Random shader' type='button'>
              <Sparkles aria-hidden='true' />
            </button>
          </div>
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
            onDeselect={() => setSelectedLayerId(null)}
            toolId={tool.id}
          >
            <div className='shader-lab-v2-stage-wrap'>
              <div
                className={`shader-lab-v2-stage shader-lab-v2-stage-${ratio}`}
                data-material-id={editingShader?.materialId}
                data-testid='shader-lab-live-stage'
                onPointerDown={() => setSelectedLayerId(null)}
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
                        onChange={(transform) => updateLogoTransform(layerId, transform)}
                        onDeselect={() => setSelectedLayerId(null)}
                        onSelect={() => setSelectedLayerId(layerId)}
                        selected={selectedLayerId === layerId}
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
                            <AppearanceFilteredContent
                              ariaLabel={`${logoLayer.name} material`}
                              className='shader-lab-v2-appearance-stack-layer'
                              settings={{
                                ...appearance,
                                borderEnabled: false,
                                shadowEnabled: false,
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
                            {appearance.borderEnabled || appearance.shadowEnabled ? (
                              <LogoAppearancePreview
                                ariaLabel={`${logoLayer.name} silhouette effects`}
                                className='shader-lab-v2-appearance-stack-layer'
                                color={appearance.borderColor}
                                logoPath={logoLayer.url}
                                settings={{
                                  ...appearance,
                                  ditherEnabled: false,
                                  invert: false,
                                }}
                                showSource={false}
                              />
                            ) : null}
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
                        onChange={(nextTransform) => updateTextLayer(layerId, { transform: nextTransform })}
                        onDeselect={() => setSelectedLayerId(null)}
                        onSelect={() => setSelectedLayerId(layerId)}
                        resizeMode='box'
                        selected={selectedLayerId === layerId}
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
                          onFocus={() => setSelectedLayerId(layerId)}
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
                            ...(application ? {
                              backgroundImage: `url("${shaderPreviewAssetPath(application.materialId)}")`,
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
                      onChange={(transform) => updateAssetTransform(layerId, transform)}
                      onDeselect={() => setSelectedLayerId(null)}
                      onSelect={() => setSelectedLayerId(layerId)}
                      selected={selectedLayerId === layerId}
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
                          <AppearanceFilteredContent
                            ariaLabel={`${asset.name} material`}
                            className='shader-lab-v2-appearance-stack-layer'
                            settings={{
                              ...appearance,
                              borderEnabled: false,
                              shadowEnabled: false,
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
                          {appearance.borderEnabled || appearance.shadowEnabled ? (
                            <LogoAppearancePreview
                              ariaLabel={`${asset.name} silhouette effects`}
                              className='shader-lab-v2-appearance-stack-layer'
                              color={appearance.borderColor}
                              logoPath={asset.url}
                              settings={{
                                ...appearance,
                                ditherEnabled: false,
                                invert: false,
                              }}
                              showSource={false}
                            />
                          ) : null}
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
                <div className='shader-lab-v2-stage-shade' aria-hidden='true' />
              </div>
            </div>
          </CanvasViewport>
          <div className='shader-lab-v2-bottom-dock' data-canvas-selection-preserve>
            <input accept='image/*,.svg,.avif,.bmp' className='sr-only' multiple onChange={(event) => void addLogoFiles(event.target.files)} ref={logoInputRef} type='file' />
            <input accept='image/*' className='sr-only' multiple onChange={(event) => addAssets(event.target.files)} ref={assetInputRef} type='file' />
            <div className='shader-lab-v2-dock-create'>
              <div className='shader-lab-v2-dock-heading'>
                <span><Layers3 aria-hidden='true' />Layers</span>
                <small>{listedLayerIds.length} total · front to back</small>
              </div>
              <div className='shader-lab-v2-dock-add' aria-label='Add canvas layer'>
                <button onClick={addTextLayer} type='button'><Type aria-hidden='true' /><span>Text</span></button>
                <button onClick={() => addCanvasShader()} type='button'><Sparkles aria-hidden='true' /><span>Shader</span></button>
                <button aria-label='Add brand mark' onClick={addBrandMarkLayer} type='button'><Layers3 aria-hidden='true' /><span>Mark</span></button>
                <button onClick={() => assetInputRef.current?.click()} type='button'><ImagePlus aria-hidden='true' /><span>Image</span></button>
              </div>
            </div>

            <div className='shader-lab-v2-dock-stack studio-scroll-area' aria-label='Canvas layer stack'>
              {[...listedLayerIds].reverse().map((layerId, index) => {
                const layerIsVisible = layerVisible(layerId);
                const orderIndex = layerOrder.indexOf(layerId);
                const shaderLayer = isShaderLayerId(layerId)
                  ? shaderLayers.find(({ id }) => id === layerId)
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
                const appliedShader = shaderLayer ?? (!isShaderLayerId(layerId) ? layerShaders[layerId] : null);
                const textAppearance = textLayer ? resolvedTextAppearance(textLayer) : null;
                const previewUrl = logoLayer?.url ?? assetLayer?.url;
                return (
                  <div
                    aria-selected={selectedLayerId === layerId}
                    className='shader-lab-v2-dock-layer'
                    data-kind={layerKind(layerId).toLocaleLowerCase().replaceAll(' ', '-')}
                    data-material={appliedShader ? 'true' : 'false'}
                    data-visible={layerIsVisible}
                    key={layerId}
                  >
                    <button
                      className='shader-lab-v2-dock-layer-select'
                      onClick={() => setSelectedLayerId(layerId)}
                      title={`Select ${layerLabel(layerId)}`}
                      type='button'
                    >
                      <span className='shader-lab-v2-dock-layer-icon'>{isShaderLayerId(layerId)
                        ? <Sparkles aria-hidden='true' />
                        : isTextLayerId(layerId)
                          ? <Type aria-hidden='true' />
                          : isLogoLayerId(layerId)
                            ? <Layers3 aria-hidden='true' />
                            : <ImagePlus aria-hidden='true' />}</span>
                      <span className='shader-lab-v2-dock-layer-copy'>
                        <strong>{layerLabel(layerId)}</strong>
                        <small>{String(index + 1).padStart(2, '0')} · {layerKind(layerId)}</small>
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
                          onFocus={() => setSelectedLayerId(textLayer.id)}
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
                        <button className='shader-lab-v2-dock-preview-select' aria-label={`Select ${layerLabel(layerId)} preview`} onClick={() => setSelectedLayerId(layerId)} type='button'>
                          {previewUrl ? <img alt='' draggable={false} src={previewUrl} /> : <span aria-hidden='true' />}
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

        <aside className='shader-lab-v2-inspector studio-scroll-area' aria-label='Design Lab controls' data-canvas-selection-preserve>
          <section className='shader-lab-v2-inspector-intro'>
            <div>
              <span>{selectedShaderLayer
                ? 'Canvas shader'
                : selectedTextLayer
                  ? 'Text layer'
                  : selectedLogoLayer
                    ? 'Mark layer'
                    : selectedAsset
                      ? 'Image layer'
                      : 'Composition'}</span>
              <h2>{selectedLayerId ? layerLabel(selectedLayerId) : 'Design Lab'}</h2>
            </div>
            <p>{selectedShaderLayer
              ? 'Tune this full-canvas material, then place it anywhere in the layer stack.'
              : selectedContentLayerId
                ? `Style, position, and export this layer${selectedLayerShader ? ` with ${material.name} applied` : ''}.`
                : 'Select a layer to edit its content and appearance, or add a new one below.'}</p>
          </section>

          {!selectedLayerId ? <>
            <section className='shader-lab-v2-control-section shader-lab-v2-composition-setup'>
              <div className='shader-lab-v2-section-title'><h3>Composition setup</h3><span>{canvasDimensions.width} × {canvasDimensions.height}</span></div>
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
                  <button disabled={Boolean(exporting)} onClick={() => void exportStill('png')} type='button'><Download aria-hidden='true' /><span>PNG</span></button>
                  <button disabled={Boolean(exporting)} onClick={() => void exportStill('jpg')} type='button'><Download aria-hidden='true' /><span>JPG</span></button>
                  <button disabled={Boolean(exporting)} onClick={() => void exportMotion('gif')} type='button'><Play aria-hidden='true' /><span>GIF</span></button>
                  <button disabled={Boolean(exporting)} onClick={() => void exportMotion('mp4')} type='button'><Play aria-hidden='true' /><span>MP4</span></button>
                </div>
              </div>
            </section>
          </> : null}

          <section className='shader-lab-v2-control-section'>
            <div className='shader-lab-v2-section-title'><h3>Canvas</h3><span>Background</span></div>
            <ColorControl
              ariaLabel='Canvas background color'
              label='Background color'
              onChange={setCanvasBackground}
              value={canvasBackground}
            />
          </section>

          {editingShader ? <>
          <section className='shader-lab-v2-control-section'>
            <div className='shader-lab-v2-section-title'><h3>Shader color</h3><span>{material.name}</span></div>
            <div className='shader-lab-v2-colors'>
              {(['colorA', 'colorB', 'colorC'] as const).map((key, index) => (
                <label key={key}>
                  <input aria-label={`Color ${index + 1}`} onChange={(event) => updateSetting(key, event.target.value)} type='color' value={settings[key]} />
                  <span>{settings[key]}</span>
                </label>
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
          </section>

          <section className='shader-lab-v2-control-section'>
            <div className='shader-lab-v2-section-title'><h3>Shader settings</h3><span>Essentials</span></div>
            <div className='shader-lab-v2-ranges'>
              <RangeControl
                label='Shader size'
                max={3}
                min={0.25}
                onChange={(value) => updateSelectedShader({ shaderSize: value })}
                step={0.05}
                value={shaderSize}
              />
              <RangeControl
                formatValue={(value) => `${Math.round(value * 100)}%`}
                label='Opacity'
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
          </section>
          </> : null}

          {selectedContentLayerId ? <section className='shader-lab-v2-control-section shader-lab-v2-layer-inspector' data-canvas-selection-preserve>
            <div className='shader-lab-v2-section-title'><h3>Selected layer</h3><span>{selectedContentLayerId ? layerKind(selectedContentLayerId) : 'Canvas'}</span></div>
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
                    label='Text opacity'
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
                  <div className='shader-lab-v2-effect-group'>
                    <label>
                      <span>Text outline</span>
                      <input checked={selectedTextAppearance.outlineEnabled} onChange={(event) => updateTextLayer(selectedTextLayer.id, { outlineEnabled: event.target.checked })} type='checkbox' />
                    </label>
                    {selectedTextAppearance.outlineEnabled ? <>
                      <label className='shader-lab-v2-color-field'>
                        <span>Outline color</span>
                        <span>
                          <input aria-label='Text outline color' onChange={(event) => updateTextLayer(selectedTextLayer.id, { outlineColor: event.target.value })} type='color' value={selectedTextAppearance.outlineColor} />
                          <code>{selectedTextAppearance.outlineColor}</code>
                        </span>
                      </label>
                      <RangeControl label='Outline width' max={12} min={0.5} onChange={(outlineWidth) => updateTextLayer(selectedTextLayer.id, { outlineWidth })} step={0.5} value={selectedTextAppearance.outlineWidth} />
                    </> : null}
                  </div>
                  <div className='shader-lab-v2-effect-group'>
                    <label>
                      <span>Text shadow</span>
                      <input checked={selectedTextAppearance.shadowEnabled} onChange={(event) => updateTextLayer(selectedTextLayer.id, { shadowEnabled: event.target.checked })} type='checkbox' />
                    </label>
                    {selectedTextAppearance.shadowEnabled ? <>
                      <label className='shader-lab-v2-color-field'>
                        <span>Shadow color</span>
                        <span>
                          <input aria-label='Text shadow color' onChange={(event) => updateTextLayer(selectedTextLayer.id, { shadowColor: event.target.value })} type='color' value={selectedTextAppearance.shadowColor} />
                          <code>{selectedTextAppearance.shadowColor}</code>
                        </span>
                      </label>
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
                <label className='shader-lab-v2-color-field'>
                  <span>Mark color</span>
                  <span>
                    <input aria-label='Mark color' onChange={(event) => updateLogoLayer(selectedLogoLayer.id, { color: event.target.value })} type='color' value={selectedLogoLayer.color ?? '#FFFFFF'} />
                    <code>{selectedLogoLayer.color ?? '#FFFFFF'}</code>
                  </span>
                </label>
                <RangeControl
                  formatValue={(value) => `${Math.round(value * 100)}%`}
                  label='Mark opacity'
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
                  label='Image opacity'
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
          </section> : null}

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
