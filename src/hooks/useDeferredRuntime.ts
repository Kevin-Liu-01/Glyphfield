'use client';

import { useEffect, useState } from 'react';

/**
 * Keeps optional editors and GPU runtimes out of the critical rendering path.
 * The delay guarantees the browser gets an initial paint before idle work begins.
 */
export function useDeferredRuntime(enabled: boolean, delayMs = 500) {
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
        if ('requestIdleCallback' in window) {
          idleId = window.requestIdleCallback(() => setReady(true), { timeout: 1_000 });
        } else {
          setReady(true);
        }
      }, delayMs);
    };
    const deferWhileScrolling = () => schedule();

    schedule();
    window.addEventListener('scroll', deferWhileScrolling, { passive: true });

    return () => {
      window.removeEventListener('scroll', deferWhileScrolling);
      clearSchedule();
    };
  }, [delayMs, enabled, ready]);

  return ready;
}
