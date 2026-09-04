'use client';

import { useEffect, useState } from 'react';

type DeferredRuntimeOptions = {
  deferWhileScrolling?: boolean;
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
    deferWhileScrolling = true,
    useIdleCallback = true,
  }: DeferredRuntimeOptions = {}
) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled || ready) return;

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

    schedule();
    if (deferWhileScrolling) {
      window.addEventListener('scroll', rescheduleAfterScroll, { passive: true });
    }

    return () => {
      if (deferWhileScrolling) window.removeEventListener('scroll', rescheduleAfterScroll);
      clearSchedule();
    };
  }, [deferWhileScrolling, delayMs, enabled, ready, useIdleCallback]);

  return ready;
}
