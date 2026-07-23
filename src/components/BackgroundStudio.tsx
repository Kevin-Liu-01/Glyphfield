'use client';

import { useMemo, useRef, useState } from 'react';
import { T, useGT } from 'gt-next';
import { Download, ImagePlus } from 'lucide-react';

import { Button } from '@/components/ui/Button';
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
import type { StudioTool } from '@/lib/studioCatalog';

const INPUT_CLASS =
  'h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-foreground';

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
  suffix,
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
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
  const customLogoRef = useRef<{ name: string; url: string } | null>(null);
  const [customLogo, setCustomLogo] = useState<{ name: string; url: string } | null>(null);
  const [showLogo, setShowLogo] = useStudioDraft(identity.id, tool.id, 'show-logo', true);
  const [exporting, setExporting] = useState(false);
  const [settings, setSettings] = useStudioDraft<BackgroundSettings>(
    identity.id,
    tool.id,
    'settings',
    () => ({
      ...DEFAULT_BACKGROUND_SETTINGS,
      colorA: identity.colors.find(({ id }) => id === 'paper')?.hex ?? '#FFFFFF',
      colorB: identity.colors.find(({ id }) => id === 'ink')?.hex ?? '#181818',
    })
  );
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
    setSettings((current) => ({ ...current, ...patch }));
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
                <T>Build an exportable field from original SVG layers.</T>
              </p>
            </div>
            <label className='flex flex-col gap-2 text-sm text-muted-foreground'>
              <T>Recipe</T>
              <select
                className={INPUT_CLASS}
                onChange={(event) => {
                  const style = event.target.value as BackgroundStyle;
                  updateSettings({
                    style,
                    ...(style === 'pattern' && settings.pattern === 'none'
                      ? { pattern: 'dots' as const }
                      : {}),
                  });
                }}
                value={settings.style}
              >
                <option value='gradient'>Gradient</option>
                <option value='grain-gradient'>Grainy gradient</option>
                <option value='dither'>Ordered dither</option>
                <option value='pattern'>Pattern field</option>
              </select>
            </label>
            <label className='flex flex-col gap-2 text-sm text-muted-foreground'>
              <T>Gradient</T>
              <select
                className={INPUT_CLASS}
                disabled={settings.style === 'dither' || settings.style === 'pattern'}
                onChange={(event) => updateSettings({ gradient: event.target.value as BackgroundGradient })}
                value={settings.gradient}
              >
                <option value='linear'>Linear</option>
                <option value='radial'>Radial</option>
              </select>
            </label>
            <div className='grid grid-cols-2 gap-3'>
              {([
                ['colorA', 'Color A'],
                ['colorB', 'Color B'],
              ] as const).map(([key, label]) => (
                <label className='flex flex-col gap-2 text-xs text-muted-foreground' key={key}>
                  {label}
                  <input
                    aria-label={gt(label)}
                    className='h-10 w-full border border-input bg-background p-1'
                    onChange={(event) => updateSettings({ [key]: event.target.value })}
                    type='color'
                    value={settings[key]}
                  />
                </label>
              ))}
            </div>
            <RangeControl label={gt('Angle')} max={180} min={0} onChange={(angle) => updateSettings({ angle })} suffix='°' value={settings.angle} />
            {settings.style === 'grain-gradient' ? (
              <RangeControl label={gt('Grain')} max={70} min={0} onChange={(grain) => updateSettings({ grain })} suffix='%' value={settings.grain} />
            ) : null}
            {settings.style === 'dither' ? (
              <label className='flex flex-col gap-2 text-sm text-muted-foreground'>
                <T>Bayer matrix</T>
                <select className={INPUT_CLASS} onChange={(event) => updateSettings({ ditherMatrix: Number(event.target.value) as 2 | 4 | 8 })} value={settings.ditherMatrix}>
                  <option value='2'>2 × 2</option>
                  <option value='4'>4 × 4</option>
                  <option value='8'>8 × 8</option>
                </select>
              </label>
            ) : null}
          </section>

          <section className='flex flex-col gap-4 border-b border-border p-5'>
            <h2 className='text-sm font-semibold'><T>Pattern overlay</T></h2>
            <label className='flex flex-col gap-2 text-sm text-muted-foreground'>
              <T>Pattern</T>
              <select className={INPUT_CLASS} onChange={(event) => updateSettings({ pattern: event.target.value as BackgroundPattern })} value={settings.pattern}>
                <option value='none'>None</option>
                <option value='dots'>Dots</option>
                <option value='lines'>Lines</option>
                <option value='grid'>Grid</option>
              </select>
            </label>
            <RangeControl label={gt('Spacing')} max={72} min={8} onChange={(spacing) => updateSettings({ spacing })} suffix='px' value={settings.spacing} />
            <RangeControl label={gt('Opacity')} max={100} min={0} onChange={(patternOpacity) => updateSettings({ patternOpacity })} suffix='%' value={settings.patternOpacity} />
          </section>

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
            <select
              className={INPUT_CLASS}
              onChange={(event) => {
                const preset = SIZE_PRESETS.find(({ id }) => id === event.target.value);
                if (preset) updateSettings({ height: preset.height, width: preset.width });
              }}
              value={SIZE_PRESETS.find(({ height, width }) => height === settings.height && width === settings.width)?.id ?? 'og'}
            >
              {SIZE_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label} · {preset.width} × {preset.height}</option>)}
            </select>
          </section>
        </aside>

        <div className='tool-canvas grid min-h-0 place-items-center overflow-auto p-5 sm:p-8'>
          <div className='w-full max-w-5xl'>
            <div
              aria-label={`${identity.name} ${settings.style} background preview`}
              className='artifact-preview overflow-hidden border border-black/15 bg-white shadow-sm'
              dangerouslySetInnerHTML={{ __html: previewSvg }}
              role='img'
              style={{ aspectRatio: `${settings.width} / ${settings.height}` }}
            />
            <div className='flex flex-wrap items-center justify-between gap-3 border-x border-b border-border bg-background px-4 py-3'>
              <p className='text-sm font-medium'>{settings.style.replace('-', ' ')}</p>
              <p className='font-mono text-[10px] uppercase tracking-wider text-muted-foreground'>
                SVG layers / {settings.width} × {settings.height}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
