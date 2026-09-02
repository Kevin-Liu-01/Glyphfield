'use client';

import { Check, ImagePlus, Upload, X } from '@/components/ui/SolidIcons';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { createPortal } from 'react-dom';

import StudioToolHeader from '@/components/StudioToolHeader';
import { Button } from '@/components/ui/Button';
import type { BrandAsset } from '@/lib/brandIdentity';
import { imageLayerName } from '@/lib/imagePlacement';

export type PendingImageImport = {
  file: File;
  label: string;
};

export type ImageImportRequest = {
  files: readonly File[];
  id: number;
};

function fileSize(size: number): string {
  if (size < 1_000_000) return `${Math.max(1, Math.round(size / 1_000))} KB`;
  return `${(size / 1_000_000).toFixed(1)} MB`;
}

function FilePreview({ file }: { file: File }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const nextUrl = URL.createObjectURL(file);
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);
  return url ? <img alt='' draggable={false} src={url} /> : <span aria-hidden='true' />;
}

function queuedImports(files: readonly File[]): PendingImageImport[] {
  return files.map((file) => ({ file, label: imageLayerName(file.name) }));
}

function isReusableImageAsset(asset: BrandAsset): boolean {
  return asset.type !== 'motion' && Boolean(asset.path);
}

export default function ImageAssetModal({
  assets,
  busy,
  error,
  onClose,
  onImport,
  onPlace,
  open,
  request,
}: {
  assets: readonly BrandAsset[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onImport: (items: readonly PendingImageImport[]) => Promise<void> | void;
  onPlace: (asset: BrandAsset) => Promise<void> | void;
  open: boolean;
  request: ImageImportRequest | null;
}) {
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState<PendingImageImport[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const requestId = request?.id ?? 0;
  const reusableAssets = useMemo(() => assets.filter(isReusableImageAsset), [assets]);

  useEffect(() => {
    if (!open) {
      setDragging(false);
      setPending([]);
      return;
    }
    setPending(queuedImports(request?.files ?? []));
  }, [open, requestId, request?.files]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [busy, onClose, open]);

  if (!open) return null;

  function addFiles(files: FileList | readonly File[] | null) {
    const next = queuedImports(Array.from(files ?? []));
    if (next.length === 0) return;
    setPending((current) => [...current, ...next]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer.files);
  }

  return createPortal(
    <dialog aria-label='Add image assets' aria-modal='true' className='shader-export-overlay' open>
      <button aria-label='Close image library' className='studio-modal-backdrop' disabled={busy} onClick={onClose} type='button' />
      <section className='image-asset-dialog'>
        <StudioToolHeader
          actions={<Button aria-label='Close image library' disabled={busy} onClick={onClose} size='icon-sm' type='button' variant='ghost'><X aria-hidden='true' /></Button>}
          headingLevel={2}
          icon={<ImagePlus aria-hidden='true' />}
          metadata='Upload once, reuse everywhere, and keep the source embedded in saved composition code.'
          title='Add image'
        />

        <div className='image-asset-dialog__body'>
          <section className='image-asset-import'>
            <div className='image-asset-section-heading'>
              <div><h3>Upload new</h3><p>Browse, drop, or paste an image. Confirming saves it to this brand’s Asset library and places it on the canvas.</p></div>
              <span>{pending.length} queued</span>
            </div>
            <div
              className='image-asset-dropzone'
              data-dragging={dragging || undefined}
              onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
              onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
            >
              <Upload aria-hidden='true' />
              <div><strong>Drop images here</strong><span>PNG, JPG, WebP, AVIF, GIF, BMP, or SVG · 4 MB each</span></div>
              <Button onClick={() => fileInputRef.current?.click()} size='sm' type='button' variant='outline'>Browse files</Button>
              <input
                accept='image/*,.svg,.avif,.bmp'
                aria-label='Choose new images'
                className='sr-only'
                multiple
                onChange={(event: ChangeEvent<HTMLInputElement>) => addFiles(event.target.files)}
                ref={fileInputRef}
                type='file'
              />
            </div>

            {pending.length > 0 ? (
              <div aria-label='Images ready to import' className='image-asset-pending-list'>
                {pending.map((item, index) => (
                  <article key={`${item.file.name}:${item.file.size}:${index}`}>
                    <div className='image-asset-pending-preview'><FilePreview file={item.file} /></div>
                    <label>
                      <span>Asset name</span>
                      <input
                        aria-label={`Asset name for ${item.file.name}`}
                        onChange={(event) => setPending((current) => current.map((candidate, candidateIndex) => (
                          candidateIndex === index ? { ...candidate, label: event.target.value } : candidate
                        )))}
                        value={item.label}
                      />
                      <small>{fileSize(item.file.size)} · encoding verified on import</small>
                    </label>
                    <Button aria-label={`Remove ${item.file.name}`} onClick={() => setPending((current) => current.filter((_, candidateIndex) => candidateIndex !== index))} size='icon-sm' type='button' variant='ghost'><X aria-hidden='true' /></Button>
                  </article>
                ))}
              </div>
            ) : null}
          </section>

          <section className='image-asset-library'>
            <div className='image-asset-section-heading'>
              <div><h3>Brand assets</h3><p>Place an existing asset without making another copy.</p></div>
              <span>{reusableAssets.length} saved</span>
            </div>
            {reusableAssets.length > 0 ? (
              <div aria-label='Reusable brand assets' className='image-asset-library-grid'>
                {reusableAssets.map((asset) => (
                  <button disabled={busy} key={asset.id} onClick={() => void onPlace(asset)} type='button'>
                    <span><img alt='' draggable={false} src={asset.path} /></span>
                    <strong>{asset.label}</strong>
                    <small>{asset.type}</small>
                  </button>
                ))}
              </div>
            ) : (
              <div className='image-asset-library-empty'>Your first upload will appear here for reuse.</div>
            )}
          </section>
        </div>

        <footer className='image-asset-dialog__footer'>
          <div aria-live='polite'>
            {error ? <span data-state='error'>{error}</span> : <span><Check aria-hidden='true' />Original bytes remain embedded in Assets, autosave, code, and export.</span>}
          </div>
          <Button disabled={busy} onClick={onClose} type='button' variant='outline'>Cancel</Button>
          <Button disabled={pending.length === 0 || busy} loading={busy} onClick={() => void onImport(pending)} type='button'>
            <Upload aria-hidden='true' />Import &amp; save{pending.length > 0 ? ` ${pending.length}` : ''}
          </Button>
        </footer>
      </section>
    </dialog>,
    document.body
  );
}
