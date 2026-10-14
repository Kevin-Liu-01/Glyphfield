'use client';

import { memo, useLayoutEffect, useMemo, useRef, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';

import CanvasArtboard from '@/components/CanvasArtboard';
import CanvasEditableText from '@/components/CanvasEditableText';
import EditableCanvasLayer from '@/components/EditableCanvasLayer';
import type { CanvasBounds, CanvasDocument, CanvasElement } from '@/lib/canvasDocument';
import { canvasLayerBounds, type CanvasLayerBounds, type CanvasLayerTransform } from '@/lib/canvasInteraction';
import { dataString, pageElements, resolveExpressionColor, roundBounds } from '@/lib/expressionModel';
import { renderExpressionElement, type ExpressionRenderContext } from '@/lib/expressionSvg';
import { STUDIO_ARTIFACT_FRAME_CLASS, STUDIO_ARTIFACT_PLANE_CLASS } from '@/lib/studioCanvasPresentation';
import styles from './ExpressionEditor.module.css';

type LayerHandlers = {
  onBounds: (id: string, bounds: CanvasBounds) => void;
  onDeselect: () => void;
  onEditEnd: () => void;
  onEditStart: (id: string) => void;
  onEditText: (id: string, value: string) => void;
  onMenu: (id: string, event: ReactMouseEvent<HTMLDivElement>) => void;
  onSelect: (id: string, additive: boolean) => void;
};

type LayerProps = LayerHandlers & {
  context: ExpressionRenderContext;
  editing: boolean;
  element: CanvasElement;
  member: boolean;
  movementBounds: CanvasLayerBounds | null;
  page: { height: number; width: number };
  selected: boolean;
  showControls: boolean;
  zIndex: number;
};

type Anchor = { base: CanvasBounds; committed: CanvasBounds; transform: CanvasLayerTransform };

const IDENTITY_TRANSFORM: CanvasLayerTransform = { scale: 1, x: 0, y: 0 };

function InlineText({ context, element, onEditEnd, onEditText, page }: Pick<LayerProps, 'context' | 'element' | 'onEditEnd' | 'onEditText' | 'page'>) {
  const hostRef = useRef<HTMLDivElement>(null);
  const style = element.textStyle!;
  useLayoutEffect(() => {
    const text = hostRef.current?.querySelector<HTMLElement>('[data-canvas-editable="true"]');
    if (!text) return;
    text.focus({ preventScroll: true });
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(text);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, []);
  const cssStyle: CSSProperties = {
    color: resolveExpressionColor(dataString(element, 'fill') || undefined, context.colors, style.color),
    display: 'block',
    fontFamily: context.fontFamily(style.fontId, style.fontFamily),
    fontSize: `${(style.fontSize / page.width) * 100}cqw`,
    fontFeatureSettings: style.casing === 'uppercase' ? "'kern' 1, 'cpsp' 1" : "'kern' 1",
    fontKerning: 'normal',
    // Optical size follows the export size, as in the rendered layer, not the zoomed size.
    fontVariationSettings: `'opsz' ${style.fontSize}`,
    fontWeight: style.fontWeight,
    height: '100%',
    letterSpacing: `${style.letterSpacing}em`,
    lineHeight: style.lineHeight,
    textAlign: style.align === 'justify' ? 'left' : style.align,
    textTransform: style.casing === 'uppercase' ? 'uppercase' : style.casing === 'lowercase' ? 'lowercase' : 'none',
    whiteSpace: 'pre-wrap',
    width: '100%',
  };
  return (
    <div
      className={styles.inlineText}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onEditEnd();
      }}
      ref={hostRef}
    >
      <CanvasEditableText
        className={styles.inlineTextField}
        label={`Edit ${element.name} text`}
        onChange={(value) => onEditText(element.id, value)}
        onFocus={() => undefined}
        style={cssStyle}
        value={element.content ?? ''}
      />
    </div>
  );
}

const ExpressionLayer = memo(function ExpressionLayer({
  context,
  editing,
  element,
  member,
  movementBounds,
  onBounds,
  onDeselect,
  onEditEnd,
  onEditStart,
  onEditText,
  onMenu,
  onSelect,
  page,
  selected,
  showControls,
  zIndex,
}: LayerProps) {
  // EditableCanvasLayer edits a transform against fixed base geometry. Keep the
  // base until the bounds change from outside (undo, inspector, layout).
  const anchorRef = useRef<Anchor | null>(null);
  if (!anchorRef.current || anchorRef.current.committed !== element.bounds) {
    anchorRef.current = { base: element.bounds, committed: element.bounds, transform: IDENTITY_TRANSFORM };
  }
  const anchor = anchorRef.current;
  const markup = useMemo(() => (editing ? '' : renderExpressionElement(element, context)), [context, editing, element]);
  const { height, width, x, y } = anchor.base;
  return (
    <EditableCanvasLayer
      allowContentInteraction={editing}
      baseHeight={height}
      baseWidth={width}
      baseX={x}
      baseY={y}
      canvasHeight={page.height}
      canvasWidth={page.width}
      className={styles.layer}
      interactive={!element.locked}
      label={element.name}
      layerId={element.id}
      movementBounds={movementBounds}
      onChange={(transform) => {
        const box = canvasLayerBounds(transform, { baseHeight: height, baseWidth: width, baseX: x, baseY: y });
        const committed = roundBounds({ height: box.height, rotation: element.bounds.rotation, width: box.width, x: box.left, y: box.top });
        anchorRef.current = { base: anchor.base, committed, transform };
        onBounds(element.id, committed);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        onMenu(element.id, event);
      }}
      onDeselect={onDeselect}
      onDoubleClick={element.kind === 'text' ? () => onEditStart(element.id) : undefined}
      onSelect={(additive) => onSelect(element.id, Boolean(additive))}
      resizeMode='box'
      selected={selected}
      selectionMember={member}
      showSelectionControls={showControls}
      transform={anchor.transform}
      zIndex={zIndex}
    >
      {editing && element.kind === 'text' ? (
        <InlineText context={context} element={element} onEditEnd={onEditEnd} onEditText={onEditText} page={page} />
      ) : (
        <svg
          aria-hidden='true'
          className={styles.layerSvg}
          dangerouslySetInnerHTML={{ __html: markup }}
          overflow='visible'
          preserveAspectRatio='none'
          viewBox={`${element.bounds.x} ${element.bounds.y} ${element.bounds.width} ${element.bounds.height}`}
        />
      )}
    </EditableCanvasLayer>
  );
});

export default function ExpressionCanvas({
  ariaLabel,
  context,
  document,
  editingId,
  handlers,
  pageId,
  selection,
}: {
  ariaLabel: string;
  context: ExpressionRenderContext;
  document: CanvasDocument;
  editingId: string | null;
  handlers: LayerHandlers;
  pageId: string;
  selection: readonly string[];
}) {
  const page = document.pages[pageId]!;
  const elements = pageElements(document, pageId);
  const pageSize = useMemo(() => ({ height: page.height, width: page.width }), [page.height, page.width]);
  const selected = useMemo(() => new Set(selection), [selection]);
  const multiple = selection.length > 1;
  const movementBounds = useMemo<CanvasLayerBounds | null>(() => {
    if (selection.length < 2) return null;
    const boxes = selection.flatMap((id) => document.elements[id] ? [document.elements[id]!.bounds] : []);
    if (boxes.length < 2) return null;
    const left = Math.min(...boxes.map((box) => box.x));
    const top = Math.min(...boxes.map((box) => box.y));
    const right = Math.max(...boxes.map((box) => box.x + box.width));
    const bottom = Math.max(...boxes.map((box) => box.y + box.height));
    return { bottom, centerX: (left + right) / 2, centerY: (top + bottom) / 2, height: bottom - top, left, right, top, width: right - left };
  }, [document.elements, selection]);
  return (
    <CanvasArtboard
      aria-label={ariaLabel}
      className={`${STUDIO_ARTIFACT_PLANE_CLASS} ${styles.plane}`}
      frameClassName={STUDIO_ARTIFACT_FRAME_CLASS}
      height={page.height}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) handlers.onDeselect();
      }}
      role='group'
      style={{ backgroundColor: page.background }}
      width={page.width}
    >
      {elements.map((element, index) => (element.hidden ? null : (
        <ExpressionLayer
          {...handlers}
          context={context}
          editing={editingId === element.id}
          element={element}
          key={element.id}
          member={multiple && selected.has(element.id)}
          movementBounds={multiple && selected.has(element.id) ? movementBounds : null}
          page={pageSize}
          selected={selected.has(element.id)}
          showControls={!multiple}
          zIndex={index + 2}
        />
      )))}
    </CanvasArtboard>
  );
}
