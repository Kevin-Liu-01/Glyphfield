'use client';

import { T, useGT } from 'gt-next';
import { Check, Download, FileDown, ImagePlus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import StudioSelect from '@/components/ui/StudioSelect';
import type { ConvertedAssetLibraryController } from '@/hooks/useConvertedAssets';
import {
  CONVERTED_ASSET_SIZES,
  formatAssetBytes,
  type ConvertedAsset,
} from '@/lib/convertedAssets';

function downloadAsset(dataUrl: string, name: string) {
  const link = document.createElement('a');
  link.download = name;
  link.href = dataUrl;
  document.body.append(link);
  link.click();
  link.remove();
}

export default function AssetConversionLibrary({
  compact = false,
  library,
  onSelect,
  selectedAssetId,
}: {
  compact?: boolean;
  library: ConvertedAssetLibraryController;
  onSelect?: (asset: ConvertedAsset | null) => void;
  selectedAssetId?: string | null;
}) {
  const gt = useGT();
  const [maxDimension, setMaxDimension] = useState(2048);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function importSelection(files: FileList | null) {
    if (!files?.length) return;
    try {
      const assets = await library.importFiles([...files], maxDimension);
      const first = assets[0];
      if (first && onSelect) onSelect(first);
      setFeedback(gt('Converted {count} file(s) to shader-safe PNG.', { count: assets.length }));
    } catch {
      setFeedback(null);
    }
  }

  return (
    <div className={`asset-conversion-library ${compact ? 'asset-conversion-library-compact' : ''}`}>
      <div className='grid grid-cols-[minmax(0,1fr)_112px] gap-2'>
        <label className='flex min-h-14 cursor-pointer items-center gap-3 border border-dashed border-input px-3 py-2 hover:bg-muted'>
          <ImagePlus aria-hidden='true' className='size-4 shrink-0 text-muted-foreground' />
          <span className='min-w-0'>
            <strong className='block text-xs'><T>Add and convert</T></strong>
            <small className='block truncate text-[10px] text-muted-foreground'><T>SVG, PNG, JPG, WebP, GIF, AVIF</T></small>
          </span>
          <input
            accept='image/*,.svg,.avif,.bmp'
            className='sr-only'
            disabled={library.busy}
            multiple
            onChange={(event) => {
              void importSelection(event.target.files);
              event.target.value = '';
            }}
            type='file'
          />
        </label>
        <StudioSelect
          ariaLabel={gt('Converted asset size')}
          disabled={library.busy}
          onValueChange={(value) => setMaxDimension(Number(value))}
          options={CONVERTED_ASSET_SIZES.map((size) => ({ label: `${size}px`, value: String(size) }))}
          value={String(maxDimension)}
        />
      </div>

      {library.busy ? <p className='mt-2 text-[10px] text-muted-foreground'><T>Sanitizing and converting to PNG…</T></p> : null}
      {library.error ? <p className='mt-2 text-xs text-status-error'>{library.error}</p> : null}
      {feedback ? <p className='mt-2 text-[10px] text-muted-foreground'>{feedback}</p> : null}

      {onSelect && selectedAssetId ? (
        <Button className='mt-2 w-full' onClick={() => onSelect(null)} size='sm' type='button' variant='outline'>
          <T>Use no converted asset</T>
        </Button>
      ) : null}

      <div className={`mt-3 grid gap-2 ${compact ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-3'}`}>
        {library.assets.map((asset) => {
          const selected = selectedAssetId === asset.id;
          return (
            <article className={`min-w-0 overflow-hidden border bg-background ${selected ? 'border-foreground ring-1 ring-foreground' : 'border-border'}`} key={asset.id}>
              <button
                aria-label={onSelect ? gt('Use {name}', { name: asset.originalName }) : gt('Preview {name}', { name: asset.originalName })}
                aria-pressed={onSelect ? selected : undefined}
                className='block w-full text-left'
                onClick={() => onSelect?.(asset)}
                type='button'
              >
                <span className='relative block aspect-[16/10] overflow-hidden bg-[linear-gradient(45deg,hsl(var(--muted))_25%,transparent_25%,transparent_75%,hsl(var(--muted))_75%),linear-gradient(45deg,hsl(var(--muted))_25%,transparent_25%,transparent_75%,hsl(var(--muted))_75%)] bg-[length:16px_16px] bg-[position:0_0,8px_8px]'>
                  <img alt='' className='absolute inset-0 size-full object-contain' src={asset.convertedDataUrl} />
                  {selected ? <span className='absolute top-2 right-2 grid size-5 place-items-center bg-foreground text-background'><Check aria-hidden='true' className='size-3' /></span> : null}
                </span>
                <span className='block p-2'>
                  <strong className='block truncate text-[11px]'>{asset.originalName}</strong>
                  <small className='mt-1 block font-mono text-[9px] uppercase text-muted-foreground'>
                    {asset.sourceMimeType.replace('image/', '') || 'image'} → PNG · {asset.width}×{asset.height}
                  </small>
                </span>
              </button>
              <div className='flex items-center justify-between border-t border-border px-2 py-1.5'>
                <span className='truncate font-mono text-[9px] text-muted-foreground'>{formatAssetBytes(asset.convertedBytes)}</span>
                <span className='flex gap-1'>
                  <Button aria-label={gt('Download original {name}', { name: asset.originalName })} onClick={() => downloadAsset(asset.originalDataUrl, asset.originalName)} size='icon-xs' type='button' variant='ghost'><FileDown aria-hidden='true' /></Button>
                  <Button aria-label={gt('Download converted {name}', { name: asset.name })} onClick={() => downloadAsset(asset.convertedDataUrl, asset.name)} size='icon-xs' type='button' variant='ghost'><Download aria-hidden='true' /></Button>
                  <Button
                    aria-label={gt('Delete {name}', { name: asset.name })}
                    onClick={() => {
                      if (selected) onSelect?.(null);
                      void library.removeAsset(asset.id);
                    }}
                    size='icon-xs'
                    type='button'
                    variant='ghost'
                  >
                    <Trash2 aria-hidden='true' />
                  </Button>
                </span>
              </div>
            </article>
          );
        })}
      </div>
      {library.assets.length === 0 && !library.busy ? (
        <p className='mt-3 border border-dashed border-border p-4 text-center text-[10px] leading-4 text-muted-foreground'>
          <T>Converted assets stay local in this browser and can be reused across Shaders and Design Lab.</T>
        </p>
      ) : null}
    </div>
  );
}
