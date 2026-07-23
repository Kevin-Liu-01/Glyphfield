'use client';

import { T, useGT } from 'gt-next';
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import StudioSelect from '@/components/ui/StudioSelect';
type TimelinePanelProps = {
  currentMs: number;
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
  currentMs,
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
  const frameDuration = 1000 / fps;
  const progress = totalMs === 0 ? 0 : (currentMs / totalMs) * 100;
  const effectiveTransitionMs = labels.length > 1 ? transitionMs : 0;
  const holdFraction = holdMs / Math.max(1, holdMs + effectiveTransitionMs);

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
            onClick={() => onSeek(0)}
            size='icon-sm'
            type='button'
            variant='outline'
          >
            <RotateCcw aria-hidden='true' />
          </Button>
          <Button
            aria-label={gt('Previous frame')}
            className='rounded-none'
            onClick={() => onSeek(Math.max(0, currentMs - frameDuration))}
            size='icon-sm'
            type='button'
            variant='outline'
          >
            <SkipBack aria-hidden='true' />
          </Button>
          <Button
            aria-label={gt('Next frame')}
            className='rounded-none'
            onClick={() => onSeek(Math.min(totalMs, currentMs + frameDuration))}
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
          <output className='min-w-28 text-right font-mono text-xs tabular-nums'>
            {formatTime(currentMs)} / {formatTime(totalMs)}
          </output>
        </div>
      </div>

      <div className='relative p-4'>
        <div className='relative h-16 overflow-hidden border border-border bg-muted/40'>
          <div className='absolute inset-0 flex'>
            {labels.map((label, index) => (
              <div
                className='relative min-w-0 flex-1 border-r border-border last:border-r-0'
                key={`${label}-${index}`}
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
            style={{ left: `${progress}%` }}
          >
            <div className='absolute -top-1 -left-[3px] size-[7px] rotate-45 bg-foreground' />
          </div>
          <input
            aria-label={gt('Timeline playhead')}
            className='absolute inset-0 z-20 size-full cursor-ew-resize opacity-0'
            max={Math.max(1, totalMs)}
            min='0'
            onChange={(event) => onSeek(Number(event.target.value))}
            step={Math.max(1, frameDuration)}
            type='range'
            value={Math.min(currentMs, Math.max(1, totalMs))}
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
