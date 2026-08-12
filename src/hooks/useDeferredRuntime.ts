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

    let idleId: number | undefined;
    const delayId = window.setTimeout(() => {
      if ('requestIdleCallback' in window) {
        idleId = window.requestIdleCallback(() => setReady(true), { timeout: 1_000 });
      } else {
        setReady(true);
      }
    }, delayMs);

    return () => {
      window.clearTimeout(delayId);
      if (idleId !== undefined && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [delayMs, enabled, ready]);

  return ready;
}
