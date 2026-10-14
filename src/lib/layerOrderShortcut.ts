import type { StackTarget } from '@/lib/expressionModel';

/**
 * ⌘[ and ⌘] move a layer one step; with Shift they move it to the back or front.
 * Shift types braces on most layouts, so this matches the physical bracket keys,
 * and also the bracket characters that some layouts type from other keys.
 */
export function layerOrderShortcut(event: { code: string; key: string; shiftKey: boolean }): Exclude<StackTarget, number> | null {
  if (event.code === 'BracketRight' || event.key === ']') return event.shiftKey ? 'front' : 'forward';
  if (event.code === 'BracketLeft' || event.key === '[') return event.shiftKey ? 'back' : 'backward';
  return null;
}
