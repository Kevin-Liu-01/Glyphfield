'use client';

import { useState, type ReactNode } from 'react';

import ArtboardSizeMenu from '@/components/ArtboardSizeMenu';
import { Button } from '@/components/ui/Button';
import { Copy, PanelsTopLeft, Plus, Trash2 } from '@/components/ui/SolidIcons';
import StudioContextMenu, {
  contextMenuPositionFromElement,
  contextMenuPositionFromEvent,
  type StudioContextMenuPosition,
} from '@/components/ui/StudioContextMenu';
import StudioSelect from '@/components/ui/StudioSelect';

export type StudioArtboardBarProps = {
  activeArtboardId: string;
  addLabel: string;
  ariaLabel: string;
  artboards: readonly { id: string; name: string }[];
  className?: string;
  contextMenuLabel?: string;
  contextTrigger?: string;
  dimensions: { height: number; width: number };
  duplicateLabel: string;
  extraActions?: ReactNode;
  onAdd: () => void;
  onDimensionsChange: (dimensions: { height: number; width: number }) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onRename: (name: string) => void;
  onSelect: (id: string) => void;
  removeLabel: string;
  selectLabel: string;
  summary: ReactNode;
  untitledName?: string;
  workspaceControls?: ReactNode;
};

export default function StudioArtboardBar({
  activeArtboardId,
  addLabel,
  ariaLabel,
  artboards,
  className = '',
  contextMenuLabel = 'Artboard',
  contextTrigger = 'studio-artboard',
  dimensions,
  duplicateLabel,
  extraActions,
  onAdd,
  onDimensionsChange,
  onDuplicate,
  onRemove,
  onRename,
  onSelect,
  removeLabel,
  selectLabel,
  summary,
  untitledName = 'Untitled artboard',
  workspaceControls,
}: StudioArtboardBarProps) {
  const active = artboards.find(({ id }) => id === activeArtboardId) ?? artboards[0];
  const [menuPosition, setMenuPosition] = useState<StudioContextMenuPosition | null>(null);
  return (
    <section
      aria-keyshortcuts='Shift+F10'
      aria-label={ariaLabel}
      className={`studio-artboard-bar animation-artboard-bar ${className}`.trim()}
      data-canvas-selection-preserve
      data-has-file-controls={workspaceControls ? 'true' : 'false'}
      data-studio-context-trigger={contextTrigger}
      onContextMenu={(event) => {
        event.preventDefault();
        setMenuPosition(contextMenuPositionFromEvent(event));
      }}
      onKeyDown={(event) => {
        if (!((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu')) return;
        event.preventDefault();
        setMenuPosition(contextMenuPositionFromElement(event.currentTarget));
      }}
      tabIndex={0}
    >
      <div className='studio-artboard-start' data-slot='artboard-start'>
        {workspaceControls ? (
          <div aria-label='Document actions' className='studio-artboard-file-controls animation-artboard-file-controls'
            data-slot='artboard-file-actions' role='group'>
            {workspaceControls}
          </div>
        ) : null}
        <div aria-label='Artboard settings' className='studio-artboard-settings' data-slot='artboard-settings' role='group'>
          <div className='studio-artboard-bar-picker animation-artboard-bar-picker'>
            <PanelsTopLeft aria-hidden='true' />
            <StudioSelect
              ariaLabel={selectLabel}
              className='studio-artboard-select animation-artboard-select'
              onValueChange={onSelect}
              options={artboards.map((artboard) => ({
                label: artboard.name.trim() || untitledName,
                value: artboard.id,
              }))}
              value={active?.id}
            />
          </div>
          <ArtboardSizeMenu
            artboardName={active?.name ?? untitledName}
            className='studio-artboard-dimensions animation-artboard-dimensions'
            dimensions={dimensions}
            onArtboardNameChange={onRename}
            onDimensionsChange={onDimensionsChange}
          />
        </div>
      </div>
      <span className='studio-artboard-summary animation-artboard-summary' data-slot='artboard-summary'>{summary}</span>
      <div className='studio-artboard-actions animation-artboard-actions' data-slot='artboard-end'>
        <div aria-label='Artboard actions' className='studio-artboard-primary-actions' data-slot='artboard-primary-actions' role='group'>
          <Button aria-label={addLabel} onClick={onAdd} size='sm' title={addLabel} type='button' variant='outline'>
            <Plus aria-hidden='true' /><span>Add</span>
          </Button>
          <Button aria-label={duplicateLabel} onClick={onDuplicate} size='icon-sm' title='Duplicate artboard' type='button' variant='outline'>
            <Copy aria-hidden='true' />
          </Button>
          <Button aria-label={removeLabel} disabled={artboards.length <= 1} onClick={onRemove} size='icon-sm' title='Delete artboard' type='button' variant='outline'>
            <Trash2 aria-hidden='true' />
          </Button>
        </div>
        {extraActions ? (
          <div aria-label='Layout and help' className='studio-artboard-extra-actions' data-slot='artboard-extra-actions' role='group'>
            {extraActions}
          </div>
        ) : null}
      </div>
      <StudioContextMenu
        detail={active ? `${dimensions.width} × ${dimensions.height}` : undefined}
        label={active?.name ?? contextMenuLabel}
        onClose={() => setMenuPosition(null)}
        position={menuPosition}
        sections={[
          {
            items: [
              { icon: <Copy aria-hidden='true' />, id: `duplicate-${contextTrigger}`, label: 'Duplicate artboard', onSelect: onDuplicate, shortcut: '⌘D' },
              { icon: <Plus aria-hidden='true' />, id: `new-${contextTrigger}`, label: 'New artboard', onSelect: onAdd },
            ],
          },
          {
            items: [
              { danger: true, disabled: artboards.length <= 1, icon: <Trash2 aria-hidden='true' />, id: `delete-${contextTrigger}`, label: 'Delete artboard', onSelect: onRemove },
            ],
          },
        ]}
      />
    </section>
  );
}
