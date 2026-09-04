'use client';

import { useEffect, useRef, type RefObject } from 'react';

import { useCommittedRef } from '@/hooks/useCommittedRef';

/**
 * Tracks the retained project workspace that owns an interactive renderer.
 * The mutable ref lets render loops pause without rerendering their full editor.
 */
export function useAncestorWorkspaceActivity(
  elementRef: RefObject<HTMLElement | null>,
  onChange?: (active: boolean) => void
) {
  const activeRef = useRef(true);
  const onChangeRef = useCommittedRef(onChange);

  useEffect(() => {
    const element = elementRef.current;
    const workspace = element?.closest<HTMLElement>('.studio-project-workspace-layer');
    if (!workspace) return;

    const sync = () => {
      const nextActive = workspace.dataset.active === 'true';
      if (activeRef.current === nextActive) return;
      activeRef.current = nextActive;
      onChangeRef.current?.(nextActive);
    };
    const observer = new MutationObserver(sync);
    observer.observe(workspace, { attributeFilter: ['data-active'], attributes: true });
    sync();
    return () => observer.disconnect();
  }, [elementRef, onChangeRef]);

  return activeRef;
}
