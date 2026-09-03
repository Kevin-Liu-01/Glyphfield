'use client';

import { T, useGT } from 'gt-next';
import { Check, Download, FileDown, ImagePlus, Trash2 } from '@/components/ui/SolidIcons';
import { useState } from 'react';

import ExportPreview, { type ExportPreviewAsset } from '@/components/ExportPreview';
import { useStudioExportProgress } from '@/components/StudioExportProgress';
import { Button } from '@/components/ui/Button';
import StudioContextMenu, {
  contextMenuPositionFromElement,
  contextMenuPositionFromEvent,
  type StudioContextMenuPosition,
} from '@/components/ui/StudioContextMenu';
import StudioSelect from '@/components/ui/StudioSelect';
import type { ConvertedAssetLibraryController } from '@/hooks/useConvertedAssets';
import {
  CONVERTED_ASSET_SIZES,
  formatAssetBytes,
  type ConvertedAsset,
} from '@/lib/convertedAssets';

function assetPreviewFormat(
  mimeType: string,
  fallback: 'FILE' | 'PNG'
): ExportPreviewAsset['format'] {
  const subtype = mimeType.split('/').at(-1)?.split(';')[0]?.toLocaleLowerCase();
  const formats: Record<string, ExportPreviewAsset['format']> = {
    avif: 'AVIF',
    bmp: 'BMP',
    gif: 'GIF',
    jpeg: 'JPG',
    jpg: 'JPG',
    png: 'PNG',
    'svg+xml': 'SVG',
    webp: 'WEBP',
  };
  return subtype ? formats[subtype] ?? fallback : fallback;
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
  const studioExport = useStudioExportProgress('asset-conversion-library');
  const [maxDimension, setMaxDimension] = useState(2048);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [lastExport, setLastExport] = useState<ExportPreviewAsset | null>(null);
  const [assetMenu, setAssetMenu] = useState<{
    assetId: string;
    position: StudioContextMenuPosition;
  } | null>(null);
  const contextAsset = assetMenu
    ? library.assets.find(({ id }) => id === assetMenu.assetId) ?? null
    : null;

  async function previewAsset(dataUrl: string, name: string, format: 'FILE' | 'PNG') {
    studioExport.start(`Preparing ${name} preview`);
    try {
      const response = await fetch(dataUrl);
      if (!response.ok) throw new Error(gt('The asset preview could not be loaded.'));
      const blob = await response.blob();
      setLastExport({
        blob,
        fileName: name,
        format: assetPreviewFormat(blob.type, format),
        previewKind: blob.type.startsWith('image/') ? 'image' : 'file',
      });
    } finally {
      studioExport.finish();
    }
  }

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
      <ExportPreview asset={lastExport} showTrigger={false} />
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
            <article
              className={`min-w-0 overflow-hidden border bg-background ${selected ? 'border-foreground ring-1 ring-foreground' : 'border-border'}`}
              data-studio-context-trigger='asset'
              key={asset.id}
              onContextMenu={(event) => {
                event.preventDefault();
                setAssetMenu({ assetId: asset.id, position: contextMenuPositionFromEvent(event) });
              }}
            >
              <button
                aria-keyshortcuts='Shift+F10'
                aria-label={onSelect ? gt('Use {name}', { name: asset.originalName }) : gt('Preview {name}', { name: asset.originalName })}
                aria-pressed={onSelect ? selected : undefined}
                className='block w-full text-left'
                onClick={() => onSelect?.(asset)}
                onKeyDown={(event) => {
                  if (!((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu')) return;
                  event.preventDefault();
                  setAssetMenu({ assetId: asset.id, position: contextMenuPositionFromElement(event.currentTarget) });
                }}
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
                  <Button aria-label={gt('Preview original {name}', { name: asset.originalName })} onClick={() => void previewAsset(asset.originalDataUrl, asset.originalName, 'FILE')} size='icon-xs' type='button' variant='ghost'><FileDown aria-hidden='true' /></Button>
                  <Button aria-label={gt('Preview converted {name}', { name: asset.name })} onClick={() => void previewAsset(asset.convertedDataUrl, asset.name, 'PNG')} size='icon-xs' type='button' variant='ghost'><Download aria-hidden='true' /></Button>
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
      <StudioContextMenu
        detail={contextAsset ? `${contextAsset.width} × ${contextAsset.height} · ${formatAssetBytes(contextAsset.convertedBytes)}` : undefined}
        label={contextAsset?.originalName ?? gt('Asset')}
        onClose={() => setAssetMenu(null)}
        position={assetMenu?.position ?? null}
        sections={contextAsset ? [
          {
            items: [
              ...(onSelect ? [{
                checked: selectedAssetId === contextAsset.id,
                icon: <Check aria-hidden='true' />,
                id: 'use-asset',
                label: gt('Use this asset'),
                onSelect: () => onSelect(contextAsset),
              }] : []),
              {
                icon: <FileDown aria-hidden='true' />,
                id: 'preview-original',
                label: gt('Preview original'),
                onSelect: () => void previewAsset(contextAsset.originalDataUrl, contextAsset.originalName, 'FILE'),
              },
              {
                icon: <Download aria-hidden='true' />,
                id: 'preview-converted',
                label: gt('Preview converted PNG'),
                onSelect: () => void previewAsset(contextAsset.convertedDataUrl, contextAsset.name, 'PNG'),
              },
            ],
          },
          {
            items: [
              {
                danger: true,
                icon: <Trash2 aria-hidden='true' />,
                id: 'delete-asset',
                label: gt('Delete asset'),
                onSelect: () => {
                  if (selectedAssetId === contextAsset.id) onSelect?.(null);
                  void library.removeAsset(contextAsset.id);
                },
              },
            ],
          },
        ] : []}
      />
      {library.assets.length === 0 && !library.busy ? (
        <p className='mt-3 border border-dashed border-border p-4 text-center text-[10px] leading-4 text-muted-foreground'>
          <T>Converted assets stay local in this browser and can be reused across every Design Lab artboard.</T>
        </p>
      ) : null}
    </div>
  );
}
