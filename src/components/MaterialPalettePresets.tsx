'use client';

import { T } from 'gt-next';

import type { BrandIdentity } from '@/lib/brandIdentity';
import {
  brandMaterialPalette,
  LIVE_MATERIAL_PALETTES,
  type LiveMaterialPalette,
} from '@/lib/liveMaterials';

function colorsMatch(left: readonly string[], right: readonly string[]) {
  return left.length === right.length
    && left.every((color, index) => color.toLocaleLowerCase() === right[index]?.toLocaleLowerCase());
}

export default function MaterialPalettePresets({
  identity,
  onSelect,
  value,
}: {
  identity: Pick<BrandIdentity, 'colors' | 'id' | 'name' | 'shortName'>;
  onSelect: (colors: LiveMaterialPalette['colors']) => void;
  value: readonly string[];
}) {
  const palettes = [brandMaterialPalette(identity), ...LIVE_MATERIAL_PALETTES];

  return (
    <div className='grid grid-cols-2 gap-2'>
      {palettes.map((palette, index) => {
        const selected = colorsMatch(value, palette.colors);

        return (
          <button
            aria-pressed={selected}
            className='flex min-w-0 flex-col gap-2 border border-border p-2 text-left hover:border-foreground hover:bg-muted aria-pressed:border-foreground aria-pressed:bg-muted'
            key={palette.id}
            onClick={() => onSelect(palette.colors)}
            title={palette.description}
            type='button'
          >
            <span className='grid h-5 w-full grid-cols-3 overflow-hidden border border-border'>
              {palette.colors.map((color) => <span key={color} style={{ backgroundColor: color }} />)}
            </span>
            <span className='flex min-w-0 items-center justify-between gap-1'>
              <span className='truncate text-[10px] font-medium'>{palette.name}</span>
              {index === 0 ? (
                <span className='shrink-0 text-[9px] text-muted-foreground'><T>Default</T></span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
