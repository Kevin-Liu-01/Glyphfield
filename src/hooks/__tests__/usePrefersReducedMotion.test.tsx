// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);

function Preference() {
  return <output>{String(usePrefersReducedMotion())}</output>;
}

describe('usePrefersReducedMotion', () => {
  it('reads the initial preference, reacts to actual media change events, and unsubscribes on unmount', () => {
    const media = Object.assign(new EventTarget(), {
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
    });
    const addListener = vi.spyOn(media, 'addEventListener');
    const removeListener = vi.spyOn(media, 'removeEventListener');
    vi.stubGlobal('matchMedia', () => media);
    const container = document.createElement('div');
    const root = createRoot(container);
    try {
      act(() => root.render(<Preference />));
      expect(container.textContent).toBe('true');
      act(() => {
        media.matches = false;
        media.dispatchEvent(new Event('change'));
      });
      expect(container.textContent).toBe('false');
      act(() => {
        media.matches = true;
        media.dispatchEvent(new Event('change'));
      });
      expect(container.textContent).toBe('true');
    } finally {
      act(() => root.unmount());
      try {
        expect(removeListener).toHaveBeenCalledWith('change', addListener.mock.calls[0]?.[1]);
      } finally {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
      }
    }
  });
});
