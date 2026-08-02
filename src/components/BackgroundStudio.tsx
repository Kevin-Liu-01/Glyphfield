'use client';

import { useMemo, useRef, useState } from 'react';
import { T, useGT } from 'gt-next';
import { Download, ImagePlus } from 'lucide-react';

import CanvasViewport from '@/components/CanvasViewport';
import AssetConversionLibrary from '@/components/AssetConversionLibrary';
import CanvasLayerPanel from '@/components/CanvasLayerPanel';
import EditableCanvasLayer, { alignCanvasLayer, type CanvasLayerTransform } from '@/components/EditableCanvasLayer';
import LogoAppearanceControls from '@/components/LogoAppearanceControls';
import LogoAppearancePreview from '@/components/LogoAppearancePreview';
import MaterialPalettePresets from '@/components/MaterialPalettePresets';
import ResizableSidebar from '@/components/ResizableSidebar';
import SourceCodeDrawer, { SourceCodeButton } from '@/components/SourceCodeDrawer';
import StickerFinishControls from '@/components/StickerFinishControls';
import SurfaceGallery from '@/components/SurfaceGallery';
import { Button } from '@/components/ui/Button';
import ColorControl from '@/components/ui/ColorControl';
import StudioSelect from '@/components/ui/StudioSelect';
import { useMountEffect } from '@/hooks/useMountEffect';
import { useConvertedAssets } from '@/hooks/useConvertedAssets';
import { useStudioDraft } from '@/hooks/usePersistentState';
import {
  BACKGROUND_GRADIENT_DEFAULTS,
  BACKGROUND_PRESETS,
  DEFAULT_BACKGROUND_SETTINGS,
  buildBackgroundSvg,
  type BackgroundDitherShape,
  type BackgroundGradient,
  type BackgroundPattern,
  type BackgroundSettings,
  type BackgroundStyle,
  type SurfaceMaterial,
} from '@/lib/backgroundSvg';
import { brandAssetPath, type BrandIdentity } from '@/lib/brandIdentity';
import { downloadSvgAsPng, imageUrlToDataUrl } from '@/lib/download';
import { brandMaterialPalette } from '@/lib/liveMaterials';
import { DEFAULT_LOGO_APPEARANCE, type LogoAppearanceSettings } from '@/lib/logoAppearance';
import type { StudioTool } from '@/lib/studioCatalog';
import {
  buildSurfaceStickerSvg,
  DEFAULT_STICKER_FINISH,
  normalizeStickerFinish,
  type StickerFinishSettings,
} from '@/lib/surfaceSticker';
import {
  parseSourceObject,
  sourceBoolean,
  sourceNumber,
  sourceObject,
  sourceString,
  stringifySource,
} from '@/lib/sourceCode';

const SIZE_PRESETS = [
  { height: 630, id: 'og', label: 'OpenGraph', width: 1200 },
  { height: 1000, id: 'wide', label: 'Wide', width: 1600 },
  { height: 1200, id: 'square', label: 'Square', width: 1200 },
] as const;

function RangeControl({
  label,
  max,
  min,
  onChange,
  step = 1,
  suffix,
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step?: number;
  suffix: string;
  value: number;
}) {
  return (
    <label className='flex flex-col gap-2 text-sm text-muted-foreground'>
      <span className='flex items-center justify-between gap-3'>
        <span>{label}</span>
        <span className='font-mono text-xs'>{value}{suffix}</span>
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

export default function BackgroundStudio({
  identity,
  tool,
}: {
  identity: BrandIdentity;
  tool: StudioTool;
}) {
  const gt = useGT();
  const convertedAssetLibrary = useConvertedAssets();
  const defaultPalette = useMemo(() => brandMaterialPalette(identity), [identity]);
  const customLogoRef = useRef<{ name: string; url: string } | null>(null);
  const [customLogo, setCustomLogo] = useState<{ name: string; url: string } | null>(null);
  const [showLogo, setShowLogo] = useStudioDraft(identity.id, tool.id, 'show-logo', true);
  const [application, setApplication] = useStudioDraft<'background' | 'sticker'>(
    identity.id,
    tool.id,
    'surface-application-v1',
    'background'
  );
  const [stickerFinish, setStickerFinish] = useStudioDraft<StickerFinishSettings>(
    identity.id,
    tool.id,
    'sticker-finish-v1',
    DEFAULT_STICKER_FINISH
  );
  const [logoAppearance, setLogoAppearance] = useStudioDraft<LogoAppearanceSettings>(identity.id, tool.id, 'logo-appearance', DEFAULT_LOGO_APPEARANCE);
  const [logoSelected, setLogoSelected] = useState(false);
  const availableBrandAssets = [...identity.assets, ...identity.proofAssets].filter(
    (asset) => !asset.path.toLocaleLowerCase().endsWith('.pdf')
  );
  const [brandAssetId, setBrandAssetId] = useStudioDraft(
    identity.id,
    tool.id,
    'brand-asset-id',
    'none'
  );
  const [convertedAssetId, setConvertedAssetId] = useStudioDraft(
    identity.id,
    tool.id,
    'converted-asset-id-v1',
    'none'
  );
  const [brandAssetOpacity, setBrandAssetOpacity] = useStudioDraft(
    identity.id,
    tool.id,
    'brand-asset-opacity',
    58
  );
  const [brandAssetFit, setBrandAssetFit] = useStudioDraft<'contain' | 'cover'>(
    identity.id,
    tool.id,
    'brand-asset-fit',
    'cover'
  );
  const [exporting, setExporting] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [storedSettings, setStoredSettings] = useStudioDraft<BackgroundSettings>(
    identity.id,
    tool.id,
    'settings',
    () => ({
      ...DEFAULT_BACKGROUND_SETTINGS,
      colorA: defaultPalette.colors[0],
      colorB: defaultPalette.colors[1],
      colorC: defaultPalette.colors[2],
    })
  );
  const settings = {
    ...DEFAULT_BACKGROUND_SETTINGS,
    ...storedSettings,
    style: storedSettings.style === 'live-shader'
      ? 'grain-gradient' as const
      : storedSettings.style ?? DEFAULT_BACKGROUND_SETTINGS.style,
  };
  const backgroundPresets = useMemo(
    () => [
      {
        category: 'Brand',
        description: defaultPalette.description,
        id: defaultPalette.id,
        name: defaultPalette.name,
        settings: {
          colorA: defaultPalette.colors[0],
          colorB: defaultPalette.colors[1],
          colorC: defaultPalette.colors[2],
        },
      },
      ...BACKGROUND_PRESETS,
    ],
    [defaultPalette]
  );
  const selectedSizePreset = SIZE_PRESETS.find(
    ({ height, width }) => height === settings.height && width === settings.width
  );
  const selectedBackgroundPreset = backgroundPresets.find(({ settings: preset }) =>
    Object.entries(preset).every(([key, value]) => settings[key as keyof BackgroundSettings] === value)
  );
  const sizeOptions = [
    ...(selectedSizePreset
      ? []
      : [{ id: 'custom', label: `Custom · ${settings.width} × ${settings.height}` }]),
    ...SIZE_PRESETS.map((preset) => ({
      id: preset.id,
      label: `${preset.label} · ${preset.width} × ${preset.height}`,
    })),
  ];
  const identityLogo = brandAssetPath(
    identity,
    settings.logoTone === 'white' ? 'mark-light' : 'mark-dark'
  );
  const selectedConvertedAsset = convertedAssetLibrary.assets.find(({ id }) => id === convertedAssetId);
  const logoPath = customLogo?.url ?? (application === 'sticker' ? selectedConvertedAsset?.convertedDataUrl : undefined) ?? identityLogo;
  const selectedBrandAsset = availableBrandAssets.find(({ id }) => id === brandAssetId);
  const selectedSurfaceAssetPath = selectedConvertedAsset?.convertedDataUrl ?? selectedBrandAsset?.path;
  const previewSvg = useMemo(
    () =>
      application === 'sticker'
        ? buildSurfaceStickerSvg(settings, {
            finish: stickerFinish,
            logo: showLogo ? logoPath : undefined,
            name: identity.shortName,
          })
        : buildBackgroundSvg(
            settings,
            {
              asset: selectedSurfaceAssetPath,
              assetFit: brandAssetFit,
              assetOpacity: brandAssetOpacity,
              logo: showLogo ? logoPath : undefined,
              logoAppearance: { ...DEFAULT_LOGO_APPEARANCE, ...logoAppearance },
              name: identity.shortName,
              showLogo: false,
            }
          ),
    [application, brandAssetFit, brandAssetOpacity, identity.shortName, logoAppearance, logoPath, selectedSurfaceAssetPath, settings, showLogo, stickerFinish]
  );

  customLogoRef.current = customLogo;
  useMountEffect(
    () => () => {
      if (customLogoRef.current) URL.revokeObjectURL(customLogoRef.current.url);
    }
  );

  function updateSettings(patch: Partial<BackgroundSettings>) {
    setStoredSettings((current) => ({ ...current, ...patch }));
  }

  function applySurfacePreset(preset: Partial<BackgroundSettings>) {
    setStoredSettings((current) => ({
      ...DEFAULT_BACKGROUND_SETTINGS,
      ...preset,
      height: current.height,
      logoColor: current.logoColor,
      logoOpacity: current.logoOpacity,
      logoScale: current.logoScale,
      logoTone: current.logoTone,
      logoX: current.logoX,
      logoY: current.logoY,
      width: current.width,
    }));
  }

  function applySurfaceSource(source: string) {
    const parsed = parseSourceObject(source);
    const nextSettings = sourceObject(parsed, 'settings');
    const nextAppearance = sourceObject(parsed, 'logoAppearance');
    const nextStickerFinish = sourceObject(parsed, 'stickerFinish');
    const nextApplication = sourceString(parsed, 'application', application);
    if (!['background', 'sticker'].includes(nextApplication)) {
      throw new TypeError('Surface application must be background or sticker.');
    }
    const nextFit = sourceString(parsed, 'brandAssetFit', brandAssetFit);
    if (!['contain', 'cover'].includes(nextFit)) {
      throw new TypeError('Brand asset fit must be contain or cover.');
    }
    const nextOpacity = sourceNumber(parsed, 'brandAssetOpacity', brandAssetOpacity);
    if (nextOpacity < 0 || nextOpacity > 100) {
      throw new RangeError('Brand asset opacity must be between 0 and 100.');
    }

    if (nextSettings) {
      const nextStyle = sourceString(nextSettings, 'style', settings.style);
      if (!['gradient', 'grain-gradient', 'dither', 'pattern'].includes(nextStyle)) {
        throw new TypeError('Surface Lab supports static gradient, grain, dither, pattern, and physical-material recipes. Use Shaders for live motion.');
      }
      const nextSurfaceMaterial = sourceString(nextSettings, 'surfaceMaterial', settings.surfaceMaterial);
      if (!['none', 'kerf-wood', 'woven-wire', 'perforated-metal', 'carved-stone', 'embossed-paper', 'brushed-metal', 'hammered-foil', 'corrugated-polymer', 'cork-composite', 'frosted-glass'].includes(nextSurfaceMaterial)) {
        throw new TypeError('Surface material must be a supported physical Surface Lab structure.');
      }
      setStoredSettings((current) => ({
        ...current,
        ...nextSettings,
        style: nextStyle as BackgroundStyle,
        surfaceMaterial: nextSurfaceMaterial as SurfaceMaterial,
      } as BackgroundSettings));
    }
    if (nextAppearance) {
      setLogoAppearance((current) => ({
        ...current,
        ...nextAppearance,
      } as LogoAppearanceSettings));
    }
    if (nextStickerFinish) {
      setStickerFinish(normalizeStickerFinish(nextStickerFinish));
    }
    setApplication(nextApplication as 'background' | 'sticker');
    setShowLogo(sourceBoolean(parsed, 'showLogo', showLogo));
    setBrandAssetId(sourceString(parsed, 'brandAssetId', brandAssetId));
    setConvertedAssetId(sourceString(parsed, 'convertedAssetId', convertedAssetId));
    setBrandAssetOpacity(nextOpacity);
    setBrandAssetFit(nextFit as 'contain' | 'cover');
    setLogoSelected(false);
  }

  function selectCustomLogo(file: File) {
    if (customLogoRef.current) URL.revokeObjectURL(customLogoRef.current.url);
    const nextLogo = { name: file.name, url: URL.createObjectURL(file) };
    customLogoRef.current = nextLogo;
    setCustomLogo(nextLogo);
    setShowLogo(true);
  }

  async function exportPng() {
    setExporting(true);
    try {
      const [embeddedLogo, embeddedBrandAsset] = await Promise.all([
        showLogo && logoPath ? imageUrlToDataUrl(logoPath) : undefined,
        selectedSurfaceAssetPath ? imageUrlToDataUrl(selectedSurfaceAssetPath) : undefined,
      ]);
      const svg = application === 'sticker'
        ? buildSurfaceStickerSvg(settings, {
            finish: stickerFinish,
            logo: showLogo ? embeddedLogo : undefined,
            name: identity.shortName,
          })
        : buildBackgroundSvg(
            settings,
            {
              asset: embeddedBrandAsset,
              assetFit: brandAssetFit,
              assetOpacity: brandAssetOpacity,
              logo: showLogo ? embeddedLogo : undefined,
              logoAppearance: { ...DEFAULT_LOGO_APPEARANCE, ...logoAppearance },
              name: identity.shortName,
              showLogo,
            }
          );
      await downloadSvgAsPng(
        svg,
        settings.width,
        settings.height,
        `${identity.id}-${settings.style}-${application}-${settings.width}x${settings.height}.png`
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className='tool-shell h-full min-h-0'>
      <header className='app-navbar tool-header flex items-center justify-between gap-4 border-b border-border px-5'>
        <div className='min-w-0'>
          <p className='text-lg font-semibold tracking-tight'>{tool.name}</p>
          <p className='truncate text-sm text-muted-foreground'>{tool.description}</p>
        </div>
        <div className='flex shrink-0 items-center gap-2'>
          <SourceCodeButton onClick={() => setSourceOpen(true)} />
          <Button loading={exporting} onClick={exportPng} type='button'>
            <Download aria-hidden='true' />
            <T>Download PNG</T>
          </Button>
        </div>
      </header>

      <div className='tool-body'>
        <ResizableSidebar
          className='tool-inspector min-h-0 border-r border-border bg-background'
          label={gt(`${tool.name} controls`)}
          storageKey={`tool-${tool.id}`}
        >
          <section className='flex flex-col gap-4 border-b border-border p-5'>
            <div>
              <h2 className='text-sm font-semibold'><T>Surface gallery</T></h2>
              <p className='mt-1 text-xs leading-5 text-muted-foreground'><T>Physical materials, static shader fields, gradients, papers, print textures, and films. Every recipe exports as SVG or PNG without a live shader.</T></p>
            </div>
            <div className='grid grid-cols-2 border border-border'>
              {(['background', 'sticker'] as const).map((value) => (
                <button
                  className={`min-h-10 px-3 text-sm ${application === value ? 'bg-foreground text-background' : 'bg-background text-foreground hover:bg-muted'} ${value === 'sticker' ? 'border-l border-border' : ''}`}
                  key={value}
                  onClick={() => setApplication(value)}
                  type='button'
                >
                  {value === 'background' ? <T>Background</T> : <T>Sticker</T>}
                </button>
              ))}
            </div>
            <SurfaceGallery
              onSelect={(preset) => applySurfacePreset(preset.settings)}
              presets={backgroundPresets}
              selectedId={selectedBackgroundPreset?.id}
            />
            <p className='text-xs leading-5 text-muted-foreground'>
              {selectedBackgroundPreset?.description ?? <T>Custom surface recipe.</T>}
            </p>
          </section>

          <section className='flex flex-col gap-4 border-b border-border p-5'>
            <div>
              <h2 className='text-sm font-semibold'><T>Physical material</T></h2>
              <p className='mt-1 text-xs leading-5 text-muted-foreground'><T>Shape the surface itself: relief, reflectivity, tooth, scale, and open area remain editable and export as deterministic SVG.</T></p>
            </div>
            <div className='flex flex-col gap-2 text-sm text-muted-foreground'>
              <T>Material structure</T>
              <StudioSelect
                ariaLabel={gt('Material structure')}
                onValueChange={(value) => updateSettings({ surfaceMaterial: value as SurfaceMaterial })}
                options={[
                  { label: gt('None / smooth'), value: 'none' },
                  { label: gt('Kerf-cut wood'), value: 'kerf-wood' },
                  { label: gt('Woven wire mesh'), value: 'woven-wire' },
                  { label: gt('Perforated metal'), value: 'perforated-metal' },
                  { label: gt('Carved stone'), value: 'carved-stone' },
                  { label: gt('Embossed paper'), value: 'embossed-paper' },
                  { label: gt('Brushed metal'), value: 'brushed-metal' },
                  { label: gt('Hammered foil'), value: 'hammered-foil' },
                  { label: gt('Corrugated polymer'), value: 'corrugated-polymer' },
                  { label: gt('Cork composite'), value: 'cork-composite' },
                  { label: gt('Frosted glass'), value: 'frosted-glass' },
                ]}
                value={settings.surfaceMaterial}
              />
            </div>
            {settings.surfaceMaterial !== 'none' ? (
              <div className='grid gap-4'>
                <div className='grid grid-cols-2 gap-3 border border-border bg-muted/30 p-3'>
                  <div>
                    <p className='font-mono text-[10px] uppercase tracking-wider text-muted-foreground'><T>Height</T></p>
                    <p className='mt-1 text-sm font-medium'>{settings.surfaceDepth}%</p>
                  </div>
                  <div>
                    <p className='font-mono text-[10px] uppercase tracking-wider text-muted-foreground'><T>Response</T></p>
                    <p className='mt-1 text-sm font-medium'>{settings.surfaceMetallic > 55 ? <T>Reflective</T> : <T>Diffuse</T>}</p>
                  </div>
                </div>
                <RangeControl label={gt('Relief depth')} max={100} min={0} onChange={(surfaceDepth) => updateSettings({ surfaceDepth })} suffix='%' value={settings.surfaceDepth} />
                <RangeControl label={gt('Physical scale')} max={140} min={12} onChange={(surfaceScale) => updateSettings({ surfaceScale })} suffix='px' value={settings.surfaceScale} />
                <RangeControl label={gt('Orientation')} max={180} min={0} onChange={(surfaceAngle) => updateSettings({ surfaceAngle })} suffix='°' value={settings.surfaceAngle} />
                <RangeControl label={gt('Roughness')} max={100} min={0} onChange={(surfaceRoughness) => updateSettings({ surfaceRoughness })} suffix='%' value={settings.surfaceRoughness} />
                <RangeControl label={gt('Metallic response')} max={100} min={0} onChange={(surfaceMetallic) => updateSettings({ surfaceMetallic })} suffix='%' value={settings.surfaceMetallic} />
                <RangeControl label={gt('Open area / porosity')} max={92} min={0} onChange={(surfaceOpenArea) => updateSettings({ surfaceOpenArea })} suffix='%' value={settings.surfaceOpenArea} />
              </div>
            ) : null}
          </section>

          <section className='flex flex-col gap-4 border-b border-border p-5'>
            <div>
              <h2 className='text-sm font-semibold'><T>Tune surface</T></h2>
              <p className='mt-1 text-xs leading-5 text-muted-foreground'><T>Refine the selected recipe without losing its static, exportable construction.</T></p>
            </div>
            <div className='flex flex-col gap-2 text-sm text-muted-foreground'>
              <T>Recipe</T>
              <StudioSelect
                ariaLabel={gt('Recipe')}
                onValueChange={(value) => {
                  const style = value as BackgroundStyle;
                  updateSettings({
                    style,
                    ...(style === 'pattern' && settings.pattern === 'none'
                      ? { pattern: 'dots' as const }
                      : {}),
                  });
                }}
                options={[
                  { label: gt('Gradient'), value: 'gradient' },
                  { label: gt('Grainy gradient'), value: 'grain-gradient' },
                  { label: gt('Ordered dither'), value: 'dither' },
                  { label: gt('Pattern field'), value: 'pattern' },
                ]}
                value={settings.style}
              />
            </div>
            <div className='flex flex-col gap-2 text-sm text-muted-foreground'>
              <T>Gradient</T>
              <StudioSelect
                ariaLabel={gt('Gradient')}
                disabled={settings.style === 'dither' || settings.style === 'pattern'}
                onValueChange={(value) => {
                  const gradient = value as BackgroundGradient;
                  updateSettings({ gradient, ...BACKGROUND_GRADIENT_DEFAULTS[gradient] });
                }}
                options={[
                  { label: gt('Linear'), value: 'linear' },
                  { label: gt('Radial'), value: 'radial' },
                  { label: gt('Soft mesh'), value: 'bloom' },
                  { label: gt('Bands'), value: 'mesh' },
                  { label: gt('Orbit'), value: 'orbit' },
                  { label: gt('Wave'), value: 'wave' },
                ]}
                value={settings.gradient}
              />
            </div>
            <div className='grid gap-3'>
                <MaterialPalettePresets
                  identity={identity}
                  onSelect={([colorA, colorB, colorC]) => updateSettings({ colorA, colorB, colorC })}
                  value={[settings.colorA, settings.colorB, settings.colorC]}
                />
                {([
                  ['colorA', 'Color A'],
                  ['colorB', 'Color B'],
                  ['colorC', 'Color C'],
                ] as const).map(([key, label]) => (
                  <ColorControl
                    ariaLabel={gt(label)}
                    key={key}
                    label={gt(label)}
                    onChange={(value) => updateSettings({ [key]: value })}
                    value={settings[key]}
                  />
                ))}
            </div>
            <RangeControl label={gt('Angle')} max={180} min={0} onChange={(angle) => updateSettings({ angle })} suffix='°' value={settings.angle} />
            {['radial', 'orbit'].includes(settings.gradient) ? (
              <div className='grid grid-cols-2 gap-3'>
                <RangeControl label={gt('Focus X')} max={100} min={0} onChange={(focalX) => updateSettings({ focalX })} suffix='%' value={settings.focalX} />
                <RangeControl label={gt('Focus Y')} max={100} min={0} onChange={(focalY) => updateSettings({ focalY })} suffix='%' value={settings.focalY} />
              </div>
            ) : null}
            {settings.gradient === 'mesh' ? (
              <div className='grid gap-3'>
                <label className='flex items-center justify-between gap-4 text-sm'>
                  <T>Band lighting</T>
                  <input
                    aria-label={gt('Band lighting')}
                    checked={settings.lightingEnabled}
                    onChange={(event) => updateSettings({ lightingEnabled: event.target.checked })}
                    type='checkbox'
                  />
                </label>
                <RangeControl label={gt('Peak position')} max={95} min={5} onChange={(focalX) => updateSettings({ focalX })} suffix='%' value={settings.focalX} />
                <RangeControl label={gt('Band count')} max={24} min={3} onChange={(bandCount) => updateSettings({ bandCount })} suffix='' value={settings.bandCount} />
                <RangeControl label={gt('Band depth')} max={100} min={0} onChange={(bandDepth) => updateSettings({ bandDepth })} suffix='%' value={settings.bandDepth} />
                <RangeControl label={gt('Band gap')} max={32} min={0} onChange={(bandGap) => updateSettings({ bandGap })} suffix='px' value={settings.bandGap} />
              </div>
            ) : null}
            {['wave', 'orbit'].includes(settings.gradient) ? (
              <RangeControl label={gt('Relief')} max={80} min={0} onChange={(relief) => updateSettings({ relief })} suffix='%' value={settings.relief} />
            ) : null}
            {settings.style === 'grain-gradient' ? (
              <RangeControl label={gt('Grain')} max={70} min={0} onChange={(grain) => updateSettings({ grain })} suffix='%' value={settings.grain} />
            ) : null}
            {settings.style === 'dither' ? (
              <div className='grid gap-3'>
                <div className='flex flex-col gap-2 text-sm text-muted-foreground'>
                  <T>Dither shape</T>
                  <StudioSelect ariaLabel={gt('Dither shape')} onValueChange={(value) => updateSettings({ ditherShape: value as BackgroundDitherShape })} options={[
                    { label: gt('Halftone dots'), value: 'dots' },
                    { label: gt('Pixel squares'), value: 'squares' },
                  ]} value={settings.ditherShape} />
                </div>
                <div className='flex flex-col gap-2 text-sm text-muted-foreground'>
                  <T>Bayer matrix</T>
                  <StudioSelect ariaLabel={gt('Bayer matrix')} onValueChange={(value) => updateSettings({ ditherMatrix: Number(value) as 2 | 4 | 8 })} options={[
                    { label: '2 × 2', value: '2' },
                    { label: '4 × 4', value: '4' },
                    { label: '8 × 8', value: '8' },
                  ]} value={String(settings.ditherMatrix)} />
                </div>
              </div>
            ) : null}
          </section>

          <section className='flex flex-col gap-4 border-b border-border p-5'>
            <h2 className='text-sm font-semibold'><T>Pattern overlay</T></h2>
            <div className='flex flex-col gap-2 text-sm text-muted-foreground'>
              <T>Pattern</T>
              <StudioSelect ariaLabel={gt('Pattern')} onValueChange={(value) => updateSettings({ pattern: value as BackgroundPattern })} options={[
                { label: gt('None'), value: 'none' },
                { label: gt('Dots'), value: 'dots' },
                { label: gt('Lines'), value: 'lines' },
                { label: gt('Grid'), value: 'grid' },
                { label: gt('Paper fibers'), value: 'fibers' },
                { label: gt('Pulp speckles'), value: 'speckles' },
                { label: gt('Topographic'), value: 'topographic' },
                { label: gt('Crosshatch'), value: 'crosshatch' },
              ]} value={settings.pattern} />
            </div>
            <RangeControl label={gt('Spacing')} max={72} min={8} onChange={(spacing) => updateSettings({ spacing })} suffix='px' value={settings.spacing} />
            <RangeControl label={gt('Opacity')} max={100} min={0} onChange={(patternOpacity) => updateSettings({ patternOpacity })} suffix='%' value={settings.patternOpacity} />
          </section>

          {application === 'sticker' ? (
            <section className='flex flex-col gap-4 border-b border-border p-5'>
              <div>
                <h2 className='text-sm font-semibold'><T>Sticker finish</T></h2>
                <p className='mt-1 text-xs leading-5 text-muted-foreground'><T>Layer a production-inspired laminate over the selected surface, then tune its light response and die-cut edge.</T></p>
              </div>
              <StickerFinishControls onChange={setStickerFinish} settings={stickerFinish} />
            </section>
          ) : null}

          <section className='flex flex-col gap-4 border-b border-border p-5'>
            <div>
              <h2 className='text-sm font-semibold'><T>Converted artwork</T></h2>
              <p className='mt-1 text-xs leading-5 text-muted-foreground'>
                {application === 'sticker'
                  ? <T>Use a converted asset as the sticker artwork and die-cut silhouette.</T>
                  : <T>Place a converted asset over the static surface recipe.</T>}
              </p>
            </div>
            <AssetConversionLibrary
              compact
              library={convertedAssetLibrary}
              onSelect={(asset) => {
                setConvertedAssetId(asset?.id ?? 'none');
                if (asset) {
                  setBrandAssetId('none');
                  if (application === 'sticker') setShowLogo(true);
                }
              }}
              selectedAssetId={selectedConvertedAsset?.id}
            />
            {selectedConvertedAsset && application === 'background' ? (
              <>
                <StudioSelect
                  ariaLabel={gt('Converted asset fit')}
                  onValueChange={(value) => setBrandAssetFit(value as typeof brandAssetFit)}
                  options={[
                    { label: gt('Cover canvas'), value: 'cover' },
                    { label: gt('Contain asset'), value: 'contain' },
                  ]}
                  value={brandAssetFit}
                />
                <RangeControl label={gt('Asset opacity')} max={100} min={0} onChange={setBrandAssetOpacity} suffix='%' value={brandAssetOpacity} />
              </>
            ) : null}
          </section>

          {application === 'background' ? (
            <section className='flex flex-col gap-4 border-b border-border p-5'>
              <div>
                <h2 className='text-sm font-semibold'><T>Brand asset layer</T></h2>
                <p className='mt-1 text-xs leading-5 text-muted-foreground'>
                  <T>Reuse an image, texture, or field from this identity.</T>
                </p>
              </div>
              <StudioSelect
                ariaLabel={gt('Brand asset layer')}
                onValueChange={(value) => {
                  setBrandAssetId(value);
                  if (value !== 'none') setConvertedAssetId('none');
                }}
                options={[
                  { label: gt('None'), value: 'none' },
                  ...availableBrandAssets.map((asset) => ({
                    label: `${asset.label} · ${asset.type}`,
                    value: asset.id,
                  })),
                ]}
                value={selectedBrandAsset?.id ?? 'none'}
              />
              {selectedBrandAsset ? (
                <>
                  <StudioSelect
                    ariaLabel={gt('Brand asset fit')}
                    onValueChange={(value) => setBrandAssetFit(value as typeof brandAssetFit)}
                    options={[
                      { label: gt('Cover canvas'), value: 'cover' },
                      { label: gt('Contain asset'), value: 'contain' },
                    ]}
                    value={brandAssetFit}
                  />
                  <RangeControl label={gt('Asset opacity')} max={100} min={0} onChange={setBrandAssetOpacity} suffix='%' value={brandAssetOpacity} />
                </>
              ) : null}
            </section>
          ) : null}

          <section className='flex flex-col gap-4 border-b border-border p-5'>
            <div className='flex items-center justify-between gap-4'>
              <h2 className='text-sm font-semibold'>{application === 'sticker' ? <T>Sticker artwork</T> : <T>Logo</T>}</h2>
              <input aria-label={gt('Show logo')} checked={showLogo} onChange={(event) => setShowLogo(event.target.checked)} type='checkbox' />
            </div>
            {application === 'background' ? (
              <>
                <div className='flex gap-2'>
                  {(['white', 'black'] as const).map((tone) => (
                    <Button className='flex-1' key={tone} onClick={() => updateSettings({ logoColor: tone === 'white' ? '#FFFFFF' : '#000000', logoTone: tone })} size='sm' type='button' variant={settings.logoTone === tone ? 'default' : 'outline'}>
                      {tone === 'white' ? <T>White</T> : <T>Black</T>}
                    </Button>
                  ))}
                </div>
                <ColorControl ariaLabel={gt('Custom logo color')} label={<T>Custom logo color</T>} onChange={(logoColor) => updateSettings({ logoColor })} value={settings.logoColor} />
              </>
            ) : (
              <p className='text-xs leading-5 text-muted-foreground'><T>The selected surface becomes the printed artwork inside the die-cut mark.</T></p>
            )}
            <RangeControl label={gt('Logo size')} max={64} min={10} onChange={(logoScale) => updateSettings({ logoScale })} suffix='%' value={settings.logoScale} />
            {application === 'background' ? <RangeControl label={gt('Logo opacity')} max={100} min={0} onChange={(logoOpacity) => updateSettings({ logoOpacity })} suffix='%' value={settings.logoOpacity} /> : null}
            <RangeControl label={gt('Horizontal')} max={50} min={-50} onChange={(logoX) => updateSettings({ logoX })} suffix='%' value={settings.logoX} />
            <RangeControl label={gt('Vertical')} max={50} min={-50} onChange={(logoY) => updateSettings({ logoY })} suffix='%' value={settings.logoY} />
            {application === 'background' ? (
              <>
                <LogoAppearanceControls onChange={(patch) => setLogoAppearance((current) => ({ ...current, ...patch }))} settings={{ ...DEFAULT_LOGO_APPEARANCE, ...logoAppearance }} />
                <CanvasLayerPanel
                  layers={[{ canMoveBackward: false, canMoveForward: false, id: 'logo', label: gt('Logo'), transform: { scale: settings.logoScale / DEFAULT_BACKGROUND_SETTINGS.logoScale, x: (settings.logoX / 100) * settings.width, y: (settings.logoY / 100) * settings.height } }]}
                  onAlign={(alignment) => {
                    const markSize = Math.min(settings.width, settings.height) * (DEFAULT_BACKGROUND_SETTINGS.logoScale / 100);
                    const next = alignCanvasLayer({ scale: settings.logoScale / DEFAULT_BACKGROUND_SETTINGS.logoScale, x: (settings.logoX / 100) * settings.width, y: (settings.logoY / 100) * settings.height }, { baseHeight: markSize, baseWidth: markSize, baseX: (settings.width - markSize) / 2, baseY: (settings.height - markSize) / 2 }, settings.width, settings.height, alignment);
                    updateSettings({ logoX: (next.x / settings.width) * 100, logoY: (next.y / settings.height) * 100 });
                  }}
                  onMove={() => undefined}
                  onReset={() => updateSettings({ logoScale: DEFAULT_BACKGROUND_SETTINGS.logoScale, logoX: 0, logoY: 0 })}
                  onSelect={() => setLogoSelected(true)}
                  selectedLayerId={logoSelected ? 'logo' : null}
                />
              </>
            ) : null}
            <label className='flex min-h-16 cursor-pointer items-center gap-3 border border-dashed border-input p-3 text-sm'>
              <ImagePlus className='size-4 text-muted-foreground' aria-hidden='true' />
              <span className='min-w-0 flex-1'>
                <span className='block font-medium'><T>Use another logo</T></span>
                <span className='block truncate text-xs text-muted-foreground'>{customLogo?.name ?? 'PNG or SVG'}</span>
              </span>
              <input accept='image/png,image/svg+xml' className='sr-only' onChange={(event) => { const file = event.target.files?.[0]; if (file) selectCustomLogo(file); event.target.value = ''; }} type='file' />
            </label>
          </section>

          <section className='flex flex-col gap-4 p-5'>
            <h2 className='text-sm font-semibold'><T>Output</T></h2>
            <StudioSelect
              ariaLabel={gt('Output size')}
              onValueChange={(value) => {
                const preset = SIZE_PRESETS.find(({ id }) => id === value);
                if (preset) updateSettings({ height: preset.height, width: preset.width });
              }}
              options={sizeOptions.map((preset) => ({ label: preset.label, value: preset.id }))}
              value={selectedSizePreset?.id ?? 'custom'}
            />
          </section>
        </ResizableSidebar>

        <div className='tool-canvas min-h-0 overflow-hidden'>
          <CanvasViewport identityId={identity.id} onDeselect={() => setLogoSelected(false)} stageClassName='grid min-h-full place-items-center p-5 sm:p-8' toolId={tool.id}>
          <div className='w-full max-w-5xl'>
            <div
              aria-label={`${identity.name} ${settings.style} ${application} preview`}
              className='artifact-frame artifact-preview relative overflow-hidden bg-white'
              role='img'
              onPointerDown={() => setLogoSelected(false)}
              style={{ aspectRatio: `${settings.width} / ${settings.height}` }}
            >
              <div className='absolute inset-0 size-full [&>svg]:size-full' dangerouslySetInnerHTML={{ __html: previewSvg }} />
              {showLogo && application === 'background' ? (
                <EditableCanvasLayer
                  baseHeight={Math.min(settings.width, settings.height) * (DEFAULT_BACKGROUND_SETTINGS.logoScale / 100)}
                  baseWidth={Math.min(settings.width, settings.height) * (DEFAULT_BACKGROUND_SETTINGS.logoScale / 100)}
                  baseX={(settings.width - Math.min(settings.width, settings.height) * (DEFAULT_BACKGROUND_SETTINGS.logoScale / 100)) / 2}
                  baseY={(settings.height - Math.min(settings.width, settings.height) * (DEFAULT_BACKGROUND_SETTINGS.logoScale / 100)) / 2}
                  canvasHeight={settings.height}
                  canvasWidth={settings.width}
                  label={gt('Logo')}
                  onChange={(next: CanvasLayerTransform) => updateSettings({ logoScale: DEFAULT_BACKGROUND_SETTINGS.logoScale * next.scale, logoX: (next.x / settings.width) * 100, logoY: (next.y / settings.height) * 100 })}
                  onSelect={() => setLogoSelected(true)}
                  selected={logoSelected}
                  transform={{ scale: settings.logoScale / DEFAULT_BACKGROUND_SETTINGS.logoScale, x: (settings.logoX / 100) * settings.width, y: (settings.logoY / 100) * settings.height }}
                  zIndex={3}
                >
                  <LogoAppearancePreview
                    ariaLabel={`${identity.name} logo`}
                    color={settings.logoColor}
                    fallback={<span className='grid size-full place-items-center font-semibold'>{identity.shortName}</span>}
                    logoPath={logoPath}
                    opacity={settings.logoOpacity / 100}
                    settings={{ ...DEFAULT_LOGO_APPEARANCE, ...logoAppearance }}
                  />
                </EditableCanvasLayer>
              ) : null}
            </div>
            <div className='flex flex-wrap items-center justify-between gap-3 border-x border-b border-border bg-background px-4 py-3'>
              <p className='text-sm font-medium'>{selectedBackgroundPreset?.name ?? settings.style.replace('-', ' ')}</p>
              <div className='flex items-center gap-4 text-muted-foreground'>
                <p className='font-mono text-[10px] uppercase tracking-wider'>
                  {application === 'sticker' ? `${stickerFinish.presetId} / ` : ''}SVG layers / {settings.width} × {settings.height}
                </p>
              </div>
            </div>
          </div>
          </CanvasViewport>
        </div>
      </div>
      {sourceOpen ? (
        <SourceCodeDrawer
          format='JSON · surface scene'
          onApply={applySurfaceSource}
          onClose={() => setSourceOpen(false)}
          source={stringifySource({
            application,
            brandAssetFit,
            brandAssetId,
            brandAssetOpacity,
            convertedAssetId,
            logoAppearance,
            stickerFinish,
            settings: {
              ...settings,
              liveMaterialId: undefined,
              liveSettings: undefined,
            },
            showLogo,
          })}
          title={gt('Surface source')}
        />
      ) : null}
    </div>
  );
}
