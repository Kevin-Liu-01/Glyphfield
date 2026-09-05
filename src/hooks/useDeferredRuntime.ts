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
    const clearSchedule = () => {
      window.clearTimeout(delayId);
      if (idleId !== undefined && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId);
        idleId = undefined;
      }
    };
    const schedule = () => {
      clearSchedule();
      delayId = window.setTimeout(() => {
        if (useIdleCallback && 'requestIdleCallback' in window) {
          idleId = window.requestIdleCallback(() => setReady(true), { timeout: 1_000 });
        } else {
          setReady(true);
        }
      }, delayMs);
    };
    const rescheduleAfterScroll = () => schedule();
    const rescheduleAfterInteraction = () => schedule();

    schedule();
    if (deferWhileScrolling) {
      window.addEventListener('scroll', rescheduleAfterScroll, { passive: true });
    }
    if (deferWhileInteracting) {
      window.addEventListener('pointerdown', rescheduleAfterInteraction, true);
      window.addEventListener('mousedown', rescheduleAfterInteraction, true);
      window.addEventListener('touchstart', rescheduleAfterInteraction, { capture: true, passive: true });
      window.addEventListener('keydown', rescheduleAfterInteraction, true);
      window.addEventListener('wheel', rescheduleAfterInteraction, { capture: true, passive: true });
    }

    return () => {
      if (deferWhileScrolling) window.removeEventListener('scroll', rescheduleAfterScroll);
      if (deferWhileInteracting) {
        window.removeEventListener('pointerdown', rescheduleAfterInteraction, true);
        window.removeEventListener('mousedown', rescheduleAfterInteraction, true);
        window.removeEventListener('touchstart', rescheduleAfterInteraction, true);
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
