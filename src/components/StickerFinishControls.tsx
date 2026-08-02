'use client';

import type { ReactNode } from 'react';
import { Check } from 'lucide-react';

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

export default function StickerFinishControls({
  onChange,
  settings,
}: {
  onChange: (settings: StickerFinishSettings) => void;
  settings?: Partial<StickerFinishSettings>;
}) {
  const finish = normalizeStickerFinish(settings);

  function update(patch: Partial<StickerFinishSettings>) {
    onChange({ ...finish, ...patch, presetId: 'custom' });
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
              <span className='flex min-h-10 items-center gap-2 border-t border-border bg-background px-2 py-1.5'>
                <span className='min-w-0 flex-1 truncate text-[10px] font-medium'>{preset.label}</span>
                {selected ? <Check aria-hidden='true' className='size-3 shrink-0' /> : null}
              </span>
            </button>
          );
        })}
      </div>

      <div className='grid gap-4 border-t border-border pt-4'>
        <RangeControl label='Finish intensity' max={100} min={0} onChange={(intensity) => update({ intensity })} unit='%' value={finish.intensity} />
        <RangeControl label='Glint angle' max={180} min={0} onChange={(glintAngle) => update({ glintAngle })} unit='°' value={finish.glintAngle} />
        <RangeControl label='Material texture' max={100} min={0} onChange={(texture) => update({ texture })} unit='%' value={finish.texture} />
        <RangeControl label='Die-cut edge' max={32} min={2} onChange={(edgeWidth) => update({ edgeWidth })} unit='px' value={finish.edgeWidth} />
        <RangeControl label='Physical depth' max={100} min={0} onChange={(depth) => update({ depth })} unit='%' value={finish.depth} />
      </div>
    </div>
  );
}
