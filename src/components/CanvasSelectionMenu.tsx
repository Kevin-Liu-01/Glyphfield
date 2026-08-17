'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Group,
  Trash2,
  Ungroup,
} from 'lucide-react';

import type { CanvasLayerAlignment } from '@/components/EditableCanvasLayer';

export type CanvasSelectionMenuPosition = { x: number; y: number };

const ALIGNMENTS: readonly { label: string; shortLabel: string; value: CanvasLayerAlignment }[] = [
  { label: 'Align selection left', shortLabel: 'L', value: 'left' },
  { label: 'Center selection horizontally', shortLabel: 'HC', value: 'horizontal-center' },
  { label: 'Align selection right', shortLabel: 'R', value: 'right' },
  { label: 'Align selection top', shortLabel: 'T', value: 'top' },
  { label: 'Center selection vertically', shortLabel: 'VC', value: 'vertical-center' },
  { label: 'Align selection bottom', shortLabel: 'B', value: 'bottom' },
] as const;

export default function CanvasSelectionMenu({
  canGroup,
  canUngroup,
  count,
  groupName,
  onAlign,
  onBringForward,
  onClose,
  onDelete,
  onDuplicate,
  onGroup,
  onSendBackward,
  onUngroup,
  position,
}: {
  canGroup: boolean;
  canUngroup: boolean;
  count: number;
  groupName?: string;
  onAlign: (alignment: CanvasLayerAlignment) => void;
  onBringForward: () => void;
  onClose: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onGroup: () => void;
  onSendBackward: () => void;
  onUngroup: () => void;
  position: CanvasSelectionMenuPosition | null;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  useLayoutEffect(() => {
    if (!position || !menuRef.current) {
      setAdjustedPosition(position);
      return;
    }
    const bounds = menuRef.current.getBoundingClientRect();
    setAdjustedPosition({
      x: Math.max(8, Math.min(position.x, window.innerWidth - bounds.width - 8)),
      y: Math.max(8, Math.min(position.y, window.innerHeight - bounds.height - 8)),
    });
  }, [position]);

  useEffect(() => {
    if (!position) return;
    const menu = menuRef.current;
    menu?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && menu?.contains(event.target)) return;
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      const items = Array.from(menu?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? []);
      if (items.length === 0) return;
      const currentIndex = items.indexOf(document.activeElement as HTMLElement);
      const nextIndex = event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : event.key === 'ArrowDown'
            ? (currentIndex + 1 + items.length) % items.length
            : (currentIndex - 1 + items.length) % items.length;
      event.preventDefault();
      items[nextIndex]?.focus();
    };
    window.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, position]);

  if (!position || !adjustedPosition || typeof document === 'undefined') return null;

  const run = (action: () => void) => {
    action();
    onClose();
  };

  return createPortal(
    <div
      aria-label={`${count} selected layer${count === 1 ? '' : 's'} actions`}
      className='canvas-selection-menu'
      data-canvas-selection-preserve
      ref={menuRef}
      role='menu'
      style={{ left: adjustedPosition.x, top: adjustedPosition.y }}
    >
      <div className='canvas-selection-menu__heading'>
        <span>{groupName ?? `${count} layer${count === 1 ? '' : 's'}`}</span>
        <kbd>⌘ click</kbd>
      </div>
      <div className='canvas-selection-menu__actions'>
        <button aria-keyshortcuts='Meta+G Control+G' disabled={!canGroup} onClick={() => run(onGroup)} role='menuitem' type='button'>
          <Group aria-hidden='true' /><span>Group</span><kbd>⌘G</kbd>
        </button>
        <button aria-keyshortcuts='Meta+Shift+G Control+Shift+G' disabled={!canUngroup} onClick={() => run(onUngroup)} role='menuitem' type='button'>
          <Ungroup aria-hidden='true' /><span>Ungroup</span><kbd>⇧⌘G</kbd>
        </button>
        <button aria-keyshortcuts='Meta+D Control+D' onClick={() => run(onDuplicate)} role='menuitem' type='button'>
          <Copy aria-hidden='true' /><span>Duplicate</span><kbd>⌘D</kbd>
        </button>
        <button onClick={() => run(onBringForward)} role='menuitem' type='button'>
          <ArrowUp aria-hidden='true' /><span>Bring forward</span>
        </button>
        <button onClick={() => run(onSendBackward)} role='menuitem' type='button'>
          <ArrowDown aria-hidden='true' /><span>Send backward</span>
        </button>
      </div>
      <div aria-label='Align assembly to canvas' className='canvas-selection-menu__align' role='group'>
        <span>Align to canvas</span>
        <div>
          {ALIGNMENTS.map((alignment) => (
            <button
              aria-label={alignment.label}
              key={alignment.value}
              onClick={() => run(() => onAlign(alignment.value))}
              role='menuitem'
              title={alignment.label}
              type='button'
            >
              {alignment.shortLabel}
            </button>
          ))}
        </div>
      </div>
      <button className='canvas-selection-menu__delete' onClick={() => run(onDelete)} role='menuitem' type='button'>
        <Trash2 aria-hidden='true' /><span>Delete selection</span>
      </button>
    </div>,
    document.body
  );
}
