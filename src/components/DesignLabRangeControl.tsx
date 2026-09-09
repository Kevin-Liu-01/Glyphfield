'use client';

import { startTransition, useCallback, useEffect, useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { flushSync } from 'react-dom';
import StudioRange from '@/components/ui/StudioRange';
import StudioRangeLabel from '@/components/StudioRangeLabel';
import { useCommittedRef } from '@/hooks/useCommittedRef';

export default function DesignLabRangeControl({
  formatValue,
  label,
  max,
  min,
  onChange,
  onPreview,
  step,
  value,
}: {
  formatValue?: (value: number) => string;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  onPreview?: (value: number) => void;
  step: number;
  value: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLOutputElement>(null);
  const pendingValueRef = useRef<number | null>(null);
  const latestValueRef = useRef<number | null>(null);
  const previewTimerRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);
  const detachGestureListenersRef = useRef<(() => void) | null>(null);
  const finishGestureRef = useCommittedRef(finishGesture);

  const formatDisplayValue = useCallback((nextValue: number) => (
    formatValue?.(nextValue) ?? (Number.isInteger(step) ? Math.round(nextValue).toString() : nextValue.toFixed(2))
  ), [formatValue, step]);

  const syncDisplayValue = useCallback((nextValue: number) => {
    const input = inputRef.current;
    if (input) {
      input.value = String(nextValue);
      const progress = max <= min ? 0 : Math.min(100, Math.max(0, (nextValue - min) / (max - min) * 100));
      input.style.setProperty('--studio-range-progress', `${progress}%`);
    }
    if (outputRef.current) outputRef.current.textContent = formatDisplayValue(nextValue);
  }, [formatDisplayValue, max, min]);

  useLayoutEffect(() => {
    if (pointerIdRef.current === null && latestValueRef.current === null) {
      syncDisplayValue(value);
    }
  }, [max, min, syncDisplayValue, value]);

  useEffect(() => () => {
    window.clearTimeout(previewTimerRef.current);
    detachGestureListenersRef.current?.();
  }, []);

  function flushValue() {
    window.clearTimeout(previewTimerRef.current);
    previewTimerRef.current = 0;
    const nextValue = pendingValueRef.current ?? latestValueRef.current;
    pendingValueRef.current = null;
    latestValueRef.current = null;
    if (nextValue !== null) {
      // Reapply even a no-op commit: a drag may have previewed another value before
      // returning to its starting point, which React need not paint again.
      onPreview?.(nextValue);
      flushSync(() => onChange(nextValue));
    }
    inputRef.current?.removeAttribute('data-canvas-preview-pending');
  }

  function finishGesture() {
    pointerIdRef.current = null;
    detachGestureListenersRef.current?.();
    detachGestureListenersRef.current = null;
    const input = inputRef.current;
    // A native range may report its final value at change/release, after the
    // last input preview. The visible control, not that earlier preview, wins.
    const nativeValue = input ? Number(input.value) : null;
    if (nativeValue !== null && Number.isFinite(nativeValue) && nativeValue !== (latestValueRef.current ?? value)) {
      syncDisplayValue(nativeValue);
      pendingValueRef.current = nativeValue;
      latestValueRef.current = nativeValue;
    }
    flushValue();
  }

  function finishPointerGesture(event: { pointerId: number }) {
    if (event.pointerId === pointerIdRef.current) finishGesture();
  }

  function beginGesture(event: ReactPointerEvent<HTMLInputElement>) {
    if (event.button !== 0 || pointerIdRef.current !== null) return;
    pointerIdRef.current = event.pointerId;
    // Let the native thumb own capture. Capturing its input prevents WebKit
    // from updating the range value at all. Window listeners cover releases
    // outside the input without replacing the browser's drag implementation.
    const finishPointer = (event: PointerEvent) => {
      if (event.pointerId === pointerIdRef.current) finishGestureRef.current();
    };
    const finishBlur = () => finishGestureRef.current();
    window.addEventListener('pointerup', finishPointer);
    window.addEventListener('pointercancel', finishPointer);
    window.addEventListener('blur', finishBlur);
    detachGestureListenersRef.current = () => {
      window.removeEventListener('pointerup', finishPointer);
      window.removeEventListener('pointercancel', finishPointer);
      window.removeEventListener('blur', finishBlur);
    };
  }

  function scheduleValue(nextValue: number) {
    syncDisplayValue(nextValue);
    pendingValueRef.current = nextValue;
    latestValueRef.current = nextValue;
    if (pointerIdRef.current === null) {
      // Keyboard/assistive input has no pointerup. It must update source now,
      // not leave a DOM-only value waiting for blur or a later export click.
      flushValue();
      return;
    }
    inputRef.current?.setAttribute('data-canvas-preview-pending', 'true');
    if (previewTimerRef.current) return;
    previewTimerRef.current = window.setTimeout(() => {
      previewTimerRef.current = 0;
      if (pendingValueRef.current === null) return;
      const previewValue = pendingValueRef.current;
      pendingValueRef.current = null;
      if (onPreview) onPreview(previewValue);
      else startTransition(() => onChange(previewValue));
    }, 16);
  }

  return (
    <label className='shader-lab-v2-range'>
      <StudioRangeLabel
        label={label}
        value={<output ref={outputRef}>{formatDisplayValue(value)}</output>}
      />
      <StudioRange
        aria-label={label}
        defaultValue={value}
        max={max}
        min={min}
        onBlur={finishGesture}
        onChange={(event) => {
          // React also synthesizes onChange for input events, which already use
          // the throttled preview path. Only a native change needs this fallback.
          if (event.nativeEvent.type === 'change') finishGesture();
        }}
        onInput={(event) => scheduleValue(Number(event.currentTarget.value))}
        onLostPointerCapture={finishPointerGesture}
        onPointerCancel={finishPointerGesture}
        onPointerDown={beginGesture}
        onPointerUp={finishPointerGesture}
        ref={inputRef}
        step={step}
      />
    </label>
  );
}
