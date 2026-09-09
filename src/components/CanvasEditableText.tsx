'use client';

import { useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react';

import { useCommittedRef } from '@/hooks/useCommittedRef';
import { isAdditiveCanvasSelection } from '@/lib/canvasInteraction';

export default function CanvasEditableText({
  className,
  label,
  onChange,
  onFocus,
  style,
  value,
}: {
  className: string;
  label: string;
  onChange: (value: string) => void;
  onFocus: () => void;
  style: CSSProperties;
  value: string;
}) {
  const textRef = useRef<HTMLSpanElement>(null);
  const onChangeRef = useCommittedRef(onChange);
  const pendingValueRef = useRef<string | null>(null);
  const commitTimerRef = useRef(0);

  function flushTextChange() {
    window.clearTimeout(commitTimerRef.current);
    commitTimerRef.current = 0;
    const nextValue = pendingValueRef.current;
    pendingValueRef.current = null;
    if (nextValue !== null) onChangeRef.current(nextValue);
  }

  function scheduleTextChange(nextValue: string) {
    pendingValueRef.current = nextValue;
    window.clearTimeout(commitTimerRef.current);
    commitTimerRef.current = window.setTimeout(flushTextChange, 140);
  }

  useLayoutEffect(() => {
    const text = textRef.current;
    if (!text || document.activeElement === text || text.innerText === value) return;
    text.innerText = value;
  }, [value]);

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
        pendingValueRef.current = event.currentTarget.innerText.replace(/\r\n/g, '\n');
        flushTextChange();
      }}
      onFocus={onFocus}
      onInput={(event) => scheduleTextChange(event.currentTarget.innerText.replace(/\r\n/g, '\n'))}
      onKeyDown={(event) => {
        event.stopPropagation();
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
