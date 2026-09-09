'use client';

import { useEffect, useState } from 'react';

type DeferredRuntimeOptions = {
  deferWhileInteracting?: boolean;
  deferWhileScrolling?: boolean;
  resetWhenDisabled?: boolean;
  useIdleCallback?: boolean;
};

/**
 * Keeps optional editors and GPU runtimes out of the critical rendering path.
 * The delay guarantees the browser gets an initial paint before idle work begins.
 */
export function useDeferredRuntime(
  enabled: boolean,
  delayMs = 500,
  {
    deferWhileInteracting = false,
    deferWhileScrolling = true,
    resetWhenDisabled = false,
    useIdleCallback = true,
  }: DeferredRuntimeOptions = {}
) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled) {
      if (resetWhenDisabled && ready) setReady(false);
      return;
    }
    if (ready) return;

    let delayId = 0;
    let idleId: number | undefined;
    let disposed = false;
    const activePointers = new Set<number>();
    let mouseDown = false;
    let activeTouches = 0;
    const gestureActive = () => activePointers.size > 0 || mouseDown || activeTouches > 0;
    const clearSchedule = () => {
      window.clearTimeout(delayId);
      if (idleId !== undefined && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId);
        idleId = undefined;
      }
    };
    const becomeReady = () => {
      if (!disposed && !gestureActive()) setReady(true);
    };
    const schedule = () => {
      clearSchedule();
      // Do not compile/mount an optional editor or shader midway through a drag.
      // A timeout after pointerdown is not an idle period until the pointer ends.
      if (gestureActive()) return;
      delayId = window.setTimeout(() => {
        if (useIdleCallback && typeof window.requestIdleCallback === 'function') {
          idleId = window.requestIdleCallback(becomeReady, { timeout: 1_000 });
        } else {
          becomeReady();
        }
      }, delayMs);
    };
    const rescheduleAfterScroll = () => schedule();
    const rescheduleAfterInteraction = () => schedule();
    const beginPointer = (event: PointerEvent) => {
      activePointers.add(event.pointerId);
      clearSchedule();
    };
    const endPointer = (event: PointerEvent) => {
      if (activePointers.delete(event.pointerId)) schedule();
    };
    const beginMouse = () => {
      mouseDown = true;
      clearSchedule();
    };
    const endMouse = () => {
      mouseDown = false;
      schedule();
    };
    const updateTouches = (event: TouchEvent) => {
      activeTouches = event.touches.length;
      schedule();
    };
    const endInterruptedGesture = () => {
      activePointers.clear();
      mouseDown = false;
      activeTouches = 0;
      schedule();
    };
    const supportsPointerEvents = typeof window.PointerEvent === 'function';

    schedule();
    if (deferWhileScrolling) {
      window.addEventListener('scroll', rescheduleAfterScroll, { passive: true });
    }
    if (deferWhileInteracting) {
      if (supportsPointerEvents) {
        window.addEventListener('pointerdown', beginPointer, true);
        window.addEventListener('pointerup', endPointer, true);
        window.addEventListener('pointercancel', endPointer, true);
      } else {
        window.addEventListener('mousedown', beginMouse, true);
        window.addEventListener('mouseup', endMouse, true);
        window.addEventListener('touchstart', updateTouches, { capture: true, passive: true });
        window.addEventListener('touchend', updateTouches, { capture: true, passive: true });
        window.addEventListener('touchcancel', updateTouches, { capture: true, passive: true });
      }
      window.addEventListener('blur', endInterruptedGesture);
      window.addEventListener('keydown', rescheduleAfterInteraction, true);
      window.addEventListener('wheel', rescheduleAfterInteraction, { capture: true, passive: true });
    }

    return () => {
      disposed = true;
      if (deferWhileScrolling) window.removeEventListener('scroll', rescheduleAfterScroll);
      if (deferWhileInteracting) {
        window.removeEventListener('pointerdown', beginPointer, true);
        window.removeEventListener('pointerup', endPointer, true);
        window.removeEventListener('pointercancel', endPointer, true);
        window.removeEventListener('mousedown', beginMouse, true);
        window.removeEventListener('mouseup', endMouse, true);
        window.removeEventListener('touchstart', updateTouches, true);
        window.removeEventListener('touchend', updateTouches, true);
        window.removeEventListener('touchcancel', updateTouches, true);
        window.removeEventListener('blur', endInterruptedGesture);
        window.removeEventListener('keydown', rescheduleAfterInteraction, true);
        window.removeEventListener('wheel', rescheduleAfterInteraction, true);
      }
      clearSchedule();
    };
  }, [
    deferWhileInteracting,
    deferWhileScrolling,
    delayMs,
    enabled,
    ready,
    resetWhenDisabled,
    useIdleCallback,
  ]);

  return ready;
}
