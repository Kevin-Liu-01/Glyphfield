import { useState, type RefObject } from 'react';

import { useMountEffect } from './useMountEffect';

/**
 * Tracks a host's viewport range. Activity normally also follows tab visibility;
 * retained renderers can opt out for their mount range and pause separately.
 */
export function useViewportActivity(
  containerRef: RefObject<Element | null>,
  { initialActive = false, respectDocumentVisibility = true, rootMargin }: {
    initialActive?: boolean;
    respectDocumentVisibility?: boolean;
    rootMargin: string;
  }
): boolean {
  const [active, setActive] = useState(initialActive);
  useMountEffect(() => {
    const container = containerRef.current;
    let intersecting = initialActive;

    function syncVisibility() {
      setActive(intersecting && (!respectDocumentVisibility || document.visibilityState === 'visible'));
    }

    if (!container || !('IntersectionObserver' in window)) {
      intersecting = true;
      syncVisibility();
      if (respectDocumentVisibility) document.addEventListener('visibilitychange', syncVisibility);
      return () => {
        if (respectDocumentVisibility) document.removeEventListener('visibilitychange', syncVisibility);
      };
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        intersecting = entry?.isIntersecting ?? false;
        syncVisibility();
      },
      { rootMargin }
    );

    observer.observe(container);
    if (respectDocumentVisibility) document.addEventListener('visibilitychange', syncVisibility);
    return () => {
      observer.disconnect();
      if (respectDocumentVisibility) document.removeEventListener('visibilitychange', syncVisibility);
    };
  });
  return active;
}
