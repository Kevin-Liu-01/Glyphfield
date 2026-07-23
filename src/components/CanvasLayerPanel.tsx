'use client';

import { T, useGT } from 'gt-next';
import {
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  ArrowDown,
  ArrowUp,
  Layers3,
} from 'lucide-react';

import type {
  CanvasLayerAlignment,
  CanvasLayerTransform,
} from '@/components/EditableCanvasLayer';
import { Button } from '@/components/ui/Button';

export type CanvasLayerPanelItem<LayerId extends string> = {
  canMoveBackward: boolean;
  canMoveForward: boolean;
  id: LayerId;
  label: string;
  transform: CanvasLayerTransform;
};

type CanvasLayerPanelProps<LayerId extends string> = {
  layers: readonly CanvasLayerPanelItem<LayerId>[];
  onAlign: (alignment: CanvasLayerAlignment) => void;
  onMove: (id: LayerId, direction: -1 | 1) => void;
  onReset: (id: LayerId) => void;
  onSelect: (id: LayerId) => void;
  selectedLayerId: LayerId | null;
};

const ALIGNMENT_ACTIONS = [
  ['left', AlignHorizontalJustifyStart, 'Align selected layer left'],
  ['horizontal-center', AlignHorizontalJustifyCenter, 'Center selected layer horizontally'],
  ['right', AlignHorizontalJustifyEnd, 'Align selected layer right'],
  ['top', AlignVerticalJustifyStart, 'Align selected layer top'],
  ['vertical-center', AlignVerticalJustifyCenter, 'Center selected layer vertically'],
  ['bottom', AlignVerticalJustifyEnd, 'Align selected layer bottom'],
] as const;

export default function CanvasLayerPanel<LayerId extends string>({
  layers,
  onAlign,
  onMove,
  onReset,
  onSelect,
  selectedLayerId,
}: CanvasLayerPanelProps<LayerId>) {
  const gt = useGT();
  const selectedLayer = layers.find(({ id }) => id === selectedLayerId) ?? null;

  return (
    <div
      className='canvas-layer-panel flex flex-col gap-4'
      data-state={selectedLayer ? 'selected' : 'idle'}
    >
      <p className='text-xs leading-5 text-muted-foreground'>
        <T>Nothing is selected until you choose a layer here or on the canvas. Drag to move, use arrow keys to nudge, and pull the blue corner to resize.</T>
      </p>

      <div className='flex flex-col gap-2' role='list' aria-label={gt('Canvas layers')}>
        {layers.map((layer) => {
          const selected = selectedLayerId === layer.id;
          return (
            <div
              className={`canvas-layer-row grid grid-cols-[1fr_30px_30px] items-center border ${selected ? 'border-foreground bg-muted' : 'border-border'}`}
              data-state={selected ? 'selected' : 'idle'}
              key={layer.id}
              role='listitem'
            >
              <button
                aria-pressed={selected}
                className='flex min-w-0 items-center gap-2 px-3 py-2 text-left text-sm'
                onClick={() => onSelect(layer.id)}
                type='button'
              >
                <Layers3 aria-hidden='true' className='size-3.5 shrink-0' />
                <span className='min-w-0 flex-1 truncate'>{layer.label}</span>
                <span className='font-mono text-[10px] text-muted-foreground'>
                  {Math.round(layer.transform.scale * 100)}%
                </span>
              </button>
              <Button
                aria-label={gt('Move {name} forward', { name: layer.label })}
                disabled={!layer.canMoveForward}
                onClick={() => onMove(layer.id, 1)}
                size='icon-sm'
                type='button'
                variant='ghost'
              >
                <ArrowUp aria-hidden='true' />
              </Button>
              <Button
                aria-label={gt('Move {name} backward', { name: layer.label })}
                disabled={!layer.canMoveBackward}
                onClick={() => onMove(layer.id, -1)}
                size='icon-sm'
                type='button'
                variant='ghost'
              >
                <ArrowDown aria-hidden='true' />
              </Button>
            </div>
          );
        })}
      </div>

      <div className='border border-border'>
        <div className='flex items-center justify-between border-b border-border px-3 py-2'>
          <span className='text-xs font-medium'><T>Align to canvas</T></span>
          <span className='font-mono text-[10px] text-muted-foreground'>
            {selectedLayer?.label ?? <T>Select a layer</T>}
          </span>
        </div>
        <div className='grid grid-cols-6'>
          {ALIGNMENT_ACTIONS.map(([alignment, Icon, label]) => (
            <Button
              aria-label={gt(label)}
              className='border-r border-border last:border-r-0'
              disabled={!selectedLayer}
              key={alignment}
              onClick={() => onAlign(alignment)}
              size='icon-sm'
              type='button'
              variant='ghost'
            >
              <Icon aria-hidden='true' />
            </Button>
          ))}
        </div>
      </div>

      <Button
        disabled={!selectedLayer}
        onClick={() => {
          if (selectedLayer) onReset(selectedLayer.id);
        }}
        size='sm'
        type='button'
        variant='outline'
      >
        <T>Reset selected layer</T>
      </Button>
    </div>
  );
}
