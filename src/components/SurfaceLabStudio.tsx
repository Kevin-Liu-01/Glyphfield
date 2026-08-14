'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { T, useGT } from 'gt-next';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileImage,
  ImageDown,
  ImagePlus,
  Layers3,
  RectangleHorizontal,
  RectangleVertical,
  RotateCcw,
  Search,
  Sparkles,
  Square,
  Sticker,
  Trash2,
  Type,
  WandSparkles,
  WrapText,
} from 'lucide-react';

import CanvasViewport from '@/components/CanvasViewport';
import EditableCanvasLayer, { type CanvasLayerTransform } from '@/components/EditableCanvasLayer';
import ExportPreview, { type ExportPreviewAsset } from '@/components/ExportPreview';
import { LabInspectorSection, LabPanelHeading } from '@/components/LabWorkspace';
import LazyLiveMaterialCanvas from '@/components/LazyLiveMaterialCanvas';
import { LiveMaterialSourceTag } from '@/components/LiveMaterialSourceLabel';
import SourceCodeDrawer, { SourceCodeButton } from '@/components/SourceCodeDrawer';
import { useStudioExportProgress } from '@/components/StudioExportProgress';
import StudioRangeLabel from '@/components/StudioRangeLabel';
import StudioToolHeader from '@/components/StudioToolHeader';
import StickerDeviceScene, {
  type StickerRenderLayer,
  type StickerSelection,
  type StickerStudioStageHandle,
} from '@/components/StickerDeviceScene';
import SurfaceMaterialStage from '@/components/SurfaceMaterialStage';
import { Button } from '@/components/ui/Button';
import StudioColorControl from '@/components/ui/ColorControl';
import StudioSelect from '@/components/ui/StudioSelect';
import { useMountEffect } from '@/hooks/useMountEffect';
import { useStudioDraft } from '@/hooks/usePersistentState';
import { DEFAULT_BACKGROUND_SETTINGS, type BackgroundSettings } from '@/lib/backgroundSvg';
import {
  brandAssetPath,
  brandTypographyFamily,
  type BrandIdentity,
  type BrandTypography,
} from '@/lib/brandIdentity';
import {
  DEFAULT_LIVE_MATERIAL_SETTINGS,
  brandMaterialPalette,
  type LiveMaterialId,
  type LiveMaterialSettings,
} from '@/lib/liveMaterials';
import {
  SHADER_LAB_CATEGORIES,
  SHADER_LIBRARY_DEFAULT_IDS,
  shaderLabMaterials,
  shaderLabSettingsFor,
  shaderPreviewAssetPath,
  type ShaderLabCategory,
} from '@/lib/shaderLab';
import { getOpenSurfaceAsset } from '@/lib/openSurfaceLibrary';
import type { StudioTool } from '@/lib/studioCatalog';
import {
  SURFACE_LAB_CLOTH_PRESETS,
  SURFACE_LAB_SHEET_PRESETS,
  SURFACE_LAB_SHADER_PRESETS,
  type SurfaceLabPreset,
} from '@/lib/surfaceLab';
import {
  DEFAULT_STICKER_FINISH,
  STICKER_FINISH_PRESETS,
  normalizeStickerFinish,
  type StickerFinishSettings,
} from '@/lib/surfaceSticker';
import { stickerSceneAssets, stickerTextSceneAsset, type StickerSceneAsset } from '@/lib/stickerScene';

const OUTPUT_SIZES = [
  { height: 630, id: 'wide', label: 'Wide · 1200 × 630', width: 1200 },
  { height: 1200, id: 'square', label: 'Square · 1200 × 1200', width: 1200 },
  { height: 1350, id: 'portrait', label: 'Portrait · 1080 × 1350', width: 1080 },
] as const;

type ArtworkKind = 'logo' | 'asset';
type DesignDock = 'shader' | 'surface' | 'text' | 'sticker';

type PlaygroundTextLayer = {
  align: 'center' | 'left' | 'right';
  color: string;
  fontRole: BrandTypography['role'];
  id: `text-${string}`;
  lineHeight: number;
  name: string;
  opacity: number;
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
  wrap?: 'nowrap' | 'wrap';
};

type PlaygroundStickerText = {
  align: 'center' | 'left' | 'right';
  color: string;
  fontRole: BrandTypography['role'];
  id: `sticker-text-${string}`;
  lineHeight: number;
  name: string;
  tracking: number;
  value: string;
  weight: number;
};

type PendingStickerAction = {
  assetId: PlaygroundStickerText['id'];
  mode: 'add' | 'duplicate';
};

const DEFAULT_TEXT_TRANSFORM: CanvasLayerTransform = {
  heightScale: 1,
  scale: 1,
  widthScale: 1,
  x: 0,
  y: 0,
};

const DESIGN_SURFACE_IDS = new Set([
  'thin-film-opal',
  'brushed-aluminum-v3',
  'frosted-glass-v3',
  'carbon-twill-v3',
  'ambientcg-leather-037',
  'polyhaven-velour-velvet',
]);

const DESIGN_SURFACE_PRESETS = [
  ...SURFACE_LAB_CLOTH_PRESETS,
  ...SURFACE_LAB_SHEET_PRESETS.filter(({ id }) => DESIGN_SURFACE_IDS.has(id)),
] as const;

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
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

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The browser could not encode this composition.'));
    }, 'image/png');
  });
}

function resolvedTextTransform(transform: CanvasLayerTransform): CanvasLayerTransform {
  return {
    ...transform,
    heightScale: transform.heightScale ?? 1,
    widthScale: transform.widthScale ?? 1,
  };
}

function PlaygroundEditableText({
  label,
  onChange,
  onFocus,
  style,
  value,
}: {
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
      className='design-lab-canvas-text'
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

function wrapCanvasLine(context: CanvasRenderingContext2D, value: string, maxWidth: number): string[] {
  if (!value) return [''];
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  lines.push(line);
  return lines;
}

function RangeControl({
  disabled = false,
  label,
  max,
  min,
  onChange,
  step = 1,
  suffix = '%',
  value,
}: {
  disabled?: boolean;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step?: number;
  suffix?: string;
  value: number;
}) {
  return (
    <label className='design-lab-range' data-disabled={disabled ? 'true' : 'false'}>
      <StudioRangeLabel label={label} value={<output>{Math.round(value * 100) / 100}{suffix}</output>} />
      <input aria-label={label} disabled={disabled} className='studio-range' max={max} min={min} onChange={(event) => onChange(Number(event.target.value))} step={step} type='range' value={value} />
    </label>
  );
}

function CompactColorControl({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className='design-lab-color'>
      <input aria-label={label} onChange={(event) => onChange(event.target.value.toUpperCase())} type='color' value={value} />
      <span>{label}</span>
      <code>{value}</code>
    </label>
  );
}

function TextAlignmentControl({
  ariaLabel,
  onChange,
  value,
}: {
  ariaLabel: string;
  onChange: (value: PlaygroundTextLayer['align']) => void;
  value: PlaygroundTextLayer['align'];
}) {
  const options = [
    { Icon: AlignLeft, label: 'Left', value: 'left' as const },
    { Icon: AlignCenter, label: 'Center', value: 'center' as const },
    { Icon: AlignRight, label: 'Right', value: 'right' as const },
  ];
  return (
    <div className='design-lab-segmented-field'>
      <span><AlignLeft aria-hidden='true' />Alignment</span>
      <div aria-label={ariaLabel} role='group'>
        {options.map(({ Icon, label, value: optionValue }) => (
          <button
            aria-label={label}
            aria-pressed={value === optionValue}
            key={optionValue}
            onClick={() => onChange(optionValue)}
            title={label}
            type='button'
          ><Icon aria-hidden='true' /><span>{label}</span></button>
        ))}
      </div>
    </div>
  );
}

function colorWithOpacity(color: string, opacity: number): string {
  const hex = color.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(hex)) return color;
  const value = Number.parseInt(hex, 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${Math.max(0, Math.min(1, opacity))})`;
}

export default function SurfaceLabStudio({ identity, tool }: { identity: BrandIdentity; tool: StudioTool }) {
  const gt = useGT();
  const studioExport = useStudioExportProgress(`${identity.id}:${tool.id}:playground`);
  const palette = useMemo(() => brandMaterialPalette(identity), [identity]);
  const shaderStageRef = useRef<HTMLDivElement>(null);
  const surfaceStageRef = useRef<HTMLDivElement>(null);
  const stickerStageRef = useRef<StickerStudioStageHandle>(null);
  const pendingStickerActionRef = useRef<PendingStickerAction | null>(null);
  const customArtworkRef = useRef<{ name: string; url: string } | null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState<ExportPreviewAsset | null>(null);
  const [selectedSticker, setSelectedSticker] = useState<StickerSelection | null>(null);
  const [stickerRenderLayers, setStickerRenderLayers] = useState<StickerRenderLayer[]>([]);
  const [customArtwork, setCustomArtwork] = useState<{ name: string; url: string } | null>(null);
  const [mountPhase, setMountPhase] = useState(0);
  const [dock, setDock] = useStudioDraft<DesignDock>(identity.id, tool.id, 'design-lab-dock-v2', 'shader');
  const [shaderCategory, setShaderCategory] = useState<ShaderLabCategory>('all');
  const [shaderQuery, setShaderQuery] = useState('');
  const [textLayers, setTextLayers] = useStudioDraft<PlaygroundTextLayer[]>(identity.id, tool.id, 'playground-text-layers-v1', []);
  const [selectedTextId, setSelectedTextId] = useState<PlaygroundTextLayer['id'] | null>(null);
  const [backgroundEnabled, setBackgroundEnabled] = useStudioDraft(identity.id, tool.id, 'design-lab-background-enabled-v1', true);
  const [surfaceEnabled, setSurfaceEnabled] = useStudioDraft(identity.id, tool.id, 'design-lab-surface-enabled-v1', true);
  const [stickersEnabled, setStickersEnabled] = useStudioDraft(identity.id, tool.id, 'design-lab-stickers-enabled-v1', true);
  const [surfacePresetId, setSurfacePresetId] = useStudioDraft(identity.id, tool.id, 'design-lab-surface-preset-v1', SURFACE_LAB_CLOTH_PRESETS[0].id);
  const [artworkKind, setArtworkKind] = useStudioDraft<ArtworkKind>(identity.id, tool.id, 'design-lab-artwork-kind-v2', 'logo');
  const [stickerTexts, setStickerTexts] = useStudioDraft<PlaygroundStickerText[]>(identity.id, tool.id, 'playground-sticker-texts-v1', []);
  const [brandAssetId, setBrandAssetId] = useStudioDraft(identity.id, tool.id, 'design-lab-brand-asset-v1', 'none');
  const [stickerDraft, setStickerDraft] = useStudioDraft<Partial<StickerFinishSettings>>(identity.id, tool.id, 'design-lab-sticker-v1', DEFAULT_STICKER_FINISH);
  const [liveMaterialId, setLiveMaterialId] = useStudioDraft<LiveMaterialId>(
    identity.id,
    tool.id,
    'design-lab-shader-v1',
    SHADER_LIBRARY_DEFAULT_IDS.surface
  );
  const [storedLiveSettings, setStoredLiveSettings] = useStudioDraft<LiveMaterialSettings>(
    identity.id,
    tool.id,
    'design-lab-shader-settings-v1',
    () => shaderLabSettingsFor(SHADER_LIBRARY_DEFAULT_IDS.surface, {
      ...DEFAULT_LIVE_MATERIAL_SETTINGS,
      colorA: palette.colors[0],
      colorB: palette.colors[1],
      colorC: palette.colors[2],
    })
  );
  const [storedSettings, setStoredSettings] = useStudioDraft<BackgroundSettings>(identity.id, tool.id, 'design-lab-surface-settings-v1', () => ({
    ...DEFAULT_BACKGROUND_SETTINGS,
    ...SURFACE_LAB_CLOTH_PRESETS[0].settings,
    colorA: palette.colors[0],
    colorB: palette.colors[1],
    colorC: palette.colors[2],
    height: 630,
    width: 1200,
  }));

  const settings: BackgroundSettings = { ...DEFAULT_BACKGROUND_SETTINGS, ...storedSettings };
  const liveSettings: LiveMaterialSettings = { ...DEFAULT_LIVE_MATERIAL_SETTINGS, ...storedLiveSettings };
  const shaderMaterialsById = useMemo(() => new Map(
    shaderLabMaterials('', 'all').map((material) => [material.id, material])
  ), []);
  const visibleShaderPresets = useMemo(() => {
    const query = shaderQuery.trim().toLocaleLowerCase();
    return SURFACE_LAB_SHADER_PRESETS.filter((preset) => (
      (shaderCategory === 'all' || preset.category.toLocaleLowerCase() === shaderCategory)
      && (!query || `${preset.name} ${preset.category} ${preset.description}`.toLocaleLowerCase().includes(query))
    ));
  }, [shaderCategory, shaderQuery]);
  const stickerFinish = useMemo(() => normalizeStickerFinish(stickerDraft), [stickerDraft]);
  const shaderPreset = SURFACE_LAB_SHADER_PRESETS.find(({ liveMaterialId: id }) => id === liveMaterialId);
  const surfacePreset = DESIGN_SURFACE_PRESETS.find(({ id }) => id === surfacePresetId) ?? DESIGN_SURFACE_PRESETS[0];
  const surfaceIsCloth = settings.surfaceMaterial === 'holo-cloth';
  const stickersFollowSurface = stickersEnabled && surfaceEnabled && surfaceIsCloth;
  const selectedOpenSurfaceAsset = getOpenSurfaceAsset(settings.surfaceLibraryAssetId);
  const outputSize = OUTPUT_SIZES.find((size) => size.width === settings.width && size.height === settings.height);
  const aspectRatio = settings.width / settings.height;
  const surfaceLayerOpacity = Math.min(0.54, 0.12 + settings.surfaceTextureAmount / 100 * 0.44);
  const selectedTextLayer = selectedTextId
    ? textLayers.find(({ id }) => id === selectedTextId) ?? null
    : null;
  const availableAssets = useMemo(() => [...identity.assets, ...identity.proofAssets].filter((asset) => (
    !asset.path.toLocaleLowerCase().endsWith('.pdf')
    && ['image', 'logo', 'product', 'proof', 'texture', 'background'].includes(asset.type)
  )), [identity.assets, identity.proofAssets]);
  const selectedBrandAsset = availableAssets.find((asset) => asset.id === brandAssetId);
  const identityLogo = brandAssetPath(identity, 'mark-light') ?? brandAssetPath(identity, 'mark-dark');
  const artworkUrl = useMemo(() => {
    if (artworkKind === 'asset') return selectedBrandAsset?.path;
    return customArtwork?.url ?? identityLogo;
  }, [artworkKind, customArtwork?.url, identityLogo, selectedBrandAsset?.path]);
  const stickerTextAssets = useMemo(() => stickerTexts.map((text) => stickerTextSceneAsset({
    align: text.align,
    color: text.color,
    fontFamily: brandTypographyFamily(identity, text.fontRole),
    id: text.id,
    label: text.name,
    lineHeight: text.lineHeight,
    text: text.value,
    tracking: text.tracking,
    weight: text.weight,
  })), [identity, stickerTexts]);
  const stickerAssets = useMemo(() => {
    const libraryAssets = stickerSceneAssets(identity, artworkUrl);
    const currentArtwork: StickerSceneAsset[] = artworkUrl
      ? [{ id: 'current-artwork', label: `${identity.name} current artwork`, path: artworkUrl, surface: 'dark' as const, type: 'logo' as const }]
      : [];
    return [...currentArtwork, ...stickerTextAssets, ...libraryAssets].filter((asset, index, collection) => (
      collection.findIndex((candidate) => candidate.id === asset.id) === index
      && (asset.kind === 'text' || collection.findIndex((candidate) => candidate.kind !== 'text' && candidate.path === asset.path) === index)
    ));
  }, [artworkUrl, identity, stickerTextAssets]);
  const selectedStickerText = selectedSticker
    ? stickerTexts.find(({ id }) => id === selectedSticker.assetId) ?? null
    : null;
  const dockOptions = [
    {
      detail: backgroundEnabled ? shaderPreset?.name ?? 'Custom shader' : 'None',
      enabled: backgroundEnabled,
      Icon: Sparkles,
      label: 'Background',
      value: 'shader' as const,
    },
    {
      detail: surfaceEnabled ? surfacePreset.name : 'None',
      enabled: surfaceEnabled,
      Icon: Layers3,
      label: 'Surface',
      value: 'surface' as const,
    },
    {
      detail: textLayers.length === 0 ? 'None' : `${textLayers.filter(({ visible }) => visible).length} visible`,
      enabled: textLayers.some(({ visible }) => visible),
      Icon: Type,
      label: 'Text',
      value: 'text' as const,
    },
    {
      detail: stickersEnabled ? selectedSticker?.label ?? `${stickerRenderLayers.length} placed` : 'None',
      enabled: stickersEnabled,
      Icon: Sticker,
      label: 'Stickers',
      value: 'sticker' as const,
    },
  ];

  customArtworkRef.current = customArtwork;
  useEffect(() => {
    const pending = pendingStickerActionRef.current;
    if (!pending || !stickerAssets.some(({ id }) => id === pending.assetId)) return;
    if (pending.mode === 'duplicate') stickerStageRef.current?.duplicateSelected(pending.assetId);
    else stickerStageRef.current?.addSticker(pending.assetId);
    pendingStickerActionRef.current = null;
  }, [stickerAssets]);

  useMountEffect(() => {
    let animationFrame = 0;
    let nextPhase = 1;
    const advance = () => {
      setMountPhase(nextPhase);
      nextPhase += 1;
      if (nextPhase <= 5) animationFrame = window.requestAnimationFrame(advance);
    };
    animationFrame = window.requestAnimationFrame(advance);
    return () => window.cancelAnimationFrame(animationFrame);
  });

  useMountEffect(() => () => {
    if (customArtworkRef.current) URL.revokeObjectURL(customArtworkRef.current.url);
  });

  const updateSettings = useCallback((patch: Partial<BackgroundSettings>) => {
    setStoredSettings((current) => ({ ...current, ...patch }));
  }, [setStoredSettings]);

  const updateLiveSettings = useCallback((patch: Partial<LiveMaterialSettings>) => {
    setStoredLiveSettings((current) => ({ ...current, ...patch }));
  }, [setStoredLiveSettings]);

  function updateSticker(patch: Partial<StickerFinishSettings>) {
    setStickerDraft(normalizeStickerFinish({ ...stickerFinish, ...patch, presetId: 'custom' }));
  }

  function addStickerText(source?: PlaygroundStickerText, mode: PendingStickerAction['mode'] = 'add') {
    const id = `sticker-text-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as PlaygroundStickerText['id'];
    const nextNumber = stickerTexts.reduce((largest, text) => {
      const match = /^Text sticker (\d+)$/.exec(text.name);
      return Math.max(largest, Number(match?.[1] ?? 0));
    }, 0) + 1;
    const text: PlaygroundStickerText = source
      ? { ...source, id, name: `${source.name} copy` }
      : {
          align: 'center',
          color: settings.logoColor || '#FFFFFF',
          fontRole: 'Display',
          id,
          lineHeight: 1,
          name: `Text sticker ${nextNumber}`,
          tracking: -0.04,
          value: nextNumber === 1 ? identity.shortName : `Sticker ${nextNumber}`,
          weight: 700,
        };
    pendingStickerActionRef.current = { assetId: id, mode };
    setStickerTexts((current) => [...current, text]);
    setStickersEnabled(true);
    setDock('sticker');
  }

  function updateStickerText(id: PlaygroundStickerText['id'], patch: Partial<Omit<PlaygroundStickerText, 'id'>>) {
    setStickerTexts((current) => current.map((text) => text.id === id ? { ...text, ...patch } : text));
  }

  function duplicateSelectedSticker() {
    if (selectedStickerText) {
      addStickerText(selectedStickerText, 'duplicate');
      return;
    }
    stickerStageRef.current?.duplicateSelected();
  }

  function addTextLayer() {
    const id = `text-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as PlaygroundTextLayer['id'];
    const nextNumber = textLayers.reduce((largest, layer) => {
      const match = /^Text (\d+)$/.exec(layer.name);
      return Math.max(largest, Number(match?.[1] ?? 0));
    }, 0) + 1;
    const placements = [
      { x: 0, y: settings.height * -0.22 },
      { x: 0, y: settings.height * 0.22 },
      { x: settings.width * -0.2, y: 0 },
      { x: settings.width * 0.2, y: 0 },
    ];
    const placement = placements[textLayers.length % placements.length] ?? { x: 0, y: 0 };
    const layer: PlaygroundTextLayer = {
      align: 'center',
      color: settings.logoColor || '#FFFFFF',
      fontRole: 'Display',
      id,
      lineHeight: 0.95,
      name: `Text ${nextNumber}`,
      opacity: 1,
      outlineColor: '#000000',
      outlineEnabled: false,
      outlineWidth: 2,
      shadowBlur: 18,
      shadowColor: '#000000',
      shadowEnabled: false,
      shadowOffsetX: 0,
      shadowOffsetY: 8,
      shadowOpacity: 0.35,
      tracking: -0.055,
      transform: { ...DEFAULT_TEXT_TRANSFORM, ...placement },
      value: nextNumber === 1 ? identity.name : `Text ${nextNumber}`,
      visible: true,
      weight: 700,
      wrap: 'wrap',
    };
    setTextLayers((current) => [...current, layer]);
    setSelectedTextId(id);
    setDock('text');
  }

  function updateTextLayer(id: PlaygroundTextLayer['id'], patch: Partial<Omit<PlaygroundTextLayer, 'id'>>) {
    setTextLayers((current) => current.map((layer) => layer.id === id ? { ...layer, ...patch } : layer));
  }

  function removeTextLayer(id: PlaygroundTextLayer['id']) {
    setTextLayers((current) => current.filter((layer) => layer.id !== id));
    setSelectedTextId((current) => current === id ? null : current);
  }

  function duplicateTextLayer(id: PlaygroundTextLayer['id']) {
    const source = textLayers.find((layer) => layer.id === id);
    if (!source) return;
    const nextId = `text-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as PlaygroundTextLayer['id'];
    const transform = resolvedTextTransform(source.transform);
    const duplicate: PlaygroundTextLayer = {
      ...source,
      id: nextId,
      name: `${source.name} copy`,
      transform: { ...transform, x: transform.x + 28, y: transform.y + 28 },
    };
    const sourceIndex = textLayers.findIndex((layer) => layer.id === id);
    setTextLayers((current) => [
      ...current.slice(0, sourceIndex + 1),
      duplicate,
      ...current.slice(sourceIndex + 1),
    ]);
    setSelectedTextId(nextId);
  }

  function moveTextLayer(id: PlaygroundTextLayer['id'], direction: -1 | 1) {
    setTextLayers((current) => {
      const index = current.findIndex((layer) => layer.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex]!, next[index]!];
      return next;
    });
  }

  function drawTextLayers(context: CanvasRenderingContext2D, width: number, height: number) {
    const scaleX = width / settings.width;
    const scaleY = height / settings.height;
    textLayers.filter(({ visible }) => visible).forEach((layer) => {
      const transform = resolvedTextTransform(layer.transform);
      const baseWidth = settings.width * 0.72;
      const boxWidth = baseWidth * (transform.widthScale ?? transform.scale) * scaleX;
      const centerX = (settings.width / 2 + transform.x) * scaleX;
      const centerY = (settings.height / 2 + transform.y) * scaleY;
      const fontSize = settings.height * 0.17 * transform.scale * scaleY;
      const fontFamily = brandTypographyFamily(identity, layer.fontRole).replaceAll('"', '\\"');
      context.save();
      context.fillStyle = layer.color;
      context.font = `${layer.weight} ${fontSize}px "${fontFamily}", sans-serif`;
      context.globalAlpha = layer.opacity;
      if (layer.shadowEnabled) {
        context.shadowBlur = (layer.shadowBlur ?? 18) * scaleY;
        context.shadowColor = colorWithOpacity(layer.shadowColor ?? '#000000', layer.shadowOpacity ?? 0.35);
        context.shadowOffsetX = (layer.shadowOffsetX ?? 0) * scaleX;
        context.shadowOffsetY = (layer.shadowOffsetY ?? 8) * scaleY;
      }
      context.textAlign = layer.align;
      context.textBaseline = 'middle';
      if ('letterSpacing' in context) context.letterSpacing = `${fontSize * layer.tracking}px`;
      const lines = (layer.wrap ?? 'wrap') === 'wrap'
        ? layer.value.split('\n').flatMap((line) => wrapCanvasLine(context, line, boxWidth))
        : layer.value.split('\n');
      const lineHeight = fontSize * layer.lineHeight;
      const firstY = centerY - (Math.max(1, lines.length) - 1) * lineHeight / 2;
      const x = layer.align === 'left'
        ? centerX - boxWidth / 2
        : layer.align === 'right'
          ? centerX + boxWidth / 2
          : centerX;
      lines.forEach((line, index) => {
        const y = firstY + index * lineHeight;
        if (layer.outlineEnabled) {
          context.lineJoin = 'round';
          context.lineWidth = Math.max(1, (layer.outlineWidth ?? 2) * scaleY * 2);
          context.strokeStyle = layer.outlineColor ?? '#000000';
          if ((layer.wrap ?? 'wrap') === 'wrap') context.strokeText(line, x, y, boxWidth);
          else context.strokeText(line, x, y);
        }
        if ((layer.wrap ?? 'wrap') === 'wrap') context.fillText(line, x, y, boxWidth);
        else context.fillText(line, x, y);
      });
      context.restore();
    });
  }

  function applyShaderPreset(preset: SurfaceLabPreset) {
    if (!preset.liveMaterialId) return;
    setBackgroundEnabled(true);
    setLiveMaterialId(preset.liveMaterialId);
    setStoredLiveSettings(shaderLabSettingsFor(preset.liveMaterialId, {
      ...DEFAULT_LIVE_MATERIAL_SETTINGS,
      colorA: palette.colors[0],
      colorB: palette.colors[1],
      colorC: palette.colors[2],
    }));
  }

  function applySurfacePreset(preset: SurfaceLabPreset) {
    setSurfacePresetId(preset.id);
    setSurfaceEnabled(true);
    if (preset.settings) {
      setStoredSettings((current) => ({
        ...current,
        ...preset.settings,
        height: current.height,
        logoColor: current.logoColor,
        width: current.width,
      }));
    }
  }

  function resetActiveLibrary() {
    if (dock === 'shader') {
      const preset = SURFACE_LAB_SHADER_PRESETS.find(({ liveMaterialId: id }) => id === SHADER_LIBRARY_DEFAULT_IDS.surface);
      if (preset) applyShaderPreset(preset);
      return;
    }
    if (dock === 'surface') {
      applySurfacePreset(DESIGN_SURFACE_PRESETS[0]);
      return;
    }
    if (dock === 'text') {
      if (selectedTextLayer) updateTextLayer(selectedTextLayer.id, { transform: DEFAULT_TEXT_TRANSFORM });
      else addTextLayer();
      return;
    }
    stickerStageRef.current?.reset();
  }

  function selectCustomArtwork(file: File) {
    if (customArtworkRef.current) URL.revokeObjectURL(customArtworkRef.current.url);
    const next = { name: file.name, url: URL.createObjectURL(file) };
    customArtworkRef.current = next;
    setCustomArtwork(next);
    setArtworkKind('logo');
    setStickersEnabled(true);
    setDock('sticker');
  }

  async function exportPng() {
    setExporting(true);
    studioExport.start('Rendering Playground PNG preview');
    try {
      const width = Math.max(1200, settings.width);
      const height = Math.round(width / aspectRatio);
      const composition = document.createElement('canvas');
      composition.width = width;
      composition.height = height;
      const context = composition.getContext('2d');
      if (!context) throw new Error('Canvas export is unavailable.');
      if (backgroundEnabled) {
        const liveShader = shaderStageRef.current?.querySelector('canvas');
        if (liveShader?.width && liveShader.height) {
          drawCover(context, liveShader, liveShader.width, liveShader.height, width, height);
        } else {
          try {
            const preview = await loadImage(shaderPreviewAssetPath(liveMaterialId));
            drawCover(context, preview, preview.naturalWidth, preview.naturalHeight, width, height);
          } catch {
            const fallback = context.createLinearGradient(0, height, width, 0);
            fallback.addColorStop(0, liveSettings.colorA);
            fallback.addColorStop(0.52, liveSettings.colorB);
            fallback.addColorStop(1, liveSettings.colorC);
            context.fillStyle = fallback;
            context.fillRect(0, 0, width, height);
          }
        }
      }
      const liveSurface = surfaceEnabled ? surfaceStageRef.current?.querySelector('canvas') : null;
      if (liveSurface?.width && liveSurface.height) {
        context.drawImage(liveSurface, 0, 0, width, height);
      }
      const composed = stickersEnabled && !surfaceIsCloth
        ? await stickerStageRef.current?.exportPng(width, composition)
        : null;
      if (composed) {
        const composedUrl = URL.createObjectURL(composed);
        try {
          const composedImage = await loadImage(composedUrl);
          context.clearRect(0, 0, width, height);
          context.drawImage(composedImage, 0, 0, width, height);
        } finally {
          URL.revokeObjectURL(composedUrl);
        }
      }
      drawTextLayers(context, width, height);
      const blob = await canvasToBlob(composition);
      const fileName = `${identity.id}-design-lab-${settings.width}x${settings.height}.png`;
      setLastExport({ blob, fileName, format: 'PNG', height, width });
    } finally {
      setExporting(false);
      studioExport.finish();
    }
  }

  function applySource(source: string) {
    const parsed = JSON.parse(source) as {
      artworkKind?: ArtworkKind | 'text';
      artworkText?: string;
      backgroundEnabled?: boolean;
      surfaceEnabled?: boolean;
      stickersEnabled?: boolean;
      surfacePresetId?: string;
      liveMaterialId?: LiveMaterialId;
      liveSettings?: Partial<LiveMaterialSettings>;
      settings?: Partial<BackgroundSettings>;
      stickerFinish?: Partial<StickerFinishSettings>;
      stickerTexts?: PlaygroundStickerText[];
      textLayers?: PlaygroundTextLayer[];
    };
    if (parsed.artworkKind && !['logo', 'text', 'asset'].includes(parsed.artworkKind)) throw new TypeError('Artwork kind must be logo, text, or asset.');
    if (parsed.liveMaterialId && !shaderLabMaterials('', 'all').some(({ id }) => id === parsed.liveMaterialId)) throw new TypeError('Unknown Playground shader.');
    if (parsed.surfacePresetId && !DESIGN_SURFACE_PRESETS.some(({ id }) => id === parsed.surfacePresetId)) throw new TypeError('Unknown Playground surface preset.');
    if (parsed.artworkKind && parsed.artworkKind !== 'text') setArtworkKind(parsed.artworkKind);
    if (typeof parsed.backgroundEnabled === 'boolean') setBackgroundEnabled(parsed.backgroundEnabled);
    if (typeof parsed.surfaceEnabled === 'boolean') setSurfaceEnabled(parsed.surfaceEnabled);
    if (typeof parsed.stickersEnabled === 'boolean') setStickersEnabled(parsed.stickersEnabled);
    if (parsed.surfacePresetId) setSurfacePresetId(parsed.surfacePresetId);
    if (parsed.liveMaterialId) setLiveMaterialId(parsed.liveMaterialId);
    if (parsed.liveSettings) setStoredLiveSettings((current) => ({ ...current, ...parsed.liveSettings }));
    if (parsed.settings) setStoredSettings((current) => ({ ...current, ...parsed.settings }));
    if (parsed.stickerFinish) setStickerDraft(normalizeStickerFinish(parsed.stickerFinish));
    if (parsed.stickerTexts) {
      if (!Array.isArray(parsed.stickerTexts) || parsed.stickerTexts.some((text) => (
        !text.id?.startsWith('sticker-text-')
        || typeof text.value !== 'string'
        || typeof text.color !== 'string'
        || !['left', 'center', 'right'].includes(text.align)
      ))) throw new TypeError('Sticker texts must be valid Playground sticker text sources.');
      setStickerTexts(parsed.stickerTexts);
    } else if (parsed.artworkKind === 'text' && typeof parsed.artworkText === 'string') {
      const id = `sticker-text-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as PlaygroundStickerText['id'];
      setStickerTexts((current) => [...current, {
        align: 'center',
        color: settings.logoColor || '#FFFFFF',
        fontRole: 'Display',
        id,
        lineHeight: 1,
        name: 'Imported text sticker',
        tracking: -0.04,
        value: parsed.artworkText ?? identity.shortName,
        weight: 700,
      }]);
    }
    if (parsed.textLayers) {
      if (!Array.isArray(parsed.textLayers) || parsed.textLayers.some((layer) => (
        !layer.id?.startsWith('text-')
        || typeof layer.value !== 'string'
        || typeof layer.visible !== 'boolean'
      ))) throw new TypeError('Text layers must be valid Playground text layers.');
      setTextLayers(parsed.textLayers);
      setSelectedTextId(null);
    }
  }

  return (
    <div className='tool-shell design-lab h-full min-h-0'>
      <StudioToolHeader
        actions={(
          <>
          <SourceCodeButton onClick={() => setSourceOpen(true)} />
          <ExportPreview asset={lastExport} />
          <Button disabled={exporting} onClick={exportPng} type='button'>
            <Download aria-hidden='true' /><T>Export PNG</T>
          </Button>
          </>
        )}
        context={<div className='design-lab-layer-readout' aria-label={gt('Active design layers')}>
          <button aria-pressed={backgroundEnabled} data-active={backgroundEnabled ? 'true' : 'false'} onClick={() => setBackgroundEnabled((value) => !value)} type='button'>Background</button>
          <button aria-pressed={surfaceEnabled} data-active={surfaceEnabled ? 'true' : 'false'} onClick={() => setSurfaceEnabled((value) => !value)} type='button'>Surface</button>
          <button aria-pressed={textLayers.some(({ visible }) => visible)} data-active={textLayers.some(({ visible }) => visible) ? 'true' : 'false'} onClick={() => setDock('text')} type='button'>Text {textLayers.length}</button>
          <button aria-pressed={stickersEnabled} data-active={stickersEnabled ? 'true' : 'false'} onClick={() => setStickersEnabled((value) => !value)} type='button'>Stickers</button>
        </div>}
        metadata='Shaders · surfaces · type · stickers'
        title='Playground'
        toolId={tool.id}
      />

      <div className='design-lab-body'>
        <main className='design-lab-workspace'>
          <CanvasViewport
            autoFit
            className='design-lab-viewport'
            draftKey='design-lab-canvas-zoom-v1'
            identityId={identity.id}
            maxZoom={180}
            onDeselect={() => setSelectedTextId(null)}
            stageClassName='design-lab-canvas-stage'
            toolId={tool.id}
          >
            <div className='design-lab-composition' style={{ aspectRatio }}>
              {mountPhase >= 1 ? (
                <>
                {backgroundEnabled ? (
                  <div className='design-lab-shader-layer' ref={shaderStageRef}>
                    <LazyLiveMaterialCanvas
                      activeWhileMounted
                      className='absolute inset-0 size-full'
                      frameRate={30}
                      materialId={liveMaterialId}
                      maxPixelCount={2_000_000}
                      settings={liveSettings}
                    />
                  </div>
                ) : null}
                </>
              ) : null}
              {mountPhase >= 2 ? (surfaceEnabled ? (
                  <div className='design-lab-surface-layer' data-interactive={surfaceIsCloth ? 'true' : 'false'} ref={surfaceStageRef}>
                    <SurfaceMaterialStage
                      artworkAspectRatio={aspectRatio}
                      artworkLayers={stickersFollowSurface ? stickerRenderLayers : undefined}
                      asset={selectedOpenSurfaceAsset}
                      className='absolute inset-0 size-full'
                      opacity={surfaceLayerOpacity}
                      presentation={surfaceIsCloth ? 'interactive' : 'flat'}
                      settings={settings}
                      showAttribution={false}
                      transparent
                    />
                  </div>
                ) : null) : null}
              {mountPhase >= 3 ? (
                <StickerDeviceScene
                  aspectRatio={aspectRatio}
                  assets={stickerAssets}
                  className='design-lab-sticker-layer'
                  enabled={stickersEnabled}
                  finish={stickerFinish}
                  onPlacementsChange={setStickerRenderLayers}
                  onSelectionChange={setSelectedSticker}
                  ref={stickerStageRef}
                  renderMode={stickersFollowSurface ? 'controls' : 'normal'}
                  surface='transparent'
                  surfaceLabel={`${identity.name} Playground sticker surface`}
                />
              ) : null}
              {mountPhase >= 3 ? textLayers.filter(({ visible }) => visible).map((layer, index) => {
                const transform = resolvedTextTransform(layer.transform);
                const baseWidth = settings.width * 0.72;
                const baseHeight = settings.height * 0.25;
                return (
                  <EditableCanvasLayer
                    allowContentInteraction
                    baseHeight={baseHeight}
                    baseWidth={baseWidth}
                    baseX={(settings.width - baseWidth) / 2}
                    baseY={(settings.height - baseHeight) / 2}
                    canvasHeight={settings.height}
                    canvasWidth={settings.width}
                    className='design-lab-text-layer'
                    fitContentHeight
                    key={layer.id}
                    label={layer.name}
                    onChange={(nextTransform) => updateTextLayer(layer.id, { transform: nextTransform })}
                    onDeselect={() => setSelectedTextId(null)}
                    onSelect={() => { setSelectedTextId(layer.id); setDock('text'); }}
                    resizeMode='box'
                    selected={selectedTextId === layer.id}
                    transform={transform}
                    zIndex={4 + index}
                  >
                    <PlaygroundEditableText
                      label={`Edit ${layer.name}`}
                      onChange={(value) => updateTextLayer(layer.id, { value })}
                      onFocus={() => { setSelectedTextId(layer.id); setDock('text'); }}
                      style={{
                        color: layer.color,
                        fontFamily: `${JSON.stringify(brandTypographyFamily(identity, layer.fontRole))}, sans-serif`,
                        fontSize: `${settings.height / settings.width * 17 * transform.scale}cqw`,
                        fontWeight: layer.weight,
                        letterSpacing: `${layer.tracking}em`,
                        lineHeight: layer.lineHeight,
                        opacity: layer.opacity,
                        overflowWrap: (layer.wrap ?? 'wrap') === 'wrap' ? 'anywhere' : 'normal',
                        textAlign: layer.align,
                        textShadow: layer.shadowEnabled
                          ? `${layer.shadowOffsetX ?? 0}px ${layer.shadowOffsetY ?? 8}px ${layer.shadowBlur ?? 18}px ${colorWithOpacity(layer.shadowColor ?? '#000000', layer.shadowOpacity ?? 0.35)}`
                          : undefined,
                        WebkitTextStroke: layer.outlineEnabled ? `${layer.outlineWidth ?? 2}px ${layer.outlineColor ?? '#000000'}` : undefined,
                        whiteSpace: (layer.wrap ?? 'wrap') === 'wrap' ? 'pre-wrap' : 'pre',
                      }}
                      value={layer.value}
                    />
                  </EditableCanvasLayer>
                );
              }) : null}
            </div>
          </CanvasViewport>

          <div className='design-lab-dock studio-sidebar lab-sidebar lab-sidebar-left'>
            {mountPhase >= 4 ? (
              <>
            <div className='design-lab-dock-tabs' role='tablist' aria-label={gt('Design libraries')}>
              <span className='design-lab-dock-label'>Layer library</span>
              {dockOptions.map((option) => (
                <button aria-selected={dock === option.value} key={option.value} onClick={() => setDock(option.value)} role='tab' type='button'>
                  <i aria-hidden='true' data-enabled={option.enabled ? 'true' : 'false'} />
                  <span><option.Icon aria-hidden='true' />{option.label}</span>
                  <small>{option.detail}</small>
                </button>
              ))}
            </div>
            <div
              aria-label={gt(dock === 'shader' ? 'Background library' : dock === 'surface' ? 'Surface library' : dock === 'text' ? 'Text layer stack' : 'Sticker library')}
              className='design-lab-dock-scroll studio-scroll-area'
              data-dock={dock}
              key={dock}
              role='tabpanel'
              tabIndex={0}
            >
              {dock === 'shader' ? (
                <>
                  <div className='design-lab-library-filter'>
                    <label>
                      <Search aria-hidden='true' />
                      <input aria-label='Search Playground shaders' onChange={(event) => setShaderQuery(event.target.value)} placeholder='Search shaders' type='search' value={shaderQuery} />
                    </label>
                    <div aria-label='Playground shader categories' role='list'>
                      {SHADER_LAB_CATEGORIES.map((option) => (
                        <button aria-pressed={shaderCategory === option.id} key={option.id} onClick={() => setShaderCategory(option.id)} type='button'>{option.label}</button>
                      ))}
                    </div>
                    <small>{visibleShaderPresets.length} shaders</small>
                  </div>
                  <button aria-pressed={!backgroundEnabled} className='design-lab-none-preset' onClick={() => setBackgroundEnabled(false)} type='button'><span aria-hidden='true'>∅</span><strong>None</strong></button>
                  {visibleShaderPresets.map((preset) => {
                    const material = preset.liveMaterialId
                      ? shaderMaterialsById.get(preset.liveMaterialId)
                      : null;
                    return (
                      <button
                        aria-pressed={backgroundEnabled && preset.liveMaterialId === liveMaterialId}
                        className='design-lab-shader-preset'
                        key={preset.id}
                        onClick={() => applyShaderPreset(preset)}
                        title={preset.name}
                        type='button'
                      >
                        {preset.liveMaterialId ? (
                          <span aria-hidden='true' className='design-lab-shader-thumb' style={{ backgroundImage: `url("${shaderPreviewAssetPath(preset.liveMaterialId)}")` }} />
                        ) : null}
                        {material ? <LiveMaterialSourceTag className='design-lab-shader-source' material={material} /> : null}
                        <span className='design-lab-shader-name'>{preset.name}</span>
                      </button>
                    );
                  })}
                </>
              ) : null}
              {dock === 'surface' ? (
                <>
                  <button aria-pressed={!surfaceEnabled} className='design-lab-none-preset' onClick={() => setSurfaceEnabled(false)} type='button'><span aria-hidden='true'>∅</span><strong>None</strong></button>
                  {DESIGN_SURFACE_PRESETS.map((preset) => (
                    <button
                      aria-pressed={preset.id === surfacePreset.id && surfaceEnabled}
                      className='design-lab-surface-preset'
                      key={preset.id}
                      onClick={() => applySurfacePreset(preset)}
                      type='button'
                    >
                      <span style={preset.previewUrl
                        ? { backgroundImage: `url("${preset.previewUrl}")` }
                        : { background: preset.swatch }} />
                      <strong>{preset.name}</strong>
                    </button>
                  ))}
                </>
              ) : null}
              {dock === 'text' ? (
                <>
                  <button className='design-lab-text-add' onClick={addTextLayer} type='button'>
                    <Type aria-hidden='true' />
                    <span><strong>Add text</strong><small>Editable canvas layer</small></span>
                  </button>
                  {[...textLayers].reverse().map((layer) => {
                    const orderIndex = textLayers.findIndex(({ id }) => id === layer.id);
                    return (
                      <div aria-selected={selectedTextId === layer.id} className='design-lab-text-card' data-visible={layer.visible ? 'true' : 'false'} key={layer.id}>
                        <button className='design-lab-text-card-select' onClick={() => setSelectedTextId(layer.id)} title={`Select ${layer.name}`} type='button'>
                          <Type aria-hidden='true' />
                          <span><strong>{layer.name}</strong><small>{layer.value || 'Empty text'}</small></span>
                        </button>
                        <div>
                          <button aria-label={`${layer.visible ? 'Hide' : 'Show'} ${layer.name}`} onClick={() => updateTextLayer(layer.id, { visible: !layer.visible })} type='button'>{layer.visible ? <Eye aria-hidden='true' /> : <EyeOff aria-hidden='true' />}</button>
                          <button aria-label={`Move ${layer.name} forward`} disabled={orderIndex === textLayers.length - 1} onClick={() => moveTextLayer(layer.id, 1)} type='button'><ArrowUp aria-hidden='true' /></button>
                          <button aria-label={`Move ${layer.name} backward`} disabled={orderIndex === 0} onClick={() => moveTextLayer(layer.id, -1)} type='button'><ArrowDown aria-hidden='true' /></button>
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : null}
              {dock === 'sticker' ? (
                <>
                  <button aria-pressed={!stickersEnabled} className='design-lab-none-preset' onClick={() => setStickersEnabled(false)} type='button'><span aria-hidden='true'>∅</span><strong>None</strong></button>
                  <button className='design-lab-sticker-text-add' onClick={() => addStickerText()} type='button'>
                    <Type aria-hidden='true' />
                    <span><strong>Add text sticker</strong><small>New independent text</small></span>
                  </button>
                  {stickerAssets.map((asset) => (
                    <button
                      aria-label={`Place ${asset.label}`}
                      className={`design-lab-sticker-asset ${asset.surface === 'light' ? 'is-light' : ''} ${asset.kind === 'text' ? 'is-text' : ''}`}
                      key={asset.id}
                      onClick={() => { setStickersEnabled(true); stickerStageRef.current?.addSticker(asset.id); }}
                      title={asset.label}
                      type='button'
                    >
                      <img alt='' draggable={false} src={asset.path} />
                      {asset.kind === 'text' ? <span><strong>{asset.label}</strong><small>Text sticker</small></span> : null}
                    </button>
                  ))}
                  <span className='design-lab-dock-divider' aria-hidden='true' />
                  {STICKER_FINISH_PRESETS.map((preset) => (
                    <button
                      aria-label={`Use ${preset.label} finish`}
                      aria-pressed={stickersEnabled && stickerFinish.presetId === preset.id}
                      className='design-lab-finish-preset'
                      key={preset.id}
                      onClick={() => { setStickersEnabled(true); setStickerDraft(preset.settings); }}
                      style={{ background: preset.swatch }}
                      title={preset.label}
                      type='button'
                    />
                  ))}
                </>
              ) : null}
            </div>
            <div className='design-lab-dock-context' data-dock={dock}>
              <div>
                <span>{dock === 'shader' ? 'Background' : dock === 'surface' ? 'Surface' : dock === 'text' ? 'Text layer' : 'Sticker finish'}</span>
                <strong>{dock === 'shader'
                  ? shaderPreset?.name ?? 'Custom shader'
                  : dock === 'surface'
                    ? surfacePreset.name
                    : dock === 'text'
                      ? selectedTextLayer?.name ?? 'No text selected'
                      : selectedSticker?.label ?? 'Composition stickers'}</strong>
              </div>
              {dock === 'text' && selectedTextLayer ? (
                <input aria-label='Quick text content' onChange={(event) => updateTextLayer(selectedTextLayer.id, { value: event.target.value })} placeholder='Type on canvas' value={selectedTextLayer.value} />
              ) : (
                <small>{dock === 'text' ? 'Add or select a text layer' : 'Choose a preset from the library'}</small>
              )}
              {dock === 'text' && selectedTextLayer ? (
                <div className='design-lab-dock-context-actions'>
                  <button aria-label='Duplicate selected text' onClick={() => duplicateTextLayer(selectedTextLayer.id)} title='Duplicate' type='button'><Copy aria-hidden='true' /></button>
                  <button aria-label='Move selected text forward' disabled={textLayers.at(-1)?.id === selectedTextLayer.id} onClick={() => moveTextLayer(selectedTextLayer.id, 1)} title='Forward' type='button'><ArrowUp aria-hidden='true' /></button>
                  <button aria-label='Move selected text backward' disabled={textLayers[0]?.id === selectedTextLayer.id} onClick={() => moveTextLayer(selectedTextLayer.id, -1)} title='Backward' type='button'><ArrowDown aria-hidden='true' /></button>
                  <button aria-label='Toggle selected text visibility' onClick={() => updateTextLayer(selectedTextLayer.id, { visible: !selectedTextLayer.visible })} title='Show or hide' type='button'>{selectedTextLayer.visible ? <Eye aria-hidden='true' /> : <EyeOff aria-hidden='true' />}</button>
                  <button aria-label='Delete selected text' onClick={() => removeTextLayer(selectedTextLayer.id)} title='Delete' type='button'><Trash2 aria-hidden='true' /></button>
                </div>
              ) : (
                <button
                  className='design-lab-dock-reset'
                  onClick={resetActiveLibrary}
                  title={gt(dock === 'shader' ? 'Reset background' : dock === 'surface' ? 'Reset surface' : dock === 'text' ? 'Reset text position' : 'Reset stickers')}
                  type='button'
                >
                  <RotateCcw aria-hidden='true' />
                  <span>Reset active layer</span>
                </button>
              )}
            </div>
              </>
            ) : null}
          </div>
        </main>

        <aside className='design-lab-inspector studio-sidebar lab-sidebar lab-sidebar-right studio-scroll-area' aria-label={gt('Playground controls')} data-canvas-selection-preserve>
          {mountPhase >= 5 ? (
            <>
          <LabPanelHeading
            action={<button
              aria-label={gt(dock === 'shader' ? 'Reset background' : dock === 'surface' ? 'Reset surface' : dock === 'text' ? 'Reset text position' : 'Reset stickers')}
              className='design-lab-reset-action'
              onClick={resetActiveLibrary}
              title={gt('Reset active layer')}
              type='button'
            >
              <RotateCcw aria-hidden='true' />
            </button>}
            className='design-lab-inspector-head'
            description='Controls follow the active library on the left.'
            eyebrow={dock === 'shader' ? 'Background shader' : dock === 'surface' ? 'Surface overlay' : dock === 'text' ? 'Text layer' : 'Sticker system'}
            title={dock === 'shader'
              ? backgroundEnabled ? shaderPreset?.name ?? 'Custom shader' : 'No background'
              : dock === 'surface'
                ? surfaceEnabled ? surfacePreset.name : 'No surface'
                : dock === 'text'
                  ? selectedTextLayer?.name ?? 'No text selected'
                  : selectedSticker?.label ?? 'Composition stickers'}
          />

          <LabInspectorSection
            action={<button aria-label={backgroundEnabled ? gt('Hide background') : gt('Show background')} className='design-lab-visibility' onClick={() => setBackgroundEnabled((value) => !value)} type='button'>
                {backgroundEnabled ? <Eye aria-hidden='true' /> : <EyeOff aria-hidden='true' />}
              </button>}
            className='design-lab-inspector-section'
            data-disabled={!backgroundEnabled ? 'true' : 'false'}
            hidden={dock !== 'shader'}
            icon={<Sparkles aria-hidden='true' />}
            title='Background shader'
          >
            <div className='design-lab-control-stack'>
              <RangeControl disabled={!backgroundEnabled} label='Shader speed' max={1.5} min={0} onChange={(speed) => updateLiveSettings({ speed })} step={0.01} suffix='×' value={liveSettings.speed} />
              <RangeControl disabled={!backgroundEnabled} label='Warp' max={1.5} min={0} onChange={(strength) => updateLiveSettings({ strength })} step={0.01} suffix='×' value={liveSettings.strength} />
              <RangeControl disabled={!backgroundEnabled} label='Detail' max={9} min={0.5} onChange={(detail) => updateLiveSettings({ detail })} step={0.1} suffix='' value={liveSettings.detail} />
              <RangeControl disabled={!backgroundEnabled} label='Texture' max={100} min={0} onChange={(grain) => updateLiveSettings({ grain })} value={liveSettings.grain} />
              <RangeControl disabled={!backgroundEnabled} label='Light' max={1.6} min={0.35} onChange={(brightness) => updateLiveSettings({ brightness })} step={0.01} suffix='×' value={liveSettings.brightness} />
            </div>
            <div className='design-lab-colors'>
              <CompactColorControl label='Base' onChange={(colorA) => updateLiveSettings({ colorA })} value={liveSettings.colorA} />
              <CompactColorControl label='Mid' onChange={(colorB) => updateLiveSettings({ colorB })} value={liveSettings.colorB} />
              <CompactColorControl label='Light' onChange={(colorC) => updateLiveSettings({ colorC })} value={liveSettings.colorC} />
            </div>
          </LabInspectorSection>

          <LabInspectorSection
            action={<button aria-label={surfaceEnabled ? gt('Hide surface') : gt('Show surface')} className='design-lab-visibility' onClick={() => setSurfaceEnabled((value) => !value)} type='button'>
                {surfaceEnabled ? <Eye aria-hidden='true' /> : <EyeOff aria-hidden='true' />}
              </button>}
            className='design-lab-inspector-section'
            data-disabled={!surfaceEnabled ? 'true' : 'false'}
            hidden={dock !== 'surface'}
            icon={<Layers3 aria-hidden='true' />}
            title='Surface overlay'
          >
            <div className='design-lab-control-stack'>
              <RangeControl disabled={!surfaceEnabled} label={surfaceIsCloth ? 'Foil' : 'Texture'} max={100} min={0} onChange={(surfaceTextureAmount) => updateSettings({ surfaceTextureAmount })} value={settings.surfaceTextureAmount} />
              <RangeControl disabled={!surfaceEnabled} label={surfaceIsCloth ? 'Drape' : 'Relief'} max={100} min={0} onChange={(surfaceDepth) => updateSettings({ surfaceDepth })} value={settings.surfaceDepth} />
              <RangeControl disabled={!surfaceEnabled} label={surfaceIsCloth ? 'Sparkle' : 'Irregularity'} max={100} min={0} onChange={(surfaceIrregularity) => updateSettings({ surfaceIrregularity })} value={settings.surfaceIrregularity} />
              <RangeControl disabled={!surfaceEnabled} label={surfaceIsCloth ? 'Roughness' : 'Pattern scale'} max={surfaceIsCloth ? 100 : 140} min={surfaceIsCloth ? 0 : 12} onChange={(value) => updateSettings(surfaceIsCloth ? { surfaceRoughness: value } : { surfaceScale: value })} suffix={surfaceIsCloth ? '%' : 'px'} value={surfaceIsCloth ? settings.surfaceRoughness : settings.surfaceScale} />
              <RangeControl disabled={!surfaceEnabled} label={surfaceIsCloth ? 'Weave' : 'Metallic'} max={100} min={0} onChange={(value) => updateSettings(surfaceIsCloth ? { surfaceOpenArea: value } : { surfaceMetallic: value })} value={surfaceIsCloth ? settings.surfaceOpenArea : settings.surfaceMetallic} />
            </div>
          </LabInspectorSection>

          <LabInspectorSection
            action={<button aria-label='Add text layer' className='design-lab-visibility' onClick={addTextLayer} title='Add text layer' type='button'><Type aria-hidden='true' /></button>}
            className='design-lab-inspector-section'
            data-disabled={!selectedTextLayer ? 'true' : 'false'}
            hidden={dock !== 'text'}
            icon={<Type aria-hidden='true' />}
            title='Text layer'
          >
            {selectedTextLayer ? (() => {
              const transform = resolvedTextTransform(selectedTextLayer.transform);
              const orderIndex = textLayers.findIndex(({ id }) => id === selectedTextLayer.id);
              return <>
                <label className='design-lab-field'><span className='design-lab-field-label'><Type aria-hidden='true' />Content</span><textarea onChange={(event) => updateTextLayer(selectedTextLayer.id, { value: event.target.value })} rows={2} value={selectedTextLayer.value} /></label>
                <div className='design-lab-text-inspector-grid'>
                  <label className='design-lab-field'>
                    <span className='design-lab-field-label'><Type aria-hidden='true' />Brand font</span>
                    <StudioSelect
                      ariaLabel='Playground text font role'
                      onValueChange={(fontRole) => updateTextLayer(selectedTextLayer.id, { fontRole: fontRole as BrandTypography['role'] })}
                      options={(['Display', 'Body', 'Accent', 'Code'] as const).map((role) => ({ label: `${role} · ${brandTypographyFamily(identity, role)}`, value: role }))}
                      value={selectedTextLayer.fontRole}
                    />
                  </label>
                  <StudioColorControl ariaLabel='Playground text color' label='Text color' onChange={(color) => updateTextLayer(selectedTextLayer.id, { color })} value={selectedTextLayer.color} />
                </div>
                <TextAlignmentControl
                  ariaLabel='Text alignment'
                  onChange={(align) => updateTextLayer(selectedTextLayer.id, { align })}
                  value={selectedTextLayer.align}
                />
                <div className='design-lab-segmented-field'>
                  <span><WrapText aria-hidden='true' />Wrapping</span>
                  <div aria-label='Text wrapping' role='group'>
                    <button aria-pressed={(selectedTextLayer.wrap ?? 'wrap') === 'wrap'} onClick={() => updateTextLayer(selectedTextLayer.id, { wrap: 'wrap' })} type='button'>Wrap</button>
                    <button aria-pressed={(selectedTextLayer.wrap ?? 'wrap') === 'nowrap'} onClick={() => updateTextLayer(selectedTextLayer.id, { wrap: 'nowrap' })} type='button'>Single line</button>
                  </div>
                </div>
                <div className='design-lab-control-stack'>
                  <RangeControl label='Text size' max={3} min={0.2} onChange={(scale) => updateTextLayer(selectedTextLayer.id, { transform: { ...transform, scale } })} step={0.05} value={transform.scale} />
                  <RangeControl label='Text box width' max={3} min={0.25} onChange={(widthScale) => updateTextLayer(selectedTextLayer.id, { transform: { ...transform, widthScale } })} step={0.05} value={transform.widthScale ?? 1} />
                  <RangeControl label='Opacity' max={100} min={0} onChange={(opacity) => updateTextLayer(selectedTextLayer.id, { opacity: opacity / 100 })} value={selectedTextLayer.opacity * 100} />
                  <RangeControl label='Weight' max={900} min={300} onChange={(weight) => updateTextLayer(selectedTextLayer.id, { weight })} step={50} suffix='' value={selectedTextLayer.weight} />
                  <RangeControl label='Line height' max={1.8} min={0.7} onChange={(lineHeight) => updateTextLayer(selectedTextLayer.id, { lineHeight })} step={0.05} suffix='' value={selectedTextLayer.lineHeight} />
                  <RangeControl label='Tracking' max={0.2} min={-0.12} onChange={(tracking) => updateTextLayer(selectedTextLayer.id, { tracking })} step={0.01} suffix='em' value={selectedTextLayer.tracking} />
                </div>
                <details className='design-lab-text-effects'>
                  <summary><span><WandSparkles aria-hidden='true' />Text effects</span><ChevronDown aria-hidden='true' /></summary>
                  <div>
                    <div className='design-lab-text-effect-group'>
                      <label className='design-lab-effect-toggle'>
                        <span><strong>Outline</strong><small>Add a crisp edge around the type.</small></span>
                        <input checked={selectedTextLayer.outlineEnabled ?? false} onChange={(event) => updateTextLayer(selectedTextLayer.id, { outlineEnabled: event.target.checked })} type='checkbox' />
                      </label>
                      {selectedTextLayer.outlineEnabled ? <>
                        <CompactColorControl label='Outline' onChange={(outlineColor) => updateTextLayer(selectedTextLayer.id, { outlineColor })} value={selectedTextLayer.outlineColor ?? '#000000'} />
                        <RangeControl label='Outline width' max={12} min={0.5} onChange={(outlineWidth) => updateTextLayer(selectedTextLayer.id, { outlineWidth })} step={0.5} suffix='px' value={selectedTextLayer.outlineWidth ?? 2} />
                      </> : null}
                    </div>
                    <div className='design-lab-text-effect-group'>
                      <label className='design-lab-effect-toggle'>
                        <span><strong>Shadow</strong><small>Add depth without changing the text box.</small></span>
                        <input checked={selectedTextLayer.shadowEnabled ?? false} onChange={(event) => updateTextLayer(selectedTextLayer.id, { shadowEnabled: event.target.checked })} type='checkbox' />
                      </label>
                      {selectedTextLayer.shadowEnabled ? <>
                        <CompactColorControl label='Shadow' onChange={(shadowColor) => updateTextLayer(selectedTextLayer.id, { shadowColor })} value={selectedTextLayer.shadowColor ?? '#000000'} />
                        <RangeControl label='Shadow blur' max={64} min={0} onChange={(shadowBlur) => updateTextLayer(selectedTextLayer.id, { shadowBlur })} suffix='px' value={selectedTextLayer.shadowBlur ?? 18} />
                        <RangeControl label='Shadow X' max={48} min={-48} onChange={(shadowOffsetX) => updateTextLayer(selectedTextLayer.id, { shadowOffsetX })} suffix='px' value={selectedTextLayer.shadowOffsetX ?? 0} />
                        <RangeControl label='Shadow Y' max={48} min={-48} onChange={(shadowOffsetY) => updateTextLayer(selectedTextLayer.id, { shadowOffsetY })} suffix='px' value={selectedTextLayer.shadowOffsetY ?? 8} />
                        <RangeControl label='Shadow opacity' max={100} min={0} onChange={(shadowOpacity) => updateTextLayer(selectedTextLayer.id, { shadowOpacity: shadowOpacity / 100 })} value={(selectedTextLayer.shadowOpacity ?? 0.35) * 100} />
                      </> : null}
                    </div>
                  </div>
                </details>
                <div className='design-lab-selection-actions'>
                  <button onClick={() => duplicateTextLayer(selectedTextLayer.id)} type='button'><Copy aria-hidden='true' /><span>Duplicate</span></button>
                  <button disabled={orderIndex === textLayers.length - 1} onClick={() => moveTextLayer(selectedTextLayer.id, 1)} type='button'><ArrowUp aria-hidden='true' /><span>Forward</span></button>
                  <button onClick={() => removeTextLayer(selectedTextLayer.id)} type='button'><Trash2 aria-hidden='true' /><span>Delete</span></button>
                </div>
              </>;
            })() : <button className='design-lab-empty-action' onClick={addTextLayer} type='button'><Type aria-hidden='true' /><span><strong>Add text layer</strong><small>Type directly on the canvas</small></span></button>}
          </LabInspectorSection>

          <LabInspectorSection
            action={<button aria-label={stickersEnabled ? gt('Hide stickers') : gt('Show stickers')} className='design-lab-visibility' onClick={() => setStickersEnabled((value) => !value)} type='button'>
                {stickersEnabled ? <Eye aria-hidden='true' /> : <EyeOff aria-hidden='true' />}
              </button>}
            className='design-lab-inspector-section'
            data-disabled={!stickersEnabled ? 'true' : 'false'}
            hidden={dock !== 'sticker'}
            icon={<Sticker aria-hidden='true' />}
            title='Sticker'
          >
            <div className='design-lab-control-stack' aria-disabled={!selectedSticker}>
              <RangeControl disabled={!stickersEnabled || !selectedSticker} label='Size' max={54} min={8} onChange={(scale) => stickerStageRef.current?.updateSelected({ scale })} value={selectedSticker?.scale ?? 24} />
              <RangeControl disabled={!stickersEnabled || !selectedSticker} label='Rotation' max={180} min={-180} onChange={(rotation) => stickerStageRef.current?.updateSelected({ rotation })} suffix='°' value={selectedSticker?.rotation ?? 0} />
              <RangeControl disabled={!stickersEnabled} label='Foil' max={100} min={0} onChange={(intensity) => updateSticker({ intensity })} value={stickerFinish.intensity} />
              <RangeControl disabled={!stickersEnabled} label='Die-cut edge' max={32} min={2} onChange={(edgeWidth) => updateSticker({ edgeWidth })} suffix='px' value={stickerFinish.edgeWidth} />
              <RangeControl disabled={!stickersEnabled} label='Contrast keyline' max={12} min={1} onChange={(seamWidth) => updateSticker({ seamWidth })} suffix='px' value={stickerFinish.seamWidth} />
              <RangeControl disabled={!stickersEnabled} label='Relief' max={100} min={0} onChange={(relief) => updateSticker({ relief })} value={stickerFinish.relief} />
            </div>
            <div className='design-lab-selection-actions'>
              <button disabled={!stickersEnabled || !selectedSticker} onClick={duplicateSelectedSticker} type='button'><Copy aria-hidden='true' /><span>Duplicate</span></button>
              <button disabled={!stickersEnabled || !selectedSticker} onClick={() => stickerStageRef.current?.bringSelectedForward()} type='button'><ArrowUp aria-hidden='true' /><span>Forward</span></button>
              <button disabled={!stickersEnabled || !selectedSticker} onClick={() => stickerStageRef.current?.removeSelected()} type='button'><Trash2 aria-hidden='true' /><span>Delete</span></button>
            </div>
            {selectedStickerText ? (
              <div className='design-lab-sticker-text-controls'>
                <div className='design-lab-subsection-label'><span>Selected text sticker</span><small>Independent artwork</small></div>
                <label className='design-lab-field'><span>Content</span><textarea onChange={(event) => updateStickerText(selectedStickerText.id, { value: event.target.value })} rows={3} value={selectedStickerText.value} /></label>
                <label className='design-lab-field'>
                  <span>Brand font</span>
                  <StudioSelect
                    ariaLabel='Sticker text font role'
                    onValueChange={(fontRole) => updateStickerText(selectedStickerText.id, { fontRole: fontRole as BrandTypography['role'] })}
                    options={(['Display', 'Body', 'Accent', 'Code'] as const).map((role) => ({ label: `${role} · ${brandTypographyFamily(identity, role)}`, value: role }))}
                    value={selectedStickerText.fontRole}
                  />
                </label>
                <StudioColorControl ariaLabel='Sticker text color' label='Text color' onChange={(color) => updateStickerText(selectedStickerText.id, { color })} value={selectedStickerText.color} />
                <TextAlignmentControl ariaLabel='Sticker text alignment' onChange={(align) => updateStickerText(selectedStickerText.id, { align })} value={selectedStickerText.align} />
                <div className='design-lab-control-stack'>
                  <RangeControl label='Type weight' max={900} min={100} onChange={(weight) => updateStickerText(selectedStickerText.id, { weight })} step={50} suffix='' value={selectedStickerText.weight} />
                  <RangeControl label='Tracking' max={0.24} min={-0.12} onChange={(tracking) => updateStickerText(selectedStickerText.id, { tracking })} step={0.01} suffix='em' value={selectedStickerText.tracking} />
                  <RangeControl label='Line height' max={1.6} min={0.75} onChange={(lineHeight) => updateStickerText(selectedStickerText.id, { lineHeight })} step={0.05} suffix='' value={selectedStickerText.lineHeight} />
                </div>
              </div>
            ) : null}
          </LabInspectorSection>

          <LabInspectorSection className='design-lab-inspector-section' hidden={dock !== 'sticker'} icon={<ImagePlus aria-hidden='true' />} meta='Text or image' title='Add sticker artwork'>
            <button className='design-lab-empty-action' onClick={() => addStickerText()} type='button'><Type aria-hidden='true' /><span>Add another text sticker</span></button>
            <div className='design-lab-artwork-kinds' role='group' aria-label={gt('Artwork type')}>
              {([
                ['logo', ImagePlus, 'Logo'],
                ['asset', Layers3, 'Asset'],
              ] as const).map(([value, Icon, label]) => (
                <button aria-pressed={artworkKind === value} key={value} onClick={() => { setArtworkKind(value); setStickersEnabled(true); setDock('sticker'); }} type='button'><Icon aria-hidden='true' />{label}</button>
              ))}
            </div>
            {artworkKind === 'asset' ? (
              <StudioSelect
                ariaLabel={gt('Brand asset')}
                onValueChange={setBrandAssetId}
                options={[{ label: gt('Choose an asset'), value: 'none' }, ...availableAssets.map((asset) => ({ label: `${asset.label} · ${asset.type}`, value: asset.id }))]}
                value={selectedBrandAsset?.id ?? 'none'}
              />
            ) : (
              <label className='design-lab-upload'>
                <ImagePlus aria-hidden='true' />
                <span><strong>{customArtwork?.name ?? 'Primary brand mark'}</strong><small>Choose PNG or SVG</small></span>
                <input accept='image/png,image/svg+xml' className='sr-only' onChange={(event) => { const file = event.target.files?.[0]; if (file) selectCustomArtwork(file); event.target.value = ''; }} type='file' />
              </label>
            )}
          </LabInspectorSection>

          <details className='design-lab-advanced' hidden={dock === 'text'}>
            <summary>Advanced layer controls <span>+</span></summary>
            <div>
              {dock === 'shader' ? <>
                <RangeControl disabled={!backgroundEnabled} label='Shader frequency' max={12} min={0.5} onChange={(frequency) => updateLiveSettings({ frequency })} step={0.1} suffix='' value={liveSettings.frequency} />
                <RangeControl disabled={!backgroundEnabled} label='Shader amplitude' max={10} min={0} onChange={(amplitude) => updateLiveSettings({ amplitude })} step={0.1} suffix='' value={liveSettings.amplitude} />
              </> : null}
              {dock === 'surface' ? (
                <RangeControl disabled={!surfaceEnabled} label='Surface direction' max={180} min={0} onChange={(surfaceAngle) => updateSettings({ surfaceAngle })} suffix='°' value={settings.surfaceAngle} />
              ) : null}
              {dock === 'sticker' ? <>
                <RangeControl disabled={!stickersEnabled} label='Foil bands' max={20} min={1} onChange={(bands) => updateSticker({ bands })} suffix='' value={stickerFinish.bands} />
                <RangeControl disabled={!stickersEnabled} label='Glint angle' max={180} min={0} onChange={(glintAngle) => updateSticker({ glintAngle })} suffix='°' value={stickerFinish.glintAngle} />
              </> : null}
            </div>
          </details>

          <LabInspectorSection className='design-lab-inspector-section' icon={<ImageDown aria-hidden='true' />} meta='PNG image' title='Output'>
            <div className='design-lab-output-overview' aria-label='Current Playground output'>
              <div><ImageDown aria-hidden='true' /><span><small>Output size</small><strong>{settings.width} × {settings.height}</strong></span></div>
              <div><FileImage aria-hidden='true' /><span><small>File type</small><strong>PNG image</strong></span></div>
            </div>
            <div className='design-lab-output-sizes' aria-label={gt('Output size')}>
              {OUTPUT_SIZES.map((size) => {
                const Icon = size.id === 'wide' ? RectangleHorizontal : size.id === 'square' ? Square : RectangleVertical;
                return (
                  <button
                    aria-pressed={outputSize?.id === size.id}
                    key={size.id}
                    onClick={() => updateSettings({ height: size.height, width: size.width })}
                    type='button'
                  >
                    <Icon aria-hidden='true' />
                    <span><strong>{size.label.split(' · ')[0]}</strong><small>{size.width}×{size.height}</small></span>
                  </button>
                );
              })}
            </div>
            {!outputSize ? <small className='design-lab-custom-output'>Custom size · {settings.width} × {settings.height}</small> : null}
          </LabInspectorSection>
            </>
          ) : null}
        </aside>
      </div>

      {sourceOpen ? (
        <SourceCodeDrawer
          format='JSON · design composition'
          onApply={applySource}
          onClose={() => setSourceOpen(false)}
          source={JSON.stringify({ artworkKind, backgroundEnabled, liveMaterialId, liveSettings, settings, stickerFinish, stickerTexts, stickersEnabled, surfaceEnabled, surfacePresetId, textLayers }, null, 2)}
          title='Playground recipe'
        />
      ) : null}
    </div>
  );
}
