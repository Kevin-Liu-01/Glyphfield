'use client';

import { useEffect, useState } from 'react';
import { Button } from './Button';
import { AlertCircle, X } from './SolidIcons';
import StudioContextMenu, { type StudioContextMenuPosition } from './StudioContextMenu';

/** A persistent error indicator with full, keyboard/touch-accessible details. */
export default function StudioErrorNotice({ error, title = 'Action failed', onDismiss }: {
  error: string | null;
  title?: string;
  onDismiss?: () => void;
}) {
  const [position, setPosition] = useState<StudioContextMenuPosition | null>(null);
  useEffect(() => { setPosition(null); }, [error]);
  if (!error) return null;
  return <span className='inline-flex shrink-0 items-center' data-studio-error>
    <span className='sr-only' role='alert'>{error}</span>
    <Button
      aria-expanded={Boolean(position)}
      aria-haspopup='menu'
      aria-label={`${title}: show details`}
      className='border-status-error-border bg-status-error-background text-status-error'
      onClick={(event) => {
        const anchor = event.currentTarget;
        const bounds = anchor.getBoundingClientRect();
        setPosition(position ? null : { anchor, x: bounds.left, y: bounds.bottom + 6 });
      }}
      size='sm'
      type='button'
      variant='outline'
    ><AlertCircle aria-hidden='true' /><span>Error</span></Button>
    <StudioContextMenu
      detail={error}
      detailWrap
      label={title}
      onClose={() => setPosition(null)}
      position={position}
      sections={[{ items: [{ id: 'dismiss', icon: <X />, label: onDismiss ? 'Dismiss error' : 'Close details', onSelect: () => onDismiss?.() }] }]}
    />
  </span>;
}
