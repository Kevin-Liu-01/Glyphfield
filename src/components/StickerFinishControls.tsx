'use client';

import type { ReactNode } from 'react';
import { Check } from 'lucide-react';

import ColorControl from '@/components/ui/ColorControl';
import {
  normalizeStickerFinish,
  stickerFinishPreset,
  STICKER_FINISH_PRESETS,
  type StickerFinishId,
  type StickerFinishSettings,
} from '@/lib/surfaceSticker';

function RangeControl({
  label,
  max,
  min,
  onChange,
  unit = '',
  value,
}: {
  label: ReactNode;
  max: number;
  min: number;
  onChange: (value: number) => void;
  unit?: string;
  value: number;
}) {
  return (
    <label className='flex flex-col gap-2'>
      <span className='flex items-center justify-between gap-3 text-sm text-muted-foreground'>
        <span>{label}</span>
        <output className='font-mono text-xs tabular-nums'>{value}{unit}</output>
      </span>
      <input className='studio-range' max={max} min={min} onChange={(event) => onChange(Number(event.target.value))} type='range' value={value} />
    </label>
  );
}

function ControlSection({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className='grid gap-4 border-t border-border pt-4'>
      <div>
        <h3 className='text-xs font-medium'>{title}</h3>
        <p className='mt-1 text-[11px] leading-4 text-muted-foreground'>{description}</p>
      </div>
      {children}
    </section>
  );
}

function ChoiceControl<T extends string>({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: T) => void;
  options: readonly { label: string; value: T }[];
  value: T;
}) {
  return (
    <div className='grid gap-2'>
      <p className='text-sm text-muted-foreground'>{label}</p>
      <div className='grid grid-cols-2 border border-border'>
        {options.map((option, index) => (
          <button
            aria-pressed={option.value === value}
            className={`min-h-9 px-2 text-[11px] ${index % 2 ? 'border-l border-border' : ''} ${index > 1 ? 'border-t border-border' : ''} ${option.value === value ? 'bg-foreground text-background' : 'bg-background hover:bg-muted'}`}
            key={option.value}
            onClick={() => onChange(option.value)}
            type='button'
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function StickerFinishControls({
  onChange,
  settings,
}: {
  onChange: (settings: StickerFinishSettings) => void;
  settings?: Partial<StickerFinishSettings>;
}) {
  const finish = normalizeStickerFinish(settings);

  function update(patch: Partial<StickerFinishSettings>) {
    onChange({ ...finish, ...patch });
  }

  return (
    <div className='flex flex-col gap-4'>
      <div className='grid grid-cols-2 gap-2'>
        {STICKER_FINISH_PRESETS.map((preset) => {
          const selected = finish.presetId === preset.id;
          return (
            <button
              aria-label={`Use ${preset.label}: ${preset.description}`}
              aria-pressed={selected}
              className={`overflow-hidden border text-left ${selected ? 'border-foreground ring-1 ring-foreground' : 'border-border hover:border-muted-foreground'}`}
              key={preset.id}
              onClick={() => onChange(stickerFinishPreset(preset.id as StickerFinishId))}
              title={preset.description}
              type='button'
            >
              <span className='block h-12' style={{ background: preset.swatch }} />
              <span className='flex min-h-11 items-center gap-2 border-t border-border bg-background px-2 py-1.5'>
                <span className='min-w-0 flex-1'>
                  <span className='block truncate text-[10px] font-medium'>{preset.label}</span>
                  {preset.source ? <span className='mt-0.5 block truncate font-mono text-[8px] uppercase tracking-wider text-muted-foreground'>{preset.source.name} · {preset.source.license}</span> : null}
                </span>
                {selected ? <Check aria-hidden='true' className='size-3 shrink-0' /> : null}
              </span>
            </button>
          );
        })}
      </div>

      <a
        className='border border-border bg-muted/20 p-3 text-[11px] leading-4 text-muted-foreground hover:text-foreground'
        href='https://github.com/jal-co/holosticker'
        rel='noreferrer'
        target='_blank'
      >
        Die-cut, laminate, relief, and peel architecture adapted from HoloSticker · MIT
      </a>

      <ControlSection
        description='Generate a real distance-field cut path from the artwork alpha. Tolerance closes tiny counters before the border is added.'
        title='Artwork & die-cut'
      >
        <ColorControl
          ariaLabel='Sticker border color'
          label='Sticker border color'
          onChange={(borderColor) => update({ borderColor })}
          value={finish.borderColor}
        />
        <RangeControl label='Border width' max={32} min={2} onChange={(edgeWidth) => update({ edgeWidth })} unit='px' value={finish.edgeWidth} />
        <RangeControl label='Cut tolerance' max={12} min={0} onChange={(cutTolerance) => update({ cutTolerance })} unit='%' value={finish.cutTolerance} />
        <RangeControl label='Ink coverage' max={200} min={0} onChange={(ink) => update({ ink })} unit='%' value={finish.ink} />
        <RangeControl label='Print relief' max={100} min={0} onChange={(relief) => update({ relief })} unit='%' value={finish.relief} />
      </ControlSection>

      <ControlSection
        description='Tune the view-dependent diffraction film, broad color pooling, micro-flakes, and embossed refractor facets.'
        title='Foil laminate'
      >
        <RangeControl label='Holo intensity' max={100} min={0} onChange={(intensity) => update({ intensity })} unit='%' value={finish.intensity} />
        <RangeControl label='Diffraction bands' max={20} min={1} onChange={(bands) => update({ bands })} value={finish.bands} />
        <RangeControl label='Spectrum direction' max={180} min={0} onChange={(glintAngle) => update({ glintAngle })} unit='°' value={finish.glintAngle} />
        <RangeControl label='Hue shift' max={100} min={0} onChange={(hueShift) => update({ hueShift })} unit='%' value={finish.hueShift} />
        <RangeControl label='Metallic grain' max={100} min={0} onChange={(texture) => update({ texture })} unit='%' value={finish.texture} />
        <ChoiceControl
          label='Diffraction flow'
          onChange={(pattern) => update({ pattern })}
          options={[
            { label: 'Linear sweep', value: 'linear' },
            { label: 'Radial lens', value: 'radial' },
            { label: 'Foil pooling', value: 'patches' },
          ]}
          value={finish.pattern}
        />
        <ChoiceControl
          label='Refractor overlay'
          onChange={(overlay) => update({ overlay })}
          options={[
            { label: 'None', value: 'none' },
            { label: 'Triangles', value: 'triangles' },
            { label: 'Squares', value: 'squares' },
            { label: 'Stripes', value: 'stripes' },
          ]}
          value={finish.overlay}
        />
      </ControlSection>

      <ControlSection
        description='Bend the subdivided sticker sheet into a directional peel. The reverse side, lifted edge, and contact shadow remain physically coherent.'
        title='Peel & form'
      >
        <RangeControl label='Peel amount' max={100} min={0} onChange={(peelAmount) => update({ peelAmount })} unit='%' value={finish.peelAmount} />
        <RangeControl label='Curl radius' max={25} min={2} onChange={(curl) => update({ curl })} unit='%' value={finish.curl} />
        <RangeControl label='Contact shadow' max={100} min={0} onChange={(shadow) => update({ shadow })} unit='%' value={finish.shadow} />
        <RangeControl label='Stock depth' max={100} min={0} onChange={(depth) => update({ depth })} unit='%' value={finish.depth} />
        <ChoiceControl
          label='Peel direction'
          onChange={(peelDirection) => update({ peelDirection })}
          options={[
            { label: 'Top left', value: 'top-left' },
            { label: 'Top', value: 'top' },
            { label: 'Top right', value: 'top-right' },
            { label: 'Right', value: 'right' },
            { label: 'Bottom right', value: 'bottom-right' },
            { label: 'Bottom', value: 'bottom' },
            { label: 'Bottom left', value: 'bottom-left' },
            { label: 'Left', value: 'left' },
          ]}
          value={finish.peelDirection}
        />
        {finish.presetId === 'precision-metal-inset' ? (
          <div className='grid gap-4 border-t border-border pt-4'>
            <div>
              <p className='text-sm font-medium'>Edge architecture</p>
              <p className='mt-1 text-xs leading-5 text-muted-foreground'>Tune the polished frame, microscopic separation seam, and recessed satin insert.</p>
            </div>
            <RangeControl label='Polished frame' max={32} min={2} onChange={(bevelWidth) => update({ bevelWidth })} unit='px' value={finish.bevelWidth} />
            <RangeControl label='Separation seam' max={12} min={0} onChange={(seamWidth) => update({ seamWidth })} unit='px' value={finish.seamWidth} />
            <RangeControl label='Inset depth' max={100} min={0} onChange={(insetDepth) => update({ insetDepth })} unit='%' value={finish.insetDepth} />
          </div>
        ) : null}
      </ControlSection>
    </div>
  );
}
