'use client';

import type { ReactNode } from 'react';

import StudioContextMenu, {
  type StudioContextMenuPosition,
} from '@/components/ui/StudioContextMenu';
import {
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  ArrowDown,
  ArrowUp,
  Copy,
  Files,
  Group,
  Trash2,
  Ungroup,
} from '@/components/ui/SolidIcons';

import type { CanvasLayerAlignment } from '@/lib/canvasInteraction';

export type CanvasSelectionMenuPosition = StudioContextMenuPosition;

const ALIGNMENTS = [
  { icon: <AlignHorizontalJustifyStart aria-hidden='true' />, label: 'Align left', value: 'left' },
  { icon: <AlignHorizontalJustifyCenter aria-hidden='true' />, label: 'Center horizontally', value: 'horizontal-center' },
  { icon: <AlignHorizontalJustifyEnd aria-hidden='true' />, label: 'Align right', value: 'right' },
  { icon: <AlignVerticalJustifyStart aria-hidden='true' />, label: 'Align top', value: 'top' },
  { icon: <AlignVerticalJustifyCenter aria-hidden='true' />, label: 'Center vertically', value: 'vertical-center' },
  { icon: <AlignVerticalJustifyEnd aria-hidden='true' />, label: 'Align bottom', value: 'bottom' },
] as const satisfies readonly {
  icon: ReactNode;
  label: string;
  value: CanvasLayerAlignment;
}[];

export default function CanvasSelectionMenu({
  canGroup,
  canPaste = true,
  canUngroup,
  count,
  groupName,
  onAlign,
  onBringForward,
  onClose,
  onCopy,
  onDelete,
  onDuplicate,
  onGroup,
  onPaste,
  onSendBackward,
  onUngroup,
  position,
}: {
  canGroup: boolean;
  canPaste?: boolean;
  canUngroup: boolean;
  count: number;
  groupName?: string;
  onAlign: (alignment: CanvasLayerAlignment) => void;
  onBringForward: () => void;
  onClose: () => void;
  onCopy?: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onGroup: () => void;
  onPaste?: () => void;
  onSendBackward: () => void;
  onUngroup: () => void;
  position: CanvasSelectionMenuPosition | null;
}) {
  return (
    <StudioContextMenu
      detail={`${count} selected layer${count === 1 ? '' : 's'}`}
      label={groupName ?? `${count} layer${count === 1 ? '' : 's'}`}
      onClose={onClose}
      position={position}
      sections={[
        {
          items: [
            { disabled: !canGroup, icon: <Group aria-hidden='true' />, id: 'group', label: 'Group selection', onSelect: onGroup, shortcut: '⌘G' },
            { disabled: !canUngroup, icon: <Ungroup aria-hidden='true' />, id: 'ungroup', label: 'Ungroup selection', onSelect: onUngroup, shortcut: '⇧⌘G' },
          ],
        },
        {
          items: [
            ...(onCopy ? [{ icon: <Copy aria-hidden='true' />, id: 'copy', label: 'Copy', onSelect: onCopy, shortcut: '⌘C' }] : []),
            { icon: <Files aria-hidden='true' />, id: 'duplicate', label: 'Duplicate', onSelect: onDuplicate, shortcut: '⌘D' },
            ...(onPaste ? [{ disabled: !canPaste, icon: <Copy aria-hidden='true' />, id: 'paste', label: 'Paste', onSelect: onPaste, shortcut: '⌘V' }] : []),
          ],
        },
        {
          label: 'Layer order',
          items: [
            { icon: <ArrowUp aria-hidden='true' />, id: 'forward', label: 'Bring forward', onSelect: onBringForward },
            { icon: <ArrowDown aria-hidden='true' />, id: 'backward', label: 'Send backward', onSelect: onSendBackward },
          ],
        },
        {
          label: 'Align to artboard',
          items: ALIGNMENTS.map((alignment) => ({
            icon: alignment.icon,
            id: `align-${alignment.value}`,
            label: alignment.label,
            onSelect: () => onAlign(alignment.value),
          })),
        },
        {
          items: [
            { danger: true, icon: <Trash2 aria-hidden='true' />, id: 'delete', label: 'Delete selection', onSelect: onDelete, shortcut: '⌫' },
          ],
        },
      ]}
    />
  );
}
