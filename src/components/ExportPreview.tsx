'use client';

import { CheckCircle2, Download, Eye, FilePenLine, FileText, RefreshCw, X } from '@/components/ui/SolidIcons';
import { useEffect, useRef, useState, type ReactNode } from 'react';
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

type ExportPreviewKind = NonNullable<ExportPreviewAsset['previewKind']>;

function exportPreviewKind(asset: ExportPreviewAsset): ExportPreviewKind {
  if (asset.previewKind) return asset.previewKind;
  if (asset.previewText !== undefined) return 'text';
  if (asset.format === 'MP4') return 'video';
  return ['AVIF', 'BMP', 'GIF', 'JPG', 'PNG', 'SVG', 'WEBP'].includes(asset.format)
    ? 'image'
    : 'file';
}

function ExportPreviewMedia({
  asset,
  downloadFileName,
  kind,
  url,
}: {
  asset: ExportPreviewAsset;
  downloadFileName: string;
  kind: ExportPreviewKind;
  url: string;
}) {
  if (kind === 'video') {
    return <video aria-label={`${asset.format} export preview`} autoPlay className='artifact-frame block max-h-[min(66vh,680px)] w-full object-contain' controls loop muted playsInline src={url} />;
  }
  if (kind === 'image') {
    return <img alt={`${asset.format} export preview`} className='artifact-frame block max-h-[min(66vh,680px)] w-full object-contain' src={url} />;
  }
  if (kind === 'text') {
    return <pre className='studio-scroll-area max-h-[min(66vh,680px)] w-full overflow-auto whitespace-pre-wrap break-words border border-border bg-background p-5 font-mono text-xs leading-5'>{asset.previewText}</pre>;
  }
  return (
    <div className='flex max-w-sm flex-col items-center gap-4 text-center'>
      <FileText aria-hidden='true' className='size-10 text-muted-foreground' />
      <div>
        <p className='text-sm font-medium'>{downloadFileName}</p>
        <p className='mt-1 text-xs leading-5 text-muted-foreground'>
          This binary file is ready. Review its name, format, and size before saving it.
        </p>
      </div>
    </div>
  );
}

function ExportPreviewContext({
  kind,
  needsRefresh,
  refreshing,
}: {
  kind: ExportPreviewKind;
  needsRefresh: boolean;
  refreshing: boolean;
}) {
  if (!needsRefresh && !refreshing && kind !== 'text' && kind !== 'file') return null;
  const message = refreshing
    ? 'Rendering the updated preview with these export settings.'
    : needsRefresh
      ? 'Export settings changed. Update the preview before downloading.'
    : kind === 'text'
      ? 'Review the generated contents here. Nothing is saved until you confirm the download.'
      : 'Confirm the file name, format, and size here. Nothing is saved until you confirm the download.';
  return <p aria-live='polite' className='text-sm leading-6 text-muted-foreground'>{message}</p>;
}

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

function exportDimensions(asset: ExportPreviewAsset): string | null {
  if (!asset.width || !asset.height) return null;
  return `${asset.width} × ${asset.height}`;
}

function exportPreviewTriggerLabel(asset: ExportPreviewAsset, triggerLabel?: string): string {
  return triggerLabel || `${asset.format} preview`;
}

function exportFileMetadata(dimensions: string | null, asset: ExportPreviewAsset): string {
  return dimensions ? `${dimensions} px` : asset.format;
}

function ExportPreviewConfiguration({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <section className='shader-export-settings'>
      <div className='shader-export-section-heading'>
        <strong>Export settings</strong>
        <small>Configure the file before rendering</small>
      </div>
      {children}
    </section>
  );
}

function useExportPreviewRefresh({
  autoRefresh,
  needsRefresh,
  onRefresh,
  open,
  refreshKey,
  refreshing,
}: {
  autoRefresh: boolean;
  needsRefresh: boolean;
  onRefresh?: () => void;
  open: boolean;
  refreshKey?: string;
  refreshing: boolean;
}) {
  const onRefreshRef = useRef(onRefresh);
  const refreshedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!autoRefresh || !open || !needsRefresh || refreshing || !onRefreshRef.current) return;
    const key = refreshKey ?? 'changed';
    if (refreshedKeyRef.current === key) return;
    const timeout = window.setTimeout(() => {
      refreshedKeyRef.current = key;
      onRefreshRef.current?.();
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [autoRefresh, needsRefresh, open, refreshKey, refreshing]);

  useEffect(() => {
    if (!needsRefresh) refreshedKeyRef.current = null;
  }, [needsRefresh]);
}

export default function ExportPreview({
  asset,
  autoRefresh = true,
  className,
  configuration,
  needsRefresh = false,
  onRefresh,
  refreshKey,
  refreshing = false,
  showTrigger = true,
  triggerLabel,
}: {
  asset: ExportPreviewAsset | null;
  autoRefresh?: boolean;
  className?: string;
  configuration?: ReactNode;
  needsRefresh?: boolean;
  onRefresh?: () => void;
  refreshKey?: string;
  refreshing?: boolean;
  showTrigger?: boolean;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [fileNameBase, setFileNameBase] = useState('export');
  const [fileNameExtension, setFileNameExtension] = useState('');
  const customizedNameRef = useRef(false);

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

  useExportPreviewRefresh({ autoRefresh, needsRefresh, onRefresh, open, refreshKey, refreshing });

  if (!asset || !url) return null;

  const dimensions = exportDimensions(asset);
  const previewKind = exportPreviewKind(asset);
  const fallbackBaseName = fileNameParts(asset.fileName, asset.format).base;
  const typedBaseName = fileNameExtension && fileNameBase.toLocaleLowerCase().endsWith(`.${fileNameExtension}`)
    ? fileNameBase.slice(0, -(fileNameExtension.length + 1))
    : fileNameBase;
  const resolvedBaseName = safeExportBaseName(typedBaseName, fallbackBaseName);
  const downloadFileName = fileNameExtension
    ? `${resolvedBaseName}.${fileNameExtension}`
    : resolvedBaseName;
  const resolvedTriggerLabel = exportPreviewTriggerLabel(asset, triggerLabel);
  const fileMetadata = exportFileMetadata(dimensions, asset);

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
          <span className='responsive-toolbar-label'>{resolvedTriggerLabel}</span>
          <span className='hidden font-mono text-[10px] text-muted-foreground 2xl:inline'>
            {formatFileSize(asset.blob.size)}
          </span>
        </Button>
      ) : null}

      {open ? createPortal(
        <dialog
          aria-label={`${asset.format} export preview`}
          aria-modal='true'
          className='shader-export-overlay'
          onCancel={(event) => {
            event.preventDefault();
            setOpen(false);
          }}
          open
        >
          <button
            aria-label='Close export preview'
            className='studio-modal-backdrop'
            onClick={() => setOpen(false)}
            type='button'
          />
          <section className='shader-export-dialog'>
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
                <ExportPreviewMedia asset={asset} downloadFileName={downloadFileName} kind={previewKind} url={url} />
              </div>

              <aside className='shader-export-sidebar studio-scroll-area'>
                <ExportPreviewConfiguration>{configuration}</ExportPreviewConfiguration>

                <section className='shader-export-name'>
                  <div className='shader-export-section-heading'>
                    <strong>File</strong>
                    <small>{fileMetadata}</small>
                  </div>
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
                </section>

                <ExportPreviewContext kind={previewKind} needsRefresh={needsRefresh} refreshing={refreshing} />

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

                <div className='shader-export-actions'>
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
        </dialog>,
        document.body
      ) : null}
    </>
  );
}
