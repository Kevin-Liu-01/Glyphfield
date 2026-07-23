'use client';

import { useState, type ReactNode } from 'react';
import { T, useGT } from 'gt-next';
import { ImagePlus } from 'lucide-react';

import ColorControl from '@/components/ui/ColorControl';
import StudioSelect from '@/components/ui/StudioSelect';
import { brandAssetPath, type BrandIdentity } from '@/lib/brandIdentity';
import { formatOklch, hexToOklch } from '@/lib/color';
import type { StudioTool } from '@/lib/studioCatalog';

const INPUT_CLASS =
  'h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-foreground';
const TEXTAREA_CLASS =
  'min-h-24 w-full resize-y rounded-md border border-input bg-background p-3 text-sm leading-6 text-foreground outline-none focus:border-foreground';

function SettingField({ children, label }: { children: ReactNode; label: ReactNode }) {
  return (
    <label className='flex flex-col gap-2 text-sm'>
      <span className='text-xs text-muted-foreground'>{label}</span>
      {children}
    </label>
  );
}

function SettingSection({ children, title }: { children: ReactNode; title: ReactNode }) {
  return (
    <section className='flex flex-col gap-4 border-b border-border p-5 last:border-b-0'>
      <h2 className='text-sm font-semibold'>{title}</h2>
      {children}
    </section>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new DOMException('The selected file could not be read.'));
    });
    reader.addEventListener('error', () => reject(reader.error ?? new DOMException('The selected file could not be read.')));
    reader.readAsDataURL(file);
  });
}

function listValue(values: string[]): string {
  return values.join('\n');
}

function parseList(value: string): string[] {
  return value.split('\n').map((item) => item.trim()).filter(Boolean);
}

export default function BrandSettingsStudio({
  identity,
  onChange,
  tool,
}: {
  identity: BrandIdentity;
  onChange: (identity: BrandIdentity) => void;
  tool: StudioTool;
}) {
  const gt = useGT();
  const [assetError, setAssetError] = useState<string | null>(null);
  const darkMark = brandAssetPath(identity, 'mark-dark');
  const lightMark = brandAssetPath(identity, 'mark-light');
  const colorPreviews = identity.colors.map((color) => {
    try {
      return { ...color, dark: hexToOklch(color.hex).lightness < 0.58, oklch: formatOklch(color.hex) };
    } catch {
      return { ...color, dark: false, oklch: gt('Invalid HEX') };
    }
  });

  function update(patch: Partial<BrandIdentity>) {
    onChange({ ...identity, ...patch });
  }

  async function replaceMark(file: File, id: 'mark-dark' | 'mark-light') {
    if (file.size > 1_500_000) {
      setAssetError(gt('Keep logo files under 1.5 MB so the identity can remain local and portable.'));
      return;
    }
    try {
      const path = await readFileAsDataUrl(file);
      const nextAsset = {
        id,
        label: id === 'mark-dark' ? 'Primary dark mark' : 'Primary light mark',
        path,
        surface: id === 'mark-dark' ? 'light' as const : 'dark' as const,
        type: 'logo' as const,
      };
      update({
        assets: identity.assets.some((asset) => asset.id === id)
          ? identity.assets.map((asset) => asset.id === id ? nextAsset : asset)
          : [...identity.assets, nextAsset],
      });
      setAssetError(null);
    } catch {
      setAssetError(gt('That logo file could not be loaded.'));
    }
  }

  return (
    <div className='tool-shell h-full min-h-0'>
      <header className='tool-header flex min-h-16 items-center justify-between gap-4 border-b border-border px-5 py-3'>
        <div className='min-w-0'>
          <p className='text-lg font-semibold tracking-tight'>{gt(tool.name)}</p>
          <p className='truncate text-sm text-muted-foreground'>{gt(tool.description)}</p>
        </div>
      </header>
      <div className='tool-body brand-settings-body'>
        <aside className='tool-inspector min-h-0 overflow-y-auto border-r border-border bg-background'>
          <SettingSection title={<T>Identity</T>}>
            <SettingField label={<T>Brand name</T>}><input className={INPUT_CLASS} onChange={(event) => update({ name: event.target.value })} value={identity.name} /></SettingField>
            <SettingField label={<T>Short name</T>}><input className={INPUT_CLASS} maxLength={4} onChange={(event) => update({ shortName: event.target.value.toLocaleUpperCase() })} value={identity.shortName} /></SettingField>
            <SettingField label={<T>Website</T>}><input className={INPUT_CLASS} onChange={(event) => update({ website: event.target.value })} value={identity.website} /></SettingField>
            <SettingField label={<T>Tagline</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => update({ tagline: event.target.value })} value={identity.tagline} /></SettingField>
            <SettingField label={<T>Positioning</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => update({ positioning: event.target.value })} value={identity.positioning} /></SettingField>
            <SettingField label={<T>Description</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => update({ description: event.target.value })} value={identity.description} /></SettingField>
            <SettingField label={<T>Mission</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => update({ mission: event.target.value })} value={identity.mission} /></SettingField>
            <SettingField label={<T>Contact email</T>}><input className={INPUT_CLASS} onChange={(event) => update({ contactEmail: event.target.value })} type='email' value={identity.contactEmail} /></SettingField>
            <SettingField label={<T>Social handle</T>}><input className={INPUT_CLASS} onChange={(event) => update({ socialHandle: event.target.value })} value={identity.socialHandle} /></SettingField>
          </SettingSection>

          <SettingSection title={<T>Strategy</T>}>
            <SettingField label={<T>Challenge</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => update({ strategy: { ...identity.strategy, challenge: event.target.value } })} value={identity.strategy.challenge} /></SettingField>
            <SettingField label={<T>Central concept</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => update({ strategy: { ...identity.strategy, concept: event.target.value } })} value={identity.strategy.concept} /></SettingField>
            <SettingField label={<T>Brand promise</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => update({ strategy: { ...identity.strategy, promise: event.target.value } })} value={identity.strategy.promise} /></SettingField>
            <SettingField label={<T>Desired outcome</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => update({ strategy: { ...identity.strategy, outcome: event.target.value } })} value={identity.strategy.outcome} /></SettingField>
            <SettingField label={<T>Strategic pillars · one per line</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => update({ strategy: { ...identity.strategy, pillars: parseList(event.target.value) } })} value={listValue(identity.strategy.pillars)} /></SettingField>
            <SettingField label={<T>Personality · one per line</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => update({ strategy: { ...identity.strategy, personality: parseList(event.target.value) } })} value={listValue(identity.strategy.personality)} /></SettingField>
          </SettingSection>

          <SettingSection title={<T>Graphic system</T>}>
            <SettingField label={<T>Recognizable device</T>}><input className={INPUT_CLASS} onChange={(event) => update({ graphicSystem: { ...identity.graphicSystem, device: event.target.value } })} value={identity.graphicSystem.device} /></SettingField>
            <SettingField label={<T>Device rationale</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => update({ graphicSystem: { ...identity.graphicSystem, description: event.target.value } })} value={identity.graphicSystem.description} /></SettingField>
            <SettingField label={<T>Composition behavior</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => update({ graphicSystem: { ...identity.graphicSystem, composition: event.target.value } })} value={identity.graphicSystem.composition} /></SettingField>
            <SettingField label={<T>Image direction</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => update({ graphicSystem: { ...identity.graphicSystem, imageDirection: event.target.value } })} value={identity.graphicSystem.imageDirection} /></SettingField>
            <SettingField label={<T>Pattern grammar</T>}>
              <StudioSelect
                ariaLabel={gt('Pattern grammar')}
                onValueChange={(pattern) => update({ graphicSystem: { ...identity.graphicSystem, pattern: pattern as typeof identity.graphicSystem.pattern } })}
                options={['blocks', 'brackets', 'burst', 'circuit', 'flow', 'grid', 'orbit', 'rays', 'steps', 'wave'].map((pattern) => ({ label: gt(pattern), value: pattern }))}
                value={identity.graphicSystem.pattern}
              />
            </SettingField>
            <SettingField label={<T>System rules · one per line</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => update({ graphicSystem: { ...identity.graphicSystem, rules: parseList(event.target.value) } })} value={listValue(identity.graphicSystem.rules)} /></SettingField>
          </SettingSection>

          <SettingSection title={<T>System defaults</T>}>
            <SettingField label={<T>Interface density</T>}>
              <StudioSelect ariaLabel={gt('Interface density')} onValueChange={(density) => update({ style: { ...identity.style, density: density as typeof identity.style.density } })} options={[
                { label: gt('Compact'), value: 'compact' },
                { label: gt('Comfortable'), value: 'comfortable' },
                { label: gt('Spacious'), value: 'spacious' },
              ]} value={identity.style.density} />
            </SettingField>
            <SettingField label={<T>Image treatment</T>}>
              <StudioSelect ariaLabel={gt('Image treatment')} onValueChange={(imageTreatment) => update({ style: { ...identity.style, imageTreatment: imageTreatment as typeof identity.style.imageTreatment } })} options={[
                { label: gt('Natural'), value: 'natural' },
                { label: gt('Monochrome'), value: 'monochrome' },
                { label: gt('Duotone'), value: 'duotone' },
              ]} value={identity.style.imageTreatment} />
            </SettingField>
            <SettingField label={<T>Construction field</T>}>
              <StudioSelect ariaLabel={gt('Construction field')} onValueChange={(grid) => update({ style: { ...identity.style, grid: grid as typeof identity.style.grid } })} options={[
                { label: gt('None'), value: 'none' },
                { label: gt('Dots'), value: 'dots' },
                { label: gt('Lines'), value: 'lines' },
              ]} value={identity.style.grid} />
            </SettingField>
            <label className='flex flex-col gap-2 text-sm'>
              <span className='flex items-center justify-between text-xs text-muted-foreground'><T>Corner radius</T><output>{identity.style.borderRadius}px</output></span>
              <input className='studio-range' max={32} min={0} onChange={(event) => update({ style: { ...identity.style, borderRadius: Number(event.target.value) } })} type='range' value={identity.style.borderRadius} />
            </label>
            <label className='flex flex-col gap-2 text-sm'>
              <span className='flex items-center justify-between text-xs text-muted-foreground'><T>Default logo scale</T><output>{identity.style.logoScale}%</output></span>
              <input className='studio-range' max={160} min={40} onChange={(event) => update({ style: { ...identity.style, logoScale: Number(event.target.value) } })} type='range' value={identity.style.logoScale} />
            </label>
          </SettingSection>

          <SettingSection title={<T>Logos</T>}>
            {(['mark-dark', 'mark-light'] as const).map((id) => (
              <label className='flex min-h-20 cursor-pointer items-center gap-3 rounded-md border border-dashed border-input p-3 hover:bg-muted' key={id}>
                <span className={`grid size-11 place-items-center overflow-hidden border border-border p-2 ${id === 'mark-light' ? 'bg-black' : 'bg-white'}`}>
                  {brandAssetPath(identity, id) ? <img alt='' className='size-full object-contain' src={brandAssetPath(identity, id)} /> : <ImagePlus className='size-4 text-muted-foreground' />}
                </span>
                <span className='min-w-0 flex-1'><span className='block text-sm font-medium'>{id === 'mark-dark' ? <T>Dark mark</T> : <T>Light mark</T>}</span><span className='block text-xs text-muted-foreground'><T>SVG or transparent PNG</T></span></span>
                <input accept='image/png,image/svg+xml' className='sr-only' onChange={(event) => { const file = event.target.files?.[0]; if (file) void replaceMark(file, id); event.target.value = ''; }} type='file' />
              </label>
            ))}
            {assetError ? <p className='text-xs text-status-error' role='alert'>{assetError}</p> : null}
          </SettingSection>

          <SettingSection title={<T>Color system</T>}>
            {identity.colors.map((color, index) => (
              <div className='flex flex-col gap-2' key={color.id}>
                <input aria-label={gt('Color name')} className={INPUT_CLASS} onChange={(event) => update({ colors: identity.colors.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item) })} value={color.name} />
                <input aria-label={gt('{name} usage', { name: color.name })} className={INPUT_CLASS} onChange={(event) => update({ colors: identity.colors.map((item, itemIndex) => itemIndex === index ? { ...item, role: event.target.value } : item) })} value={color.role} />
                <ColorControl
                  ariaLabel={gt('{name} color', { name: color.name })}
                  label={color.role}
                  onChange={(hex) => update({ colors: identity.colors.map((item, itemIndex) => itemIndex === index ? { ...item, hex } : item) })}
                  value={color.hex}
                />
              </div>
            ))}
          </SettingSection>

          <SettingSection title={<T>Typography</T>}>
            {identity.typography.map((font, index) => (
              <div className='grid grid-cols-[72px_minmax(0,1fr)] items-start gap-3' key={`${font.role}-${index}`}>
                <span className='font-mono text-[10px] uppercase text-muted-foreground'>{font.role}</span>
                <span className='flex flex-col gap-2'>
                  <input className={INPUT_CLASS} onChange={(event) => update({ typography: identity.typography.map((item, itemIndex) => itemIndex === index ? { ...item, family: event.target.value } : item) })} value={font.family} />
                  <input aria-label={gt('{role} font usage', { role: font.role })} className={INPUT_CLASS} onChange={(event) => update({ typography: identity.typography.map((item, itemIndex) => itemIndex === index ? { ...item, usage: event.target.value } : item) })} value={font.usage} />
                </span>
              </div>
            ))}
          </SettingSection>

          <SettingSection title={<T>Language and voice</T>}>
            <SettingField label={<T>Greetings · one per line</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => update({ greetings: parseList(event.target.value) })} value={listValue(identity.greetings)} /></SettingField>
            <SettingField label={<T>Voice principles · one per line</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => update({ voice: { ...identity.voice, principles: parseList(event.target.value) } })} value={listValue(identity.voice.principles)} /></SettingField>
            <SettingField label={<T>Approved phrases · one per line</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => update({ voice: { ...identity.voice, phrases: parseList(event.target.value) } })} value={listValue(identity.voice.phrases)} /></SettingField>
            <SettingField label={<T>Avoid · one per line</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => update({ voice: { ...identity.voice, avoid: parseList(event.target.value) } })} value={listValue(identity.voice.avoid)} /></SettingField>
            <SettingField label={<T>Audiences · one per line</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => update({ audiences: parseList(event.target.value) })} value={listValue(identity.audiences)} /></SettingField>
            <SettingField label={<T>Brand values · one per line</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => update({ values: parseList(event.target.value) })} value={listValue(identity.values)} /></SettingField>
            <SettingField label={<T>Products · one per line</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => update({ products: parseList(event.target.value) })} value={listValue(identity.products)} /></SettingField>
            <SettingField label={<T>Proof points · one per line</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => update({ proof: parseList(event.target.value) })} value={listValue(identity.proof)} /></SettingField>
          </SettingSection>

          <SettingSection title={<T>Applications</T>}>
            {identity.applications.map((application, index) => (
              <div className='flex flex-col gap-2 border border-border p-3' key={application.id}>
                <span className='font-mono text-[9px] uppercase tracking-widest text-muted-foreground'>
                  {String(index + 1).padStart(2, '0')} / {application.category}
                </span>
                <input aria-label={gt('Application name')} className={INPUT_CLASS} onChange={(event) => update({ applications: identity.applications.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item) })} value={application.name} />
                <input aria-label={gt('Application format')} className={INPUT_CLASS} onChange={(event) => update({ applications: identity.applications.map((item, itemIndex) => itemIndex === index ? { ...item, format: event.target.value } : item) })} value={application.format} />
                <textarea aria-label={gt('Application description')} className={TEXTAREA_CLASS} onChange={(event) => update({ applications: identity.applications.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item) })} value={application.description} />
              </div>
            ))}
          </SettingSection>
        </aside>

        <div className='tool-canvas min-h-0 overflow-auto p-5 sm:p-8'>
          <div className='brand-settings-preview mx-auto flex w-full max-w-5xl flex-col gap-px overflow-hidden border border-border bg-border shadow-sm' style={{ borderRadius: identity.style.borderRadius }}>
            <section className='relative min-h-[360px] overflow-hidden bg-white p-8 text-[#181818] sm:p-12'>
              <div className='absolute inset-0 opacity-50 [background-image:radial-gradient(circle,#D4D4D4_1px,transparent_1px)] [background-size:18px_18px]' />
              <div className='relative flex h-full min-h-[264px] flex-col justify-between'>
                <div className='flex items-start justify-between gap-8'>
                  {darkMark ? <img alt='' className='size-16 object-contain' src={darkMark} /> : <span className='text-3xl font-semibold'>{identity.shortName}</span>}
                  <span className='font-mono text-xs text-black/40'>{identity.website}</span>
                </div>
                <div className='max-w-4xl'><p className='font-mono text-xs uppercase tracking-widest text-black/40'>{identity.graphicSystem.device}</p><h2 className='mt-4 text-4xl font-semibold leading-[0.98] tracking-[-0.055em] sm:text-7xl'>{identity.tagline}</h2><p className='mt-5 max-w-2xl text-sm leading-6 text-black/55'>{identity.strategy.concept}</p></div>
              </div>
            </section>
            <section className='grid bg-background lg:grid-cols-2'>
              <div className='grid grid-cols-2 gap-px bg-border'>
                {colorPreviews.map((color) => <div className='flex min-h-28 flex-col justify-between p-4' key={color.id} style={{ backgroundColor: color.hex, color: color.dark ? '#FFFFFF' : '#181818' }}><span className='text-xs font-semibold'>{color.name}</span><span className='font-mono text-[10px] opacity-60'>{color.hex}<br />{color.oklch}</span></div>)}
              </div>
              <div className='flex flex-col justify-between gap-10 border-l border-border bg-background p-8'>
                <div>{identity.typography.map((font) => <div className='mb-5' key={font.role}><p className='font-mono text-[10px] uppercase text-muted-foreground'>{font.role} / {font.family}</p><p className='mt-1 text-2xl font-semibold' style={{ fontFamily: font.family }}>{identity.name}</p></div>)}</div>
                <div><p className='font-mono text-[10px] uppercase text-muted-foreground'><T>Voice</T></p><div className='mt-3 flex flex-wrap gap-2'>{identity.voice.principles.map((principle) => <span className='border border-border px-2.5 py-1 text-xs' key={principle}>{principle}</span>)}</div></div>
                <div><p className='font-mono text-[10px] uppercase text-muted-foreground'><T>Values</T></p><div className='mt-3 flex flex-wrap gap-2'>{identity.values.map((value) => <span className='border border-border px-2.5 py-1 text-xs' key={value}>{value}</span>)}</div></div>
              </div>
            </section>
            <section className='grid min-h-44 grid-cols-2'>
              <div className='grid place-items-center bg-white p-8'>{darkMark ? <img alt='' className='size-24 object-contain' src={darkMark} /> : <span className='text-4xl font-semibold'>{identity.shortName}</span>}</div>
              <div className='grid place-items-center bg-black p-8 text-white'>{lightMark ? <img alt='' className='size-24 object-contain' src={lightMark} /> : <span className='text-4xl font-semibold'>{identity.shortName}</span>}</div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
