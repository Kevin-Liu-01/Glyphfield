'use client';

import { Pipette } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

type EyeDropperConstructor = new () => {
  open: (options: { signal: AbortSignal }) => Promise<{ sRGBHex: string }>;
};

function getEyeDropper() {
  return (window as Window & { EyeDropper?: EyeDropperConstructor }).EyeDropper;
}

export default function ScreenColorPicker({
  ariaLabel,
  onPick,
}: {
  ariaLabel: string;
  onPick: (hex: string) => void;
}) {
  const descriptionId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setSupported(typeof getEyeDropper() === 'function');
    const popover = buttonRef.current?.closest('[popover]');
    const abortOnClose = (event: Event) => {
      if ((event as ToggleEvent).newState === 'closed') requestRef.current?.abort();
    };
    popover?.addEventListener('beforetoggle', abortOnClose);
    return () => {
      requestRef.current?.abort();
      popover?.removeEventListener('beforetoggle', abortOnClose);
    };
  }, []);

  async function pickColor() {
    const EyeDropper = getEyeDropper();
    if (!EyeDropper || requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setActive(true);
    setError('');
    try {
      // Open synchronously within the click's transient user activation.
      const result = await new EyeDropper().open({ signal: controller.signal });
      if (!controller.signal.aborted) onPick(result.sRGBHex);
    } catch (cause) {
      if (!controller.signal.aborted && !(cause instanceof DOMException && cause.name === 'AbortError')) {
        setError('Could not sample the screen. Try again.');
      }
    } finally {
      requestRef.current = null;
      if (buttonRef.current) {
        setActive(false);
        if (!controller.signal.aborted) buttonRef.current.focus({ preventScroll: true });
      }
    }
  }

  const description = supported
    ? 'Click anywhere on your screen. Press Escape to cancel.'
    : 'Screen sampling requires a supported browser on HTTPS or localhost.';

  return <div className='flex flex-col gap-1.5'>
    <button
      aria-describedby={descriptionId}
      aria-disabled={active || !supported}
      aria-label={`${ariaLabel} pick screen color`}
      aria-pressed={active}
      className='flex h-8 items-center justify-center gap-2 rounded-md border border-input text-xs hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'
      disabled={!supported}
      onClick={pickColor}
      ref={buttonRef}
      title={description}
      type='button'
    >
      <Pipette aria-hidden='true' size={14} />
      {active ? 'Click a screen color…' : 'Pick screen color'}
    </button>
    <span className='sr-only' id={descriptionId}>{description}</span>
    <span className={error ? 'text-xs text-destructive' : 'sr-only'} role='status'>
      {error || (active ? description : '')}
    </span>
  </div>;
}
