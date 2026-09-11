'use client';

import type { ReactNode } from 'react';

import StudioContextMenu, {
  type StudioContextMenuItem,
  type StudioContextMenuPosition,
  type StudioContextMenuSection,
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
  Crop,
  Eye,
  EyeOff,
  Files,
  Group,
  Layers3,
  Scissors,
  Trash2,
  Ungroup,
} from '@/components/ui/SolidIcons';

import type { CanvasLayerAlignment } from '@/lib/canvasInteraction';

export type CanvasSelectionMenuPosition = StudioContextMenuPosition;

type CanvasSelectionMenuProps = {
  canCrop?: boolean;
  canGroup: boolean;
  canPaste?: boolean;
  canUngroup: boolean;
  count: number;
  cropEditing?: boolean;
  groupName?: string;
  onAlign: (alignment: CanvasLayerAlignment) => void;
  onBringForward: () => void;
  onBringToFront?: () => void;
  onClose: () => void;
  onCopy?: () => void;
  onCrop?: () => void;
  onCut?: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onGroup: () => void;
  onPaste?: () => void;
  onResetCrop?: () => void;
  onSelectAll?: () => void;
  onSendBackward: () => void;
  onSendToBack?: () => void;
  onToggleVisibility?: () => void;
  onUngroup: () => void;
  position: CanvasSelectionMenuPosition | null;
  selectionVisible?: boolean;
};

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

function imageMenuSection({
  canCrop = false,
  cropEditing = false,
  onCrop,
  onResetCrop,
}: Pick<CanvasSelectionMenuProps, 'canCrop' | 'cropEditing' | 'onCrop' | 'onResetCrop'>): StudioContextMenuSection {
  const items: StudioContextMenuItem[] = [];
  if (canCrop && onCrop) {
    items.push({
      description: cropEditing ? 'Return to normal layer editing' : 'Reveal the full image and reposition it inside the frame',
      icon: <Crop aria-hidden='true' />,
      id: 'crop',
      label: cropEditing ? 'Finish cropping' : 'Crop image',
      onSelect: onCrop,
      shortcut: 'Double-click',
    });
    if (onResetCrop) items.push({ icon: <Crop aria-hidden='true' />, id: 'reset-crop', label: 'Reset crop', onSelect: onResetCrop });
  }
  return { items, label: canCrop ? 'Image' : undefined };
}

function editMenuSection({
  canPaste = true,
  onCopy,
  onCut,
  onDuplicate,
  onPaste,
  onSelectAll,
}: Pick<CanvasSelectionMenuProps, 'canPaste' | 'onCopy' | 'onCut' | 'onDuplicate' | 'onPaste' | 'onSelectAll'>): StudioContextMenuSection {
  const items: StudioContextMenuItem[] = [];
  if (onCut) items.push({ icon: <Scissors aria-hidden='true' />, id: 'cut', label: 'Cut', onSelect: onCut, shortcut: '⌘X' });
  if (onCopy) items.push({ icon: <Copy aria-hidden='true' />, id: 'copy', label: 'Copy', onSelect: onCopy, shortcut: '⌘C' });
  if (onPaste) items.push({ disabled: !canPaste, icon: <Copy aria-hidden='true' />, id: 'paste', label: 'Paste', onSelect: onPaste, shortcut: '⌘V' });
  items.push({ icon: <Files aria-hidden='true' />, id: 'duplicate', label: 'Duplicate', onSelect: onDuplicate, shortcut: '⌘D' });
  if (onSelectAll) items.push({ icon: <Layers3 aria-hidden='true' />, id: 'select-all', label: 'Select all layers', onSelect: onSelectAll, shortcut: '⌘A' });
  return { items };
}

function organizeMenuSection(props: Pick<CanvasSelectionMenuProps, 'canGroup' | 'canUngroup' | 'onGroup' | 'onUngroup'>): StudioContextMenuSection {
  return {
    items: [
      { disabled: !props.canGroup, icon: <Group aria-hidden='true' />, id: 'group', label: 'Group selection', onSelect: props.onGroup, shortcut: '⌘G' },
      { disabled: !props.canUngroup, icon: <Ungroup aria-hidden='true' />, id: 'ungroup', label: 'Ungroup selection', onSelect: props.onUngroup, shortcut: '⇧⌘G' },
    ],
    label: 'Organize',
  };
}

function orderMenuSection(props: Pick<CanvasSelectionMenuProps, 'onBringForward' | 'onBringToFront' | 'onSendBackward' | 'onSendToBack'>): StudioContextMenuSection {
  const items: StudioContextMenuItem[] = [
    { icon: <ArrowUp aria-hidden='true' />, id: 'forward', label: 'Bring forward', onSelect: props.onBringForward },
  ];
  if (props.onBringToFront) items.push({ icon: <ArrowUp aria-hidden='true' />, id: 'front', label: 'Bring to front', onSelect: props.onBringToFront, shortcut: '⇧⌘]' });
  items.push({ icon: <ArrowDown aria-hidden='true' />, id: 'backward', label: 'Send backward', onSelect: props.onSendBackward });
  if (props.onSendToBack) items.push({ icon: <ArrowDown aria-hidden='true' />, id: 'back', label: 'Send to back', onSelect: props.onSendToBack, shortcut: '⇧⌘[' });
  return { items, label: 'Layer order' };
}

function alignMenuSection(onAlign: CanvasSelectionMenuProps['onAlign']): StudioContextMenuSection {
  return {
    items: ALIGNMENTS.map((alignment) => ({
      icon: alignment.icon,
      id: `align-${alignment.value}`,
      label: alignment.label,
      onSelect: () => onAlign(alignment.value),
    })),
    label: 'Align to artboard',
  };
}

function finalMenuSection({
  onDelete,
  onToggleVisibility,
  selectionVisible = true,
}: Pick<CanvasSelectionMenuProps, 'onDelete' | 'onToggleVisibility' | 'selectionVisible'>): StudioContextMenuSection {
  const items: StudioContextMenuItem[] = [];
  if (onToggleVisibility) items.push({
    checked: selectionVisible,
    icon: selectionVisible ? <Eye aria-hidden='true' /> : <EyeOff aria-hidden='true' />,
    id: 'visibility',
    label: selectionVisible ? 'Selection visible' : 'Selection hidden',
    onSelect: onToggleVisibility,
  });
  items.push({ danger: true, icon: <Trash2 aria-hidden='true' />, id: 'delete', label: 'Delete selection', onSelect: onDelete, shortcut: '⌫' });
  return { items };
}

export default function CanvasSelectionMenu({
  canGroup,
  canPaste = true,
  canUngroup,
  canCrop = false,
  count,
  cropEditing = false,
  groupName,
  onAlign,
  onBringForward,
  onBringToFront,
  onClose,
  onCopy,
  onCrop,
  onCut,
  onDelete,
  onDuplicate,
  onGroup,
  onPaste,
  onResetCrop,
  onSelectAll,
  onSendBackward,
  onSendToBack,
  onToggleVisibility,
  onUngroup,
  position,
  selectionVisible = true,
}: CanvasSelectionMenuProps) {
  return (
    <StudioContextMenu
      detail={`${count} selected layer${count === 1 ? '' : 's'}`}
      label={groupName ?? `${count} layer${count === 1 ? '' : 's'}`}
      onClose={onClose}
      position={position}
      sections={[
        imageMenuSection({ canCrop, cropEditing, onCrop, onResetCrop }),
        editMenuSection({ canPaste, onCopy, onCut, onDuplicate, onPaste, onSelectAll }),
        organizeMenuSection({ canGroup, canUngroup, onGroup, onUngroup }),
        orderMenuSection({ onBringForward, onBringToFront, onSendBackward, onSendToBack }),
        alignMenuSection(onAlign),
        finalMenuSection({ onDelete, onToggleVisibility, selectionVisible }),
      ]}
    />
  );
}
