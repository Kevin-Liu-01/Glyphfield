'use client';

import { useCallback, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { T, useGT } from 'gt-next';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Download,
  Eye,
  EyeOff,
  ImagePlus,
  Layers3,
  RotateCcw,
  Sparkles,
  Trash2,
  Type,
} from 'lucide-react';

import CanvasViewport from '@/components/CanvasViewport';
import EditableCanvasLayer, { type CanvasLayerTransform } from '@/components/EditableCanvasLayer';
import ExportPreview, { type ExportPreviewAsset } from '@/components/ExportPreview';
import LazyLiveMaterialCanvas from '@/components/LazyLiveMaterialCanvas';
import SourceCodeDrawer, { SourceCodeButton } from '@/components/SourceCodeDrawer';
import StickerDeviceScene, {
  type StickerRenderLayer,
  type StickerSelection,
  type StickerStudioStageHandle,
} from '@/components/StickerDeviceScene';
import SurfaceMaterialStage from '@/components/SurfaceMaterialStage';
import { Button } from '@/components/ui/Button';
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
  SHADER_LIBRARY_DEFAULT_IDS,
  shaderLabMaterials,
  shaderLabSettingsFor,
  shaderPreviewAssetPath,
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
import { stickerSceneAssets } from '@/lib/stickerScene';

const OUTPUT_SIZES = [
  { height: 630, id: 'wide', label: 'Wide · 1200 × 630', width: 1200 },
  { height: 1200, id: 'square', label: 'Square · 1200 × 1200', width: 1200 },
  { height: 1350, id: 'portrait', label: 'Portrait · 1080 × 1350', width: 1080 },
] as const;

type ArtworkKind = 'logo' | 'text' | 'asset';
type DesignDock = 'shader' | 'surface' | 'text' | 'sticker';

type PlaygroundTextLayer = {
  align: 'center' | 'left' | 'right';
  color: string;
  fontRole: BrandTypography['role'];
  id: `text-${string}`;
  lineHeight: number;
  name: string;
  opacity: number;
  tracking: number;
  transform: CanvasLayerTransform;
  value: string;
  visible: boolean;
  weight: number;
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

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function textArtworkUrl(text: string, color: string) {
  const safeText = escapeXml(text.trim() || 'Glyphfield');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 500"><text x="600" y="285" text-anchor="middle" dominant-baseline="middle" fill="${color}" font-family="Arial,Helvetica,sans-serif" font-size="190" font-weight="700" letter-spacing="-8">${safeText}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
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
      <span><span>{label}</span><output>{Math.round(value * 100) / 100}{suffix}</output></span>
      <input disabled={disabled} className='studio-range' max={max} min={min} onChange={(event) => onChange(Number(event.target.value))} step={step} type='range' value={value} />
    </label>
  );
}

function ColorControl({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className='design-lab-color'>
      <input aria-label={label} onChange={(event) => onChange(event.target.value.toUpperCase())} type='color' value={value} />
      <span>{label}</span>
      <code>{value}</code>
    </label>
  );
}

export default function SurfaceLabStudio({ identity, tool }: { identity: BrandIdentity; tool: StudioTool }) {
  const gt = useGT();
  const palette = useMemo(() => brandMaterialPalette(identity), [identity]);
  const shaderStageRef = useRef<HTMLDivElement>(null);
  const surfaceStageRef = useRef<HTMLDivElement>(null);
  const stickerStageRef = useRef<StickerStudioStageHandle>(null);
  const customArtworkRef = useRef<{ name: string; url: string } | null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState<ExportPreviewAsset | null>(null);
  const [selectedSticker, setSelectedSticker] = useState<StickerSelection | null>(null);
  const [stickerRenderLayers, setStickerRenderLayers] = useState<StickerRenderLayer[]>([]);
  const [customArtwork, setCustomArtwork] = useState<{ name: string; url: string } | null>(null);
  const [dock, setDock] = useStudioDraft<DesignDock>(identity.id, tool.id, 'design-lab-dock-v2', 'shader');
  const [textLayers, setTextLayers] = useStudioDraft<PlaygroundTextLayer[]>(identity.id, tool.id, 'playground-text-layers-v1', []);
  const [selectedTextId, setSelectedTextId] = useState<PlaygroundTextLayer['id'] | null>(null);
  const [backgroundEnabled, setBackgroundEnabled] = useStudioDraft(identity.id, tool.id, 'design-lab-background-enabled-v1', true);
  const [surfaceEnabled, setSurfaceEnabled] = useStudioDraft(identity.id, tool.id, 'design-lab-surface-enabled-v1', true);
  const [stickersEnabled, setStickersEnabled] = useStudioDraft(identity.id, tool.id, 'design-lab-stickers-enabled-v1', true);
  const [surfacePresetId, setSurfacePresetId] = useStudioDraft(identity.id, tool.id, 'design-lab-surface-preset-v1', SURFACE_LAB_CLOTH_PRESETS[0].id);
  const [artworkKind, setArtworkKind] = useStudioDraft<ArtworkKind>(identity.id, tool.id, 'design-lab-artwork-kind-v1', 'logo');
  const [artworkText, setArtworkText] = useStudioDraft(identity.id, tool.id, 'design-lab-artwork-text-v1', identity.shortName);
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
    if (artworkKind === 'text') return textArtworkUrl(artworkText, settings.logoColor);
    if (artworkKind === 'asset') return selectedBrandAsset?.path;
    return customArtwork?.url ?? identityLogo;
  }, [artworkKind, artworkText, customArtwork?.url, identityLogo, selectedBrandAsset?.path, settings.logoColor]);
  const stickerAssets = useMemo(() => {
    const libraryAssets = stickerSceneAssets(identity, artworkUrl);
    const currentArtwork = artworkUrl
      ? [{ id: 'current-artwork', label: `${identity.name} current artwork`, path: artworkUrl, surface: 'dark' as const, type: 'logo' as const }]
      : [];
    return [...currentArtwork, ...libraryAssets].filter((asset, index, collection) => (
      collection.findIndex(({ path }) => path === asset.path) === index
    ));
  }, [artworkUrl, identity]);
  const dockOptions = [
    {
      detail: backgroundEnabled ? shaderPreset?.name ?? 'Custom shader' : 'None',
      enabled: backgroundEnabled,
      index: '01',
      label: 'Background',
      value: 'shader' as const,
    },
    {
      detail: surfaceEnabled ? surfacePreset.name : 'None',
      enabled: surfaceEnabled,
      index: '02',
      label: 'Surface',
      value: 'surface' as const,
    },
    {
      detail: textLayers.length === 0 ? 'None' : `${textLayers.filter(({ visible }) => visible).length} visible`,
      enabled: textLayers.some(({ visible }) => visible),
      index: '03',
      label: 'Text',
      value: 'text' as const,
    },
    {
      detail: stickersEnabled ? selectedSticker?.label ?? `${stickerAssets.length} assets` : 'None',
      enabled: stickersEnabled,
      index: '04',
      label: 'Stickers',
      value: 'sticker' as const,
    },
  ];

  customArtworkRef.current = customArtwork;
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
      tracking: -0.055,
      transform: { ...DEFAULT_TEXT_TRANSFORM, ...placement },
      value: nextNumber === 1 ? identity.name : `Text ${nextNumber}`,
      visible: true,
      weight: 700,
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
      context.textAlign = layer.align;
      context.textBaseline = 'middle';
      if ('letterSpacing' in context) context.letterSpacing = `${fontSize * layer.tracking}px`;
      const lines = layer.value.split('\n').flatMap((line) => wrapCanvasLine(context, line, boxWidth));
      const lineHeight = fontSize * layer.lineHeight;
      const firstY = centerY - (Math.max(1, lines.length) - 1) * lineHeight / 2;
      const x = layer.align === 'left'
        ? centerX - boxWidth / 2
        : layer.align === 'right'
          ? centerX + boxWidth / 2
          : centerX;
      lines.forEach((line, index) => context.fillText(line, x, firstY + index * lineHeight, boxWidth));
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
    }
  }

  function applySource(source: string) {
    const parsed = JSON.parse(source) as {
      artworkKind?: ArtworkKind;
      artworkText?: string;
      backgroundEnabled?: boolean;
      surfaceEnabled?: boolean;
      stickersEnabled?: boolean;
      surfacePresetId?: string;
      liveMaterialId?: LiveMaterialId;
      liveSettings?: Partial<LiveMaterialSettings>;
      settings?: Partial<BackgroundSettings>;
      stickerFinish?: Partial<StickerFinishSettings>;
      textLayers?: PlaygroundTextLayer[];
    };
    if (parsed.artworkKind && !['logo', 'text', 'asset'].includes(parsed.artworkKind)) throw new TypeError('Artwork kind must be logo, text, or asset.');
    if (parsed.liveMaterialId && !shaderLabMaterials('', 'all').some(({ id }) => id === parsed.liveMaterialId)) throw new TypeError('Unknown Playground shader.');
    if (parsed.surfacePresetId && !DESIGN_SURFACE_PRESETS.some(({ id }) => id === parsed.surfacePresetId)) throw new TypeError('Unknown Playground surface preset.');
    if (parsed.artworkKind) setArtworkKind(parsed.artworkKind);
    if (typeof parsed.artworkText === 'string') setArtworkText(parsed.artworkText);
    if (typeof parsed.backgroundEnabled === 'boolean') setBackgroundEnabled(parsed.backgroundEnabled);
    if (typeof parsed.surfaceEnabled === 'boolean') setSurfaceEnabled(parsed.surfaceEnabled);
    if (typeof parsed.stickersEnabled === 'boolean') setStickersEnabled(parsed.stickersEnabled);
    if (parsed.surfacePresetId) setSurfacePresetId(parsed.surfacePresetId);
    if (parsed.liveMaterialId) setLiveMaterialId(parsed.liveMaterialId);
    if (parsed.liveSettings) setStoredLiveSettings((current) => ({ ...current, ...parsed.liveSettings }));
    if (parsed.settings) setStoredSettings((current) => ({ ...current, ...parsed.settings }));
    if (parsed.stickerFinish) setStickerDraft(normalizeStickerFinish(parsed.stickerFinish));
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
      <header className='app-navbar tool-header design-lab-header'>
        <div className='design-lab-title'>
          <span><Sparkles aria-hidden='true' /> Playground <small>01</small></span>
          <p>Build one composition with shaders, surfaces, editable type, and stickers.</p>
        </div>
        <div className='design-lab-layer-readout' aria-label={gt('Active design layers')}>
          <button aria-pressed={backgroundEnabled} data-active={backgroundEnabled ? 'true' : 'false'} onClick={() => setBackgroundEnabled((value) => !value)} type='button'>Background</button>
          <button aria-pressed={surfaceEnabled} data-active={surfaceEnabled ? 'true' : 'false'} onClick={() => setSurfaceEnabled((value) => !value)} type='button'>Surface</button>
          <button aria-pressed={textLayers.some(({ visible }) => visible)} data-active={textLayers.some(({ visible }) => visible) ? 'true' : 'false'} onClick={() => setDock('text')} type='button'>Text {textLayers.length}</button>
          <button aria-pressed={stickersEnabled} data-active={stickersEnabled ? 'true' : 'false'} onClick={() => setStickersEnabled((value) => !value)} type='button'>Stickers</button>
        </div>
        <div className='flex shrink-0 items-center gap-2'>
          <SourceCodeButton onClick={() => setSourceOpen(true)} />
          <ExportPreview asset={lastExport} />
          <Button loading={exporting} onClick={exportPng} type='button'>
            <Download aria-hidden='true' /><T>Download PNG</T>
          </Button>
        </div>
      </header>

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
              {surfaceEnabled ? (
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
              ) : null}
              <StickerDeviceScene
                aspectRatio={aspectRatio}
                className='design-lab-sticker-layer'
                enabled={stickersEnabled}
                finish={stickerFinish}
                identity={identity}
                logoPath={artworkUrl}
                onPlacementsChange={setStickerRenderLayers}
                onSelectionChange={setSelectedSticker}
                ref={stickerStageRef}
                renderMode={stickersFollowSurface ? 'controls' : 'normal'}
                surface='transparent'
              />
              {textLayers.filter(({ visible }) => visible).map((layer, index) => {
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
                        textAlign: layer.align,
                      }}
                      value={layer.value}
                    />
                  </EditableCanvasLayer>
                );
              })}
            </div>
          </CanvasViewport>

          <div className='design-lab-dock'>
            <div className='design-lab-dock-tabs' role='tablist' aria-label={gt('Design libraries')}>
              <span className='design-lab-dock-label'>Layer library</span>
              {dockOptions.map((option) => (
                <button aria-selected={dock === option.value} key={option.value} onClick={() => setDock(option.value)} role='tab' type='button'>
                  <i aria-hidden='true' data-enabled={option.enabled ? 'true' : 'false'} />
                  <span><b>{option.index}</b>{option.label}</span>
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
                  <button aria-pressed={!backgroundEnabled} className='design-lab-none-preset' onClick={() => setBackgroundEnabled(false)} type='button'><span aria-hidden='true'>∅</span><strong>None</strong></button>
                  {SURFACE_LAB_SHADER_PRESETS.map((preset) => (
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
                      <span className='design-lab-shader-name'>{preset.name}</span>
                    </button>
                  ))}
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
                  {stickerAssets.map((asset) => (
                    <button
                      aria-label={`Place ${asset.label}`}
                      className={`design-lab-sticker-asset ${asset.surface === 'light' ? 'is-light' : ''}`}
                      key={asset.id}
                      onClick={() => { setStickersEnabled(true); stickerStageRef.current?.addSticker(asset.id); }}
                      title={asset.label}
                      type='button'
                    >
                      <img alt='' draggable={false} src={asset.path} />
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
          </div>
        </main>

        <aside className='design-lab-inspector studio-scroll-area' aria-label={gt('Playground controls')}>
          <div className='design-lab-inspector-head'>
            <span>Composition stack</span>
            <strong>{backgroundEnabled ? shaderPreset?.name ?? 'Custom shader' : 'no background'} · {surfaceEnabled ? surfacePreset.name : 'no surface'} · {textLayers.length} text · {stickersEnabled ? 'stickers' : 'no stickers'}</strong>
            <small>Layer settings update the canvas immediately.</small>
          </div>

          <section className='design-lab-inspector-section' data-disabled={!backgroundEnabled ? 'true' : 'false'}>
            <div className='design-lab-section-title'>
              <div><span>01</span><h2>Background shader</h2></div>
              <button aria-label={backgroundEnabled ? gt('Hide background') : gt('Show background')} className='design-lab-visibility' onClick={() => setBackgroundEnabled((value) => !value)} type='button'>
                {backgroundEnabled ? <Eye aria-hidden='true' /> : <EyeOff aria-hidden='true' />}
              </button>
            </div>
            <div className='design-lab-control-stack'>
              <RangeControl disabled={!backgroundEnabled} label='Motion' max={1.5} min={0} onChange={(speed) => updateLiveSettings({ speed })} step={0.01} suffix='×' value={liveSettings.speed} />
              <RangeControl disabled={!backgroundEnabled} label='Warp' max={1.5} min={0} onChange={(strength) => updateLiveSettings({ strength })} step={0.01} suffix='×' value={liveSettings.strength} />
              <RangeControl disabled={!backgroundEnabled} label='Detail' max={9} min={0.5} onChange={(detail) => updateLiveSettings({ detail })} step={0.1} suffix='' value={liveSettings.detail} />
              <RangeControl disabled={!backgroundEnabled} label='Texture' max={100} min={0} onChange={(grain) => updateLiveSettings({ grain })} value={liveSettings.grain} />
              <RangeControl disabled={!backgroundEnabled} label='Light' max={1.6} min={0.35} onChange={(brightness) => updateLiveSettings({ brightness })} step={0.01} suffix='×' value={liveSettings.brightness} />
            </div>
            <div className='design-lab-colors'>
              <ColorControl label='Base' onChange={(colorA) => updateLiveSettings({ colorA })} value={liveSettings.colorA} />
              <ColorControl label='Mid' onChange={(colorB) => updateLiveSettings({ colorB })} value={liveSettings.colorB} />
              <ColorControl label='Light' onChange={(colorC) => updateLiveSettings({ colorC })} value={liveSettings.colorC} />
            </div>
          </section>

          <section className='design-lab-inspector-section' data-disabled={!surfaceEnabled ? 'true' : 'false'}>
            <div className='design-lab-section-title'>
              <div><span>02</span><h2>Surface overlay</h2></div>
              <button aria-label={surfaceEnabled ? gt('Hide surface') : gt('Show surface')} className='design-lab-visibility' onClick={() => setSurfaceEnabled((value) => !value)} type='button'>
                {surfaceEnabled ? <Eye aria-hidden='true' /> : <EyeOff aria-hidden='true' />}
              </button>
            </div>
            <div className='design-lab-control-stack'>
              <RangeControl disabled={!surfaceEnabled} label={surfaceIsCloth ? 'Foil' : 'Texture'} max={100} min={0} onChange={(surfaceTextureAmount) => updateSettings({ surfaceTextureAmount })} value={settings.surfaceTextureAmount} />
              <RangeControl disabled={!surfaceEnabled} label={surfaceIsCloth ? 'Drape' : 'Relief'} max={100} min={0} onChange={(surfaceDepth) => updateSettings({ surfaceDepth })} value={settings.surfaceDepth} />
              <RangeControl disabled={!surfaceEnabled} label={surfaceIsCloth ? 'Sparkle' : 'Irregularity'} max={100} min={0} onChange={(surfaceIrregularity) => updateSettings({ surfaceIrregularity })} value={settings.surfaceIrregularity} />
              <RangeControl disabled={!surfaceEnabled} label={surfaceIsCloth ? 'Roughness' : 'Pattern scale'} max={surfaceIsCloth ? 100 : 140} min={surfaceIsCloth ? 0 : 12} onChange={(value) => updateSettings(surfaceIsCloth ? { surfaceRoughness: value } : { surfaceScale: value })} suffix={surfaceIsCloth ? '%' : 'px'} value={surfaceIsCloth ? settings.surfaceRoughness : settings.surfaceScale} />
              <RangeControl disabled={!surfaceEnabled} label={surfaceIsCloth ? 'Weave' : 'Metallic'} max={100} min={0} onChange={(value) => updateSettings(surfaceIsCloth ? { surfaceOpenArea: value } : { surfaceMetallic: value })} value={surfaceIsCloth ? settings.surfaceOpenArea : settings.surfaceMetallic} />
            </div>
          </section>

          <section className='design-lab-inspector-section' data-disabled={!selectedTextLayer ? 'true' : 'false'}>
            <div className='design-lab-section-title'>
              <div><span>03</span><h2>Text layer</h2></div>
              <button aria-label='Add text layer' className='design-lab-visibility' onClick={addTextLayer} title='Add text layer' type='button'><Type aria-hidden='true' /></button>
            </div>
            {selectedTextLayer ? (() => {
              const transform = resolvedTextTransform(selectedTextLayer.transform);
              const orderIndex = textLayers.findIndex(({ id }) => id === selectedTextLayer.id);
              return <>
                <label className='design-lab-field'><span>Content</span><textarea onChange={(event) => updateTextLayer(selectedTextLayer.id, { value: event.target.value })} rows={2} value={selectedTextLayer.value} /></label>
                <div className='design-lab-text-inspector-grid'>
                  <label className='design-lab-field'>
                    <span>Brand font</span>
                    <StudioSelect
                      ariaLabel='Playground text font role'
                      onValueChange={(fontRole) => updateTextLayer(selectedTextLayer.id, { fontRole: fontRole as BrandTypography['role'] })}
                      options={(['Display', 'Body', 'Accent', 'Code'] as const).map((role) => ({ label: `${role} · ${brandTypographyFamily(identity, role)}`, value: role }))}
                      value={selectedTextLayer.fontRole}
                    />
                  </label>
                  <ColorControl label='Text' onChange={(color) => updateTextLayer(selectedTextLayer.id, { color })} value={selectedTextLayer.color} />
                </div>
                <div className='design-lab-artwork-kinds' role='group' aria-label='Text alignment'>
                  {(['left', 'center', 'right'] as const).map((align) => <button aria-pressed={selectedTextLayer.align === align} key={align} onClick={() => updateTextLayer(selectedTextLayer.id, { align })} type='button'>{align}</button>)}
                </div>
                <div className='design-lab-control-stack'>
                  <RangeControl label='Text size' max={3} min={0.2} onChange={(scale) => updateTextLayer(selectedTextLayer.id, { transform: { ...transform, scale } })} step={0.05} value={transform.scale} />
                  <RangeControl label='Text box width' max={3} min={0.25} onChange={(widthScale) => updateTextLayer(selectedTextLayer.id, { transform: { ...transform, widthScale } })} step={0.05} value={transform.widthScale ?? 1} />
                  <RangeControl label='Opacity' max={100} min={0} onChange={(opacity) => updateTextLayer(selectedTextLayer.id, { opacity: opacity / 100 })} value={selectedTextLayer.opacity * 100} />
                  <RangeControl label='Weight' max={900} min={300} onChange={(weight) => updateTextLayer(selectedTextLayer.id, { weight })} step={50} suffix='' value={selectedTextLayer.weight} />
                  <RangeControl label='Line height' max={1.8} min={0.7} onChange={(lineHeight) => updateTextLayer(selectedTextLayer.id, { lineHeight })} step={0.05} suffix='' value={selectedTextLayer.lineHeight} />
                  <RangeControl label='Tracking' max={0.2} min={-0.12} onChange={(tracking) => updateTextLayer(selectedTextLayer.id, { tracking })} step={0.01} suffix='em' value={selectedTextLayer.tracking} />
                </div>
                <div className='design-lab-selection-actions'>
                  <button onClick={() => duplicateTextLayer(selectedTextLayer.id)} type='button'><Copy aria-hidden='true' /><span>Duplicate</span></button>
                  <button disabled={orderIndex === textLayers.length - 1} onClick={() => moveTextLayer(selectedTextLayer.id, 1)} type='button'><ArrowUp aria-hidden='true' /><span>Forward</span></button>
                  <button onClick={() => removeTextLayer(selectedTextLayer.id)} type='button'><Trash2 aria-hidden='true' /><span>Delete</span></button>
                </div>
              </>;
            })() : <button className='design-lab-empty-action' onClick={addTextLayer} type='button'><Type aria-hidden='true' /><span>Add your first text layer</span></button>}
          </section>

          <section className='design-lab-inspector-section' data-disabled={!stickersEnabled ? 'true' : 'false'}>
            <div className='design-lab-section-title'>
              <div><span>04</span><h2>Sticker</h2></div>
              <button aria-label={stickersEnabled ? gt('Hide stickers') : gt('Show stickers')} className='design-lab-visibility' onClick={() => setStickersEnabled((value) => !value)} type='button'>
                {stickersEnabled ? <Eye aria-hidden='true' /> : <EyeOff aria-hidden='true' />}
              </button>
            </div>
            <div className='design-lab-control-stack' aria-disabled={!selectedSticker}>
              <RangeControl disabled={!stickersEnabled || !selectedSticker} label='Size' max={54} min={8} onChange={(scale) => stickerStageRef.current?.updateSelected({ scale })} value={selectedSticker?.scale ?? 24} />
              <RangeControl disabled={!stickersEnabled || !selectedSticker} label='Rotation' max={180} min={-180} onChange={(rotation) => stickerStageRef.current?.updateSelected({ rotation })} suffix='°' value={selectedSticker?.rotation ?? 0} />
              <RangeControl disabled={!stickersEnabled} label='Foil' max={100} min={0} onChange={(intensity) => updateSticker({ intensity })} value={stickerFinish.intensity} />
              <RangeControl disabled={!stickersEnabled} label='Die-cut edge' max={32} min={2} onChange={(edgeWidth) => updateSticker({ edgeWidth })} suffix='px' value={stickerFinish.edgeWidth} />
              <RangeControl disabled={!stickersEnabled} label='Contrast keyline' max={12} min={1} onChange={(seamWidth) => updateSticker({ seamWidth })} suffix='px' value={stickerFinish.seamWidth} />
              <RangeControl disabled={!stickersEnabled} label='Relief' max={100} min={0} onChange={(relief) => updateSticker({ relief })} value={stickerFinish.relief} />
            </div>
            <div className='design-lab-selection-actions'>
              <button disabled={!stickersEnabled || !selectedSticker} onClick={() => stickerStageRef.current?.duplicateSelected()} type='button'><Copy aria-hidden='true' /><span>Duplicate</span></button>
              <button disabled={!stickersEnabled || !selectedSticker} onClick={() => stickerStageRef.current?.bringSelectedForward()} type='button'><ArrowUp aria-hidden='true' /><span>Forward</span></button>
              <button disabled={!stickersEnabled || !selectedSticker} onClick={() => stickerStageRef.current?.removeSelected()} type='button'><Trash2 aria-hidden='true' /><span>Delete</span></button>
            </div>
          </section>

          <section className='design-lab-inspector-section'>
            <div className='design-lab-section-title'><div><span>05</span><h2>Sticker artwork</h2></div><small>Add from dock</small></div>
            <div className='design-lab-artwork-kinds' role='group' aria-label={gt('Artwork type')}>
              {([
                ['logo', ImagePlus, 'Logo'],
                ['text', Type, 'Text'],
                ['asset', Layers3, 'Asset'],
              ] as const).map(([value, Icon, label]) => (
                <button aria-pressed={artworkKind === value} key={value} onClick={() => { setArtworkKind(value); setStickersEnabled(true); setDock('sticker'); }} type='button'><Icon aria-hidden='true' />{label}</button>
              ))}
            </div>
            {artworkKind === 'text' ? (
              <label className='design-lab-field'><span>Text</span><input onChange={(event) => setArtworkText(event.target.value)} value={artworkText} /></label>
            ) : artworkKind === 'asset' ? (
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
          </section>

          <details className='design-lab-advanced'>
            <summary>Advanced layer controls <span>+</span></summary>
            <div>
              <RangeControl disabled={!backgroundEnabled} label='Shader frequency' max={12} min={0.5} onChange={(frequency) => updateLiveSettings({ frequency })} step={0.1} suffix='' value={liveSettings.frequency} />
              <RangeControl disabled={!backgroundEnabled} label='Shader amplitude' max={10} min={0} onChange={(amplitude) => updateLiveSettings({ amplitude })} step={0.1} suffix='' value={liveSettings.amplitude} />
              <RangeControl disabled={!surfaceEnabled} label='Surface direction' max={180} min={0} onChange={(surfaceAngle) => updateSettings({ surfaceAngle })} suffix='°' value={settings.surfaceAngle} />
              <RangeControl disabled={!stickersEnabled} label='Foil bands' max={20} min={1} onChange={(bands) => updateSticker({ bands })} suffix='' value={stickerFinish.bands} />
              <RangeControl disabled={!stickersEnabled} label='Glint angle' max={180} min={0} onChange={(glintAngle) => updateSticker({ glintAngle })} suffix='°' value={stickerFinish.glintAngle} />
            </div>
          </details>

          <section className='design-lab-inspector-section'>
            <div className='design-lab-section-title'><div><span>06</span><h2>Output</h2></div><small>PNG</small></div>
            <StudioSelect
              ariaLabel={gt('Output size')}
              onValueChange={(id) => {
                const size = OUTPUT_SIZES.find((candidate) => candidate.id === id);
                if (size) updateSettings({ height: size.height, width: size.width });
              }}
              options={[
                ...(outputSize ? [] : [{ label: `Custom · ${settings.width} × ${settings.height}`, value: 'custom' }]),
                ...OUTPUT_SIZES.map((size) => ({ label: size.label, value: size.id })),
              ]}
              value={outputSize?.id ?? 'custom'}
            />
          </section>
        </aside>
      </div>

      {sourceOpen ? (
        <SourceCodeDrawer
          format='JSON · design composition'
          onApply={applySource}
          onClose={() => setSourceOpen(false)}
          source={JSON.stringify({ artworkKind, artworkText, backgroundEnabled, liveMaterialId, liveSettings, settings, stickerFinish, stickersEnabled, surfaceEnabled, surfacePresetId, textLayers }, null, 2)}
          title='Playground recipe'
        />
      ) : null}
    </div>
  );
}
