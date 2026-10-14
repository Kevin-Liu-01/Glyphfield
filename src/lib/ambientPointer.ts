/**
 * A virtual cursor for pointer-driven Shaders.com effects. Upstream reads the pointer from
 * window mouse events, so interactive effects stay blank until someone moves the mouse.
 * While nobody is moving the real pointer, this traces a slow loop over the surface instead.
 */
const REAL_POINTER_HOLD_MS = 2_500;

let lastRealPointerAt = Number.NEGATIVE_INFINITY;
let listening = false;

function listenForRealPointer() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  // Synthetic mouse events never produce pointer events, so any pointermove is a real person.
  window.addEventListener('pointermove', () => { lastRealPointerAt = performance.now(); }, { capture: true, passive: true });
}

/** Normalized position on a slow two-frequency loop, kept away from the edges. */
export function ambientPointerPosition(timeSeconds: number): { x: number; y: number } {
  return {
    x: 0.5 + 0.3 * Math.sin(timeSeconds * 0.9) + 0.08 * Math.sin(timeSeconds * 2.3 + 0.4),
    y: 0.5 + 0.26 * Math.sin(timeSeconds * 0.7 + 1.3) + 0.06 * Math.cos(timeSeconds * 1.9),
  };
}

/** Moves the shared pointer over `element`; returns false while a real pointer is in use. */
export function driveAmbientPointer(element: HTMLElement, timeSeconds: number, force = false): boolean {
  listenForRealPointer();
  if (!force && performance.now() - lastRealPointerAt < REAL_POINTER_HOLD_MS) return false;
  const bounds = element.getBoundingClientRect();
  if (bounds.width < 1 || bounds.height < 1) return false;
  const { x, y } = ambientPointerPosition(timeSeconds);
  window.dispatchEvent(new MouseEvent('mousemove', {
    clientX: bounds.left + x * bounds.width,
    clientY: bounds.top + y * bounds.height,
  }));
  return true;
}
