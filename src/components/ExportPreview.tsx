'use client';

import { CheckCircle2, Download, Eye, FilePenLine, FileText, RefreshCw, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import StudioToolHeader from '@/components/StudioToolHeader';
import { Button } from '@/components/ui/Button';
import { downloadBlob } from '@/lib/download';
import type { MotionLoopReport } from '@/lib/canvasExport';

export type ExportPreviewAsset = {
  blob: Blob;
  elapsedMs?: number;
  fileName: string;
  format: 'AVIF' | 'BMP' | 'FILE' | 'GIF' | 'JPG' | 'JSON' | 'LOTTIE' | 'MP4' | 'PNG' | 'SVG' | 'WEBP';
  height?: number;
  loopReport?: MotionLoopReport;
  previewKind?: 'file' | 'image' | 'text' | 'video';
  previewText?: string;
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

function fileNameParts(fileName: string, format: ExportPreviewAsset['format']): { base: string; extension: string } {
  const leaf = fileName.split(/[\\/]/).pop()?.trim() || 'export';
  const dot = leaf.lastIndexOf('.');
  if (dot > 0 && dot < leaf.length - 1) {
    return { base: leaf.slice(0, dot), extension: leaf.slice(dot + 1).toLocaleLowerCase() };
  }
  return {
    base: leaf,
    extension: format === 'FILE' ? '' : format.toLocaleLowerCase(),
  };
}

function safeExportBaseName(value: string, fallback: string): string {
  const printable = Array.from(value).filter((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint >= 32 && codePoint !== 127;
  }).join('');
  const safe = printable
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/[.\s]+$/g, '')
    .trim();
  return safe || fallback;
}

export default function ExportPreview({
  asset,
  className,
  needsRefresh = false,
  onRefresh,
  refreshKey,
  refreshing = false,
  showTrigger = true,
}: {
  asset: ExportPreviewAsset | null;
  className?: string;
  needsRefresh?: boolean;
  onRefresh?: () => void;
  refreshKey?: string;
  refreshing?: boolean;
  showTrigger?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [fileNameBase, setFileNameBase] = useState('export');
  const [fileNameExtension, setFileNameExtension] = useState('');
  const customizedNameRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  const refreshedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!asset) {
      setOpen(false);
      setUrl(null);
      customizedNameRef.current = false;
      return;
    }

    const parts = fileNameParts(asset.fileName, asset.format);
    if (!customizedNameRef.current) setFileNameBase(parts.base);
    setFileNameExtension(parts.extension);
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

  useEffect(() => {
    if (!open || !needsRefresh || refreshing || !onRefreshRef.current) return;
    const key = refreshKey ?? 'changed';
    if (refreshedKeyRef.current === key) return;
    const timeout = window.setTimeout(() => {
      refreshedKeyRef.current = key;
      onRefreshRef.current?.();
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [needsRefresh, open, refreshKey, refreshing]);

  useEffect(() => {
    if (!needsRefresh) refreshedKeyRef.current = null;
  }, [needsRefresh]);

  if (!asset || !url) return null;

  const dimensions = asset.width && asset.height
    ? `${asset.width} × ${asset.height}`
    : null;
  const previewKind = asset.previewKind
    ?? (asset.previewText !== undefined
      ? 'text'
      : asset.format === 'MP4'
        ? 'video'
        : ['AVIF', 'BMP', 'GIF', 'JPG', 'PNG', 'SVG', 'WEBP'].includes(asset.format)
          ? 'image'
          : 'file');
  const fallbackBaseName = fileNameParts(asset.fileName, asset.format).base;
  const typedBaseName = fileNameExtension && fileNameBase.toLocaleLowerCase().endsWith(`.${fileNameExtension}`)
    ? fileNameBase.slice(0, -(fileNameExtension.length + 1))
    : fileNameBase;
  const resolvedBaseName = safeExportBaseName(typedBaseName, fallbackBaseName);
  const downloadFileName = fileNameExtension
    ? `${resolvedBaseName}.${fileNameExtension}`
    : resolvedBaseName;

  return (
    <>
      {showTrigger ? (
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
      ) : null}

      {open ? createPortal(
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
            <StudioToolHeader
              actions={<Button
                aria-label='Close export preview'
                onClick={() => setOpen(false)}
                size='icon-sm'
                type='button'
                variant='ghost'
              >
                <X aria-hidden='true' />
              </Button>}
              headingLevel={2}
              icon={<Eye aria-hidden='true' />}
              metadata={`Preview the completed ${asset.format} before saving it.`}
              title='Review export'
            />

            <div className='shader-export-content'>
              <div className='grid min-h-72 min-w-0 place-items-center overflow-hidden bg-[radial-gradient(circle,hsl(var(--border)/0.35)_1px,transparent_1px)] bg-[size:14px_14px] p-5'>
                {previewKind === 'video' ? (
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
                ) : previewKind === 'image' ? (
                  <img
                    alt={`${asset.format} export preview`}
                    className='artifact-frame block max-h-[min(66vh,680px)] w-full object-contain'
                    src={url}
                  />
                ) : previewKind === 'text' ? (
                  <pre className='studio-scroll-area max-h-[min(66vh,680px)] w-full overflow-auto whitespace-pre-wrap break-words border border-border bg-background p-5 font-mono text-xs leading-5'>
                    {asset.previewText}
                  </pre>
                ) : (
                  <div className='flex max-w-sm flex-col items-center gap-4 text-center'>
                    <FileText aria-hidden='true' className='size-10 text-muted-foreground' />
                    <div>
                      <p className='text-sm font-medium'>{downloadFileName}</p>
                      <p className='mt-1 text-xs leading-5 text-muted-foreground'>
                        This binary file is ready. Review its name, format, and size before saving it.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <aside className='flex min-w-0 flex-col gap-5 border-l border-border p-5'>
                <div className='shader-export-name'>
                  <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                    {asset.format} export
                  </p>
                  <label>
                    <span>File name</span>
                    <span className='shader-export-name-field'>
                      <FilePenLine aria-hidden='true' />
                      <input
                        aria-label={`${asset.format} export file name`}
                        onBlur={() => setFileNameBase(resolvedBaseName)}
                        onChange={(event) => {
                          customizedNameRef.current = true;
                          setFileNameBase(event.target.value);
                        }}
                        spellCheck={false}
                        type='text'
                        value={fileNameBase}
                      />
                      {fileNameExtension ? <i>.{fileNameExtension}</i> : null}
                    </span>
                  </label>
                  <p className='mt-1 font-mono text-[11px] text-muted-foreground'>
                    {[
                      dimensions,
                      formatFileSize(asset.blob.size),
                      asset.elapsedMs === undefined ? null : `rendered in ${formatRenderTime(asset.elapsedMs)}`,
                    ].filter(Boolean).join(' · ')}
                  </p>
                </div>

                {needsRefresh || previewKind === 'text' || previewKind === 'file' ? (
                  <p aria-live='polite' className='text-sm leading-6 text-muted-foreground'>
                    {needsRefresh
                      ? 'Updating the preview to match the current composition.'
                      : previewKind === 'text'
                        ? 'Review the generated contents here. Nothing is saved until you confirm the download.'
                        : 'Confirm the file name, format, and size here. Nothing is saved until you confirm the download.'}
                  </p>
                ) : null}

                {asset.loopReport ? (
                  <div className='shader-export-loop-proof' role='status'>
                    <CheckCircle2 aria-hidden='true' />
                    <span>
                      <strong>{asset.loopReport.verified ? 'Pixel-perfect loop verified' : 'Loop boundary needs review'}</strong>
                      <small>
                        {asset.loopReport.closureMismatchPixels} pixels differ from the captured seam · {asset.loopReport.overlapFrames}-frame temporal overlap
                      </small>
                    </span>
                  </div>
                ) : null}

                <div className='mt-auto flex gap-2 pt-3'>
                  <Button className='flex-1' onClick={() => setOpen(false)} type='button' variant='outline'>
                    Cancel
                  </Button>
                  <Button
                    className='flex-1'
                    disabled={refreshing || (needsRefresh && !onRefresh)}
                    loading={refreshing}
                    onClick={() => {
                      if (needsRefresh && onRefresh) {
                        onRefresh();
                        return;
                      }
                      downloadBlob(asset.blob, downloadFileName);
                      setOpen(false);
                    }}
                    type='button'
                  >
                    {needsRefresh ? <RefreshCw aria-hidden='true' /> : <Download aria-hidden='true' />}
                    {needsRefresh ? 'Update preview' : `Download ${asset.format}`}
                  </Button>
                </div>
              </aside>
            </div>
          </section>
        </div>,
        document.body
      ) : null}
    </>
  );
}
