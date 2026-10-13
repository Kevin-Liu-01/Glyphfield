'use client';

import { useRef, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';

import styles from '@/components/AnimationTimeline.module.css';

export const MIN_SCENE_HOLD_MS = 100;

export type SceneTrimMode = 'roll' | 'ripple';

type DragSession = {
  moved: boolean;
  pixelsPerMs: number;
  pointerId: number;
  startX: number;
  value: number;
};

function formatSeconds(timeMs: number): string {
  return `${(Math.max(0, timeMs) / 1000).toFixed(2)}s`;
}

/**
 * Resolves a trim. Roll (default) moves the cut between this scene and the next,
 * so later scenes keep their place on the master timeline; ripple (Alt) changes
 * only this scene and shifts everything after it.
 */
export function resolveSceneTrim({
  deltaMs,
  holds,
  index,
  mode,
}: {
  deltaMs: number;
  holds: readonly number[];
  index: number;
  mode: SceneTrimMode;
}): { holdMs: number; nextHoldMs?: number } {
  const hold = holds[index] ?? 0;
  const next = holds[index + 1];
  if (mode === 'roll' && next !== undefined) {
    const delta = Math.min(next - MIN_SCENE_HOLD_MS, Math.max(MIN_SCENE_HOLD_MS - hold, deltaMs));
    return { holdMs: Math.round(hold + delta), nextHoldMs: Math.round(next - delta) };
  }
  return { holdMs: Math.round(Math.max(MIN_SCENE_HOLD_MS, hold + deltaMs)) };
}

export function SceneTrimHandle({
  disabled,
  frameMs,
  holdMs,
  index,
  label,
  left,
  onCommit,
  pixelsPerMs,
}: {
  disabled: boolean;
  frameMs: number;
  holdMs: number;
  index: number;
  label: string;
  left: string;
  onCommit: (index: number, deltaMs: number, mode: SceneTrimMode) => void;
  pixelsPerMs: () => number;
}) {
  const sessionRef = useRef<DragSession | null>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);

  function preview(element: HTMLElement, deltaMs: number, pixels: number) {
    element.style.transform = `translate3d(${deltaMs * pixels}px, 0, 0)`;
    element.dataset.dragging = 'true';
    if (readoutRef.current) readoutRef.current.textContent = formatSeconds(holdMs + deltaMs);
  }

  function clearPreview(element: HTMLElement) {
    element.style.transform = '';
    delete element.dataset.dragging;
    if (readoutRef.current) readoutRef.current.textContent = '';
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (disabled || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    sessionRef.current = { moved: false, pixelsPerMs: Math.max(0.0001, pixelsPerMs()), pointerId: event.pointerId, startX: event.clientX, value: 0 };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const session = sessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const raw = (event.clientX - session.startX) / session.pixelsPerMs;
    // Snap to whole output frames so trims land on exported frame boundaries.
    session.value = Math.round(raw / frameMs) * frameMs;
    session.moved ||= Math.abs(event.clientX - session.startX) > 2;
    if (session.moved) preview(event.currentTarget, Math.max(MIN_SCENE_HOLD_MS - holdMs, session.value), session.pixelsPerMs);
  }

  function onPointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    const session = sessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    sessionRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    clearPreview(event.currentTarget);
    if (event.type === 'pointercancel' || !session.moved || session.value === 0) return;
    onCommit(index, session.value, event.altKey ? 'ripple' : 'roll');
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    const step = frameMs * (event.shiftKey ? 10 : 1);
    let delta = 0;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') delta = -step;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') delta = step;
    if (delta === 0) return;
    event.preventDefault();
    event.stopPropagation();
    onCommit(index, delta, event.altKey ? 'ripple' : 'roll');
  }

  return (
    <div
      aria-disabled={disabled}
      aria-keyshortcuts='ArrowLeft ArrowRight Shift+ArrowLeft Shift+ArrowRight Alt+ArrowLeft Alt+ArrowRight'
      aria-label={label}
      aria-orientation='horizontal'
      aria-valuemax={60_000}
      aria-valuemin={MIN_SCENE_HOLD_MS}
      aria-valuenow={Math.round(holdMs)}
      aria-valuetext={formatSeconds(holdMs)}
      className={styles.trim}
      data-scene-trim={index}
      onKeyDown={onKeyDown}
      onPointerCancel={onPointerEnd}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      role='slider'
      style={{ left }}
      tabIndex={disabled ? -1 : 0}
      title={`${label}. Drag to trim; hold Alt to ripple later scenes.`}
    >
      <span aria-hidden='true' className={styles.trimReadout} ref={readoutRef} />
    </div>
  );
}

export function KeyframeDiamond({
  atMs,
  current,
  disabled,
  frameMs,
  holdMs,
  id,
  label,
  onRemove,
  onRetime,
  onSelect,
  pixelsPerMs,
}: {
  atMs: number;
  current: boolean;
  disabled: boolean;
  frameMs: number;
  holdMs: number;
  id: string;
  label: string;
  onRemove: (id: string) => void;
  onRetime: (id: string, atMs: number) => void;
  onSelect: (id: string) => void;
  pixelsPerMs: () => number;
}) {
  const sessionRef = useRef<DragSession | null>(null);
  const left = `${holdMs <= 0 ? 0 : Math.min(100, Math.max(0, (atMs / holdMs) * 100))}%`;

  function onPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (disabled || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    sessionRef.current = { moved: false, pixelsPerMs: Math.max(0.0001, pixelsPerMs()), pointerId: event.pointerId, startX: event.clientX, value: atMs };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const session = sessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const offset = event.clientX - session.startX;
    session.moved ||= Math.abs(offset) > 2;
    if (!session.moved) return;
    const next = Math.min(holdMs, Math.max(0, Math.round((atMs + offset / session.pixelsPerMs) / frameMs) * frameMs));
    session.value = next;
    event.currentTarget.style.transform = `translate3d(${(next - atMs) * session.pixelsPerMs}px, 0, 0)`;
  }

  function onPointerEnd(event: ReactPointerEvent<HTMLButtonElement>) {
    const session = sessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    sessionRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    event.currentTarget.style.transform = '';
    if (event.type === 'pointercancel') return;
    if (session.moved && session.value !== atMs) onRetime(id, session.value);
    else if (!session.moved) onSelect(id);
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      event.stopPropagation();
      onRemove(id);
      return;
    }
    const step = frameMs * (event.shiftKey ? 10 : 1);
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    event.stopPropagation();
    onRetime(id, Math.min(holdMs, Math.max(0, atMs + (event.key === 'ArrowLeft' ? -step : step))));
  }

  return (
    <button
      aria-keyshortcuts='ArrowLeft ArrowRight Shift+ArrowLeft Shift+ArrowRight Delete'
      aria-label={label}
      className={styles.diamond}
      data-current={current ? 'true' : 'false'}
      data-keyframe-id={id}
      disabled={disabled}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={onKeyDown}
      onPointerCancel={onPointerEnd}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      style={{ left }}
      title={`${label}. Drag or use arrow keys to retime; Delete removes it.`}
      type='button'
    />
  );
}
