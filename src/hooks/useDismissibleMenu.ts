import type { RefObject } from 'react';

import { useCommittedRef } from './useCommittedRef';
import { useMountEffect } from './useMountEffect';

/** Dismisses a transient surface on Escape or a pointer press outside its root. */
export function useDismissibleMenu(
  rootRef: RefObject<HTMLElement | null>,
  onDismiss: () => void,
  ignoredClosestSelector?: string
) {
  const onDismissRef = useCommittedRef(onDismiss);
  useMountEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (ignoredClosestSelector && event.target instanceof Element && event.target.closest(ignoredClosestSelector)) return;
      if (!rootRef.current?.contains(event.target as Node)) onDismissRef.current();
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onDismissRef.current();
    }

    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  });
}
