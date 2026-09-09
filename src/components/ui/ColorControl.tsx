'use client';

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';

import {
  formatOklch,
  hexToHsv,
  hsvToHex,
  normalizeHex,
  normalizeHexOrFallback,
  oklchToHex,
  parseOklch,
} from '@/lib/color';
import StudioRange from '@/components/ui/StudioRange';
import { useCommittedRef } from '@/hooks/useCommittedRef';

type ColorControlProps = {
  ariaLabel: string;
  compact?: boolean;
  label: ReactNode;
  onChange: (value: string) => void;
  onPreview?: (value: string) => void;
  onOpacityChange?: (value: number) => void;
  onOpacityPreview?: (value: number) => void;
  opacity?: number;
  value: string;
};

type PropBoundPreview<T, Base = T> = {
  base: Base;
  value: T;
};

// Native ranges own their thumb capture in WebKit. Only track the gesture here;
// window listeners finish releases outside the input without replacing it.
function ColorRange({
  onCommit,
  onValue,
  value,
  ...props
}: Omit<ComponentProps<typeof StudioRange>, 'onInput' | 'onChange' | 'value'> & {
  onCommit: () => void;
  onValue: (value: number) => void;
  value: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pointerRef = useRef<number | null>(null);
  const nativeValueRef = useRef(value);
  const detachRef = useRef<(() => void) | null>(null);
  const finishRef = useCommittedRef(finish);

  useLayoutEffect(() => {
    if (pointerRef.current === null) nativeValueRef.current = value;
  }, [value]);
  useEffect(() => () => detachRef.current?.(), []);

  function finish() {
    pointerRef.current = null;
    detachRef.current?.();
    detachRef.current = null;
    const next = Number(inputRef.current?.value);
    if (Number.isFinite(next) && next !== nativeValueRef.current) {
      nativeValueRef.current = next;
      onValue(next);
    }
    onCommit();
  }

  function finishPointer(event: { pointerId: number }) {
    if (event.pointerId === pointerRef.current) finish();
  }

  function begin(event: PointerEvent<HTMLInputElement>) {
    if (event.button !== 0 || event.isPrimary === false || pointerRef.current !== null) return;
    pointerRef.current = event.pointerId;
    const onEnd = (event: globalThis.PointerEvent) => {
      if (event.pointerId === pointerRef.current) finishRef.current();
    };
    const onBlur = () => finishRef.current();
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    window.addEventListener('blur', onBlur);
    detachRef.current = () => {
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
      window.removeEventListener('blur', onBlur);
    };
  }

  return <StudioRange
    {...props}
    onBlur={finish}
    onChange={(event) => { if (event.nativeEvent.type === 'change') finish(); }}
    onInput={(event) => {
      nativeValueRef.current = Number(event.currentTarget.value);
      onValue(nativeValueRef.current);
      // Keyboard and assistive edits have no pointer release to commit them.
      if (pointerRef.current === null) onCommit();
    }}
    onLostPointerCapture={finishPointer}
    onPointerCancel={finishPointer}
    onPointerDown={begin}
    onPointerUp={finishPointer}
    ref={inputRef}
    value={value}
  />;
}

function ColorTextInput({
  onCommit,
  value,
  ...props
}: { 'aria-label': string; className: string; onCommit: (value: string) => void; value: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const cancelRef = useRef(false);
  return <input
    {...props}
    onBlur={(event) => {
      if (!cancelRef.current && event.currentTarget.value !== value) onCommit(event.currentTarget.value);
      cancelRef.current = false;
      setDraft(null);
      event.currentTarget.value = value;
    }}
    onChange={(event) => setDraft(event.currentTarget.value)}
    onKeyDown={(event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        event.currentTarget.blur();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        cancelRef.current = true;
        setDraft(null);
        event.currentTarget.blur();
      }
    }}
    value={draft ?? value}
  />;
}

export default function ColorControl({
  ariaLabel,
  compact = false,
  label,
  onChange,
  onPreview,
  onOpacityChange,
  onOpacityPreview,
  opacity,
  value,
}: ColorControlProps) {
  const pickerId = useId();
  const [pickerPosition, setPickerPosition] = useState({ left: 0, top: 0 });
  const committedHex = normalizeHexOrFallback(value);
  const [hexPreview, setHexPreview] = useState<PropBoundPreview<string> | null>(null);
  const previewHex = hexPreview?.base === committedHex ? hexPreview.value : null;
  const pendingHexRef = useRef<string | null>(null);
  const latestHexRef = useRef<string | null>(null);
  const previewFrameRef = useRef(0);
  const [opacityPreview, setOpacityPreview] = useState<PropBoundPreview<number, number | undefined> | null>(null);
  const previewOpacity = opacityPreview && opacityPreview.base === opacity
    ? opacityPreview.value
    : null;
  const pendingOpacityRef = useRef<number | null>(null);
  const latestOpacityRef = useRef<number | null>(null);
  const opacityFrameRef = useRef(0);
  const hex = previewHex ?? committedHex;
  const displayedOpacity = previewOpacity ?? opacity;
  const oklch = formatOklch(hex);
  // HEX cannot represent hue on gray, saturation on black, or the 360° endpoint.
  // Keep the user's exact coordinates while they still describe this color.
  const [pickerColor, setPickerColor] = useState<{ hex: string; hsv: ReturnType<typeof hexToHsv> } | null>(null);
  const hsv = pickerColor?.hex === hex ? pickerColor.hsv : hexToHsv(hex);
  const hsvRef = useRef(hsv);
  const pickerPointerRef = useRef<number | null>(null);

  useLayoutEffect(() => { hsvRef.current = hsv; }, [hsv]);

  useEffect(() => () => cancelAnimationFrame(previewFrameRef.current), []);

  useEffect(() => () => cancelAnimationFrame(opacityFrameRef.current), []);

  function showHexPreview(nextHex: string) {
    setHexPreview({ base: committedHex, value: nextHex });
  }

  function flushPreview() {
    cancelAnimationFrame(previewFrameRef.current);
    previewFrameRef.current = 0;
    const nextHex = pendingHexRef.current ?? latestHexRef.current;
    pendingHexRef.current = null;
    latestHexRef.current = null;
    if (!nextHex) return;
    showHexPreview(nextHex);
    onPreview?.(nextHex);
    onChange(nextHex);
  }

  function schedulePreview(nextValue: string) {
    const nextHex = normalizeHexOrFallback(nextValue, hex);
    showHexPreview(nextHex);
    pendingHexRef.current = nextHex;
    latestHexRef.current = nextHex;
    if (previewFrameRef.current) return;
    previewFrameRef.current = requestAnimationFrame(() => {
      previewFrameRef.current = 0;
      const frameHex = pendingHexRef.current;
      pendingHexRef.current = null;
      if (!frameHex) return;
      showHexPreview(frameHex);
      (onPreview ?? onChange)(frameHex);
    });
  }

  function scheduleHsv(nextHsv: ReturnType<typeof hexToHsv>) {
    const clamped = {
      hue: nextHsv.hue,
      saturation: Math.max(0, Math.min(1, nextHsv.saturation)),
      value: Math.max(0, Math.min(1, nextHsv.value)),
    };
    const nextHex = hsvToHex(clamped.hue, clamped.saturation, clamped.value);
    hsvRef.current = clamped;
    setPickerColor({ hex: nextHex, hsv: clamped });
    schedulePreview(nextHex);
  }

  function commitTextColor(nextHex: string) {
    hsvRef.current = hexToHsv(nextHex);
    setPickerColor(null);
    schedulePreview(nextHex);
    flushPreview();
  }

  function commitHex(nextValue: string) {
    try {
      commitTextColor(normalizeHex(nextValue));
    } catch {
      return;
    }
  }

  function commitOklch(nextValue: string) {
    const parsed = parseOklch(nextValue);
    if (parsed) commitTextColor(oklchToHex(parsed));
  }

  function scheduleOpacityPreview(nextOpacity: number) {
    pendingOpacityRef.current = nextOpacity;
    latestOpacityRef.current = nextOpacity;
    setOpacityPreview({ base: opacity, value: nextOpacity });
    if (opacityFrameRef.current) return;
    opacityFrameRef.current = requestAnimationFrame(() => {
      opacityFrameRef.current = 0;
      const frameOpacity = pendingOpacityRef.current;
      pendingOpacityRef.current = null;
      if (frameOpacity === null) return;
      (onOpacityPreview ?? onOpacityChange)?.(frameOpacity);
    });
  }

  function commitOpacityPreview() {
    cancelAnimationFrame(opacityFrameRef.current);
    opacityFrameRef.current = 0;
    const nextOpacity = pendingOpacityRef.current ?? latestOpacityRef.current;
    pendingOpacityRef.current = null;
    if (nextOpacity === null) return;
    onOpacityPreview?.(nextOpacity);
    latestOpacityRef.current = null;
    onOpacityChange?.(nextOpacity);
  }

  function updateSaturationAndValue(clientX: number, clientY: number, target: HTMLElement) {
    const bounds = target.getBoundingClientRect();
    if (
      !Number.isFinite(clientX)
      || !Number.isFinite(clientY)
      || !Number.isFinite(bounds.width)
      || !Number.isFinite(bounds.height)
      || bounds.width <= 0
      || bounds.height <= 0
    ) return;
    const saturation = Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width));
    const nextValue = Math.max(0, Math.min(1, 1 - (clientY - bounds.top) / bounds.height));
    scheduleHsv({ hue: hsvRef.current.hue, saturation, value: nextValue });
  }

  function handlePickerPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || event.isPrimary === false || pickerPointerRef.current !== null) return;
    pickerPointerRef.current = event.pointerId;
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    updateSaturationAndValue(event.clientX, event.clientY, event.currentTarget);
  }

  function handlePickerPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerId !== pickerPointerRef.current) return;
    updateSaturationAndValue(event.clientX, event.clientY, event.currentTarget);
  }

  function finishPickerPointer(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerId !== pickerPointerRef.current) return;
    if (event.type === 'pointerup') {
      updateSaturationAndValue(event.clientX, event.clientY, event.currentTarget);
    }
    pickerPointerRef.current = null;
    flushPreview();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handlePickerKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 0.1 : 0.01;
    let saturation = hsvRef.current.saturation;
    let nextValue = hsvRef.current.value;
    if (event.key === 'ArrowLeft') saturation -= step;
    else if (event.key === 'ArrowRight') saturation += step;
    else if (event.key === 'ArrowUp') nextValue += step;
    else if (event.key === 'ArrowDown') nextValue -= step;
    else return;
    event.preventDefault();
    event.stopPropagation();
    scheduleHsv({ hue: hsvRef.current.hue, saturation, value: nextValue });
    flushPreview();
  }

  function positionPicker(event: MouseEvent<HTMLButtonElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const viewportPadding = 12;
    const pickerWidth = 260;
    const pickerHeight = compact ? 410 : 320;
    const left = Math.min(
      window.innerWidth - pickerWidth - viewportPadding,
      Math.max(viewportPadding, bounds.left)
    );
    const fitsBelow = bounds.bottom + pickerHeight + viewportPadding <= window.innerHeight;
    const top = fitsBelow
      ? bounds.bottom + 8
      : Math.max(viewportPadding, bounds.top - pickerHeight - 8);
    setPickerPosition({ left, top });
  }

  return (
    <div className={compact
      ? 'studio-color-control studio-color-control-compact design-lab-color'
      : 'studio-color-control flex flex-col gap-2.5 rounded-md border border-border p-3'}>
      {compact ? (
        <button
          aria-haspopup='dialog'
          aria-label={ariaLabel}
          className='studio-color-control-compact-trigger'
          onClick={positionPicker}
          popoverTarget={pickerId}
          popoverTargetAction='toggle'
          type='button'
        >
          <span
            aria-hidden='true'
            className='studio-color-control-compact-swatch'
            style={{ backgroundColor: hex }}
          />
          <span>{label}</span>
          <code>{hex}</code>
        </button>
      ) : <>
        <div className='flex items-center justify-between gap-3'>
          <span className='text-xs font-semibold text-foreground'>{label}</span>
          {opacity === undefined ? null : (
            <output className='font-mono text-[10px] text-muted-foreground'>{displayedOpacity}%</output>
          )}
        </div>
        <div className='studio-color-control-row grid grid-cols-[38px_minmax(0,1fr)] items-stretch gap-2'>
          <button
            aria-haspopup='dialog'
            aria-label={ariaLabel}
            className='studio-color-control-swatch relative grid size-[38px] shrink-0 cursor-pointer place-items-center rounded-md border border-input bg-background p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring'
            onClick={positionPicker}
            popoverTarget={pickerId}
            popoverTargetAction='toggle'
            type='button'
          >
            <span
              aria-hidden='true'
              className='size-full border border-foreground/10'
              style={{ backgroundColor: hex }}
            />
          </button>
          <label className='studio-color-control-field studio-color-control-hex-field grid grid-cols-[42px_1fr] items-center overflow-hidden rounded-md border border-input bg-background'>
            <span className='pl-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground'>HEX</span>
            <ColorTextInput
              aria-label={`${ariaLabel} HEX`}
              className='h-9 min-w-0 bg-transparent pr-2 font-mono text-xs uppercase outline-none'
              onCommit={commitHex}
              value={hex}
            />
          </label>
        </div>
      </>}
      <div
        aria-label={`${ariaLabel} color picker`}
        className='color-picker-popover flex w-[260px] flex-col gap-3 rounded-md bg-background p-3 text-foreground smooth-shadow-ring-xl'
        id={pickerId}
        onBeforeToggle={(event) => {
          if (event.newState !== 'closed') return;
          const active = document.activeElement;
          if (active instanceof HTMLElement && event.currentTarget.contains(active)) active.blur();
          pickerPointerRef.current = null;
          flushPreview();
        }}
        popover='auto'
        role='dialog'
        style={pickerPosition}
      >
        <div
          aria-label={`${ariaLabel} saturation and brightness`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={Math.round(hsv.saturation * 100)}
          className='relative aspect-[16/9] w-full cursor-crosshair touch-none overflow-hidden rounded-sm border border-foreground/10 outline-none focus-visible:ring-2 focus-visible:ring-ring'
          onKeyDown={handlePickerKeyDown}
          onBlur={() => { pickerPointerRef.current = null; flushPreview(); }}
          onLostPointerCapture={finishPickerPointer}
          onPointerDown={handlePickerPointerDown}
          onPointerMove={handlePickerPointerMove}
          onPointerUp={finishPickerPointer}
          onPointerCancel={finishPickerPointer}
          role='slider'
          style={{
            backgroundColor: `hsl(${hsv.hue} 100% 50%)`,
            backgroundImage: 'linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)',
          }}
          tabIndex={0}
        >
          <span
            aria-hidden='true'
            className='pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.55)]'
            style={{
              left: `clamp(6px, ${hsv.saturation * 100}%, calc(100% - 6px))`,
              top: `clamp(6px, ${(1 - hsv.value) * 100}%, calc(100% - 6px))`,
            }}
          />
        </div>
        <label className='flex items-center gap-3'>
          <span className='size-5 shrink-0 rounded-full border border-border' style={{ backgroundColor: hex }} />
          <ColorRange
            aria-label={`${ariaLabel} hue`}
            className='color-hue-range min-w-0 flex-1'
            max={360}
            min={0}
            onCommit={flushPreview}
            onValue={(hue) => scheduleHsv({ ...hsvRef.current, hue })}
            value={Math.round(hsv.hue)}
          />
        </label>
        <div className='grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground'>
          <span className='rounded-sm border border-border py-1.5'><strong className='font-medium text-foreground'>{Math.round(hsv.hue)}</strong> H</span>
          <span className='rounded-sm border border-border py-1.5'><strong className='font-medium text-foreground'>{Math.round(hsv.saturation * 100)}</strong> S</span>
          <span className='rounded-sm border border-border py-1.5'><strong className='font-medium text-foreground'>{Math.round(hsv.value * 100)}</strong> V</span>
        </div>
        {compact ? <>
          <label className='studio-color-control-field studio-color-control-hex-field grid grid-cols-[42px_1fr] items-center overflow-hidden rounded-md border border-input bg-background'>
            <span className='pl-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground'>HEX</span>
            <ColorTextInput
              aria-label={`${ariaLabel} HEX`}
              className='h-9 min-w-0 bg-transparent pr-2 font-mono text-xs uppercase outline-none'
              onCommit={commitHex}
              value={hex}
            />
          </label>
          <label className='studio-color-control-field studio-color-control-oklch-field grid grid-cols-[52px_1fr] items-center overflow-hidden rounded-md border border-input bg-background'>
            <span className='pl-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground'>OKLCH</span>
            <ColorTextInput
              aria-label={`${ariaLabel} OKLCH`}
              className='h-9 min-w-0 bg-transparent pr-2 font-mono text-[10px] outline-none'
              onCommit={commitOklch}
              value={oklch}
            />
          </label>
        </> : null}
      </div>
      {compact ? null : <label className='studio-color-control-field studio-color-control-oklch-field grid grid-cols-[52px_1fr] items-center overflow-hidden rounded-md border border-input bg-background'>
        <span className='pl-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground'>OKLCH</span>
        <ColorTextInput
          aria-label={`${ariaLabel} OKLCH`}
          className='h-9 min-w-0 bg-transparent pr-2 font-mono text-[10px] outline-none'
          onCommit={commitOklch}
          value={oklch}
        />
      </label>}
      {compact || opacity === undefined || !onOpacityChange ? null : (
        <ColorRange
          aria-label={`${ariaLabel} opacity`}
          max={100}
          min={0}
          onCommit={commitOpacityPreview}
          onValue={scheduleOpacityPreview}
          value={displayedOpacity!}
        />
      )}
    </div>
  );
}
