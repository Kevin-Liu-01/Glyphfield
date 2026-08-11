'use client';

import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Code2,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  ImagePlus,
  Pause,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';

import CanvasViewport from '@/components/CanvasViewport';
import AuthenticShaderPreview from '@/components/AuthenticShaderPreview';
import EditableCanvasLayer, {
  canvasLayerDimensions,
  type CanvasLayerTransform,
} from '@/components/EditableCanvasLayer';
import LiveMaterialCanvas from '@/components/LazyLiveMaterialCanvas';
import { LiveMaterialSourceTag } from '@/components/LiveMaterialSourceLabel';
import { Button } from '@/components/ui/Button';
import { useStudioDraft } from '@/hooks/usePersistentState';
import { brandAssetPath, type BrandIdentity } from '@/lib/brandIdentity';
import {
  canvasTextCharacters,
  canvasTextLineX,
  layoutCanvasText,
  trackedTextWidth,
  type CanvasTextAlign,
  type CanvasTextWrap,
} from '@/lib/canvasText';
import {
  DEFAULT_LIVE_MATERIAL_SETTINGS,
  LIVE_MATERIAL_PALETTES,
  brandMaterialPalette,
  getLiveMaterial,
  isPaperLiveMaterialId,
  normalizeLiveMaterialId,
  type LiveMaterialId,
  type LiveMaterialSettings,
} from '@/lib/liveMaterials';
import {
  SHADER_LAB_CATEGORIES,
  shaderLabCategoryCount,
  shaderLabMaterials,
  shaderLabSettingsFor,
  shaderPreviewAssetPath,
  type ShaderLabCategory,
} from '@/lib/shaderLab';
import type { StudioTool } from '@/lib/studioCatalog';

type ShaderTarget = 'background' | 'logo' | 'both';
type ShaderRatio = 'wide' | 'square' | 'opengraph';
type ContentMode = 'logo' | 'text' | 'both' | 'none';
type CompositionLayerId = 'logo' | 'text' | `asset-${string}`;

type CompositionAsset = {
  id: CompositionLayerId;
  name: string;
  transform: CanvasLayerTransform;
  url: string;
};

type LayerGeometry = {
  baseHeight: number;
  baseWidth: number;
  baseX: number;
  baseY: number;
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

const DEFAULT_LAYER_TRANSFORM: CanvasLayerTransform = { scale: 1, x: 0, y: 0 };
const DEFAULT_TEXT_LAYER_TRANSFORM: CanvasLayerTransform = {
  ...DEFAULT_LAYER_TRANSFORM,
  heightScale: 1,
  widthScale: 1,
};

function layerGeometry(layerId: CompositionLayerId, ratio: ShaderRatio, contentMode: ContentMode = 'logo'): LayerGeometry {
  const canvas = CANVAS_DIMENSIONS[ratio];
  if (layerId === 'text') {
    const paired = contentMode === 'both';
    const baseWidth = canvas.width * (paired ? 0.68 : 0.72);
    const baseHeight = canvas.height * (paired ? 0.18 : 0.25);
    return {
      baseHeight,
      baseWidth,
      baseX: (canvas.width - baseWidth) / 2,
      baseY: paired ? canvas.height * 0.23 : (canvas.height - baseHeight) / 2,
    };
  }
  if (layerId === 'logo') {
    const paired = contentMode === 'both';
    const baseWidth = canvas.width * (paired ? 0.34 : 0.42);
    const baseHeight = canvas.height * (paired ? 0.24 : 0.32);
    return {
      baseHeight,
      baseWidth,
      baseX: (canvas.width - baseWidth) / 2,
      baseY: paired ? canvas.height * 0.55 : (canvas.height - baseHeight) / 2,
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
  { key: 'speed', label: 'Motion', max: 1.5, min: 0, step: 0.01 },
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

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = fileName;
  link.href = url;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
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
      <span>
        <span>{label}</span>
        <output>{formatValue?.(value) ?? (Number.isInteger(step) ? Math.round(value) : value.toFixed(2))}</output>
      </span>
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

export default function ShaderLabStudio({
  identity,
  navigation,
  tool,
}: {
  identity: BrandIdentity;
  navigation?: ReactNode;
  tool: StudioTool;
}) {
  const brandPalette = brandMaterialPalette(identity);
  const initialSettings = shaderLabSettingsFor('holo-cloth-silk', {
    ...DEFAULT_LIVE_MATERIAL_SETTINGS,
    colorA: brandPalette.colors[0],
    colorB: brandPalette.colors[1],
    colorC: brandPalette.colors[2],
  });
  const stageRef = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const assetInputRef = useRef<HTMLInputElement>(null);
  const customLogoUrlRef = useRef<string | null>(null);
  const compositionAssetUrlsRef = useRef<string[]>([]);
  const [storedMaterialId, setMaterialId] = useStudioDraft<LiveMaterialId>(
    identity.id,
    tool.id,
    'shader-lab-v2-material',
    'holo-cloth-silk'
  );
  const [settings, setSettings] = useStudioDraft<LiveMaterialSettings>(
    identity.id,
    tool.id,
    'shader-lab-v2-settings',
    initialSettings
  );
  const [shaderSize, setShaderSize] = useStudioDraft(
    identity.id,
    tool.id,
    'shader-lab-v2-shader-size',
    1
  );
  const [brandPaletteApplied, setBrandPaletteApplied] = useStudioDraft(
    identity.id,
    tool.id,
    'shader-lab-v2-brand-palette-v1',
    false
  );
  const [target, setTarget] = useStudioDraft<ShaderTarget>(identity.id, tool.id, 'shader-lab-v2-target', 'background');
  const [ratio, setRatio] = useStudioDraft<ShaderRatio>(identity.id, tool.id, 'shader-lab-v2-ratio', 'wide');
  const [contentMode, setContentMode] = useStudioDraft<ContentMode>(identity.id, tool.id, 'shader-lab-v2-content-mode', 'logo');
  const [textValue, setTextValue] = useStudioDraft(identity.id, tool.id, 'shader-lab-v2-text', identity.shortName);
  const [textWeight, setTextWeight] = useStudioDraft(identity.id, tool.id, 'shader-lab-v2-text-weight', 700);
  const [textTracking, setTextTracking] = useStudioDraft(identity.id, tool.id, 'shader-lab-v2-text-tracking', -0.06);
  const [textLineHeight, setTextLineHeight] = useStudioDraft(identity.id, tool.id, 'shader-lab-v2-text-line-height', 0.95);
  const [textAlign, setTextAlign] = useStudioDraft<CanvasTextAlign>(identity.id, tool.id, 'shader-lab-v2-text-align', 'center');
  const [textWrap, setTextWrap] = useStudioDraft<CanvasTextWrap>(identity.id, tool.id, 'shader-lab-v2-text-wrap', 'wrap');
  const [logoTransform, setLogoTransform] = useStudioDraft<CanvasLayerTransform>(
    identity.id,
    tool.id,
    'shader-lab-v2-logo-transform',
    DEFAULT_LAYER_TRANSFORM
  );
  const [textTransform, setTextTransform] = useStudioDraft<CanvasLayerTransform>(
    identity.id,
    tool.id,
    'shader-lab-v2-text-transform',
    DEFAULT_TEXT_LAYER_TRANSFORM
  );
  const [paused, setPaused] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ShaderLabCategory>('all');
  const [customLogo, setCustomLogo] = useState<{ name: string; url: string } | null>(null);
  const [compositionAssets, setCompositionAssets] = useState<CompositionAsset[]>([]);
  const [layerOrder, setLayerOrder] = useState<CompositionLayerId[]>(['logo', 'text']);
  const [selectedLayerId, setSelectedLayerId] = useState<CompositionLayerId | null>('logo');
  const [copied, setCopied] = useState(false);
  const [captureTimeMs, setCaptureTimeMs] = useState<number | null>(null);
  const [exporting, setExporting] = useState<'gif' | 'png' | null>(null);
  const [exportProgress, setExportProgress] = useState(0);
  const materialId = normalizeLiveMaterialId(storedMaterialId);
  const material = getLiveMaterial(materialId);
  const ratioOption = RATIO_OPTIONS.find((option) => option.value === ratio) ?? RATIO_OPTIONS[0]!;
  const canvasDimensions = CANVAS_DIMENSIONS[ratio];
  const resolvedTextTransform: CanvasLayerTransform = {
    ...textTransform,
    heightScale: textTransform.heightScale ?? 1,
    widthScale: textTransform.widthScale ?? 1,
  };
  const textFontSizeCqw = canvasDimensions.height / canvasDimensions.width * 17 * resolvedTextTransform.scale;
  const materials = useMemo(() => shaderLabMaterials(query, category), [category, query]);
  const builtInLogo = brandAssetPath(identity, 'mark-light')
    ?? brandAssetPath(identity, 'logo-light')
    ?? brandAssetPath(identity, 'mark-dark')
    ?? monogramDataUrl(identity);
  const logoSource = customLogo?.url ?? builtInLogo;
  const logoMaskStyle = {
    WebkitMaskImage: `url("${logoSource}")`,
    WebkitMaskPosition: 'center',
    WebkitMaskRepeat: 'no-repeat',
    WebkitMaskSize: 'contain',
    maskImage: `url("${logoSource}")`,
    maskPosition: 'center',
    maskRepeat: 'no-repeat',
    maskSize: 'contain',
  } as CSSProperties;

  useEffect(() => () => {
    if (customLogoUrlRef.current) URL.revokeObjectURL(customLogoUrlRef.current);
    compositionAssetUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    if (brandPaletteApplied) return;
    setSettings((current) => ({
      ...current,
      colorA: brandPalette.colors[0],
      colorB: brandPalette.colors[1],
      colorC: brandPalette.colors[2],
    }));
    setBrandPaletteApplied(true);
  }, [brandPaletteApplied, brandPalette.colors, setBrandPaletteApplied, setSettings]);

  function updateSetting<Key extends keyof LiveMaterialSettings>(key: Key, value: LiveMaterialSettings[Key]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function selectMaterial(nextId: LiveMaterialId) {
    setMaterialId(nextId);
    setSettings(shaderLabSettingsFor(nextId, {
      ...DEFAULT_LIVE_MATERIAL_SETTINGS,
      colorA: brandPalette.colors[0],
      colorB: brandPalette.colors[1],
      colorC: brandPalette.colors[2],
    }));
  }

  function selectRandomMaterial() {
    const visibleChoices = materials.filter(({ id }) => id !== materialId);
    const choices = visibleChoices.length > 0
      ? visibleChoices
      : shaderLabMaterials('', 'all').filter(({ id }) => id !== materialId);
    const next = choices[Math.floor(Math.random() * choices.length)];
    if (next) selectMaterial(next.id);
  }

  function selectLogo(file: File | undefined) {
    if (!file || !file.type.startsWith('image/')) return;
    if (customLogoUrlRef.current) URL.revokeObjectURL(customLogoUrlRef.current);
    const url = URL.createObjectURL(file);
    customLogoUrlRef.current = url;
    setCustomLogo({ name: file.name, url });
  }

  function clearLogo() {
    if (customLogoUrlRef.current) URL.revokeObjectURL(customLogoUrlRef.current);
    customLogoUrlRef.current = null;
    setCustomLogo(null);
    if (logoInputRef.current) logoInputRef.current.value = '';
  }

  function addAssets(files: FileList | null) {
    const images = Array.from(files ?? []).filter((file) => file.type.startsWith('image/'));
    if (images.length === 0) return;
    const nextAssets = images.map((file, index): CompositionAsset => {
      const url = URL.createObjectURL(file);
      compositionAssetUrlsRef.current.push(url);
      return {
        id: `asset-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${index}`}`,
        name: file.name,
        transform: { ...DEFAULT_LAYER_TRANSFORM, x: index * 28, y: index * 24 },
        url,
      };
    });
    setCompositionAssets((current) => [...current, ...nextAssets]);
    setLayerOrder((current) => [...current, ...nextAssets.map(({ id }) => id)]);
    setSelectedLayerId(nextAssets.at(-1)?.id ?? null);
    if (assetInputRef.current) assetInputRef.current.value = '';
  }

  function removeAsset(id: CompositionLayerId) {
    setCompositionAssets((current) => {
      const removed = current.find((asset) => asset.id === id);
      if (removed) {
        URL.revokeObjectURL(removed.url);
        compositionAssetUrlsRef.current = compositionAssetUrlsRef.current.filter((url) => url !== removed.url);
      }
      return current.filter((asset) => asset.id !== id);
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

  function updateAssetTransform(id: CompositionLayerId, transform: CanvasLayerTransform) {
    setCompositionAssets((current) => current.map((asset) => asset.id === id ? { ...asset, transform } : asset));
  }

  const visibleLayerIds = layerOrder.filter((id) => {
    if (id === 'logo') return contentMode === 'logo' || contentMode === 'both';
    if (id === 'text') return contentMode === 'text' || contentMode === 'both';
    return compositionAssets.some((asset) => asset.id === id);
  });
  const listedLayerIds = layerOrder.filter((id) =>
    id === 'logo' || id === 'text' || compositionAssets.some((asset) => asset.id === id)
  );

  function primaryLayerIsVisible(id: 'logo' | 'text') {
    return id === 'logo'
      ? contentMode === 'logo' || contentMode === 'both'
      : contentMode === 'text' || contentMode === 'both';
  }

  function togglePrimaryLayer(id: 'logo' | 'text') {
    const logoVisible = id === 'logo' ? !primaryLayerIsVisible('logo') : primaryLayerIsVisible('logo');
    const textVisible = id === 'text' ? !primaryLayerIsVisible('text') : primaryLayerIsVisible('text');
    const nextMode: ContentMode = logoVisible && textVisible
      ? 'both'
      : logoVisible
        ? 'logo'
        : textVisible
          ? 'text'
          : 'none';
    setContentMode(nextMode);
    if (selectedLayerId === id && !primaryLayerIsVisible(id)) return;
    if (selectedLayerId === id) setSelectedLayerId(null);
  }

  function layerLabel(id: CompositionLayerId) {
    if (id === 'logo') return 'Brand mark';
    if (id === 'text') return 'Text';
    return compositionAssets.find((asset) => asset.id === id)?.name ?? 'Image';
  }

  async function copySetup() {
    const setup = JSON.stringify({
      composition: {
        assets: compositionAssets.map(({ id, name, transform }) => ({ id, name, transform })),
        contentMode,
        layerOrder,
        logoTransform,
        text: textValue,
        textTracking,
        textTransform,
        textWeight,
      },
      materialId,
      ratio,
      settings,
      shaderSize,
      target,
    }, null, 2);
    try {
      await navigator.clipboard.writeText(setup);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_600);
    } catch {
      setCopied(false);
    }
  }

  function paintCurrentMaterial(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    layer: 'background' | 'logo' = 'background'
  ) {
    const liveCanvas = stageRef.current?.querySelector<HTMLElement>(`[data-material-layer="${layer}"]`)?.querySelector('canvas')
      ?? stageRef.current?.querySelector('canvas');
    if (liveCanvas?.width && liveCanvas.height) {
      try {
        drawCover(context, liveCanvas, liveCanvas.width, liveCanvas.height, width, height);
        return;
      } catch {
        paintFallback(context, width, height, settings);
        return;
      }
    }
    paintFallback(context, width, height, settings);
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

  function outputLayerBox(
    layerId: CompositionLayerId,
    transform: CanvasLayerTransform,
    outputWidth: number,
    outputHeight: number
  ) {
    const geometry = layerGeometry(layerId, ratio, contentMode);
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
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';

    if (target === 'background' || target === 'both') {
      paintCurrentMaterial(context, width, height);
    } else {
      context.fillStyle = '#111216';
      context.fillRect(0, 0, width, height);
    }

    visibleLayerIds.forEach((layerId) => {
      if (layerId === 'logo') {
        const logo = images.get('logo');
        if (!logo) return;
        const box = outputLayerBox('logo', logoTransform, width, height);
        if (target === 'logo' || target === 'both') {
          const materialLayer = document.createElement('canvas');
          materialLayer.width = Math.max(1, Math.round(box.width));
          materialLayer.height = Math.max(1, Math.round(box.height));
          const materialContext = materialLayer.getContext('2d');
          if (!materialContext) return;
          paintCurrentMaterial(materialContext, materialLayer.width, materialLayer.height, 'logo');
          materialContext.globalCompositeOperation = 'destination-in';
          drawContained(
            materialContext,
            logo,
            logo.naturalWidth || 1,
            logo.naturalHeight || 1,
            0,
            0,
            materialLayer.width,
            materialLayer.height
          );
          context.drawImage(materialLayer, box.x, box.y, box.width, box.height);
        } else {
          context.save();
          context.globalAlpha = 0.96;
          context.globalCompositeOperation = 'difference';
          drawContained(context, logo, logo.naturalWidth || 1, logo.naturalHeight || 1, box.x, box.y, box.width, box.height);
          context.restore();
        }
        return;
      }

      if (layerId === 'text') {
        const box = outputLayerBox('text', resolvedTextTransform, width, height);
        const value = textValue || identity.shortName;
        context.save();
        context.textAlign = 'left';
        context.textBaseline = 'alphabetic';
        const fontSize = Math.max(18, height * 0.17 * resolvedTextTransform.scale);
        const lineHeight = fontSize * textLineHeight;
        const spacing = textTracking * fontSize;
        context.font = `${textWeight} ${fontSize}px Arial, sans-serif`;
        const measureText = (text: string) => context.measureText(text).width;
        const lines = layoutCanvasText(value, box.width, measureText, spacing, textWrap);
        const totalHeight = Math.max(lineHeight, lines.length * lineHeight);
        const renderedBoxHeight = Math.max(box.height, totalHeight);
        const firstBaseline = box.y + (renderedBoxHeight - totalHeight) / 2 + fontSize;
        const preview = images.get('shader-preview');
        const pattern = preview && (target === 'logo' || target === 'both') ? context.createPattern(preview, 'repeat') : null;
        context.fillStyle = pattern ?? (target === 'background' ? '#ffffff' : settings.colorC);
        if (target === 'background') context.globalCompositeOperation = 'difference';
        lines.forEach((line, lineIndex) => {
          const characters = canvasTextCharacters(line);
          const lineWidth = trackedTextWidth(line, measureText, spacing);
          let cursor = canvasTextLineX(textAlign, box.x, box.width, lineWidth);
          characters.forEach((character) => {
            context.fillText(character, cursor, firstBaseline + lineIndex * lineHeight);
            cursor += measureText(character) + spacing;
          });
        });
        context.restore();
        return;
      }

      const asset = compositionAssets.find(({ id }) => id === layerId);
      const image = asset ? images.get(asset.id) : null;
      if (!asset || !image) return;
      const box = outputLayerBox(asset.id, asset.transform, width, height);
      drawContained(context, image, image.naturalWidth || 1, image.naturalHeight || 1, box.x, box.y, box.width, box.height);
    });
  }

  async function loadCompositionImages() {
    const entries: [string, string][] = [
      ['logo', logoSource],
      ['shader-preview', shaderPreviewAssetPath(materialId)],
      ...compositionAssets.map((asset): [string, string] => [asset.id, asset.url]),
    ];
    return new Map(await Promise.all(entries.map(async ([id, source]) => [id, await loadImage(source)] as const)));
  }

  async function exportPng() {
    if (exporting) return;
    setExporting('png');
    try {
      const output = document.createElement('canvas');
      output.width = ratio === 'square' ? 1400 : ratio === 'opengraph' ? 1200 : 1600;
      output.height = ratio === 'square' ? 1400 : ratio === 'opengraph' ? 630 : 900;
      const context = output.getContext('2d');
      if (!context) return;
      const images = await loadCompositionImages();
      composeFrame(context, output.width, output.height, images);
      const blob = await new Promise<Blob | null>((resolve) => output.toBlob(resolve, 'image/png'));
      if (blob) downloadBlob(blob, `${identity.id}-${materialId}-${target}.png`);
    } finally {
      setExporting(null);
    }
  }

  async function exportGif() {
    if (exporting) return;
    setExporting('gif');
    setExportProgress(0);
    try {
      const output = document.createElement('canvas');
      output.width = ratio === 'square' ? 800 : 960;
      output.height = ratio === 'square' ? 800 : ratio === 'opengraph' ? 504 : 540;
      const context = output.getContext('2d', { willReadFrequently: true });
      if (!context) return;
      const images = await loadCompositionImages();
      const { GIFEncoder, applyPalette, quantize } = await import('gifenc');
      const gif = GIFEncoder();
      let palette: ReturnType<typeof quantize> | undefined;
      const frameCount = 24;
      const frameDelay = 80;

      for (let index = 0; index < frameCount; index += 1) {
        setCaptureTimeMs(index * frameDelay);
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        composeFrame(context, output.width, output.height, images);
        const pixels = context.getImageData(0, 0, output.width, output.height).data;
        palette ??= quantize(pixels, 256, { format: 'rgb565' });
        gif.writeFrame(applyPalette(pixels, palette, 'rgb565'), output.width, output.height, {
          delay: frameDelay,
          ...(index === 0 ? { palette, repeat: 0 } : {}),
        });
        setExportProgress((index + 1) / frameCount);
      }
      gif.finish();
      downloadBlob(new Blob([Uint8Array.from(gif.bytes())], { type: 'image/gif' }), `${identity.id}-${materialId}-${target}.gif`);
    } finally {
      setCaptureTimeMs(null);
      setExportProgress(0);
      setExporting(null);
    }
  }

  function renderLiveMaterial(layer: 'background' | 'logo') {
    return (
      <LiveMaterialCanvas
        activeWhileMounted
        captureTimeMs={captureTimeMs}
        className='absolute inset-0 size-full'
        key={`${layer}-${materialId}`}
        materialId={materialId}
        patternScale={shaderSize}
        paused={paused || captureTimeMs !== null}
        renderScale={1}
        settings={settings}
      />
    );
  }

  return (
    <div className='shader-lab-v2 tool-shell h-full min-h-0'>
      <header className='app-navbar tool-header flex items-center justify-between gap-4 border-b border-border px-5'>
        <div className='min-w-0'>
          <div className='flex items-center gap-2'>
            <p className='text-lg font-semibold tracking-tight'>{tool.name}</p>
          </div>
          <p className='truncate text-sm text-muted-foreground'>Choose a shader, tune its scale and color, then apply it to the canvas, logo, or both.</p>
        </div>
        <div className='flex shrink-0 items-center gap-2'>
          {navigation}
          <Button aria-label={paused ? 'Play shader' : 'Pause shader'} onClick={() => setPaused((current) => !current)} size='icon' type='button' variant='outline'>
            {paused ? <Play aria-hidden='true' /> : <Pause aria-hidden='true' />}
          </Button>
          <Button disabled={Boolean(exporting)} onClick={() => void exportPng()} loading={exporting === 'png'} type='button' variant='outline'>
            <Download aria-hidden='true' />
            <span className='responsive-toolbar-label'>PNG</span>
          </Button>
          <Button disabled={Boolean(exporting)} onClick={() => void exportGif()} loading={exporting === 'gif'} type='button'>
            <Download aria-hidden='true' />
            <span className='responsive-toolbar-label'>{exporting === 'gif' ? `${Math.round(exportProgress * 100)}%` : 'GIF'}</span>
          </Button>
        </div>
      </header>

      <div className='shader-lab-v2-layout'>
        <aside className='shader-lab-v2-library' aria-label='Shader library'>
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
          <div className='shader-lab-v2-material-grid'>
            {materials.map((option) => (
              <button
                aria-pressed={materialId === option.id}
                className='shader-lab-v2-material-card'
                key={option.id}
                onClick={() => selectMaterial(option.id)}
                type='button'
              >
                <span className='shader-lab-v2-material-preview'>
                  <AuthenticShaderPreview materialId={option.id} />
                  <LiveMaterialSourceTag material={option} />
                </span>
                <span className='shader-lab-v2-material-copy'>
                  <strong>{option.name}</strong>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <main className='shader-lab-v2-workspace'>
          <div className='shader-lab-v2-stage-toolbar'>
            <div className='shader-lab-v2-segmented' aria-label='Apply shader to'>
              <button aria-pressed={target === 'background'} onClick={() => setTarget('background')} type='button'>Canvas</button>
              <button aria-pressed={target === 'logo'} onClick={() => setTarget('logo')} type='button'>Logo</button>
              <button aria-pressed={target === 'both'} onClick={() => setTarget('both')} type='button'>Both</button>
            </div>
            <div className='shader-lab-v2-segmented shader-lab-v2-ratios' aria-label='Canvas ratio'>
              {RATIO_OPTIONS.map((option) => (
                <button aria-pressed={ratio === option.value} key={option.value} onClick={() => setRatio(option.value)} type='button'>{option.label}</button>
              ))}
            </div>
          </div>
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
                className={`shader-lab-v2-stage shader-lab-v2-stage-${target} shader-lab-v2-stage-${ratio}`}
                data-material-id={materialId}
                data-testid='shader-lab-live-stage'
                onPointerDown={() => setSelectedLayerId(null)}
                ref={stageRef}
                style={{ aspectRatio: `${ratioOption.width} / ${ratioOption.height}` }}
              >
                {target === 'background' || target === 'both' ? (
                  <div className='shader-lab-v2-canvas-material' data-material-layer='background'>
                    {renderLiveMaterial('background')}
                  </div>
                ) : null}
                {visibleLayerIds.map((layerId, index) => {
                  const geometry = layerGeometry(layerId, ratio, contentMode);
                  const zIndex = 5 + index;
                  if (layerId === 'logo') {
                    return (
                      <EditableCanvasLayer
                        {...geometry}
                        canvasHeight={canvasDimensions.height}
                        canvasWidth={canvasDimensions.width}
                        className='shader-lab-v2-composition-layer'
                        key={layerId}
                        label='Brand mark'
                        onChange={setLogoTransform}
                        onDeselect={() => setSelectedLayerId(null)}
                        onSelect={() => setSelectedLayerId('logo')}
                        selected={selectedLayerId === 'logo'}
                        transform={logoTransform}
                        zIndex={zIndex}
                      >
                        {target === 'logo' || target === 'both' ? (
                          <div className='shader-lab-v2-layer-logo-mask' data-material-layer='logo' style={logoMaskStyle}>
                            {renderLiveMaterial('logo')}
                          </div>
                        ) : (
                          <img alt={`${identity.name} logo`} className='shader-lab-v2-layer-image shader-lab-v2-layer-logo' loading='eager' src={logoSource} />
                        )}
                      </EditableCanvasLayer>
                    );
                  }
                  if (layerId === 'text') {
                    return (
                      <EditableCanvasLayer
                        {...geometry}
                        canvasHeight={canvasDimensions.height}
                        canvasWidth={canvasDimensions.width}
                        className='shader-lab-v2-composition-layer'
                        fitContentHeight
                        key={layerId}
                        label='Text'
                        onChange={setTextTransform}
                        onDeselect={() => setSelectedLayerId(null)}
                        onSelect={() => setSelectedLayerId('text')}
                        resizeMode='box'
                        selected={selectedLayerId === 'text'}
                        transform={resolvedTextTransform}
                        zIndex={zIndex}
                      >
                        <span
                          className={`shader-lab-v2-layer-text ${target === 'logo' || target === 'both' ? 'shader-lab-v2-layer-text-material' : ''}`}
                          style={{
                            fontSize: `${textFontSizeCqw}cqw`,
                            fontWeight: textWeight,
                            letterSpacing: `${textTracking}em`,
                            lineHeight: textLineHeight,
                            overflowWrap: textWrap === 'wrap' ? 'anywhere' : 'normal',
                            textAlign,
                            whiteSpace: textWrap === 'wrap' ? 'pre-wrap' : 'pre',
                            ...(target === 'logo' || target === 'both' ? { backgroundImage: `url("${shaderPreviewAssetPath(materialId)}")` } : {}),
                          }}
                        >
                          {textValue || identity.shortName}
                        </span>
                      </EditableCanvasLayer>
                    );
                  }
                  const asset = compositionAssets.find(({ id }) => id === layerId);
                  if (!asset) return null;
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
                      <img alt='' className='shader-lab-v2-layer-image' src={asset.url} />
                    </EditableCanvasLayer>
                  );
                })}
                <div className='shader-lab-v2-stage-shade' aria-hidden='true' />
              </div>
            </div>
          </CanvasViewport>
          <div className='shader-lab-v2-stage-meta'>
            <span>{material.name}</span>
            <span>{ratioOption.label}</span>
          </div>
        </main>

        <aside className='shader-lab-v2-inspector' aria-label='Shader controls'>
          <section className='shader-lab-v2-inspector-intro'>
            <div>
              <span>{material.engine}</span>
              <h2>{material.name}</h2>
            </div>
            <button
              aria-label='Reset shader settings'
              onClick={() => {
                setSettings(shaderLabSettingsFor(materialId, initialSettings));
                setShaderSize(1);
              }}
              title='Reset shader'
              type='button'
            ><RotateCcw aria-hidden='true' /></button>
            <p>{material.description}</p>
            {material.sourceUrl ? (
              <a href={material.sourceUrl} rel='noreferrer' target='_blank'>{material.sourceLabel ?? 'View source'}<ExternalLink aria-hidden='true' /></a>
            ) : null}
          </section>

          <section className='shader-lab-v2-control-section'>
            <div className='shader-lab-v2-section-title'><h3>Color</h3><span>3 stops</span></div>
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
                  onClick={() => setSettings((current) => ({ ...current, colorA: palette.colors[0], colorB: palette.colors[1], colorC: palette.colors[2] }))}
                  title={palette.name}
                  type='button'
                >
                  {palette.colors.map((color) => <i key={color} style={{ background: color }} />)}
                </button>
              ))}
            </div>
          </section>

          <section className='shader-lab-v2-control-section'>
            <div className='shader-lab-v2-section-title'><h3>Tune</h3><span>Essentials</span></div>
            <div className='shader-lab-v2-ranges'>
              <RangeControl
                label='Shader size'
                max={3}
                min={0.25}
                onChange={setShaderSize}
                step={0.05}
                value={shaderSize}
              />
              {isPaperLiveMaterialId(materialId) ? (
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
                  key={control.key}
                  onChange={(value) => updateSetting(control.key, value)}
                  value={settings[control.key]}
                />
              ))}
            </div>
          </section>

          <section className='shader-lab-v2-control-section'>
            <div className='shader-lab-v2-section-title'><h3>Composition</h3><span>{visibleLayerIds.length} layers</span></div>
            <input accept='image/*' className='sr-only' onChange={(event) => selectLogo(event.target.files?.[0])} ref={logoInputRef} type='file' />
            <input accept='image/*' className='sr-only' multiple onChange={(event) => addAssets(event.target.files)} ref={assetInputRef} type='file' />
            <div className='shader-lab-v2-content-modes' aria-label='Primary content'>
              {([
                ['logo', 'Mark'],
                ['text', 'Text'],
                ['both', 'Both'],
                ['none', 'None'],
              ] as const).map(([value, label]) => (
                <button aria-pressed={contentMode === value} key={value} onClick={() => setContentMode(value)} type='button'>{label}</button>
              ))}
            </div>
            {contentMode === 'text' || contentMode === 'both' ? (
              <>
                <label className='shader-lab-v2-text-input'>
                  <Type aria-hidden='true' />
                  <textarea aria-label='Canvas text' maxLength={280} onChange={(event) => setTextValue(event.target.value)} placeholder='Type something' rows={2} value={textValue} />
                </label>
                <div aria-label='Typography' className='shader-lab-v2-text-controls'>
                  <div className='shader-lab-v2-text-options'>
                    <span>Wrap</span>
                    <div>
                      {(['wrap', 'nowrap'] as const).map((value) => (
                        <button aria-pressed={textWrap === value} key={value} onClick={() => setTextWrap(value)} type='button'>
                          {value === 'wrap' ? 'On' : 'Off'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className='shader-lab-v2-text-options'>
                    <span>Align</span>
                    <div>
                      {(['left', 'center', 'right'] as const).map((value) => (
                        <button aria-pressed={textAlign === value} key={value} onClick={() => setTextAlign(value)} type='button'>
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
                    onChange={(scale) => setTextTransform((current) => ({ ...current, scale }))}
                    step={0.05}
                    value={textTransform.scale}
                  />
                  <RangeControl
                    formatValue={(value) => value.toFixed(2)}
                    label='Line height'
                    max={1.8}
                    min={0.7}
                    onChange={setTextLineHeight}
                    step={0.05}
                    value={textLineHeight}
                  />
                  <RangeControl
                    label='Weight'
                    max={900}
                    min={300}
                    onChange={setTextWeight}
                    step={50}
                    value={textWeight}
                  />
                  <RangeControl
                    formatValue={(value) => `${value.toFixed(2)}em`}
                    label='Tracking'
                    max={0.2}
                    min={-0.12}
                    onChange={setTextTracking}
                    step={0.01}
                    value={textTracking}
                  />
                </div>
              </>
            ) : null}
            <div className='shader-lab-v2-logo-row'>
              <Button className='flex-1' onClick={() => logoInputRef.current?.click()} size='sm' type='button' variant='outline'><ImagePlus aria-hidden='true' />{customLogo ? 'Replace mark' : 'Upload mark'}</Button>
              {customLogo ? <Button aria-label='Use brand logo' onClick={clearLogo} size='icon-sm' type='button' variant='ghost'><X aria-hidden='true' /></Button> : null}
            </div>
            {customLogo ? <p className='truncate text-xs text-muted-foreground'>{customLogo.name}</p> : null}
            <Button className='w-full' onClick={() => assetInputRef.current?.click()} size='sm' type='button' variant='outline'><ImagePlus aria-hidden='true' />Add image assets</Button>

            <div className='shader-lab-v2-layer-list' aria-label='Canvas layers'>
              {[...listedLayerIds].reverse().map((layerId) => {
                const orderIndex = layerOrder.indexOf(layerId);
                const layerVisible = layerId === 'logo' || layerId === 'text'
                  ? primaryLayerIsVisible(layerId)
                  : true;
                return (
                  <div aria-selected={selectedLayerId === layerId} data-visible={layerVisible} key={layerId}>
                    <button className='shader-lab-v2-layer-select' onClick={() => setSelectedLayerId(layerId)} title={layerLabel(layerId)} type='button'>
                      <span>{layerId === 'text' ? <Type aria-hidden='true' /> : <ImagePlus aria-hidden='true' />}</span>
                      <strong>{layerLabel(layerId)}</strong>
                    </button>
                    {layerId === 'logo' || layerId === 'text' ? (
                      <button
                        aria-label={`${layerVisible ? 'Hide' : 'Show'} ${layerLabel(layerId)}`}
                        aria-pressed={layerVisible}
                        onClick={() => togglePrimaryLayer(layerId)}
                        title={`${layerVisible ? 'Hide' : 'Show'} ${layerLabel(layerId)}`}
                        type='button'
                      >
                        {layerVisible ? <Eye aria-hidden='true' /> : <EyeOff aria-hidden='true' />}
                      </button>
                    ) : null}
                    <button aria-label={`Move ${layerLabel(layerId)} forward`} disabled={orderIndex === layerOrder.length - 1} onClick={() => moveLayer(layerId, 1)} type='button'><ArrowUp aria-hidden='true' /></button>
                    <button aria-label={`Move ${layerLabel(layerId)} backward`} disabled={orderIndex === 0} onClick={() => moveLayer(layerId, -1)} type='button'><ArrowDown aria-hidden='true' /></button>
                    {layerId.startsWith('asset-') ? <button aria-label={`Delete ${layerLabel(layerId)}`} onClick={() => removeAsset(layerId)} type='button'><Trash2 aria-hidden='true' /></button> : null}
                  </div>
                );
              })}
            </div>
            {selectedLayerId === 'logo' ? <Button className='mt-2 w-full' onClick={() => setLogoTransform(DEFAULT_LAYER_TRANSFORM)} size='sm' type='button' variant='ghost'><RotateCcw aria-hidden='true' />Reset mark position</Button> : null}
            {selectedLayerId === 'text' ? <Button className='mt-2 w-full' onClick={() => setTextTransform(DEFAULT_TEXT_LAYER_TRANSFORM)} size='sm' type='button' variant='ghost'><RotateCcw aria-hidden='true' />Reset text box</Button> : null}
          </section>

          <details className='shader-lab-v2-advanced'>
            <summary>Advanced <ChevronDown aria-hidden='true' /></summary>
            <div className='shader-lab-v2-ranges'>
              {ADVANCED_CONTROLS.map((control) => (
                <RangeControl {...control} key={control.key} onChange={(value) => updateSetting(control.key, value)} value={settings[control.key]} />
              ))}
            </div>
          </details>

          <section className='shader-lab-v2-handoff'>
            <Code2 aria-hidden='true' />
            <div><strong>Developer handoff</strong><span>Material ID + exact uniforms</span></div>
            <button onClick={() => void copySetup()} type='button'>{copied ? <Check aria-hidden='true' /> : 'Copy'}</button>
          </section>
        </aside>
      </div>
    </div>
  );
}
