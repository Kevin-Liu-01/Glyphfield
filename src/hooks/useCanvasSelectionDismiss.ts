import { useRef, type RefObject } from 'react';

import { useMountEffect } from '@/hooks/useMountEffect';

export function useCanvasSelectionDismiss<T extends HTMLElement>(
  boundaryRef: RefObject<T | null>,
  onDismiss?: () => void
): void {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useMountEffect(() => {
    function dismissOutsideCanvas(event: PointerEvent) {
      const boundary = boundaryRef.current;
      const target = event.target;
      if (
        !boundary ||
        !(target instanceof Element) ||
        boundary.contains(target) ||
        target.closest(
          '[data-canvas-selection-preserve], [role="dialog"], [role="listbox"]'
        )
      ) {
        return;
      }
      onDismissRef.current?.();
    }

    document.addEventListener('pointerdown', dismissOutsideCanvas, true);
    return () => {
      document.removeEventListener('pointerdown', dismissOutsideCanvas, true);
    };
  });
}
