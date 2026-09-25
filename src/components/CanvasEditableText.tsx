'use client';

import { useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react';
import { flushSync } from 'react-dom';

import { useCommittedRef } from '@/hooks/useCommittedRef';
import { isAdditiveCanvasSelection } from '@/lib/canvasInteraction';
import { editTextRuns, type InlineTextStyle, type TextSelectionRange, type TextStyleRun } from '@/lib/richText';
import { editableTextValue, readTextSelection, renderTextRuns, restoreTextSelection } from '@/lib/richTextDom';

export default function CanvasEditableText({
  className,
  label,
  onChange,
  onFocus,
  onRichChange,
  onSelectionChange,
  onFormat,
  onUndoRedo,
  runs,
  resolveRunStyle,
  style,
  value,
}: {
  className: string;
  label: string;
  onChange: (value: string) => void;
  onFocus: () => void;
  onRichChange?: (value: string, runs: TextStyleRun[] | undefined) => void;
  onSelectionChange?: (selection: TextSelectionRange) => void;
  onFormat?: (format: 'bold' | 'italic' | 'underline') => void;
  onUndoRedo?: (redo: boolean) => void;
  runs?: TextStyleRun[];
  resolveRunStyle?: (style: InlineTextStyle) => Partial<CSSStyleDeclaration>;
  style: CSSProperties;
  value: string;
}) {
  const textRef = useRef<HTMLSpanElement>(null);
  const onChangeRef = useCommittedRef(onChange);
  const richRef = useCommittedRef({ onRichChange, onSelectionChange, onFormat, onUndoRedo, runs, value, resolveRunStyle });
  const composingRef = useRef(false);
  const renderedRef = useRef('');
  const pendingValueRef = useRef<string | null>(null);
  const pendingRunsRef = useRef<TextStyleRun[] | undefined>(undefined);
  const inputSelectionRef = useRef<TextSelectionRange | null>(null);
  const commitTimerRef = useRef(0);

  function flushTextChange() {
    window.clearTimeout(commitTimerRef.current);
    commitTimerRef.current = 0;
    const nextValue = pendingValueRef.current;
    pendingValueRef.current = null;
    if (nextValue !== null) {
      const current = richRef.current;
      if (current.onRichChange) current.onRichChange(nextValue, pendingRunsRef.current);
      else onChangeRef.current(nextValue);
    }
  }

  function scheduleTextChange(nextValue: string) {
    const current = richRef.current;
    // Focusing and leaving a text box is selection, not a document edit. Avoid
    // rebuilding history/source/autosave when the native value did not change.
    if (nextValue === (pendingValueRef.current ?? current.value)) {
      inputSelectionRef.current = null;
      return;
    }
    pendingRunsRef.current = editTextRuns(pendingValueRef.current ?? current.value, nextValue,
      pendingValueRef.current === null ? current.runs : pendingRunsRef.current, inputSelectionRef.current);
    inputSelectionRef.current = null;
    pendingValueRef.current = nextValue;
    window.clearTimeout(commitTimerRef.current);
    commitTimerRef.current = window.setTimeout(flushTextChange, 140);
  }

  useLayoutEffect(() => {
    const text = textRef.current;
    if (text && resolveRunStyle) {
      if (composingRef.current || pendingValueRef.current !== null) return;
      const key = JSON.stringify([value, runs, resolveRunStyle({}), ...(runs ?? []).map(({ style }) => resolveRunStyle(style))]);
      if (key === renderedRef.current) return;
      const selection = document.activeElement === text ? readTextSelection(text) : null;
      renderTextRuns(text, value, runs ?? [], resolveRunStyle);
      renderedRef.current = key;
      if (selection) restoreTextSelection(text, selection);
      return;
    }
    if (!text || document.activeElement === text || text.innerText === value) return;
    text.innerText = value;
  }, [value, runs, resolveRunStyle]);

  useEffect(() => {
    const reportSelection = () => {
      const text = textRef.current;
      if (!text || document.activeElement !== text || composingRef.current) return;
      const selection = readTextSelection(text);
      if (selection) richRef.current.onSelectionChange?.(selection);
    };
    document.addEventListener('selectionchange', reportSelection);
    return () => document.removeEventListener('selectionchange', reportSelection);
  }, [richRef]);

  useLayoutEffect(() => {
    const text = textRef.current;
    if (!text || text.closest('.shader-lab-v2')?.querySelector('[data-canvas-preview-pending="true"]')) return;
    // An interrupted inspector drag can unmount without committing. React may
    // skip unchanged style props, so the canonical text owner clears that preview.
    for (const property of ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing'] as const) {
      const value = style[property];
      const cssValue = value == null ? '' : typeof value === 'number' && (property === 'fontSize' || property === 'letterSpacing')
        ? `${value}px` : String(value);
      if (text.style[property] !== cssValue) text.style[property] = cssValue;
    }
  });

  useEffect(() => () => window.clearTimeout(commitTimerRef.current), []);

  return (
    <span
      aria-label={label}
      aria-multiline='true'
      className={className}
      contentEditable='plaintext-only'
      data-canvas-editable='true'
      onContextMenu={(event) => event.stopPropagation()}
      onBlur={(event) => {
        scheduleTextChange(resolveRunStyle ? editableTextValue(event.currentTarget) : event.currentTarget.innerText.replace(/\r\n/g, '\n'));
        flushTextChange();
      }}
      onBeforeInput={(event) => { inputSelectionRef.current = readTextSelection(event.currentTarget); }}
      onCompositionStart={() => { composingRef.current = true; }}
      onCompositionEnd={(event) => {
        composingRef.current = false;
        scheduleTextChange(resolveRunStyle ? editableTextValue(event.currentTarget) : event.currentTarget.innerText.replace(/\r\n/g, '\n'));
      }}
      onFocus={onFocus}
      onInput={(event) => {
        if (composingRef.current) return;
        scheduleTextChange(resolveRunStyle ? editableTextValue(event.currentTarget) : event.currentTarget.innerText.replace(/\r\n/g, '\n'));
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.nativeEvent.isComposing) {
          const key = event.key.toLowerCase();
          if (onFormat && ['b', 'i', 'u'].includes(key)) {
            event.preventDefault();
            flushSync(flushTextChange);
            const selection = readTextSelection(event.currentTarget);
            if (selection) onSelectionChange?.(selection);
            richRef.current.onFormat?.(key === 'b' ? 'bold' : key === 'i' ? 'italic' : 'underline');
          }
          if (onUndoRedo && key === 'z') {
            event.preventDefault();
            flushSync(flushTextChange);
            richRef.current.onUndoRedo?.(event.shiftKey);
          }
        }
        if (event.key === 'Escape') event.currentTarget.blur();
      }}
      onPointerDown={(event) => {
        const extendingTextSelection = document.activeElement === event.currentTarget
          && event.shiftKey && !event.metaKey && !event.ctrlKey;
        if (isAdditiveCanvasSelection(event) && !extendingTextSelection) {
          event.preventDefault();
          return;
        }
        event.stopPropagation();
      }}
      ref={textRef}
      role='textbox'
      spellCheck
      style={style}
      suppressContentEditableWarning
      tabIndex={0}
    />
  );
}
