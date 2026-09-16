'use client';

import { useId, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { ChevronDown } from '@/components/ui/SolidIcons';
import StudioContextMenu, { type StudioContextMenuPosition, type StudioContextMenuSection } from '@/components/ui/StudioContextMenu';

/** A named toolbar entry into the same menu used by canvas context actions. */
export default function StudioActionMenu({
  label, icon, sections, detail, disabled = false, loading = false,
}: {
  label: string;
  icon: ReactNode;
  sections: readonly StudioContextMenuSection[];
  detail?: string;
  disabled?: boolean;
  loading?: boolean;
}) {
  const [position, setPosition] = useState<StudioContextMenuPosition | null>(null);
  const menuId = useId();
  function open(anchor: HTMLButtonElement) {
    const bounds = anchor.getBoundingClientRect();
    setPosition({ anchor, x: bounds.left, y: bounds.bottom + 6 });
  }
  return <>
    <Button
      aria-controls={position ? menuId : undefined} aria-expanded={Boolean(position)} aria-haspopup='menu' aria-label={label}
      disabled={disabled} loading={loading}
      onClick={(event) => position ? setPosition(null) : open(event.currentTarget)}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        event.preventDefault();
        open(event.currentTarget);
      }}
      size='toolbar' type='button' variant='outline'
    >
      {icon}<span>{label}</span><ChevronDown aria-hidden='true' />
    </Button>
    <StudioContextMenu id={menuId} detail={detail} detailWrap label={label} onClose={() => setPosition(null)} position={position} sections={sections} />
  </>;
}
