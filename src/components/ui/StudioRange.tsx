'use client';

import {
  forwardRef,
  type CSSProperties,
  type InputHTMLAttributes,
  type InputEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';

type StudioRangeProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

type StudioRangeStyle = CSSProperties & {
  '--studio-range-progress': string;
};

function numericValue(value: StudioRangeProps['value'] | StudioRangeProps['defaultValue'], fallback: number): number {
  const resolved = Array.isArray(value) ? value[0] : value;
  const parsed = Number(resolved);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function progressFor(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}

function setProgress(input: HTMLInputElement) {
  const min = numericValue(input.min, 0);
  const max = numericValue(input.max, 100);
  const value = numericValue(input.value, min);
  input.style.setProperty('--studio-range-progress', `${progressFor(value, min, max)}%`);
}

const StudioRange = forwardRef<HTMLInputElement, StudioRangeProps>(function StudioRange({
  className = '',
  defaultValue,
  max = 100,
  min = 0,
  onClick,
  onInput,
  onPointerUp,
  style,
  value,
  ...props
}, ref) {
  const numericMin = numericValue(min, 0);
  const numericMax = numericValue(max, 100);
  const numericCurrentValue = numericValue(value ?? defaultValue, numericMin);
  const rangeStyle = {
    ...style,
    '--studio-range-progress': `${progressFor(numericCurrentValue, numericMin, numericMax)}%`,
  } as StudioRangeStyle;

  function handleInput(event: InputEvent<HTMLInputElement>) {
    setProgress(event.currentTarget);
    onInput?.(event);
  }

  function handlePointerUp(event: PointerEvent<HTMLInputElement>) {
    onPointerUp?.(event);
    if (event.defaultPrevented || event.currentTarget.disabled || event.button !== 0 || event.isPrimary === false) return;
    // Safari's mousedown default action blurs pointerdown focus. Wait until the
    // gesture ends so native dragging finishes before assigning keyboard focus.
    event.currentTarget.focus({ preventScroll: true });
  }

  function handleClick(event: MouseEvent<HTMLInputElement>) {
    onClick?.(event);
    if (event.defaultPrevented || event.currentTarget.disabled || event.button !== 0) return;
    event.currentTarget.focus({ preventScroll: true });
  }

  return (
    <input
      {...props}
      className={`studio-range ${className}`.trim()}
      data-studio-range='true'
      defaultValue={defaultValue}
      max={max}
      min={min}
      onClick={handleClick}
      onInput={handleInput}
      onPointerUp={handlePointerUp}
      ref={ref}
      style={rangeStyle}
      type='range'
      value={value}
    />
  );
});

export default StudioRange;
