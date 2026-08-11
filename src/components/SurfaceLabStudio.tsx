'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { T, useGT } from 'gt-next';
import {
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
import LazyLiveMaterialCanvas from '@/components/LazyLiveMaterialCanvas';
import SourceCodeDrawer, { SourceCodeButton } from '@/components/SourceCodeDrawer';
import StickerDeviceScene, {
  type StickerSelection,
  type StickerStudioStageHandle,
} from '@/components/StickerDeviceScene';
import SurfaceMaterialStage from '@/components/SurfaceMaterialStage';
import { Button } from '@/components/ui/Button';
import StudioSelect from '@/components/ui/StudioSelect';
import { useMountEffect } from '@/hooks/useMountEffect';
import { useStudioDraft } from '@/hooks/usePersistentState';
import { DEFAULT_BACKGROUND_SETTINGS, type BackgroundSettings } from '@/lib/backgroundSvg';
import { brandAssetPath, type BrandIdentity } from '@/lib/brandIdentity';
import { downloadBlob } from '@/lib/download';
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
type DesignDock = 'shader' | 'surface' | 'sticker';

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
  const [selectedSticker, setSelectedSticker] = useState<StickerSelection | null>(null);
  const [customArtwork, setCustomArtwork] = useState<{ name: string; url: string } | null>(null);
  const [dock, setDock] = useStudioDraft<DesignDock>(identity.id, tool.id, 'design-lab-dock-v2', 'shader');
  const [surfaceEnabled, setSurfaceEnabled] = useStudioDraft(identity.id, tool.id, 'design-lab-surface-enabled-v1', true);
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
  const selectedOpenSurfaceAsset = getOpenSurfaceAsset(settings.surfaceLibraryAssetId);
  const outputSize = OUTPUT_SIZES.find((size) => size.width === settings.width && size.height === settings.height);
  const aspectRatio = settings.width / settings.height;
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

  function applyShaderPreset(preset: SurfaceLabPreset) {
    if (!preset.liveMaterialId) return;
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
    stickerStageRef.current?.reset();
  }

  function selectCustomArtwork(file: File) {
    if (customArtworkRef.current) URL.revokeObjectURL(customArtworkRef.current.url);
    const next = { name: file.name, url: URL.createObjectURL(file) };
    customArtworkRef.current = next;
    setCustomArtwork(next);
    setArtworkKind('logo');
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
      const liveSurface = surfaceEnabled ? surfaceStageRef.current?.querySelector('canvas') : null;
      if (liveSurface?.width && liveSurface.height) context.drawImage(liveSurface, 0, 0, width, height);
      const composed = await stickerStageRef.current?.exportPng(width, composition);
      downloadBlob(composed ?? await canvasToBlob(composition), `${identity.id}-design-lab-${settings.width}x${settings.height}.png`);
    } finally {
      setExporting(false);
    }
  }

  function applySource(source: string) {
    const parsed = JSON.parse(source) as {
      artworkKind?: ArtworkKind;
      artworkText?: string;
      surfaceEnabled?: boolean;
      surfacePresetId?: string;
      liveMaterialId?: LiveMaterialId;
      liveSettings?: Partial<LiveMaterialSettings>;
      settings?: Partial<BackgroundSettings>;
      stickerFinish?: Partial<StickerFinishSettings>;
    };
    if (parsed.artworkKind && !['logo', 'text', 'asset'].includes(parsed.artworkKind)) throw new TypeError('Artwork kind must be logo, text, or asset.');
    if (parsed.liveMaterialId && !shaderLabMaterials('', 'all').some(({ id }) => id === parsed.liveMaterialId)) throw new TypeError('Unknown Design Lab shader.');
    if (parsed.surfacePresetId && !DESIGN_SURFACE_PRESETS.some(({ id }) => id === parsed.surfacePresetId)) throw new TypeError('Unknown Design Lab surface preset.');
    if (parsed.artworkKind) setArtworkKind(parsed.artworkKind);
    if (typeof parsed.artworkText === 'string') setArtworkText(parsed.artworkText);
    if (typeof parsed.surfaceEnabled === 'boolean') setSurfaceEnabled(parsed.surfaceEnabled);
    if (parsed.surfacePresetId) setSurfacePresetId(parsed.surfacePresetId);
    if (parsed.liveMaterialId) setLiveMaterialId(parsed.liveMaterialId);
    if (parsed.liveSettings) setStoredLiveSettings((current) => ({ ...current, ...parsed.liveSettings }));
    if (parsed.settings) setStoredSettings((current) => ({ ...current, ...parsed.settings }));
    if (parsed.stickerFinish) setStickerDraft(normalizeStickerFinish(parsed.stickerFinish));
  }

  return (
    <div className='tool-shell design-lab h-full min-h-0'>
      <header className='app-navbar tool-header design-lab-header'>
        <div className='design-lab-title'>
          <span><Sparkles aria-hidden='true' /> Design Lab <small>01</small></span>
          <p>Background shader, physical surface, and stickers in one composition.</p>
        </div>
        <div className='design-lab-layer-readout' aria-label={gt('Active design layers')}>
          <span data-active='true'>Shader</span>
          <span data-active={surfaceEnabled ? 'true' : 'false'}>Surface</span>
          <span data-active='true'>Stickers</span>
        </div>
        <div className='flex shrink-0 items-center gap-2'>
          <SourceCodeButton onClick={() => setSourceOpen(true)} />
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
            stageClassName='design-lab-canvas-stage'
            toolId={tool.id}
          >
            <div className='design-lab-composition' style={{ aspectRatio }}>
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
              {surfaceEnabled ? (
                <div className='design-lab-surface-layer' ref={surfaceStageRef}>
                  <SurfaceMaterialStage
                    asset={selectedOpenSurfaceAsset}
                    className='absolute inset-0 size-full'
                    settings={settings}
                    showAttribution={false}
                    transparent
                  />
                </div>
              ) : null}
              <StickerDeviceScene
                aspectRatio={aspectRatio}
                className='design-lab-sticker-layer'
                finish={stickerFinish}
                identity={identity}
                logoPath={artworkUrl}
                onSelectionChange={setSelectedSticker}
                ref={stickerStageRef}
                surface='transparent'
              />
            </div>
          </CanvasViewport>

          <div className='design-lab-dock'>
            <div className='design-lab-dock-tabs' role='tablist' aria-label={gt('Design libraries')}>
              {(['shader', 'surface', 'sticker'] as const).map((value) => (
                <button aria-selected={dock === value} key={value} onClick={() => setDock(value)} role='tab' type='button'>
                  {value === 'shader' ? 'Background' : value === 'sticker' ? 'Stickers' : 'Surface'}
                </button>
              ))}
            </div>
            <div className='design-lab-dock-scroll' data-dock={dock}>
              {dock === 'shader' ? SURFACE_LAB_SHADER_PRESETS.map((preset) => (
                <button
                  aria-pressed={preset.liveMaterialId === liveMaterialId}
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
              )) : null}
              {dock === 'surface' ? DESIGN_SURFACE_PRESETS.map((preset) => (
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
              )) : null}
              {dock === 'sticker' ? (
                <>
                  {stickerAssets.map((asset) => (
                    <button
                      aria-label={`Place ${asset.label}`}
                      className={`design-lab-sticker-asset ${asset.surface === 'light' ? 'is-light' : ''}`}
                      key={asset.id}
                      onClick={() => stickerStageRef.current?.addSticker(asset.id)}
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
                      aria-pressed={stickerFinish.presetId === preset.id}
                      className='design-lab-finish-preset'
                      key={preset.id}
                      onClick={() => setStickerDraft(preset.settings)}
                      style={{ background: preset.swatch }}
                      title={preset.label}
                      type='button'
                    />
                  ))}
                </>
              ) : null}
            </div>
            <button
              className='design-lab-dock-reset'
              onClick={resetActiveLibrary}
              title={gt(dock === 'shader' ? 'Reset background' : dock === 'surface' ? 'Reset surface' : 'Reset stickers')}
              type='button'
            >
              <RotateCcw aria-hidden='true' />
            </button>
          </div>
        </main>

        <aside className='design-lab-inspector' aria-label={gt('Design Lab controls')}>
          <div className='design-lab-inspector-head'>
            <span>Composition stack</span>
            <strong>{shaderPreset?.name ?? 'Custom shader'} + {surfaceEnabled ? surfacePreset.name : 'no surface'}</strong>
            <small>Each control updates the same canvas.</small>
          </div>

          <section className='design-lab-inspector-section'>
            <div className='design-lab-section-title'><div><span>01</span><h2>Background shader</h2></div><small>{shaderPreset?.name ?? 'Custom'}</small></div>
            <div className='design-lab-control-stack'>
              <RangeControl label='Motion' max={1.5} min={0} onChange={(speed) => updateLiveSettings({ speed })} step={0.01} suffix='×' value={liveSettings.speed} />
              <RangeControl label='Warp' max={1.5} min={0} onChange={(strength) => updateLiveSettings({ strength })} step={0.01} suffix='×' value={liveSettings.strength} />
              <RangeControl label='Detail' max={9} min={0.5} onChange={(detail) => updateLiveSettings({ detail })} step={0.1} suffix='' value={liveSettings.detail} />
              <RangeControl label='Texture' max={100} min={0} onChange={(grain) => updateLiveSettings({ grain })} value={liveSettings.grain} />
              <RangeControl label='Light' max={1.6} min={0.35} onChange={(brightness) => updateLiveSettings({ brightness })} step={0.01} suffix='×' value={liveSettings.brightness} />
            </div>
            <div className='design-lab-colors'>
              <ColorControl label='Base' onChange={(colorA) => updateLiveSettings({ colorA })} value={liveSettings.colorA} />
              <ColorControl label='Mid' onChange={(colorB) => updateLiveSettings({ colorB })} value={liveSettings.colorB} />
              <ColorControl label='Light' onChange={(colorC) => updateLiveSettings({ colorC })} value={liveSettings.colorC} />
            </div>
          </section>

          <section className='design-lab-inspector-section' data-disabled={!surfaceEnabled ? 'true' : 'false'}>
            <div className='design-lab-section-title'>
              <div><span>02</span><h2>Sticker surface</h2></div>
              <button aria-label={surfaceEnabled ? gt('Hide surface') : gt('Show surface')} className='design-lab-visibility' onClick={() => setSurfaceEnabled((value) => !value)} type='button'>
                {surfaceEnabled ? <Eye aria-hidden='true' /> : <EyeOff aria-hidden='true' />}
              </button>
            </div>
            <div className='design-lab-control-stack'>
              <RangeControl disabled={!surfaceEnabled} label={surfaceIsCloth ? 'Foil' : 'Texture'} max={100} min={0} onChange={(surfaceTextureAmount) => updateSettings({ surfaceTextureAmount })} value={settings.surfaceTextureAmount} />
              <RangeControl disabled={!surfaceEnabled} label={surfaceIsCloth ? 'Drape' : 'Relief'} max={100} min={0} onChange={(surfaceDepth) => updateSettings({ surfaceDepth })} value={settings.surfaceDepth} />
              <RangeControl disabled={!surfaceEnabled} label={surfaceIsCloth ? 'Sparkle' : 'Irregularity'} max={100} min={0} onChange={(surfaceIrregularity) => updateSettings({ surfaceIrregularity })} value={settings.surfaceIrregularity} />
              <RangeControl disabled={!surfaceEnabled} label={surfaceIsCloth ? 'Roughness' : 'Pattern scale'} max={surfaceIsCloth ? 100 : 140} min={surfaceIsCloth ? 0 : 12} onChange={(value) => updateSettings(surfaceIsCloth ? { surfaceRoughness: value } : { surfaceScale: value })} suffix={surfaceIsCloth ? '%' : 'px'} value={surfaceIsCloth ? settings.surfaceRoughness : settings.surfaceScale} />
              <RangeControl disabled={!surfaceEnabled} label={surfaceIsCloth ? 'Stiffness' : 'Metallic'} max={100} min={0} onChange={(value) => updateSettings(surfaceIsCloth ? { surfaceOpenArea: value } : { surfaceMetallic: value })} value={surfaceIsCloth ? settings.surfaceOpenArea : settings.surfaceMetallic} />
            </div>
          </section>

          <section className='design-lab-inspector-section'>
            <div className='design-lab-section-title'><div><span>03</span><h2>Sticker</h2></div><small>{selectedSticker?.label ?? 'Select on canvas'}</small></div>
            <div className='design-lab-control-stack' aria-disabled={!selectedSticker}>
              <RangeControl disabled={!selectedSticker} label='Size' max={54} min={8} onChange={(scale) => stickerStageRef.current?.updateSelected({ scale })} value={selectedSticker?.scale ?? 24} />
              <RangeControl disabled={!selectedSticker} label='Rotation' max={180} min={-180} onChange={(rotation) => stickerStageRef.current?.updateSelected({ rotation })} suffix='°' value={selectedSticker?.rotation ?? 0} />
              <RangeControl label='Foil' max={100} min={0} onChange={(intensity) => updateSticker({ intensity })} value={stickerFinish.intensity} />
              <RangeControl label='Die-cut edge' max={32} min={2} onChange={(edgeWidth) => updateSticker({ edgeWidth })} suffix='px' value={stickerFinish.edgeWidth} />
              <RangeControl label='Contrast keyline' max={12} min={1} onChange={(seamWidth) => updateSticker({ seamWidth })} suffix='px' value={stickerFinish.seamWidth} />
              <RangeControl label='Relief' max={100} min={0} onChange={(relief) => updateSticker({ relief })} value={stickerFinish.relief} />
            </div>
            <div className='design-lab-selection-actions'>
              <button disabled={!selectedSticker} onClick={() => stickerStageRef.current?.duplicateSelected()} type='button'><Copy aria-hidden='true' /><span>Duplicate</span></button>
              <button disabled={!selectedSticker} onClick={() => stickerStageRef.current?.bringSelectedForward()} type='button'><ArrowUp aria-hidden='true' /><span>Forward</span></button>
              <button disabled={!selectedSticker} onClick={() => stickerStageRef.current?.removeSelected()} type='button'><Trash2 aria-hidden='true' /><span>Delete</span></button>
            </div>
          </section>

          <section className='design-lab-inspector-section'>
            <div className='design-lab-section-title'><div><span>04</span><h2>Artwork source</h2></div><small>Add from dock</small></div>
            <div className='design-lab-artwork-kinds' role='group' aria-label={gt('Artwork type')}>
              {([
                ['logo', ImagePlus, 'Logo'],
                ['text', Type, 'Text'],
                ['asset', Layers3, 'Asset'],
              ] as const).map(([value, Icon, label]) => (
                <button aria-pressed={artworkKind === value} key={value} onClick={() => { setArtworkKind(value); setDock('sticker'); }} type='button'><Icon aria-hidden='true' />{label}</button>
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
              <RangeControl label='Shader frequency' max={12} min={0.5} onChange={(frequency) => updateLiveSettings({ frequency })} step={0.1} suffix='' value={liveSettings.frequency} />
              <RangeControl label='Shader amplitude' max={10} min={0} onChange={(amplitude) => updateLiveSettings({ amplitude })} step={0.1} suffix='' value={liveSettings.amplitude} />
              <RangeControl disabled={!surfaceEnabled} label='Surface direction' max={180} min={0} onChange={(surfaceAngle) => updateSettings({ surfaceAngle })} suffix='°' value={settings.surfaceAngle} />
              <RangeControl label='Foil bands' max={20} min={1} onChange={(bands) => updateSticker({ bands })} suffix='' value={stickerFinish.bands} />
              <RangeControl label='Glint angle' max={180} min={0} onChange={(glintAngle) => updateSticker({ glintAngle })} suffix='°' value={stickerFinish.glintAngle} />
            </div>
          </details>

          <section className='design-lab-inspector-section'>
            <div className='design-lab-section-title'><div><span>05</span><h2>Output</h2></div><small>PNG</small></div>
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
          source={JSON.stringify({ artworkKind, artworkText, liveMaterialId, liveSettings, settings, stickerFinish, surfaceEnabled, surfacePresetId }, null, 2)}
          title='Design Lab recipe'
        />
      ) : null}
    </div>
  );
}
