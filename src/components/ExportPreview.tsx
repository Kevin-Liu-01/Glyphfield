'use client';

import { Download, Eye, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { downloadBlob } from '@/lib/download';

export type ExportPreviewAsset = {
  blob: Blob;
  elapsedMs?: number;
  fileName: string;
  format: 'GIF' | 'JPG' | 'MP4' | 'PNG';
  height?: number;
  width?: number;
};

function formatFileSize(size: number): string {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRenderTime(elapsedMs: number): string {
  if (elapsedMs < 1_000) return `${Math.max(1, Math.round(elapsedMs))} ms`;
  return `${(elapsedMs / 1_000).toFixed(1)} s`;
}

export default function ExportPreview({
  asset,
  className,
}: {
  asset: ExportPreviewAsset | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!asset) {
      setOpen(false);
      setUrl(null);
      return;
    }

    const nextUrl = URL.createObjectURL(asset.blob);
    setUrl(nextUrl);
    setOpen(true);
    return () => URL.revokeObjectURL(nextUrl);
  }, [asset]);

  useEffect(() => {
    if (!open) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  if (!asset || !url) return null;

  const dimensions = asset.width && asset.height
    ? `${asset.width} × ${asset.height}`
    : null;

  return (
    <>
      <Button
        aria-haspopup='dialog'
        className={className}
        onClick={() => setOpen(true)}
        type='button'
        variant='outline'
      >
        <Eye aria-hidden='true' />
        <span className='responsive-toolbar-label'>{asset.format} preview</span>
        <span className='hidden font-mono text-[10px] text-muted-foreground 2xl:inline'>
          {formatFileSize(asset.blob.size)}
        </span>
      </Button>

      {open ? (
        <div
          className='shader-export-overlay'
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setOpen(false);
          }}
        >
          <section
            aria-label={`${asset.format} export preview`}
            aria-modal='true'
            className='shader-export-dialog'
            role='dialog'
          >
            <header className='flex items-start justify-between gap-4 border-b border-border p-5'>
              <div className='min-w-0'>
                <h2 className='text-base font-semibold'>Review export</h2>
                <p className='mt-1 text-sm text-muted-foreground'>
                  Preview the completed {asset.format} before saving it.
                </p>
              </div>
              <Button
                aria-label='Close export preview'
                onClick={() => setOpen(false)}
                size='icon-sm'
                type='button'
                variant='ghost'
              >
                <X aria-hidden='true' />
              </Button>
            </header>

            <div className='shader-export-content'>
              <div className='grid min-h-72 min-w-0 place-items-center overflow-hidden bg-[radial-gradient(circle,hsl(var(--border)/0.35)_1px,transparent_1px)] bg-[size:14px_14px] p-5'>
                {asset.format === 'MP4' ? (
                  <video
                    aria-label={`${asset.format} export preview`}
                    autoPlay
                    className='artifact-frame block max-h-[min(66vh,680px)] w-full object-contain'
                    controls
                    loop
                    muted
                    playsInline
                    src={url}
                  />
                ) : (
                  <img
                    alt={`${asset.format} export preview`}
                    className='artifact-frame block max-h-[min(66vh,680px)] w-full object-contain'
                    src={url}
                  />
                )}
              </div>

              <aside className='flex min-w-0 flex-col gap-5 border-l border-border p-5'>
                <div>
                  <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                    {asset.format} export
                  </p>
                  <p className='mt-2 break-all text-sm font-medium'>{asset.fileName}</p>
                  <p className='mt-1 font-mono text-[11px] text-muted-foreground'>
                    {[
                      dimensions,
                      formatFileSize(asset.blob.size),
                      asset.elapsedMs === undefined ? null : `rendered in ${formatRenderTime(asset.elapsedMs)}`,
                    ].filter(Boolean).join(' · ')}
                  </p>
                </div>

                <p className='text-sm leading-6 text-muted-foreground'>
                  Check the final framing and detail here. The exported file is already rendered and
                  will download without being generated again.
                </p>

                <div className='mt-auto flex gap-2 pt-3'>
                  <Button className='flex-1' onClick={() => setOpen(false)} type='button' variant='outline'>
                    Cancel
                  </Button>
                  <Button className='flex-1' onClick={() => downloadBlob(asset.blob, asset.fileName)} type='button'>
                    <Download aria-hidden='true' />
                    Download {asset.format}
                  </Button>
                </div>
              </aside>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
