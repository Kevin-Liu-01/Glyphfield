'use client';

import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { flushSync } from 'react-dom';

import DesignLabRangeControl from '@/components/DesignLabRangeControl';
import { useCommittedRef } from '@/hooks/useCommittedRef';
import { MAX_DESIGN_LAB_FONT_SIZE, MIN_DESIGN_LAB_FONT_SIZE } from '@/lib/designLabTypography';

import styles from './StudioFontSizeControl.module.css';

type FontSizeDraft = { base: number; dirty: boolean; text: string };

function sizeDraft(value: number, base = value): FontSizeDraft {
  // Suppress binary arithmetic noise only in the settled display. The exact
  // controlled value and explicitly entered drafts remain authoritative.
  return { base, dirty: false, text: String(Number(value.toPrecision(12))) };
}

function parseFontSize(text: string): number | null {
  if (!text.trim()) return null;
  const value = Number(text);
  return Number.isFinite(value) && value >= MIN_DESIGN_LAB_FONT_SIZE && value <= MAX_DESIGN_LAB_FONT_SIZE
    ? value
    : null;
}

/** Key by the selected layer when switching between equal-size text owners. */
export default function StudioFontSizeControl({ value, onChange, onPreview }: {
  value: number;
  onChange: (value: number) => void;
  onPreview?: (value: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(() => sizeDraft(value));
  // A new controlled value replaces a stale draft before paint, without
  // remounting the input or stealing focus from a keyboard edit.
  if (draft.base !== value) setDraft(sizeDraft(value));
  const sliderValue = Math.max(MIN_DESIGN_LAB_FONT_SIZE, Math.round(value));
  const sliderMax = Math.max(512, sliderValue);

  function changeSize(nextValue: number) {
    setDraft(sizeDraft(nextValue, value));
    onChange(nextValue);
  }

  function previewSize(nextValue: number) {
    setDraft(sizeDraft(nextValue, value));
    onPreview?.(nextValue);
  }

  function commitSize(nextValue: number | null) {
    if (nextValue === null) {
      setDraft(sizeDraft(value));
      return;
    }
    setDraft(sizeDraft(nextValue, value));
    if (nextValue === value) return;
    onPreview?.(nextValue);
    flushSync(() => onChange(nextValue));
  }

  function commitDraft() {
    if (draft.dirty) commitSize(parseFontSize(draft.text));
  }

  const nativeCommitRef = useCommittedRef((text: string) => {
    // A no-op native change must not replace exact source pixels with their
    // shorter display representation.
    if (text === sizeDraft(value).text) setDraft(sizeDraft(value));
    else commitSize(parseFontSize(text));
  });

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    // The public Browser API assigns .value directly, which React's value
    // tracker can suppress in onChange. Native change is the commit boundary.
    const commit = () => nativeCommitRef.current(input.value);
    input.addEventListener('change', commit);
    return () => input.removeEventListener('change', commit);
  }, [nativeCommitRef]);

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setDraft(sizeDraft(value));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      commitDraft();
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      event.stopPropagation();
      const direction = event.key === 'ArrowUp' ? 1 : -1;
      const currentValue = draft.dirty ? parseFontSize(event.currentTarget.value) ?? value : value;
      commitSize(Math.min(MAX_DESIGN_LAB_FONT_SIZE, Math.max(MIN_DESIGN_LAB_FONT_SIZE,
        currentValue + direction)));
    }
  }

  return (
    <div className={styles.control}>
      <DesignLabRangeControl
        formatValue={(nextValue) => `${nextValue === sliderValue && value !== sliderValue ? '≈' : ''}${nextValue} px`}
        label='Text size'
        max={sliderMax}
        min={MIN_DESIGN_LAB_FONT_SIZE}
        onChange={changeSize}
        onPreview={onPreview ? previewSize : undefined}
        step={1}
        value={sliderValue}
      />
      <label className={styles.pixelField}>
        <input
          aria-label='Text size in pixels'
          inputMode='decimal'
          max={MAX_DESIGN_LAB_FONT_SIZE}
          min={MIN_DESIGN_LAB_FONT_SIZE}
          onBlur={commitDraft}
          onInput={(event) => setDraft({ base: value, dirty: true, text: event.currentTarget.value })}
          onKeyDown={handleKeyDown}
          ref={inputRef}
          step={1}
          title='Enter a size from 1 to 2048 pixels'
          type='number'
          value={draft.text}
        />
        <span aria-hidden='true'>px</span>
      </label>
    </div>
  );
}
