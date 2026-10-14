'use client';

import { useLayoutEffect, type RefObject } from 'react';

const EXIT_GHOST_LIFETIME_MS = 260;

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    || document.querySelector('.studio-app[data-studio-motion="reduced"]') !== null;
}

/**
 * Lets an overlay that unmounts on close (menu, popover, dialog) play an exit
 * animation without keeping it mounted. A copy of its last frame stays in place,
 * inert, hidden from assistive technology and without ids or roles, while the
 * `[data-exiting]` animation in globals.css runs, and is then removed.
 */
export function useExitGhost(ref: RefObject<HTMLElement | null>, open: unknown): void {
  useLayoutEffect(() => {
    const element = ref.current;
    const parent = element?.parentElement;
    if (!open || !element || !parent) return;
    return () => {
      // Environments without Web Animations (unit tests) and reduced motion close at once.
      if (!parent.isConnected || typeof element.getAnimations !== 'function' || reducedMotion()) return;
      const ghost = element.cloneNode(true) as HTMLElement;
      for (const node of [ghost, ...ghost.querySelectorAll<HTMLElement>('[id], [role]')]) {
        node.removeAttribute('id');
        node.removeAttribute('role');
      }
      ghost.setAttribute('aria-hidden', 'true');
      ghost.inert = true;
      ghost.dataset.exiting = 'true';
      parent.append(ghost);
      const remove = () => ghost.remove();
      ghost.addEventListener('animationend', (event) => {
        if (event.target === ghost) remove();
      });
      window.setTimeout(remove, EXIT_GHOST_LIFETIME_MS);
    };
  }, [open, ref]);
}
