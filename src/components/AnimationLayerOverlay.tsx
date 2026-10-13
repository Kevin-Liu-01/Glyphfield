'use client';

import { useRef, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';

import type { AnimationPose } from '@/lib/animationMotion';

function pivotPoint(box: HTMLElement): { x: number; y: number } {
  const parent = box.parentElement!.getBoundingClientRect();
  const left = Number.parseFloat(box.style.left) / 100;
  const top = Number.parseFloat(box.style.top) / 100;
  return { x: parent.left + parent.width * left, y: parent.top + parent.height * top };
}

/** Safe-area inset used by layout guides and the inspector's align actions. */
export function animationSafeMargin(width: number, height: number): number {
  return Math.round(Math.min(width, height) * 0.08);
}

export function normalizeRotation(degrees: number): number {
  const wrapped = ((degrees + 180) % 360 + 360) % 360 - 180;
  return Math.round(wrapped * 10) / 10;
}

/**
 * Rotation handle for the selected scene layer. The outline follows the layer's
 * rotated box; dragging the knob previews live through `onPreview` and commits
 * once on release. Shift snaps to 15°.
 */
export function AnimationRotateHandle({
  anchor = 'center',
  baseHeight,
  baseWidth,
  canvasHeight,
  canvasWidth,
  label,
  onCommit,
  onPreview,
  pose,
}: {
  /** Rotation pivot: the box centre, or the leading edge for start-anchored text. */
  anchor?: 'center' | 'start';
  baseHeight: number;
  baseWidth: number;
  canvasHeight: number;
  canvasWidth: number;
  label: string;
  onCommit: (rotation: number) => void;
  onPreview: (rotation: number | null) => void;
  pose: AnimationPose;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<{ centerX: number; centerY: number; pointerId: number; startAngle: number; value: number } | null>(null);
  const width = baseWidth * pose.scale;
  const height = baseHeight * pose.scale;
  const centerX = ((pose.alignX + 1) / 2) * canvasWidth;
  const centerY = ((pose.alignY + 1) / 2) * canvasHeight;
  const translate = anchor === 'start' ? 'translate(0, -50%)' : 'translate(-50%, -50%)';

  function pointerAngle(event: ReactPointerEvent<HTMLElement>, centerXPx: number, centerYPx: number): number {
    return (Math.atan2(event.clientY - centerYPx, event.clientX - centerXPx) * 180) / Math.PI;
  }

  function onPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    // The pivot is the rendered anchor; rotated boxes keep it at their origin.
    const pivot = boxRef.current?.dataset.pivot === 'start' && boxRef.current.parentElement
      ? pivotPoint(boxRef.current)
      : null;
    const cx = pivot?.x ?? box.left + box.width / 2;
    const cy = pivot?.y ?? box.top + box.height / 2;
    sessionRef.current = { centerX: cx, centerY: cy, pointerId: event.pointerId, startAngle: pointerAngle(event, cx, cy), value: pose.rotation };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const session = sessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    let next = pose.rotation + pointerAngle(event, session.centerX, session.centerY) - session.startAngle;
    if (event.shiftKey) next = Math.round(next / 15) * 15;
    session.value = normalizeRotation(next);
    if (boxRef.current) boxRef.current.style.transform = `${translate} rotate(${session.value}deg)`;
    onPreview(session.value);
  }

  function onPointerEnd(event: ReactPointerEvent<HTMLButtonElement>) {
    const session = sessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    sessionRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (boxRef.current) boxRef.current.style.transform = '';
    if (event.type !== 'pointercancel' && session.value !== pose.rotation) onCommit(session.value);
    onPreview(null);
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    const step = event.shiftKey ? 15 : 1;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    event.stopPropagation();
    onCommit(normalizeRotation(pose.rotation + (event.key === 'ArrowLeft' ? -step : step)));
  }

  return (
    <div
      aria-hidden='false'
      className='pointer-events-none absolute z-40'
      data-animation-rotate-box
      ref={boxRef}
      style={{
        height: `${(height / canvasHeight) * 100}%`,
        left: `${(centerX / canvasWidth) * 100}%`,
        top: `${(centerY / canvasHeight) * 100}%`,
        transform: `${translate} rotate(${pose.rotation}deg)`,
        transformOrigin: anchor === 'start' ? '0 50%' : '50% 50%',
        width: `${(width / canvasWidth) * 100}%`,
      }}
      data-pivot={anchor}
    >
      {pose.rotation !== 0 ? (
        <span aria-hidden='true' className='absolute inset-0 border border-dashed border-[#5b8cff]/80' />
      ) : null}
      <span aria-hidden='true' className='absolute bottom-full left-1/2 h-5 w-px -translate-x-1/2 bg-[#5b8cff]' />
      <button
        aria-keyshortcuts='ArrowLeft ArrowRight Shift+ArrowLeft Shift+ArrowRight'
        aria-label={label}
        className='pointer-events-auto absolute bottom-full left-1/2 mb-5 size-3.5 -translate-x-1/2 translate-y-1/2 cursor-grab touch-none rounded-full border-2 border-[#5b8cff] bg-white shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[#5b8cff] active:cursor-grabbing'
        data-canvas-selection-preserve
        onKeyDown={onKeyDown}
        onPointerCancel={onPointerEnd}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        title={`${label}. Shift snaps to 15°.`}
        type='button'
      />
    </div>
  );
}

/** Rule-of-thirds and safe-area guides over the stage. View-only; never exported. */
export function AnimationLayoutGuides({ height, width }: { height: number; width: number }) {
  const margin = animationSafeMargin(width, height);
  const insetX = `${(margin / width) * 100}%`;
  const insetY = `${(margin / height) * 100}%`;
  return (
    <div aria-hidden='true' className='pointer-events-none absolute inset-0 z-20' data-animation-layout-guides>
      <span className='absolute border border-dashed border-white/35 mix-blend-difference' style={{ bottom: insetY, left: insetX, right: insetX, top: insetY }} />
      {[1, 2].map((third) => (
        <span className='absolute inset-y-0 w-px bg-white/25 mix-blend-difference' key={`x-${third}`} style={{ left: `${(third / 3) * 100}%` }} />
      ))}
      {[1, 2].map((third) => (
        <span className='absolute inset-x-0 h-px bg-white/25 mix-blend-difference' key={`y-${third}`} style={{ top: `${(third / 3) * 100}%` }} />
      ))}
    </div>
  );
}
