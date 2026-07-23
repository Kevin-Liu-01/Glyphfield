'use client';

import { useMemo, useRef, useState } from 'react';
import { T, useGT } from 'gt-next';
import { Download, ImagePlus } from 'lucide-react';

import CanvasViewport from '@/components/CanvasViewport';
import LiveMaterialCanvas from '@/components/LazyLiveMaterialCanvas';
import { Button } from '@/components/ui/Button';
import ColorControl from '@/components/ui/ColorControl';
import StudioSelect from '@/components/ui/StudioSelect';
import { useMountEffect } from '@/hooks/useMountEffect';
import { useStudioDraft } from '@/hooks/usePersistentState';
import {
  DEFAULT_BACKGROUND_SETTINGS,
  buildBackgroundSvg,
  type BackgroundGradient,
  type BackgroundPattern,
  type BackgroundSettings,
  type BackgroundStyle,
} from '@/lib/backgroundSvg';
import { brandAssetPath, type BrandIdentity } from '@/lib/brandIdentity';
import { downloadSvgAsPng, imageUrlToDataUrl } from '@/lib/download';
import {
  DEFAULT_LIVE_MATERIAL_SETTINGS,
  LIVE_MATERIAL_OPTIONS,
  type LiveMaterialId,
  type LiveMaterialSettings,
} from '@/lib/liveMaterials';
import type { StudioTool } from '@/lib/studioCatalog';

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
  const liveLayerRef = useRef<HTMLDivElement>(null);
  const customLogoRef = useRef<{ name: string; url: string } | null>(null);
  const [customLogo, setCustomLogo] = useState<{ name: string; url: string } | null>(null);
  const [showLogo, setShowLogo] = useStudioDraft(identity.id, tool.id, 'show-logo', true);
  const [exporting, setExporting] = useState(false);
  const [storedSettings, setStoredSettings] = useStudioDraft<BackgroundSettings>(
    identity.id,
    tool.id,
    'settings',
    () => ({
      ...DEFAULT_BACKGROUND_SETTINGS,
      colorA: identity.colors.find(({ id }) => id === 'paper')?.hex ?? '#FFFFFF',
      colorB: identity.colors.find(({ id }) => id === 'ink')?.hex ?? '#181818',
    })
  );
  const settings = {
    ...DEFAULT_BACKGROUND_SETTINGS,
    ...storedSettings,
    liveMaterialId: storedSettings.liveMaterialId ?? DEFAULT_BACKGROUND_SETTINGS.liveMaterialId!,
    liveSettings: {
      ...DEFAULT_LIVE_MATERIAL_SETTINGS,
      ...storedSettings.liveSettings,
    },
  };
  const selectedSizePreset = SIZE_PRESETS.find(
    ({ height, width }) => height === settings.height && width === settings.width
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
  const previewSvg = useMemo(
    () =>
      buildBackgroundSvg(
        settings,
        showLogo ? { logo: logoPath, name: identity.shortName } : undefined
      ),
    [identity.shortName, logoPath, settings, showLogo]
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

  function updateLiveSettings(patch: Partial<LiveMaterialSettings>) {
    setStoredSettings((current) => ({
      ...current,
      liveSettings: {
        ...DEFAULT_LIVE_MATERIAL_SETTINGS,
        ...current.liveSettings,
        ...patch,
      },
    }));
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
        if (showLogo) {
          const markSize = Math.min(settings.width, settings.height) * (settings.logoScale / 100);
          const markX = (settings.width - markSize) / 2 + (settings.logoX / 100) * settings.width;
          const markY = (settings.height - markSize) / 2 + (settings.logoY / 100) * settings.height;
          context.globalAlpha = settings.logoOpacity / 100;
          if (logoPath) {
            const image = new Image();
            image.src = logoPath;
            await image.decode();
            context.drawImage(image, markX, markY, markSize, markSize);
          } else {
            context.fillStyle = settings.logoTone === 'white' ? '#FFFFFF' : '#000000';
            context.font = `700 ${markSize * 0.42}px Inter, sans-serif`;
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(identity.shortName, settings.width / 2, settings.height / 2);
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
      const embeddedLogo = showLogo && logoPath ? await imageUrlToDataUrl(logoPath) : undefined;
      const svg = buildBackgroundSvg(
        settings,
        showLogo ? { logo: embeddedLogo, name: identity.shortName } : undefined
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
      <header className='tool-header flex min-h-16 items-center justify-between gap-4 border-b border-border px-5 py-3'>
        <div className='min-w-0'>
          <p className='text-lg font-semibold tracking-tight'>{tool.name}</p>
          <p className='truncate text-sm text-muted-foreground'>{tool.description}</p>
        </div>
        <div className='flex shrink-0 items-center gap-2'>
          <Button loading={exporting} onClick={exportPng} type='button'>
            <Download aria-hidden='true' />
            <T>Download PNG</T>
          </Button>
        </div>
      </header>

      <div className='tool-body'>
        <aside className='tool-inspector min-h-0 overflow-y-auto border-r border-border bg-background'>
          <section className='flex flex-col gap-4 border-b border-border p-5'>
            <div>
              <h2 className='text-sm font-semibold'><T>Surface</T></h2>
              <p className='mt-1 text-xs leading-5 text-muted-foreground'>
                <T>Build an exportable field from SVG layers or live GPU materials.</T>
              </p>
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
                onValueChange={(value) => updateSettings({ gradient: value as BackgroundGradient })}
                options={[
                  { label: gt('Linear'), value: 'linear' },
                  { label: gt('Radial'), value: 'radial' },
                ]}
                value={settings.gradient}
              />
            </div>
            {settings.style === 'live-shader' ? (
              <div className='flex flex-col gap-3'>
                <StudioSelect
                  ariaLabel={gt('Live material')}
                  onValueChange={(value) => updateSettings({ liveMaterialId: value as LiveMaterialId })}
                  options={LIVE_MATERIAL_OPTIONS.map((material) => ({
                    label: `${material.engine} / ${material.name}`,
                    value: material.id,
                  }))}
                  value={settings.liveMaterialId}
                />
                {(['colorA', 'colorB', 'colorC'] as const).map((key, index) => (
                  <ColorControl
                    ariaLabel={gt('Material color {number}', { number: index + 1 })}
                    key={key}
                    label={gt('Color {number}', { number: index + 1 })}
                    onChange={(value) => updateLiveSettings({ [key]: value })}
                    value={settings.liveSettings[key]}
                  />
                ))}
                <RangeControl label={gt('Speed')} max={2} min={0} onChange={(speed) => updateLiveSettings({ speed })} step={0.05} suffix='×' value={settings.liveSettings.speed} />
                <RangeControl label={gt('Strength')} max={2} min={0} onChange={(strength) => updateLiveSettings({ strength })} step={0.05} suffix='' value={settings.liveSettings.strength} />
                <RangeControl label={gt('Grain')} max={100} min={0} onChange={(grain) => updateLiveSettings({ grain })} suffix='%' value={settings.liveSettings.grain} />
              </div>
            ) : (
              <div className='grid gap-3'>
                {([
                  ['colorA', 'Color A'],
                  ['colorB', 'Color B'],
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
            {settings.style === 'grain-gradient' ? (
              <RangeControl label={gt('Grain')} max={70} min={0} onChange={(grain) => updateSettings({ grain })} suffix='%' value={settings.grain} />
            ) : null}
            {settings.style === 'dither' ? (
              <div className='flex flex-col gap-2 text-sm text-muted-foreground'>
                <T>Bayer matrix</T>
                <StudioSelect ariaLabel={gt('Bayer matrix')} onValueChange={(value) => updateSettings({ ditherMatrix: Number(value) as 2 | 4 | 8 })} options={[
                  { label: '2 × 2', value: '2' },
                  { label: '4 × 4', value: '4' },
                  { label: '8 × 8', value: '8' },
                ]} value={String(settings.ditherMatrix)} />
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
            <div className='flex items-center justify-between gap-4'>
              <h2 className='text-sm font-semibold'><T>Logo</T></h2>
              <input aria-label={gt('Show logo')} checked={showLogo} onChange={(event) => setShowLogo(event.target.checked)} type='checkbox' />
            </div>
            <div className='flex gap-2'>
              {(['white', 'black'] as const).map((tone) => (
                <Button className='flex-1' key={tone} onClick={() => updateSettings({ logoTone: tone })} size='sm' type='button' variant={settings.logoTone === tone ? 'default' : 'outline'}>
                  {tone === 'white' ? <T>White</T> : <T>Black</T>}
                </Button>
              ))}
            </div>
            <RangeControl label={gt('Logo size')} max={64} min={10} onChange={(logoScale) => updateSettings({ logoScale })} suffix='%' value={settings.logoScale} />
            <RangeControl label={gt('Logo opacity')} max={100} min={0} onChange={(logoOpacity) => updateSettings({ logoOpacity })} suffix='%' value={settings.logoOpacity} />
            <RangeControl label={gt('Horizontal')} max={50} min={-50} onChange={(logoX) => updateSettings({ logoX })} suffix='%' value={settings.logoX} />
            <RangeControl label={gt('Vertical')} max={50} min={-50} onChange={(logoY) => updateSettings({ logoY })} suffix='%' value={settings.logoY} />
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
        </aside>

        <div className='tool-canvas min-h-0 overflow-auto'>
          <CanvasViewport identityId={identity.id} stageClassName='grid min-h-full place-items-center p-5 sm:p-8' toolId={tool.id}>
          <div className='w-full max-w-5xl'>
            {settings.style === 'live-shader' ? (
              <div
                aria-label={`${identity.name} live shader background preview`}
                className='artifact-frame artifact-preview relative overflow-hidden bg-black'
                ref={liveLayerRef}
                role='img'
                style={{ aspectRatio: `${settings.width} / ${settings.height}` }}
              >
                <LiveMaterialCanvas materialId={settings.liveMaterialId} settings={settings.liveSettings} />
                {showLogo ? (
                  <div
                    className='pointer-events-none absolute inset-0 grid place-items-center'
                    style={{
                      opacity: settings.logoOpacity / 100,
                      transform: `translate(${settings.logoX}%, ${settings.logoY}%)`,
                    }}
                  >
                    {logoPath ? (
                      <img
                        alt={`${identity.name} logo`}
                        className='object-contain'
                        src={logoPath}
                        style={{ height: `${settings.logoScale}%`, width: `${settings.logoScale}%` }}
                      />
                    ) : (
                      <span
                        className='font-semibold'
                        style={{
                          color: settings.logoTone === 'white' ? '#FFFFFF' : '#000000',
                          fontSize: `${settings.logoScale / 2}cqw`,
                        }}
                      >
                        {identity.shortName}
                      </span>
                    )}
                  </div>
                ) : null}
              </div>
            ) : (
              <div
                aria-label={`${identity.name} ${settings.style} background preview`}
                className='artifact-frame artifact-preview overflow-hidden bg-white'
                dangerouslySetInnerHTML={{ __html: previewSvg }}
                role='img'
                style={{ aspectRatio: `${settings.width} / ${settings.height}` }}
              />
            )}
            <div className='flex flex-wrap items-center justify-between gap-3 border-x border-b border-border bg-background px-4 py-3'>
              <p className='text-sm font-medium'>{settings.style.replace('-', ' ')}</p>
              <p className='font-mono text-[10px] uppercase tracking-wider text-muted-foreground'>
                {settings.style === 'live-shader' ? 'GPU material' : 'SVG layers'} / {settings.width} × {settings.height}
              </p>
            </div>
          </div>
          </CanvasViewport>
        </div>
      </div>
    </div>
  );
}
