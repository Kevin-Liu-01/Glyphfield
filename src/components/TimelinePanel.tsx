'use client';

import { T, useGT } from 'gt-next';
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from '@/components/ui/SolidIcons';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { Button } from '@/components/ui/Button';
import StudioSelect from '@/components/ui/StudioSelect';
type TimelinePanelProps = {
  currentMsRef: { current: number };
  fps: number;
  holdMs: number;
  isPlaying: boolean;
  labels: readonly string[];
  onPlayChange: (playing: boolean) => void;
  onRateChange: (rate: number) => void;
  onSeek: (timeMs: number) => void;
  playbackRate: number;
  totalMs: number;
  transitionMs: number;
};

function formatTime(timeMs: number): string {
  const seconds = Math.max(0, timeMs) / 1000;
  return `${seconds.toFixed(2)}s`;
}

export default function TimelinePanel({
  currentMsRef,
  fps,
  holdMs,
  isPlaying,
  labels,
  onPlayChange,
  onRateChange,
  onSeek,
  playbackRate,
  totalMs,
  transitionMs,
}: TimelinePanelProps) {
  const gt = useGT();
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLOutputElement>(null);
  const playheadElementRef = useRef<HTMLDivElement>(null);
  const frameDuration = 1000 / fps;
  const effectiveTransitionMs = labels.length > 1 ? transitionMs : 0;
  const holdFraction = holdMs / Math.max(1, holdMs + effectiveTransitionMs);
  const segments = useMemo(() => {
    const occurrences = new Map<string, number>();
    return labels.map((label) => {
      const occurrence = (occurrences.get(label) ?? 0) + 1;
      occurrences.set(label, occurrence);
      return { key: `${label}:${occurrence}`, label };
    });
  }, [labels]);
  const syncPlayheadUi = useCallback(() => {
    const currentMs = Math.min(currentMsRef.current, totalMs);
    const progress = totalMs === 0 ? 0 : (currentMs / totalMs) * 100;
    if (playheadElementRef.current) {
      playheadElementRef.current.style.left = `${progress}%`;
    }
    if (outputRef.current) {
      outputRef.current.value = `${formatTime(currentMs)} / ${formatTime(totalMs)}`;
    }
    if (inputRef.current) {
      inputRef.current.value = String(currentMs);
    }
  }, [currentMsRef, totalMs]);

  useEffect(() => {
    let animationFrame = 0;

    function tick() {
      syncPlayheadUi();
      animationFrame = requestAnimationFrame(tick);
    }

    syncPlayheadUi();
    if (isPlaying) animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [isPlaying, syncPlayheadUi]);

  function seekAndSync(timeMs: number) {
    onSeek(timeMs);
    syncPlayheadUi();
  }

  return (
    <section className='border-t border-border bg-background'>
      <div className='flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2'>
        <div className='flex items-center gap-1'>
          <Button
            aria-label={isPlaying ? gt('Pause preview') : gt('Play preview')}
            className='rounded-none'
            onClick={() => onPlayChange(!isPlaying)}
            size='icon-sm'
            type='button'
            variant='outline'
          >
            {isPlaying ? <Pause aria-hidden='true' /> : <Play aria-hidden='true' />}
          </Button>
          <Button
            aria-label={gt('Restart preview')}
            className='rounded-none'
            onClick={() => seekAndSync(0)}
            size='icon-sm'
            type='button'
            variant='outline'
          >
            <RotateCcw aria-hidden='true' />
          </Button>
          <Button
            aria-label={gt('Previous frame')}
            className='rounded-none'
            onClick={() => seekAndSync(Math.max(0, currentMsRef.current - frameDuration))}
            size='icon-sm'
            type='button'
            variant='outline'
          >
            <SkipBack aria-hidden='true' />
          </Button>
          <Button
            aria-label={gt('Next frame')}
            className='rounded-none'
            onClick={() => seekAndSync(Math.min(totalMs, currentMsRef.current + frameDuration))}
            size='icon-sm'
            type='button'
            variant='outline'
          >
            <SkipForward aria-hidden='true' />
          </Button>
        </div>

        <div className='flex items-center gap-3'>
          <div className='flex items-center gap-2 text-xs text-muted-foreground'>
            <T>Rate</T>
            <StudioSelect
              ariaLabel={gt('Playback rate')}
              className='h-8 w-20 font-mono text-xs'
              onValueChange={(value) => onRateChange(Number(value))}
              options={[0.1, 0.25, 0.5, 1, 2, 4].map((rate) => ({ label: `${rate}×`, value: String(rate) }))}
              value={String(playbackRate)}
            />
          </div>
          <output className='min-w-28 text-right font-mono text-xs tabular-nums' ref={outputRef}>
            {formatTime(currentMsRef.current)} / {formatTime(totalMs)}
          </output>
        </div>
      </div>

      <div className='relative p-4'>
        <div className='relative h-16 overflow-hidden border border-border bg-muted/40'>
          <div className='absolute inset-0 flex'>
            {segments.map(({ key, label }, index) => (
              <div
                className='relative min-w-0 flex-1 border-r border-border last:border-r-0'
                key={key}
              >
                <div
                  className='absolute inset-y-0 left-0 bg-foreground/8'
                  style={{ width: `${holdFraction * 100}%` }}
                />
                <div className='absolute inset-x-2 top-2 truncate font-mono text-[10px] text-muted-foreground'>
                  {String(index + 1).padStart(2, '0')} {label}
                </div>
                <div
                  className='absolute right-0 bottom-2 h-2 bg-foreground/20'
                  style={{ width: `${(1 - holdFraction) * 100}%` }}
                />
              </div>
            ))}
          </div>
          <div
            className='pointer-events-none absolute inset-y-0 z-10 w-px bg-foreground'
            ref={playheadElementRef}
            style={{ left: 0 }}
          >
            <div className='absolute -top-1 -left-[3px] size-[7px] rotate-45 bg-foreground' />
          </div>
          <input
            aria-label={gt('Timeline playhead')}
            className='absolute inset-0 z-20 size-full cursor-ew-resize opacity-0'
            max={Math.max(1, totalMs)}
            min='0'
            onChange={(event) => seekAndSync(Number(event.target.value))}
            ref={inputRef}
            step={Math.max(1, frameDuration)}
            type='range'
            defaultValue={Math.min(currentMsRef.current, Math.max(1, totalMs))}
          />
        </div>
        <div className='mt-2 flex items-center justify-between gap-4 font-mono text-[10px] uppercase tracking-wider text-muted-foreground'>
          <span>
            <T>Master playhead</T>
          </span>
          <span>
            {labels.length} <T>states</T> · {fps} fps · {holdMs}ms + {effectiveTransitionMs}ms
          </span>
        </div>
      </div>
    </section>
  );
}
