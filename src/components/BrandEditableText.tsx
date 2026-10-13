'use client';

import { createElement, useLayoutEffect, useRef, type CSSProperties, type HTMLAttributes, type KeyboardEvent, type RefObject } from 'react';

type EditableTag = 'blockquote' | 'div' | 'h1' | 'h2' | 'h3' | 'p' | 'span' | 'strong';

type BrandEditableTextProps = {
  as?: EditableTag;
  autoFocus?: boolean;
  className?: string;
  /** Plain text when false; the same element and styles either way. */
  editable?: boolean;
  /** Accessible label, unique within the tool, so agents can `studio.set()` it. */
  label: string;
  maxLength?: number;
  multiline?: boolean;
  onCommit: (value: string) => void;
  onDone?: () => void;
  style?: CSSProperties;
  value: string;
};

/**
 * In-place copy editing for brand outputs. The element stays uncontrolled while
 * focused so the caret never jumps; every input commits so preview, source and
 * export read the same text. Enter (single line) or Escape (revert) finishes.
 */
export default function BrandEditableText({
  as: tag = 'span',
  autoFocus = false,
  className = '',
  editable = true,
  label,
  maxLength = 600,
  multiline = false,
  onCommit,
  onDone,
  style,
  value,
}: BrandEditableTextProps) {
  const ref = useRef<HTMLElement>(null);
  const initialRef = useRef(value);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || element === document.activeElement) return;
    if (element.textContent !== value) element.textContent = value;
  }, [value, editable]);

  useLayoutEffect(() => {
    if (!autoFocus || !ref.current) return;
    const element = ref.current;
    element.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [autoFocus]);

  // Distinct keys remount the element when editing toggles, so React never
  // reconciles text children against content written by the editor.
  if (!editable) return createElement(tag, { className, key: 'static', style }, value);

  function commit() {
    const element = ref.current;
    if (!element) return;
    const next = (element.textContent ?? '').slice(0, maxLength);
    if (next !== value) onCommit(next);
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      if (ref.current) ref.current.textContent = initialRef.current;
      onCommit(initialRef.current);
      ref.current?.blur();
      return;
    }
    if (event.key === 'Enter' && (!multiline || event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      ref.current?.blur();
    }
  }

  const props: HTMLAttributes<HTMLElement> & { ref: RefObject<HTMLElement | null>; 'data-brand-editable': string } = {
    'aria-label': label,
    'aria-multiline': multiline || undefined,
    className: `brand-editable-text ${className}`.trim(),
    contentEditable: 'plaintext-only',
    'data-brand-editable': 'true',
    onBlur: () => {
      commit();
      onDone?.();
    },
    onFocus: () => {
      initialRef.current = value;
    },
    onInput: commit,
    onKeyDown,
    onPointerDown: (event) => event.stopPropagation(),
    ref,
    role: 'textbox',
    spellCheck: true,
    style,
    suppressContentEditableWarning: true,
    tabIndex: 0,
  };
  return createElement(tag, { ...props, key: 'editable' });
}
