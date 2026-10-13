'use client';

import { memo, useMemo, useState, type DragEvent, type ReactNode } from 'react';
import { T, useGT } from 'gt-next';
import {
  ArrowDown,
  ArrowUp,
  Badge,
  Braces,
  Copy,
  Eye,
  EyeOff,
  Grid3X3,
  Image as ImageIcon,
  Layers3,
  Minus,
  Plus,
  Presentation,
  Sparkles,
  Square,
  Trash2,
  Type,
  Waves,
} from '@/components/ui/SolidIcons';

import { Button } from '@/components/ui/Button';
import StudioSelect from '@/components/ui/StudioSelect';
import { ControlSection, UploadField } from '@/components/tools/ToolFields';
import type { CanvasDocument, CanvasElement } from '@/lib/canvasDocument';
import { elementComponent, pageElements, pageSettings, type ExpressionToolKind } from '@/lib/expressionModel';
import type { ExpressionAddableLayer } from '@/lib/expressionOperations';
import { buildExpressionPageSvg, type ExpressionRenderContext } from '@/lib/expressionSvg';
import { expressionLayouts } from '@/lib/expressionTemplates';
import styles from './ExpressionEditor.module.css';

export type LayersPanelApi = {
  addLayer: (kind: ExpressionAddableLayer) => void;
  addSlide: (layout: string) => void;
  duplicateSlide: (pageId: string) => void;
  moveLayer: (id: string, index: number) => void;
  moveSlide: (pageId: string, index: number) => void;
  removeSlide: (pageId: string) => void;
  select: (ids: string[], additive?: boolean) => void;
  selectPage: (pageId: string) => void;
  setHidden: (id: string, hidden: boolean) => void;
  setLocked: (id: string, locked: boolean) => void;
  uploadImage: (file: File) => void;
};

const ADD_BUTTONS: readonly { icon: ReactNode; kind: ExpressionAddableLayer; label: string; short: string }[] = [
  { icon: <Type aria-hidden='true' />, kind: 'text', label: 'Add text layer', short: 'Text' },
  { icon: <ImageIcon aria-hidden='true' />, kind: 'image', label: 'Add image layer', short: 'Image' },
  { icon: <Badge aria-hidden='true' />, kind: 'logo', label: 'Add logo layer', short: 'Logo' },
  { icon: <Square aria-hidden='true' />, kind: 'shape', label: 'Add shape layer', short: 'Shape' },
  { icon: <Minus aria-hidden='true' />, kind: 'divider', label: 'Add divider', short: 'Divider' },
  { icon: <Sparkles aria-hidden='true' />, kind: 'shader', label: 'Add shader background', short: 'Shader' },
  { icon: <Grid3X3 aria-hidden='true' />, kind: 'texture', label: 'Add texture layer', short: 'Texture' },
  { icon: <Waves aria-hidden='true' />, kind: 'device', label: 'Add brand device', short: 'Device' },
];

function layerIcon(element: CanvasElement) {
  if (element.kind === 'text') return <Type aria-hidden='true' className='size-3.5 shrink-0' />;
  if (element.kind === 'image' || element.kind === 'shader') return <ImageIcon aria-hidden='true' className='size-3.5 shrink-0' />;
  if (element.kind === 'logo') return <Badge aria-hidden='true' className='size-3.5 shrink-0' />;
  if (element.kind === 'texture') return <Grid3X3 aria-hidden='true' className='size-3.5 shrink-0' />;
  if (elementComponent(element) === 'code') return <Braces aria-hidden='true' className='size-3.5 shrink-0' />;
  if (elementComponent(element) === 'device') return <Waves aria-hidden='true' className='size-3.5 shrink-0' />;
  if (element.kind === 'shape' || element.kind === 'line') return <Square aria-hidden='true' className='size-3.5 shrink-0' />;
  return <Layers3 aria-hidden='true' className='size-3.5 shrink-0' />;
}

const SlideThumbnail = memo(function SlideThumbnail({ context, document, pageId }: { context: ExpressionRenderContext; document: CanvasDocument; pageId: string }) {
  const markup = useMemo(() => buildExpressionPageSvg(document, pageId, context), [context, document, pageId]);
  return <span aria-hidden='true' className={styles.slideThumb} dangerouslySetInnerHTML={{ __html: markup }} />;
}, (previous, next) => previous.pageId === next.pageId
  && previous.context === next.context
  && previous.document.pages[previous.pageId] === next.document.pages[next.pageId]
  && pageElements(previous.document, previous.pageId).every((element, index) => element === pageElements(next.document, next.pageId)[index]));

function dropPosition(event: DragEvent<HTMLElement>): 'after' | 'before' {
  const bounds = event.currentTarget.getBoundingClientRect();
  return event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
}

function SlidesSection({
  activePageId,
  api,
  document,
  thumbnailContext,
}: {
  activePageId: string;
  api: LayersPanelApi;
  document: CanvasDocument;
  thumbnailContext: (pageId: string) => ExpressionRenderContext;
}) {
  const gt = useGT();
  const [newLayout, setNewLayout] = useState('statement');
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; position: 'after' | 'before' } | null>(null);
  const activeIndex = document.pageIds.indexOf(activePageId);
  return (
    <ControlSection title={<T>Slides</T>}>
      <ol aria-label={gt('Slides')} className={`${styles.slideStrip} m-0 list-none p-0`}>
        {document.pageIds.map((pageId, index) => {
          const layout = expressionLayouts('slides').find(({ id }) => id === pageSettings(document, pageId).layout);
          return (
            <li key={pageId}>
              <button
                aria-current={pageId === activePageId ? 'true' : undefined}
                aria-label={gt('Slide {number}: {layout}', { layout: layout?.label ?? '', number: index + 1 })}
                className={styles.slideCard}
                data-active={pageId === activePageId}
                data-drop={dropTarget?.id === pageId ? dropTarget.position : undefined}
                draggable
                onClick={() => api.selectPage(pageId)}
                onDragEnd={() => { setDragging(null); setDropTarget(null); }}
                onDragOver={(event) => {
                  if (!dragging || dragging === pageId) return;
                  event.preventDefault();
                  setDropTarget({ id: pageId, position: dropPosition(event) });
                }}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', pageId);
                  setDragging(pageId);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (!dragging || dragging === pageId) return;
                  const from = document.pageIds.indexOf(dragging);
                  let to = index + (dropPosition(event) === 'after' ? 1 : 0);
                  if (from < to) to -= 1;
                  api.moveSlide(dragging, to);
                  setDragging(null);
                  setDropTarget(null);
                }}
                onKeyDown={(event) => {
                  if (!event.altKey) return;
                  if (event.key === 'ArrowUp') { event.preventDefault(); api.moveSlide(pageId, index - 1); }
                  if (event.key === 'ArrowDown') { event.preventDefault(); api.moveSlide(pageId, index + 1); }
                }}
                type='button'
              >
                <span className={styles.slideIndex}>{String(index + 1).padStart(2, '0')}</span>
                <span>
                  <SlideThumbnail context={thumbnailContext(pageId)} document={document} pageId={pageId} />
                  <span className={styles.slideName}>{layout?.label ?? pageId}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className='flex flex-col gap-2'>
        <StudioSelect ariaLabel='New slide layout' onValueChange={setNewLayout} options={expressionLayouts('slides').map(({ id, label }) => ({ label, value: id }))} value={newLayout} />
        <div className={styles.iconRow}>
          <Button onClick={() => api.addSlide(newLayout)} size='sm' type='button' variant='outline'>
            <Plus aria-hidden='true' />
            <T>Add slide</T>
          </Button>
          <Button aria-label={gt('Duplicate slide')} onClick={() => api.duplicateSlide(activePageId)} size='icon-sm' title={gt('Duplicate slide')} type='button' variant='ghost'>
            <Copy aria-hidden='true' />
          </Button>
          <Button aria-label={gt('Move slide up')} disabled={activeIndex <= 0} onClick={() => api.moveSlide(activePageId, activeIndex - 1)} size='icon-sm' title={gt('Move slide up')} type='button' variant='ghost'>
            <ArrowUp aria-hidden='true' />
          </Button>
          <Button aria-label={gt('Move slide down')} disabled={activeIndex >= document.pageIds.length - 1} onClick={() => api.moveSlide(activePageId, activeIndex + 1)} size='icon-sm' title={gt('Move slide down')} type='button' variant='ghost'>
            <ArrowDown aria-hidden='true' />
          </Button>
          <Button aria-label={gt('Delete slide')} disabled={document.pageIds.length <= 1} onClick={() => api.removeSlide(activePageId)} size='icon-sm' title={gt('Delete slide')} type='button' variant='ghost'>
            <Trash2 aria-hidden='true' />
          </Button>
        </div>
      </div>
    </ControlSection>
  );
}

export default function ExpressionLayersPanel({
  activePageId,
  api,
  document,
  kind,
  selection,
  thumbnailContext,
}: {
  activePageId: string;
  api: LayersPanelApi;
  document: CanvasDocument;
  kind: ExpressionToolKind;
  selection: readonly string[];
  thumbnailContext: (pageId: string) => ExpressionRenderContext;
}) {
  const gt = useGT();
  const elements = pageElements(document, activePageId);
  const ordered = [...elements].reverse();
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; position: 'after' | 'before' } | null>(null);
  const selected = new Set(selection);
  return (
    <>
      {kind === 'slides' ? <SlidesSection activePageId={activePageId} api={api} document={document} thumbnailContext={thumbnailContext} /> : null}
      <ControlSection title={<T>Add</T>}>
        <div className={styles.addGrid}>
          {ADD_BUTTONS.map((button) => (
            <button aria-label={gt(button.label)} className={styles.addButton} key={button.kind} onClick={() => api.addLayer(button.kind)} title={gt(button.label)} type='button'>
              {button.icon}
              <span aria-hidden='true'>{gt(button.short)}</span>
            </button>
          ))}
        </div>
        <UploadField accept='image/*,.svg' label='Upload image layer' onFile={api.uploadImage} />
      </ControlSection>
      <ControlSection title={<T>Layers</T>}>
        <p className={styles.hint}>
          <T>Click to select, Shift-click to add, double-click text to type on the canvas. Drag rows to restack; Alt + arrow keys move the selected row.</T>
        </p>
        <ul aria-label={gt('Expression layers')} className='m-0 flex list-none flex-col gap-0.5 p-0'>
          {ordered.map((element) => {
            const index = elements.indexOf(element);
            return (
              <li
                className={styles.layerRow}
                data-drop={dropTarget?.id === element.id ? dropTarget.position : undefined}
                data-hidden={element.hidden}
                data-selected={selected.has(element.id)}
                key={element.id}
                onDragOver={(event) => {
                  if (!dragging || dragging === element.id) return;
                  event.preventDefault();
                  setDropTarget({ id: element.id, position: dropPosition(event) });
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (!dragging || dragging === element.id) return;
                  // Rows are listed top-first; "before" in the list means above in the stack.
                  const above = dropPosition(event) === 'before';
                  const from = elements.findIndex(({ id }) => id === dragging);
                  let to = above ? index + 1 : index;
                  if (from < to) to -= 1;
                  api.moveLayer(dragging, to);
                  setDragging(null);
                  setDropTarget(null);
                }}
              >
                <span
                  aria-hidden='true'
                  className={styles.grip}
                  draggable
                  onDragEnd={() => { setDragging(null); setDropTarget(null); }}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', element.id);
                    setDragging(element.id);
                  }}
                >⋮⋮</span>
                <button
                  aria-label={gt('Select layer {name}', { name: element.name })}
                  aria-pressed={selected.has(element.id)}
                  className={styles.layerName}
                  onClick={(event) => api.select([element.id], event.shiftKey || event.metaKey || event.ctrlKey)}
                  onKeyDown={(event) => {
                    if (!event.altKey) return;
                    if (event.key === 'ArrowUp') { event.preventDefault(); api.moveLayer(element.id, index + 1); }
                    if (event.key === 'ArrowDown') { event.preventDefault(); api.moveLayer(element.id, index - 1); }
                  }}
                  type='button'
                >
                  {layerIcon(element)}
                  <span>{element.name}</span>
                </button>
                <Button
                  aria-label={gt(element.hidden ? 'Show {name}' : 'Hide {name}', { name: element.name })}
                  aria-pressed={element.hidden}
                  onClick={() => api.setHidden(element.id, !element.hidden)}
                  size='icon-xs'
                  type='button'
                  variant='ghost'
                >
                  {element.hidden ? <EyeOff aria-hidden='true' /> : <Eye aria-hidden='true' />}
                </Button>
                <Button
                  aria-label={gt(element.locked ? 'Unlock {name}' : 'Lock {name}', { name: element.name })}
                  aria-pressed={element.locked}
                  onClick={() => api.setLocked(element.id, !element.locked)}
                  size='icon-xs'
                  type='button'
                  variant='ghost'
                >
                  <span aria-hidden='true' className='text-[11px]'>{element.locked ? '■' : '□'}</span>
                </Button>
              </li>
            );
          })}
        </ul>
      </ControlSection>
      {kind !== 'slides' ? null : (
        <p className={`${styles.hint} px-4 pb-4`}>
          <Presentation aria-hidden='true' className='mr-1 inline size-3.5' />
          <T>Footers use {'{page}'} and {'{pages}'} for slide numbers.</T>
        </p>
      )}
    </>
  );
}
