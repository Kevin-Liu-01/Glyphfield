'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useCommittedRef } from './useCommittedRef';

const MANUAL_SCROLL_GRACE_MS = 1500;
const AXIS_INSET = 10;

/** Follow the host's playback subscription, without a second clock or per-frame layout reads. */
export function useTimelineFollow({
  currentMsRef, disabled, isPlaying, totalMs,
}: {
  currentMsRef: { current: number };
  disabled: boolean;
  isPlaying: boolean;
  totalMs: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const stateRef = useCommittedRef({ disabled, isPlaying, totalMs });
  const geometryRef = useRef({ width: 0, contentWidth: 0, left: 0 });
  const pointersRef = useRef(new Set<number>());
  const resumeAfterRef = useRef(0);

  const follow = useCallback((timeMs: number, explicitSeek = false) => {
    const state = stateRef.current;
    const scroll = scrollRef.current;
    if (!scroll || state.disabled || (!explicitSeek && !state.isPlaying) || pointersRef.current.size) return;
    if (!explicitSeek && performance.now() < resumeAfterRef.current) return;
    resumeAfterRef.current = 0;
    const { width, contentWidth, left } = geometryRef.current;
    if (width <= 0 || contentWidth <= width || state.totalMs <= 0) return;
    const progress = Math.max(0, Math.min(1, timeMs / state.totalMs));
    const x = AXIS_INSET + progress * Math.max(0, contentWidth - AXIS_INSET * 2);
    // Keep some upcoming frames visible. During normal playback this advances
    // at the playhead's pace; no restarted smooth-scroll animation can trail it.
    let next = left;
    if (x > left + width * 0.8) next = x - width * 0.8;
    else if (x < left + width * 0.2) next = x - width * 0.2;
    next = Math.max(0, Math.min(contentWidth - width, next));
    if (Math.abs(next - left) < 0.5) return;
    geometryRef.current.left = next;
    scroll.scrollLeft = next;
  }, [stateRef]);

  useEffect(() => {
    const scroll = scrollRef.current;
    const content = contentRef.current;
    if (!scroll || !content) return;
    const measure = () => {
      // scrollWidth includes transformed playhead overflow in older layouts;
      // the authored content box is the stable time axis, not that overflow.
      geometryRef.current = { width: scroll.clientWidth, contentWidth: content.clientWidth, left: scroll.scrollLeft };
      follow(currentMsRef.current);
    };
    const yieldToUser = () => { resumeAfterRef.current = performance.now() + MANUAL_SCROLL_GRACE_MS; };
    const readScroll = () => {
      const next = scroll.scrollLeft;
      // Native scrollbar input may not dispatch pointer events; touch momentum
      // also outlives pointerup. External moves yield, acknowledgements of our
      // own writes do not (both can be trusted browser scroll events).
      if (Math.abs(next - geometryRef.current.left) > 1) yieldToUser();
      geometryRef.current.left = next;
    };
    const hold = (event: PointerEvent) => { pointersRef.current.add(event.pointerId); };
    const release = (event: PointerEvent) => {
      if (pointersRef.current.delete(event.pointerId)) yieldToUser();
    };
    const blur = () => { pointersRef.current.clear(); yieldToUser(); };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(scroll);
    observer?.observe(content);
    measure();
    scroll.addEventListener('scroll', readScroll, { passive: true });
    scroll.addEventListener('wheel', yieldToUser, { passive: true });
    scroll.addEventListener('keydown', yieldToUser);
    scroll.addEventListener('pointerdown', hold, true);
    window.addEventListener('pointerup', release, true);
    window.addEventListener('pointercancel', release, true);
    window.addEventListener('blur', blur);
    return () => {
      observer?.disconnect();
      scroll.removeEventListener('scroll', readScroll);
      scroll.removeEventListener('wheel', yieldToUser);
      scroll.removeEventListener('keydown', yieldToUser);
      scroll.removeEventListener('pointerdown', hold, true);
      window.removeEventListener('pointerup', release, true);
      window.removeEventListener('pointercancel', release, true);
      window.removeEventListener('blur', blur);
      pointersRef.current.clear();
    };
  }, [currentMsRef, follow]);

  useEffect(() => {
    if (!isPlaying || disabled) return;
    resumeAfterRef.current = 0;
    follow(currentMsRef.current);
  }, [currentMsRef, disabled, follow, isPlaying]);

  return { contentRef, follow, scrollRef };
}
