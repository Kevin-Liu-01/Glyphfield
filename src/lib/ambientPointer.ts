/**
 * A virtual cursor for pointer-driven Shaders.com effects. Upstream reads the pointer from
 * window mouse events, so interactive effects stay blank until someone moves the mouse over them.
 * While the real pointer is away from a surface, this traces a slow loop over it instead, and puts
 * that position back after every real move elsewhere so the effect never jumps to the side panels.
 */
const REAL_POINTER_HOLD_MS = 1_500;

let lastRealPointer = { at: Number.NEGATIVE_INFINITY, x: 0, y: 0 };
let driven: { element: HTMLElement; timeSeconds: number } | null = null;
const relayedElements = new WeakSet<HTMLElement>();

/** Normalized position on a slow two-frequency loop, kept away from the edges. */
export function ambientPointerPosition(timeSeconds: number): { x: number; y: number } {
  return {
    x: 0.5 + 0.3 * Math.sin(timeSeconds * 0.9) + 0.08 * Math.sin(timeSeconds * 2.3 + 0.4),
    y: 0.5 + 0.26 * Math.sin(timeSeconds * 0.7 + 1.3) + 0.06 * Math.cos(timeSeconds * 1.9),
  };
}

/** True while a person has recently moved the real pointer over `bounds`. */
export function realPointerOver(bounds: DOMRect, now: number): boolean {
  if (now - lastRealPointer.at >= REAL_POINTER_HOLD_MS) return false;
  const { x, y } = lastRealPointer;
  return x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
}

function dispatchAmbient(element: HTMLElement, timeSeconds: number): boolean {
  const bounds = element.getBoundingClientRect();
  if (bounds.width < 1 || bounds.height < 1) return false;
  const { x, y } = ambientPointerPosition(timeSeconds);
  window.dispatchEvent(new MouseEvent('mousemove', {
    clientX: bounds.left + x * bounds.width,
    clientY: bounds.top + y * bounds.height,
  }));
  return true;
}

function onMouseMove(event: MouseEvent) {
  // Synthetic events (ours) are untrusted; only a person's moves change who owns the pointer.
  if (!event.isTrusted) return;
  lastRealPointer = { at: performance.now(), x: event.clientX, y: event.clientY };
  if (driven?.element.isConnected && !realPointerOver(driven.element.getBoundingClientRect(), lastRealPointer.at)) {
    dispatchAmbient(driven.element, driven.timeSeconds);
  }
}

/**
 * Upstream registers its window listener when a renderer starts. Re-adding ours after that keeps
 * it later in the listener order, so the ambient position is the last one upstream reads.
 */
function relayAfterUpstream(element: HTMLElement) {
  if (relayedElements.has(element)) return;
  relayedElements.add(element);
  window.removeEventListener('mousemove', onMouseMove);
  window.addEventListener('mousemove', onMouseMove, { passive: true });
}

/** Moves the shared pointer over `element`; returns false while a person's pointer is over it. */
export function driveAmbientPointer(element: HTMLElement, timeSeconds: number, force = false): boolean {
  if (typeof window === 'undefined') return false;
  relayAfterUpstream(element);
  driven = { element, timeSeconds };
  if (!force && realPointerOver(element.getBoundingClientRect(), performance.now())) return false;
  return dispatchAmbient(element, timeSeconds);
}
