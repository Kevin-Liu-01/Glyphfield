import { useState, type RefObject } from 'react';

import { useMountEffect } from './useMountEffect';

/** Keeps an expensive visual active only while its host is near the visible page. */
export function useViewportActivity(
  containerRef: RefObject<Element | null>,
  { initialActive = false, rootMargin }: { initialActive?: boolean; rootMargin: string }
): boolean {
  const [active, setActive] = useState(initialActive);
  useMountEffect(() => {
    const container = containerRef.current;
    let intersecting = initialActive;

    function syncVisibility() {
      setActive(intersecting && document.visibilityState === 'visible');
    }

    if (!container || !('IntersectionObserver' in window)) {
      intersecting = true;
      syncVisibility();
      document.addEventListener('visibilitychange', syncVisibility);
      return () => document.removeEventListener('visibilitychange', syncVisibility);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        intersecting = entry?.isIntersecting ?? false;
        syncVisibility();
      },
      { rootMargin }
    );

    observer.observe(container);
    document.addEventListener('visibilitychange', syncVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', syncVisibility);
    };
  });
  return active;
}
