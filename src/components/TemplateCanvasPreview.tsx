'use client';

import type { CSSProperties } from 'react';

import CanvasArtboard from '@/components/CanvasArtboard';
import EditableCanvasLayer from '@/components/EditableCanvasLayer';
import type {
  CanvasLayerGeometry,
  CanvasLayerTransform,
} from '@/lib/canvasInteraction';
import type { TemplateKind } from '@/lib/templateAssets';
import type { TemplateLayerId } from '@/lib/templateSvg';

const LAYER_LABELS: Record<TemplateLayerId, string> = {
  brand: 'Brand lockup',
  content: 'Content',
  footer: 'Footer',
};

export default function TemplateCanvasPreview({
  ariaLabel,
  background,
  borderRadius,
  height,
  kind,
  layerGeometries,
  layerOrder,
  layerTransforms,
  onChange,
  onDeselect,
  onSelect,
  selectedLayer,
  svg,
  width,
}: {
  ariaLabel: string;
  background: string;
  borderRadius: number;
  height: number;
  kind: TemplateKind;
  layerGeometries: Record<TemplateLayerId, CanvasLayerGeometry>;
  layerOrder: readonly TemplateLayerId[];
  layerTransforms: Record<TemplateLayerId, CanvasLayerTransform>;
  onChange: (id: TemplateLayerId, transform: CanvasLayerTransform) => void;
  onDeselect: () => void;
  onSelect: (id: TemplateLayerId) => void;
  selectedLayer: TemplateLayerId | null;
  svg: string;
  width: number;
}) {
  const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return (
    <CanvasArtboard
      aria-label={ariaLabel}
      className={`artifact-preview template-artboard template-artboard-${kind} overflow-hidden border border-border`}
      frameClassName='template-artboard-frame w-full max-w-5xl'
      height={height}
      onPointerDown={onDeselect}
      role='group'
      style={{ backgroundColor: background, borderRadius } as CSSProperties}
      width={width}
    >
      <div
        aria-hidden='true'
        className='template-rendered-svg'
        style={{ backgroundImage: `url("${svgDataUrl}")` }}
      />
      {layerOrder.map((id) => (
        <EditableCanvasLayer
          {...layerGeometries[id]}
          canvasHeight={height}
          canvasWidth={width}
          className='template-canvas-hit-layer'
          key={id}
          label={LAYER_LABELS[id]}
          onChange={(transform) => onChange(id, transform)}
          onDeselect={onDeselect}
          onSelect={() => onSelect(id)}
          selected={selectedLayer === id}
          transform={layerTransforms[id]}
          zIndex={layerOrder.indexOf(id) + 5}
        >
          <span className='sr-only'>{LAYER_LABELS[id]}</span>
        </EditableCanvasLayer>
      ))}
    </CanvasArtboard>
  );
}
