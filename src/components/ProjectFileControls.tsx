'use client';

import { useRef, useState } from 'react';
import { Download, FileJson, Upload } from '@/components/ui/SolidIcons';
import { Button } from '@/components/ui/Button';
import { downloadBlob } from '@/lib/download';
import {
  STUDIO_PROJECT_FILE_ACCEPT,
  type StudioProjectFile,
} from '@/lib/projectFile';

async function readDefaultProjectFile(file: File): Promise<string> {
  const { readDesignLabProjectFile } = await import('@/lib/designLabProjectFile');
  return readDesignLabProjectFile(file);
}

export type ProjectFileControlsProps = {
  disabled?: boolean;
  open: (source: string) => Promise<void> | void;
  prepare: () => Promise<StudioProjectFile>;
  read?: (file: File) => Promise<string>;
  workspaceLabel?: string;
};

export function DownloadProjectFileButton({
  disabled = false,
  prepare,
}: Pick<ProjectFileControlsProps, 'disabled' | 'prepare'>) {
  const pendingRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    if (disabled || pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const file = await prepare();
      if (file.blob.size === 0 || file.blob.type !== 'application/json' || !file.fileName.endsWith('.glyphfield.json')) {
        throw new TypeError('The editable project file could not be prepared.');
      }
      downloadBlob(file.blob, file.fileName);
      setMessage('Project download started. Reopen it with Open project file.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The project file could not be downloaded.');
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }
  return <span className='inline-flex min-w-0 flex-col gap-1'>
    <Button aria-label='Download project file' disabled={disabled} loading={pending} onClick={() => void save()} size='sm' type='button' variant='outline'>
      <Download aria-hidden='true' /><span className='studio-toolbar-action-label'>Project file</span>
    </Button>
    {error ? <span className='max-w-64 text-xs text-status-error' role='alert'>{error}</span> : null}
    {message ? <span className='sr-only' role='status'>{message}</span> : null}
  </span>;
}

export function OpenProjectFileButton({
  disabled = false,
  onOpen,
  read = readDefaultProjectFile,
  workspaceLabel = 'Design Lab',
}: Pick<ProjectFileControlsProps, 'disabled' | 'read' | 'workspaceLabel'> & { onOpen: ProjectFileControlsProps['open'] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function open(file: File) {
    if (disabled || pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setMessage(null);
    setError(null);
    try {
      const source = await read(file);
      await onOpen(source);
      setMessage(`Opened ${file.name}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The project file could not be opened.');
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }
  return <span className='inline-flex min-w-0 flex-col gap-1'>
    <Button aria-label='Open project file' disabled={disabled} loading={pending} onClick={() => inputRef.current?.click()} size='sm' title={`Open an editable ${workspaceLabel} project file in this workspace`} type='button' variant='outline'>
      <Upload aria-hidden='true' /><span className='studio-toolbar-action-label'>Open project</span>
    </Button>
    <input
      accept={STUDIO_PROJECT_FILE_ACCEPT}
      aria-label='Choose project file'
      className='sr-only'
      disabled={disabled || pending}
      onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (file) void open(file);
      }}
      ref={inputRef}
      tabIndex={-1}
      type='file'
    />
    {error ? <span className='max-w-64 text-xs text-status-error' role='alert'>{error}</span> : null}
    {message ? <span className='sr-only' role='status'>{message}</span> : null}
  </span>;
}

export default function ProjectFileControls({ disabled, open, prepare, read, workspaceLabel = 'Design Lab' }: ProjectFileControlsProps) {
  return <section aria-label='Editable project file' className='flex flex-col gap-2 rounded-md border border-border p-3'>
    <strong className='flex items-center gap-2 text-sm'><FileJson aria-hidden='true' className='size-4' />Editable project</strong>
    <p className='text-xs leading-5 text-muted-foreground'>Share all artboards, editable layers, embedded assets, and saved shader frames as a .glyphfield.json file.</p>
    <div className='flex flex-wrap gap-2'>
      <DownloadProjectFileButton disabled={disabled} prepare={prepare} />
      <OpenProjectFileButton disabled={disabled} onOpen={open} read={read} workspaceLabel={workspaceLabel} />
    </div>
    <p className='text-xs leading-5 text-muted-foreground'>Opening replaces this {workspaceLabel} workspace. Saved versions remain available.</p>
  </section>;
}
