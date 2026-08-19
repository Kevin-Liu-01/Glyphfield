'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
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

type ColorControlProps = {
  ariaLabel: string;
  label: ReactNode;
  onChange: (value: string) => void;
  onPreview?: (value: string) => void;
  onOpacityChange?: (value: number) => void;
  onOpacityPreview?: (value: number) => void;
  opacity?: number;
  value: string;
};

export default function ColorControl({
  ariaLabel,
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
  const [previewHex, setPreviewHex] = useState<string | null>(null);
  const pendingHexRef = useRef<string | null>(null);
  const latestHexRef = useRef<string | null>(null);
  const previewFrameRef = useRef(0);
  const [previewOpacity, setPreviewOpacity] = useState<number | null>(null);
  const pendingOpacityRef = useRef<number | null>(null);
  const latestOpacityRef = useRef<number | null>(null);
  const opacityFrameRef = useRef(0);
  const hex = previewHex ?? committedHex;
  const displayedOpacity = previewOpacity ?? opacity;
  const oklch = formatOklch(hex);
  const hsv = hexToHsv(hex);

  useEffect(() => {
    if (previewHex === committedHex) setPreviewHex(null);
  }, [committedHex, previewHex]);

  useEffect(() => () => cancelAnimationFrame(previewFrameRef.current), []);

  useEffect(() => {
    if (previewOpacity === opacity) setPreviewOpacity(null);
  }, [opacity, previewOpacity]);

  useEffect(() => () => cancelAnimationFrame(opacityFrameRef.current), []);

  function flushPreview(commit: boolean) {
    cancelAnimationFrame(previewFrameRef.current);
    previewFrameRef.current = 0;
    const nextHex = pendingHexRef.current ?? latestHexRef.current;
    pendingHexRef.current = null;
    if (!nextHex) return;
    setPreviewHex(nextHex);
    onPreview?.(nextHex);
    if (commit) {
      latestHexRef.current = null;
      onChange(nextHex);
    }
  }

  function schedulePreview(nextValue: string) {
    const nextHex = normalizeHexOrFallback(nextValue, hex);
    pendingHexRef.current = nextHex;
    latestHexRef.current = nextHex;
    if (previewFrameRef.current) return;
    previewFrameRef.current = requestAnimationFrame(() => {
      previewFrameRef.current = 0;
      const frameHex = pendingHexRef.current;
      pendingHexRef.current = null;
      if (!frameHex) return;
      setPreviewHex(frameHex);
      (onPreview ?? onChange)(frameHex);
    });
  }

  function commitHex(nextValue: string) {
    try {
      onChange(normalizeHex(nextValue));
    } catch {
      return;
    }
  }

  function commitOklch(nextValue: string) {
    const parsed = parseOklch(nextValue);
    if (parsed) onChange(oklchToHex(parsed));
  }

  function scheduleOpacityPreview(nextOpacity: number) {
    pendingOpacityRef.current = nextOpacity;
    latestOpacityRef.current = nextOpacity;
    setPreviewOpacity(nextOpacity);
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
    schedulePreview(hsvToHex(hsv.hue, saturation, nextValue));
  }

  function handlePickerPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    updateSaturationAndValue(event.clientX, event.clientY, event.currentTarget);
  }

  function handlePickerPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    updateSaturationAndValue(event.clientX, event.clientY, event.currentTarget);
  }

  function handlePickerKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 0.1 : 0.01;
    let saturation = hsv.saturation;
    let nextValue = hsv.value;
    if (event.key === 'ArrowLeft') saturation -= step;
    else if (event.key === 'ArrowRight') saturation += step;
    else if (event.key === 'ArrowUp') nextValue += step;
    else if (event.key === 'ArrowDown') nextValue -= step;
    else return;
    event.preventDefault();
    const nextHex = hsvToHex(hsv.hue, saturation, nextValue);
    setPreviewHex(nextHex);
    onPreview?.(nextHex);
    onChange(nextHex);
  }

  function positionPicker(event: MouseEvent<HTMLButtonElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const viewportPadding = 12;
    const pickerWidth = 260;
    const pickerHeight = 320;
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
    <div className='studio-color-control flex flex-col gap-2.5 rounded-md border border-border p-3'>
      <div className='flex items-center justify-between gap-3'>
        <span className='text-xs font-semibold text-foreground'>{label}</span>
        {opacity === undefined ? null : (
          <output className='font-mono text-[10px] text-muted-foreground'>{displayedOpacity}%</output>
        )}
      </div>
      <div className='studio-color-control-row grid grid-cols-[38px_minmax(0,1fr)] items-stretch gap-2'>
        <button
          aria-controls={pickerId}
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
          <input
            aria-label={`${ariaLabel} HEX`}
            className='h-9 min-w-0 bg-transparent pr-2 font-mono text-xs uppercase outline-none'
            defaultValue={hex}
            key={hex}
            onBlur={(event) => commitHex(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
          />
        </label>
      </div>
      <div
        className='color-picker-popover flex w-[260px] flex-col gap-3 rounded-md bg-background p-3 text-foreground smooth-shadow-ring-xl'
        id={pickerId}
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
          onPointerDown={handlePickerPointerDown}
          onPointerMove={handlePickerPointerMove}
          onPointerUp={(event) => {
            flushPreview(true);
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
          }}
          onPointerCancel={() => flushPreview(true)}
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
          <input
            aria-label={`${ariaLabel} hue`}
            className='studio-range color-hue-range min-w-0 flex-1'
            max={360}
            min={0}
            onBlur={() => flushPreview(true)}
            onInput={(event) => schedulePreview(hsvToHex(Number(event.currentTarget.value), hsv.saturation, hsv.value))}
            onPointerCancel={() => flushPreview(true)}
            onPointerUp={() => flushPreview(true)}
            type='range'
            value={Math.round(hsv.hue)}
          />
        </label>
        <div className='grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground'>
          <span className='rounded-sm border border-border py-1.5'><strong className='font-medium text-foreground'>{Math.round(hsv.hue)}</strong> H</span>
          <span className='rounded-sm border border-border py-1.5'><strong className='font-medium text-foreground'>{Math.round(hsv.saturation * 100)}</strong> S</span>
          <span className='rounded-sm border border-border py-1.5'><strong className='font-medium text-foreground'>{Math.round(hsv.value * 100)}</strong> V</span>
        </div>
      </div>
      <label className='studio-color-control-field studio-color-control-oklch-field grid grid-cols-[52px_1fr] items-center overflow-hidden rounded-md border border-input bg-background'>
        <span className='pl-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground'>OKLCH</span>
        <input
          aria-label={`${ariaLabel} OKLCH`}
          className='h-9 min-w-0 bg-transparent pr-2 font-mono text-[10px] outline-none'
          defaultValue={oklch}
          key={oklch}
          onBlur={(event) => commitOklch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
        />
      </label>
      {opacity === undefined || !onOpacityChange ? null : (
        <input
          aria-label={`${ariaLabel} opacity`}
          className='studio-range'
          max={100}
          min={0}
          onBlur={commitOpacityPreview}
          onInput={(event) => scheduleOpacityPreview(Number(event.currentTarget.value))}
          onPointerCancel={commitOpacityPreview}
          onPointerUp={commitOpacityPreview}
          type='range'
          value={displayedOpacity}
        />
      )}
    </div>
  );
}
