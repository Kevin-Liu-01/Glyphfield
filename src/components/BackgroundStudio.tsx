'use client';

import { useMemo, useRef, useState, type ReactNode } from 'react';
import { T, useGT } from 'gt-next';
import { Download, ImagePlus } from 'lucide-react';

import CanvasViewport from '@/components/CanvasViewport';
import CanvasLayerPanel from '@/components/CanvasLayerPanel';
import EditableCanvasLayer, { alignCanvasLayer, type CanvasLayerTransform } from '@/components/EditableCanvasLayer';
import LiveMaterialControls from '@/components/LiveMaterialControls';
import LogoAppearanceControls from '@/components/LogoAppearanceControls';
import LogoAppearancePreview from '@/components/LogoAppearancePreview';
import LiveMaterialCanvas from '@/components/LazyLiveMaterialCanvas';
import { LiveMaterialSourceBadge } from '@/components/LiveMaterialSourceLabel';
import MaterialPalettePresets from '@/components/MaterialPalettePresets';
import ResizableSidebar from '@/components/ResizableSidebar';
import SourceCodeDrawer, { SourceCodeButton } from '@/components/SourceCodeDrawer';
import { Button } from '@/components/ui/Button';
import ColorControl from '@/components/ui/ColorControl';
import StudioSelect from '@/components/ui/StudioSelect';
import { useMountEffect } from '@/hooks/useMountEffect';
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
} from '@/lib/backgroundSvg';
import { brandAssetPath, type BrandIdentity } from '@/lib/brandIdentity';
import { downloadSvgAsPng, imageUrlToDataUrl } from '@/lib/download';
import {
  DEFAULT_LIVE_MATERIAL_SETTINGS,
  brandMaterialPalette,
  getLiveMaterial,
} from '@/lib/liveMaterials';
import { DEFAULT_LOGO_APPEARANCE, drawLogoAppearanceLayer, type LogoAppearanceSettings } from '@/lib/logoAppearance';
import type { StudioTool } from '@/lib/studioCatalog';
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
  navigation,
  tool,
}: {
  identity: BrandIdentity;
  navigation?: ReactNode;
  tool: StudioTool;
}) {
  const gt = useGT();
  const defaultPalette = brandMaterialPalette(identity);
  const defaultLiveSettings = {
    ...DEFAULT_LIVE_MATERIAL_SETTINGS,
    colorA: defaultPalette.colors[0],
    colorB: defaultPalette.colors[1],
    colorC: defaultPalette.colors[2],
  };
  const liveLayerRef = useRef<HTMLDivElement>(null);
  const customLogoRef = useRef<{ name: string; url: string } | null>(null);
  const [customLogo, setCustomLogo] = useState<{ name: string; url: string } | null>(null);
  const [showLogo, setShowLogo] = useStudioDraft(identity.id, tool.id, 'show-logo', true);
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
      liveSettings: defaultLiveSettings,
    })
  );
  const settings = {
    ...DEFAULT_BACKGROUND_SETTINGS,
    ...storedSettings,
    liveMaterialId: storedSettings.liveMaterialId ?? DEFAULT_BACKGROUND_SETTINGS.liveMaterialId!,
    liveSettings: {
      ...defaultLiveSettings,
      ...storedSettings.liveSettings,
    },
  };
  const backgroundPresets = [
    {
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
  ];
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
  const logoPath = customLogo?.url ?? identityLogo;
  const selectedBrandAsset = availableBrandAssets.find(({ id }) => id === brandAssetId);
  const previewSvg = useMemo(
    () =>
      buildBackgroundSvg(
        settings,
        {
          asset: selectedBrandAsset?.path,
          assetFit: brandAssetFit,
          assetOpacity: brandAssetOpacity,
          logo: showLogo ? logoPath : undefined,
          logoAppearance: { ...DEFAULT_LOGO_APPEARANCE, ...logoAppearance },
          name: identity.shortName,
          showLogo: false,
        }
      ),
    [brandAssetFit, brandAssetOpacity, identity.shortName, logoAppearance, logoPath, selectedBrandAsset?.path, settings, showLogo]
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

  function applySurfaceSource(source: string) {
    const parsed = parseSourceObject(source);
    const nextSettings = sourceObject(parsed, 'settings');
    const nextAppearance = sourceObject(parsed, 'logoAppearance');
    const nextFit = sourceString(parsed, 'brandAssetFit', brandAssetFit);
    if (!['contain', 'cover'].includes(nextFit)) {
      throw new TypeError('Brand asset fit must be contain or cover.');
    }
    const nextOpacity = sourceNumber(parsed, 'brandAssetOpacity', brandAssetOpacity);
    if (nextOpacity < 0 || nextOpacity > 100) {
      throw new RangeError('Brand asset opacity must be between 0 and 100.');
    }

    if (nextSettings) {
      setStoredSettings((current) => ({
        ...current,
        ...nextSettings,
      } as BackgroundSettings));
    }
    if (nextAppearance) {
      setLogoAppearance((current) => ({
        ...current,
        ...nextAppearance,
      } as LogoAppearanceSettings));
    }
    setShowLogo(sourceBoolean(parsed, 'showLogo', showLogo));
    setBrandAssetId(sourceString(parsed, 'brandAssetId', brandAssetId));
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
      if (settings.style === 'live-shader') {
        const shaderCanvas = liveLayerRef.current?.querySelector('canvas');
        if (!shaderCanvas) return;
        const output = document.createElement('canvas');
        output.width = settings.width;
        output.height = settings.height;
        const context = output.getContext('2d');
        if (!context) return;
        context.drawImage(shaderCanvas, 0, 0, settings.width, settings.height);
        if (selectedBrandAsset) {
          const image = new Image();
          image.src = selectedBrandAsset.path;
          await image.decode();
          const imageScale = brandAssetFit === 'cover'
            ? Math.max(settings.width / image.naturalWidth, settings.height / image.naturalHeight)
            : Math.min(settings.width / image.naturalWidth, settings.height / image.naturalHeight);
          const imageWidth = image.naturalWidth * imageScale;
          const imageHeight = image.naturalHeight * imageScale;
          context.globalAlpha = brandAssetOpacity / 100;
          context.drawImage(
            image,
            (settings.width - imageWidth) / 2,
            (settings.height - imageHeight) / 2,
            imageWidth,
            imageHeight
          );
          context.globalAlpha = 1;
        }
        if (showLogo) {
          const markSize = Math.min(settings.width, settings.height) * (settings.logoScale / 100);
          const markX = (settings.width - markSize) / 2 + (settings.logoX / 100) * settings.width;
          const markY = (settings.height - markSize) / 2 + (settings.logoY / 100) * settings.height;
          if (logoPath) {
            const image = new Image();
            image.src = logoPath;
            await image.decode();
            const tinted = document.createElement('canvas');
            tinted.width = Math.ceil(markSize);
            tinted.height = Math.ceil(markSize);
            const tintedContext = tinted.getContext('2d');
            if (!tintedContext) return;
            tintedContext.drawImage(image, 0, 0, markSize, markSize);
            tintedContext.globalCompositeOperation = 'source-in';
            tintedContext.fillStyle = settings.logoColor;
            tintedContext.fillRect(0, 0, markSize, markSize);
            drawLogoAppearanceLayer(
              context,
              tinted,
              markX,
              markY,
              markSize,
              markSize,
              { ...DEFAULT_LOGO_APPEARANCE, ...logoAppearance },
              settings.logoOpacity / 100
            );
          } else {
            context.globalAlpha = settings.logoOpacity / 100;
            context.fillStyle = settings.logoColor;
            context.font = `600 ${markSize * 0.42}px Switzer, sans-serif`;
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(identity.shortName, settings.width / 2, settings.height / 2);
            context.globalAlpha = 1;
          }
        }
        const blob = await new Promise<Blob | null>((resolve) => output.toBlob(resolve, 'image/png'));
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `${identity.id}-${settings.liveMaterialId}-${settings.width}x${settings.height}.png`;
        link.href = url;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        return;
      }
      const [embeddedLogo, embeddedBrandAsset] = await Promise.all([
        showLogo && logoPath ? imageUrlToDataUrl(logoPath) : undefined,
        selectedBrandAsset ? imageUrlToDataUrl(selectedBrandAsset.path) : undefined,
      ]);
      const svg = buildBackgroundSvg(
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
        `${identity.id}-${settings.style}-background-${settings.width}x${settings.height}.png`
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
          {navigation}
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
              <h2 className='text-sm font-semibold'><T>Surface</T></h2>
              <p className='mt-1 text-xs leading-5 text-muted-foreground'>
                <T>Build an exportable field from SVG layers or live rendered materials.</T>
              </p>
            </div>
            <div className='flex flex-col gap-2 text-sm text-muted-foreground'>
              <T>Preset</T>
              <StudioSelect
                ariaLabel={gt('Background preset')}
                onValueChange={(value) => {
                  const preset = backgroundPresets.find(({ id }) => id === value);
                  if (preset) updateSettings(preset.settings);
                }}
                options={[
                  ...(selectedBackgroundPreset ? [] : [{ label: gt('Custom'), value: 'custom' }]),
                  ...backgroundPresets.map((preset) => ({ label: preset.name, value: preset.id })),
                ]}
                value={selectedBackgroundPreset?.id ?? 'custom'}
              />
              {selectedBackgroundPreset ? (
                <p className='text-xs leading-5'>{selectedBackgroundPreset.description}</p>
              ) : null}
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
                  { label: gt('Live shader'), value: 'live-shader' },
                ]}
                value={settings.style}
              />
            </div>
            <div className='flex flex-col gap-2 text-sm text-muted-foreground'>
              <T>Gradient</T>
              <StudioSelect
                ariaLabel={gt('Gradient')}
                disabled={settings.style === 'dither' || settings.style === 'pattern' || settings.style === 'live-shader'}
                onValueChange={(value) => {
                  const gradient = value as BackgroundGradient;
                  updateSettings({ gradient, ...BACKGROUND_GRADIENT_DEFAULTS[gradient] });
                }}
                options={[
                  { label: gt('Linear'), value: 'linear' },
                  { label: gt('Radial'), value: 'radial' },
                  { label: gt('Bands'), value: 'mesh' },
                  { label: gt('Orbit'), value: 'orbit' },
                  { label: gt('Wave'), value: 'wave' },
                ]}
                value={settings.gradient}
              />
            </div>
            {settings.style === 'live-shader' ? (
              <LiveMaterialControls
                identity={identity}
                materialId={settings.liveMaterialId}
                onMaterialIdChange={(liveMaterialId) => updateSettings({ liveMaterialId })}
                onSettingsChange={(liveSettings) => updateSettings({ liveSettings })}
                settings={settings.liveSettings}
              />
            ) : (
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
            )}
            {settings.style === 'live-shader' ? null : <RangeControl label={gt('Angle')} max={180} min={0} onChange={(angle) => updateSettings({ angle })} suffix='°' value={settings.angle} />}
            {settings.style !== 'live-shader' && ['radial', 'orbit'].includes(settings.gradient) ? (
              <div className='grid grid-cols-2 gap-3'>
                <RangeControl label={gt('Focus X')} max={100} min={0} onChange={(focalX) => updateSettings({ focalX })} suffix='%' value={settings.focalX} />
                <RangeControl label={gt('Focus Y')} max={100} min={0} onChange={(focalY) => updateSettings({ focalY })} suffix='%' value={settings.focalY} />
              </div>
            ) : null}
            {settings.style !== 'live-shader' && settings.gradient === 'mesh' ? (
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
            {settings.style !== 'live-shader' && ['wave', 'orbit'].includes(settings.gradient) ? (
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

          {settings.style === 'live-shader' ? null : <section className='flex flex-col gap-4 border-b border-border p-5'>
            <h2 className='text-sm font-semibold'><T>Pattern overlay</T></h2>
            <div className='flex flex-col gap-2 text-sm text-muted-foreground'>
              <T>Pattern</T>
              <StudioSelect ariaLabel={gt('Pattern')} onValueChange={(value) => updateSettings({ pattern: value as BackgroundPattern })} options={[
                { label: gt('None'), value: 'none' },
                { label: gt('Dots'), value: 'dots' },
                { label: gt('Lines'), value: 'lines' },
                { label: gt('Grid'), value: 'grid' },
              ]} value={settings.pattern} />
            </div>
            <RangeControl label={gt('Spacing')} max={72} min={8} onChange={(spacing) => updateSettings({ spacing })} suffix='px' value={settings.spacing} />
            <RangeControl label={gt('Opacity')} max={100} min={0} onChange={(patternOpacity) => updateSettings({ patternOpacity })} suffix='%' value={settings.patternOpacity} />
          </section>}

          <section className='flex flex-col gap-4 border-b border-border p-5'>
            <div>
              <h2 className='text-sm font-semibold'><T>Brand asset layer</T></h2>
              <p className='mt-1 text-xs leading-5 text-muted-foreground'>
                <T>Reuse an image, texture, or field from this identity.</T>
              </p>
            </div>
            <StudioSelect
              ariaLabel={gt('Brand asset layer')}
              onValueChange={setBrandAssetId}
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

          <section className='flex flex-col gap-4 border-b border-border p-5'>
            <div className='flex items-center justify-between gap-4'>
              <h2 className='text-sm font-semibold'><T>Logo</T></h2>
              <input aria-label={gt('Show logo')} checked={showLogo} onChange={(event) => setShowLogo(event.target.checked)} type='checkbox' />
            </div>
            <div className='flex gap-2'>
              {(['white', 'black'] as const).map((tone) => (
                <Button className='flex-1' key={tone} onClick={() => updateSettings({ logoColor: tone === 'white' ? '#FFFFFF' : '#000000', logoTone: tone })} size='sm' type='button' variant={settings.logoTone === tone ? 'default' : 'outline'}>
                  {tone === 'white' ? <T>White</T> : <T>Black</T>}
                </Button>
              ))}
            </div>
            <ColorControl ariaLabel={gt('Custom logo color')} label={<T>Custom logo color</T>} onChange={(logoColor) => updateSettings({ logoColor })} value={settings.logoColor} />
            <RangeControl label={gt('Logo size')} max={64} min={10} onChange={(logoScale) => updateSettings({ logoScale })} suffix='%' value={settings.logoScale} />
            <RangeControl label={gt('Logo opacity')} max={100} min={0} onChange={(logoOpacity) => updateSettings({ logoOpacity })} suffix='%' value={settings.logoOpacity} />
            <RangeControl label={gt('Horizontal')} max={50} min={-50} onChange={(logoX) => updateSettings({ logoX })} suffix='%' value={settings.logoX} />
            <RangeControl label={gt('Vertical')} max={50} min={-50} onChange={(logoY) => updateSettings({ logoY })} suffix='%' value={settings.logoY} />
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
            {settings.style === 'live-shader' ? (
              <div
                aria-label={`${identity.name} live shader background preview`}
                className='artifact-frame artifact-preview relative overflow-hidden bg-black'
                ref={liveLayerRef}
                role='img'
                onPointerDown={() => setLogoSelected(false)}
                style={{ aspectRatio: `${settings.width} / ${settings.height}` }}
              >
                <LiveMaterialCanvas materialId={settings.liveMaterialId} settings={settings.liveSettings} />
                {selectedBrandAsset ? (
                  <img
                    alt=''
                    aria-hidden='true'
                    className={`pointer-events-none absolute inset-0 size-full ${brandAssetFit === 'contain' ? 'object-contain' : 'object-cover'}`}
                    src={selectedBrandAsset.path}
                    style={{ opacity: brandAssetOpacity / 100 }}
                  />
                ) : null}
                {showLogo ? (
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
                      fallback={<span className='font-semibold' style={{ fontSize: `${settings.logoScale / 2}cqw` }}>{identity.shortName}</span>}
                      logoPath={logoPath}
                      opacity={settings.logoOpacity / 100}
                      settings={{ ...DEFAULT_LOGO_APPEARANCE, ...logoAppearance }}
                    />
                  </EditableCanvasLayer>
                ) : null}
              </div>
            ) : (
              <div
                aria-label={`${identity.name} ${settings.style} background preview`}
                className='artifact-frame artifact-preview relative overflow-hidden bg-white'
                role='img'
                onPointerDown={() => setLogoSelected(false)}
                style={{ aspectRatio: `${settings.width} / ${settings.height}` }}
              >
                <div className='absolute inset-0 size-full [&>svg]:size-full' dangerouslySetInnerHTML={{ __html: previewSvg }} />
                {showLogo ? (
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
            )}
            <div className='flex flex-wrap items-center justify-between gap-3 border-x border-b border-border bg-background px-4 py-3'>
              <p className='text-sm font-medium'>{settings.style.replace('-', ' ')}</p>
              <div className='flex items-center gap-4 text-muted-foreground'>
                <p className='font-mono text-[10px] uppercase tracking-wider'>
                  {settings.style === 'live-shader'
                    ? settings.liveMaterialId === 'glyphfield-glyph-field' ? 'Canvas material' : 'GPU material'
                    : 'SVG layers'} / {settings.width} × {settings.height}
                </p>
                {settings.style === 'live-shader' ? (
                  <LiveMaterialSourceBadge engine={getLiveMaterial(settings.liveMaterialId).engine} />
                ) : null}
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
            brandAssetFit,
            brandAssetId,
            brandAssetOpacity,
            logoAppearance,
            settings,
            showLogo,
          })}
          title={gt('Surface source')}
        />
      ) : null}
    </div>
  );
}
