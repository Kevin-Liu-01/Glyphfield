'use client';

import type { CSSProperties, ReactNode } from 'react';
import { T, useGT } from 'gt-next';
import { Maximize2, Minus, Plus } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { useStudioDraft } from '@/hooks/usePersistentState';

function clampZoom(value: number): number {
  return Math.min(200, Math.max(40, Math.round(value / 5) * 5));
}

export default function CanvasViewport({
  children,
  className = '',
  draftKey = 'canvas-zoom',
  identityId,
  stageClassName = '',
  toolId,
}: {
  children: ReactNode;
  className?: string;
  draftKey?: string;
  identityId: string;
  stageClassName?: string;
  toolId: string;
}) {
  const gt = useGT();
  const [zoom, setZoom] = useStudioDraft(identityId, toolId, draftKey, 100);

  function changeZoom(value: number) {
    setZoom(clampZoom(value));
  }

  return (
    <div className={`canvas-viewport ${className}`}>
      <div className='canvas-viewport-toolbar' role='group' aria-label={gt('Canvas zoom')}>
        <Button aria-label={gt('Zoom out')} disabled={zoom <= 40} onClick={() => changeZoom(zoom - 10)} size='icon-sm' title={gt('Zoom out')} type='button' variant='ghost'>
          <Minus aria-hidden='true' />
        </Button>
        <label className='canvas-zoom-range'>
          <span className='sr-only'><T>Canvas zoom</T></span>
          <input max={200} min={40} onChange={(event) => changeZoom(Number(event.target.value))} step={5} type='range' value={zoom} />
        </label>
        <button className='canvas-zoom-value' onClick={() => setZoom(100)} title={gt('Reset to 100%')} type='button'>{zoom}%</button>
        <Button aria-label={gt('Zoom in')} disabled={zoom >= 200} onClick={() => changeZoom(zoom + 10)} size='icon-sm' title={gt('Zoom in')} type='button' variant='ghost'>
          <Plus aria-hidden='true' />
        </Button>
        <span className='canvas-toolbar-divider' />
        <Button aria-label={gt('Fit canvas')} onClick={() => setZoom(100)} size='icon-sm' title={gt('Fit canvas')} type='button' variant='ghost'>
          <Maximize2 aria-hidden='true' />
        </Button>
      </div>
      <div className='canvas-viewport-scroll'>
        <div
          className={`canvas-viewport-stage ${stageClassName}`}
          style={{ '--canvas-zoom': zoom / 100 } as CSSProperties}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
