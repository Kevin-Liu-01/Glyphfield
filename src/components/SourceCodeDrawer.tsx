'use client';

import {
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { T, useGT } from 'gt-next';
import { Check, Code2, RotateCcw, X } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { useMountEffect } from '@/hooks/useMountEffect';

const DEFAULT_DRAWER_WIDTH = 512;
const MIN_DRAWER_WIDTH = 320;
const MAX_DRAWER_WIDTH = 760;
const DRAWER_WIDTH_STORAGE_KEY = 'glyphfield:source-code-drawer:width';

function clampDrawerWidth(width: number) {
  return Math.min(MAX_DRAWER_WIDTH, Math.max(MIN_DRAWER_WIDTH, width));
}

export function SourceCodeButton({ onClick }: { onClick: () => void }) {
  const gt = useGT();

  return (
    <Button
      aria-label={gt('Edit source code')}
      onClick={onClick}
      title={gt('Edit source code')}
      type='button'
      variant='outline'
    >
      <Code2 aria-hidden='true' />
      <span className='responsive-toolbar-label'><T>Code</T></span>
    </Button>
  );
}

export default function SourceCodeDrawer({
  format,
  onApply,
  onClose,
  source,
  title,
}: {
  format: string;
  onApply: (source: string) => void;
  onClose: () => void;
  source: string;
  title?: string;
}) {
  const gt = useGT();
  const [draft, setDraft] = useState(source);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [width, setWidth] = useState(DEFAULT_DRAWER_WIDTH);
  const [resizing, setResizing] = useState(false);
  const dragRef = useRef({
    currentWidth: DEFAULT_DRAWER_WIDTH,
    pointerId: 0,
    startWidth: DEFAULT_DRAWER_WIDTH,
    startX: 0,
  });

  useMountEffect(() => {
    const storedValue = window.localStorage.getItem(DRAWER_WIDTH_STORAGE_KEY);
    if (storedValue === null) return;
    const storedWidth = Number(storedValue);
    if (!Number.isFinite(storedWidth)) return;
    const nextWidth = clampDrawerWidth(storedWidth);
    dragRef.current.currentWidth = nextWidth;
    setWidth(nextWidth);
  });

  function updateWidth(nextWidth: number) {
    const clampedWidth = clampDrawerWidth(nextWidth);
    dragRef.current.currentWidth = clampedWidth;
    setWidth(clampedWidth);
    return clampedWidth;
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      currentWidth: width,
      pointerId: event.pointerId,
      startWidth: width,
      startX: event.clientX,
    };
    setResizing(true);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!resizing || event.pointerId !== dragRef.current.pointerId) return;
    updateWidth(
      dragRef.current.startWidth - (event.clientX - dragRef.current.startX)
    );
  }

  function finishResize(event: PointerEvent<HTMLDivElement>) {
    if (!resizing || event.pointerId !== dragRef.current.pointerId) return;
    setResizing(false);
    window.localStorage.setItem(
      DRAWER_WIDTH_STORAGE_KEY,
      String(dragRef.current.currentWidth)
    );
  }

  function handleResizeKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 32 : 8;
    let nextWidth: number | null = null;
    if (event.key === 'Home') nextWidth = MIN_DRAWER_WIDTH;
    if (event.key === 'End') nextWidth = MAX_DRAWER_WIDTH;
    if (event.key === 'ArrowLeft') nextWidth = width + step;
    if (event.key === 'ArrowRight') nextWidth = width - step;
    if (nextWidth === null) return;
    event.preventDefault();
    const clampedWidth = updateWidth(nextWidth);
    window.localStorage.setItem(DRAWER_WIDTH_STORAGE_KEY, String(clampedWidth));
  }

  function apply() {
    try {
      onApply(draft);
      setError(null);
      setApplied(true);
    } catch (caught) {
      setApplied(false);
      setError(caught instanceof Error ? caught.message : gt('The source could not be applied.'));
    }
  }

  function reset() {
    setDraft(source);
    setError(null);
    setApplied(false);
  }

  return (
    <aside
      aria-label={gt('Source code editor')}
      className='source-code-drawer'
      data-canvas-selection-preserve
      data-resizing={resizing ? 'true' : 'false'}
      style={{ width: `${width}px` } as CSSProperties}
    >
      <div
        aria-label={gt('Resize source code editor')}
        aria-orientation='vertical'
        aria-valuemax={MAX_DRAWER_WIDTH}
        aria-valuemin={MIN_DRAWER_WIDTH}
        aria-valuenow={width}
        className='source-code-drawer-resize'
        onKeyDown={handleResizeKeyDown}
        onPointerCancel={finishResize}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishResize}
        role='separator'
        tabIndex={0}
      />
      <header className='flex items-center justify-between gap-4 border-b border-border px-4'>
        <div className='min-w-0'>
          <p className='truncate text-sm font-semibold'>{title ?? gt('Artifact source')}</p>
          <p className='mt-0.5 text-xs uppercase tracking-[0.12em] text-muted-foreground'>{format}</p>
        </div>
        <Button
          aria-label={gt('Close source editor')}
          onClick={onClose}
          size='icon-sm'
          type='button'
          variant='ghost'
        >
          <X aria-hidden='true' />
        </Button>
      </header>

      <div className='source-code-drawer-body'>
        <textarea
          aria-label={gt('Editable source code')}
          autoCapitalize='off'
          autoCorrect='off'
          className='source-code-textarea'
          onChange={(event) => {
            setDraft(event.target.value);
            setApplied(false);
          }}
          spellCheck={false}
          value={draft}
        />
        {error ? (
          <p className='border-t border-status-error-border bg-status-error-background px-4 py-3 text-xs leading-5 text-status-error' role='alert'>
            {error}
          </p>
        ) : null}
      </div>

      <footer className='grid grid-cols-2 gap-2 border-t border-border p-3'>
        <Button onClick={reset} type='button' variant='outline'>
          <RotateCcw aria-hidden='true' />
          <T>Reset</T>
        </Button>
        <Button onClick={apply} type='button'>
          {applied ? <Check aria-hidden='true' /> : <Code2 aria-hidden='true' />}
          {applied ? <T>Applied</T> : <T>Apply code</T>}
        </Button>
      </footer>
    </aside>
  );
}
