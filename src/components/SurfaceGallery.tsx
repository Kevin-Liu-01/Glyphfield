'use client';

import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';

import {
  buildBackgroundSvg,
  DEFAULT_BACKGROUND_SETTINGS,
  type BackgroundSettings,
} from '@/lib/backgroundSvg';

export type SurfaceGalleryPreset = {
  category: string;
  description: string;
  id: string;
  name: string;
  previewUrl?: string;
  settings: Partial<BackgroundSettings>;
  source?: {
    license: string;
    name: string;
    url: string;
  };
};

export default function SurfaceGallery({
  onSelect,
  presets,
  selectedId,
}: {
  onSelect: (preset: SurfaceGalleryPreset) => void;
  presets: readonly SurfaceGalleryPreset[];
  selectedId?: string;
}) {
  const [category, setCategory] = useState('Open PBR');
  const categories = useMemo(
    () => ['Open PBR', 'Procedural', 'Fields', 'All', ...Array.from(new Set(presets.map((preset) => preset.category)))],
    [presets]
  );
  const visiblePresets = category === 'All'
    ? presets
    : category === 'Open PBR'
      ? presets.filter((preset) => preset.source)
      : category === 'Procedural'
        ? presets.filter((preset) => !preset.source && preset.settings.surfaceMaterial && preset.settings.surfaceMaterial !== 'none')
      : category === 'Fields'
        ? presets.filter((preset) => !preset.settings.surfaceMaterial || preset.settings.surfaceMaterial === 'none')
        : presets.filter((preset) => preset.category === category);
  const previews = useMemo(
    () => new Map(presets.flatMap((preset) => {
      if (preset.previewUrl) return [];
      const previewSettings: BackgroundSettings = {
        ...DEFAULT_BACKGROUND_SETTINGS,
        ...preset.settings,
        height: 126,
        width: 216,
      };
      return [[preset.id, buildBackgroundSvg(previewSettings)] as const];
    })),
    [presets]
  );

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex gap-1 overflow-x-auto pb-1'>
        {categories.map((item) => (
          <button
            className={`shrink-0 border px-2 py-1 text-[10px] ${category === item ? 'border-foreground bg-foreground text-background' : 'border-border bg-background text-muted-foreground hover:text-foreground'}`}
            key={item}
            onClick={() => setCategory(item)}
            type='button'
          >
            {item}
          </button>
        ))}
      </div>
      <div className='grid grid-cols-2 gap-2'>
        {visiblePresets.map((preset) => {
          const preview = previews.get(preset.id) ?? '';
          const selected = selectedId === preset.id;
          return (
            <button
              aria-label={`Use ${preset.name}: ${preset.description}`}
              aria-pressed={selected}
              className={`group min-w-0 overflow-hidden border text-left transition-colors ${selected ? 'border-foreground ring-1 ring-foreground' : 'border-border hover:border-muted-foreground'}`}
              key={preset.id}
              onClick={() => onSelect(preset)}
              title={preset.description}
              type='button'
            >
              {preset.previewUrl ? (
                <span className='relative block aspect-[12/7] overflow-hidden bg-muted'>
                  <img alt='' className='size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]' loading='lazy' src={preset.previewUrl} />
                </span>
              ) : (
                <span className='relative block aspect-[12/7] overflow-hidden bg-muted [&>svg]:size-full' dangerouslySetInnerHTML={{ __html: preview }} />
              )}
              <span className='flex min-h-12 items-center gap-2 border-t border-border bg-background px-2 py-2'>
                <span className='min-w-0 flex-1'>
                  <span className='block truncate text-[11px] font-medium'>{preset.name}</span>
                  {preset.source ? <span className='mt-0.5 block truncate font-mono text-[8px] uppercase tracking-wider text-muted-foreground'>{preset.source.name} · {preset.source.license}</span> : null}
                </span>
                {selected ? <Check aria-hidden='true' className='size-3 shrink-0' /> : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
