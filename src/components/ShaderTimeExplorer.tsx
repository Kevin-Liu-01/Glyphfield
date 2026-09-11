'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { flushSync } from 'react-dom';
import { Clock3, ImagePlus, Pause, Play, Plus, SkipBack, SkipForward } from '@/components/ui/SolidIcons';
import StudioRange from '@/components/ui/StudioRange';
import { useCommittedRef } from '@/hooks/useCommittedRef';
import type { ShaderMotionCapabilities } from '@/lib/shaderMotionCapabilities';

export type ShaderTimeExplorerProps = {
  timeMs: number;
  playing: boolean;
  onTimeChange: (timeMs: number) => void;
  onTimePreview: (timeMs: number) => void;
  onLiveTime?: (timeMs: number) => void;
  onFreeze: () => void;
  onScrubStart?: () => void;
  onPlay: () => void;
  onCapture: () => void;
  canSeek: boolean;
  busy: boolean;
  capabilities?: ShaderMotionCapabilities;
};

const EXPLORATION_WINDOW_MS = 30_000;
const FRAME_STEP_MS = 1000 / 60;
const boundedTime = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;
const windowFor = (value: number) => Math.max(EXPLORATION_WINDOW_MS, Math.ceil(value / EXPLORATION_WINDOW_MS) * EXPLORATION_WINDOW_MS);

/** Native motion stays in its renderer. This readout never drives playback or wraps time. */
export default function ShaderTimeExplorer(props: ShaderTimeExplorerProps) {
  const { busy, canSeek, capabilities, playing, timeMs } = props;
  const latest = useCommittedRef(props);
  const timeRef = useRef(boundedTime(timeMs));
  const rangeRef = useRef<HTMLInputElement>(null);
  const secondsRef = useRef<HTMLSpanElement>(null);
  const windowLabelRef = useRef<HTMLSpanElement>(null);
  const [windowMs, setWindowMs] = useState(() => windowFor(timeMs));
  const windowRef = useRef(windowMs);
  const pendingRef = useRef<number | null>(null);
  const lastPreviewedRef = useRef<number | null>(null);
  const previewFrameRef = useRef(0);
  const scrubbingRef = useRef(false);
  const pointerGestureRef = useRef<{ pointerId: number; initialValue: number } | null>(null);
  const detachGestureListenersRef = useRef<(() => void) | null>(null);
  const finishGestureRef = useCommittedRef(finishPointerGesture);
  const nativeChangeRef = useCommittedRef(handleNativeChange);

  const syncDisplay = useCallback((value: number) => {
    const next = boundedTime(value);
    timeRef.current = next;
    if (rangeRef.current) {
      // Playback never changes the user's exploration range. The elapsed
      // readout stays unbounded; only the thumb stops at the selected edge.
      const visibleTime = Math.min(next, windowRef.current);
      rangeRef.current.max = String(windowRef.current);
      rangeRef.current.value = String(visibleTime);
      rangeRef.current.style.setProperty('--studio-range-progress', `${visibleTime / windowRef.current * 100}%`);
    }
    if (secondsRef.current) secondsRef.current.textContent = `${(next / 1000).toFixed(2)}s`;
    if (windowLabelRef.current) windowLabelRef.current.textContent = `${windowRef.current / 1000}s`;
  }, []);

  useLayoutEffect(() => {
    syncDisplay(timeMs);
  }, [playing, syncDisplay, timeMs]);
  useLayoutEffect(() => {
    windowRef.current = Math.max(windowRef.current, windowMs);
    syncDisplay(timeRef.current);
  }, [syncDisplay, windowMs]);

  useEffect(() => {
    if (!playing || busy) return;
    let previous: number | undefined;
    let animationFrame = 0;
    const tick = (now: number) => {
      const delta = previous === undefined || document.hidden ? 0 : Math.max(0, now - previous);
      previous = document.hidden ? undefined : now;
      if (!scrubbingRef.current && !document.hidden) {
        syncDisplay(timeRef.current + delta);
        latest.current.onLiveTime?.(timeRef.current);
      }
      animationFrame = requestAnimationFrame(tick);
    };
    const resetAfterVisibility = () => { previous = undefined; };
    document.addEventListener('visibilitychange', resetAfterVisibility);
    animationFrame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animationFrame);
      document.removeEventListener('visibilitychange', resetAfterVisibility);
    };
  }, [busy, latest, playing, syncDisplay]);

  useEffect(() => {
    const range = rangeRef.current;
    const change = () => nativeChangeRef.current();
    range?.addEventListener('change', change);
    return () => {
      cancelAnimationFrame(previewFrameRef.current);
      detachGestureListenersRef.current?.();
      range?.removeEventListener('change', change);
    };
  }, [nativeChangeRef]);

  function startScrub() {
    if (!canSeek || busy || scrubbingRef.current) return;
    scrubbingRef.current = true;
    if (playing) (latest.current.onScrubStart ?? latest.current.onFreeze)();
  }

  function preview(next: number) {
    if (!canSeek || busy) return;
    startScrub();
    syncDisplay(next);
    pendingRef.current = timeRef.current;
    if (rangeRef.current) rangeRef.current.dataset.canvasPreviewPending = 'true';
    if (previewFrameRef.current) return;
    previewFrameRef.current = requestAnimationFrame(() => {
      previewFrameRef.current = 0;
      if (pendingRef.current === null) return;
      lastPreviewedRef.current = pendingRef.current;
      latest.current.onTimePreview(pendingRef.current);
    });
  }

  function commitScrub() {
    cancelAnimationFrame(previewFrameRef.current);
    previewFrameRef.current = 0;
    scrubbingRef.current = false;
    const next = pendingRef.current;
    pendingRef.current = null;
    if (rangeRef.current) delete rangeRef.current.dataset.canvasPreviewPending;
    if (next === null) return;
    if (lastPreviewedRef.current !== next) latest.current.onTimePreview(next);
    lastPreviewedRef.current = null;
    flushSync(() => latest.current.onTimeChange(next));
  }

  function finishPointerGesture() {
    const gesture = pointerGestureRef.current;
    const value = Number(rangeRef.current?.value);
    if (gesture && Number.isFinite(value) && (pendingRef.current !== null || value !== gesture.initialValue)) preview(value);
    pointerGestureRef.current = null;
    detachGestureListenersRef.current?.();
    detachGestureListenersRef.current = null;
    commitScrub();
  }

  function beginPointerGesture(event: ReactPointerEvent<HTMLInputElement>) {
    if (!canSeek || busy || event.button !== 0 || pointerGestureRef.current) return;
    pointerGestureRef.current = { pointerId: event.pointerId, initialValue: Number(event.currentTarget.value) };
    const finishPointer = (event: PointerEvent) => {
      if (pointerGestureRef.current?.pointerId === event.pointerId) finishGestureRef.current();
    };
    const finishBlur = () => finishGestureRef.current();
    const finishHidden = () => { if (document.hidden) finishGestureRef.current(); };
    // Do not capture native range pointers: WebKit's native thumb drag needs
    // its own routing. Gesture-scoped listeners cover releases outside it.
    window.addEventListener('pointerup', finishPointer);
    window.addEventListener('pointercancel', finishPointer);
    window.addEventListener('blur', finishBlur);
    document.addEventListener('visibilitychange', finishHidden);
    detachGestureListenersRef.current = () => {
      window.removeEventListener('pointerup', finishPointer);
      window.removeEventListener('pointercancel', finishPointer);
      window.removeEventListener('blur', finishBlur);
      document.removeEventListener('visibilitychange', finishHidden);
    };
    startScrub();
  }

  function endPointerGesture(event: ReactPointerEvent<HTMLInputElement>) {
    if (pointerGestureRef.current?.pointerId === event.pointerId) finishPointerGesture();
  }

  function handleNativeChange() {
    if (!canSeek || busy) return;
    const value = Number(rangeRef.current?.value);
    if (Number.isFinite(value) && value !== Math.min(timeRef.current, windowRef.current)) preview(value);
    finishPointerGesture();
  }

  function handleInput(value: number) {
    preview(value);
    if (!pointerGestureRef.current) commitScrub();
  }

  function step(direction: number) {
    if (!canSeek || busy) return;
    preview(timeRef.current + direction * FRAME_STEP_MS);
    commitScrub();
  }

  const motionLabel = capabilities?.loop.kind === 'configured' ? 'Configured loop'
    : capabilities?.motionModel === 'static' ? 'Static shader' : 'Continuous';
  const seekExplanation = canSeek ? 'Explore shader time. This range is not a loop or export duration.'
    : capabilities?.motionModel === 'static' ? 'This shader is static. Capture its current appearance.'
      : 'This shader stores live simulation state. Capture its current frame; timestamps cannot reconstruct its history.';
  const smallButton = 'grid h-7 w-7 shrink-0 place-items-center rounded-[5px] border border-border bg-raised-background text-foreground hover:bg-muted disabled:opacity-40 [&_svg]:size-3';
  const playLabel = capabilities?.motionModel === 'stateful' ? 'Start new fluid motion' : 'Resume live shader motion';

  return (
    <section className='shader-lab-v2-frame-history' data-canvas-selection-preserve
      style={{ gridTemplateColumns: '28px minmax(80px,122px) minmax(48px,1fr) max-content', columnGap: 8 }}>
      <button aria-label={playing ? 'Freeze current shader frame' : playLabel} title={playing ? 'Freeze current shader frame' : playLabel} disabled={busy}
        onClick={() => playing ? latest.current.onFreeze() : latest.current.onPlay()} type='button'>
        {playing ? <Pause aria-hidden='true' /> : <Play aria-hidden='true' />}
      </button>
      <div className='shader-lab-v2-frame-history-copy' title={`${motionLabel}. ${seekExplanation}`}>
        <span><Clock3 aria-hidden='true' /><span>Shader time</span></span>
        <small>{playing ? 'Live' : 'Paused'} · <span ref={secondsRef}>{(boundedTime(timeMs) / 1000).toFixed(2)}s</span></small>
      </div>
      <StudioRange aria-label='Explore shader time' aria-description={seekExplanation} disabled={!canSeek || busy}
        defaultValue={boundedTime(timeMs)} min={0} max={windowMs} step={FRAME_STEP_MS} ref={rangeRef}
        onInput={(event) => handleInput(Number(event.currentTarget.value))} onPointerDown={beginPointerGesture}
        onPointerUp={endPointerGesture} onPointerCancel={endPointerGesture} onLostPointerCapture={endPointerGesture}
        onBlur={finishPointerGesture} />
      <div className='flex min-w-0 items-center gap-1'>
        <button className={smallButton} aria-label='Previous shader frame (1/60 second)' title='Back 1/60s' disabled={!canSeek || busy}
          onClick={() => step(-1)} type='button'><SkipBack aria-hidden='true' /></button>
        <button className={smallButton} aria-label='Next shader frame (1/60 second)' title='Forward 1/60s' disabled={!canSeek || busy}
          onClick={() => step(1)} type='button'><SkipForward aria-hidden='true' /></button>
        <button className='flex h-7 shrink-0 items-center gap-1 rounded-[5px] border border-border px-2 text-[9px] tabular-nums hover:bg-muted disabled:opacity-40'
          aria-label='Extend shader exploration by 30 seconds' title={seekExplanation} disabled={!canSeek || busy}
          onClick={() => { const next = windowRef.current + EXPLORATION_WINDOW_MS; windowRef.current = next; setWindowMs(next); }} type='button'>
          <span ref={windowLabelRef}>{windowMs / 1000}s</span><Plus aria-hidden='true' className='size-3' />
        </button>
        <button className={smallButton} aria-label='Capture shader frame' title='Save exact shader appearance' disabled={busy}
          onClick={() => latest.current.onCapture()} type='button'><ImagePlus aria-hidden='true' /></button>
      </div>
    </section>
  );
}
