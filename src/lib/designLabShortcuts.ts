// Design Lab keyboard shortcuts: one catalog drives both the key handler and
// the shortcuts overlay, so the overlay can never list a key that does nothing.
import type { DesignLabArrangement } from './designLabArrange';

export type DesignLabShortcutCommand =
  | { kind: 'add'; layer: 'effect' | 'image' | 'mark' | 'shader' | 'sticker' | 'text' }
  | { kind: 'arrange'; arrangement: DesignLabArrangement }
  | { kind: 'copy-style' }
  | { kind: 'delete' }
  | { kind: 'duplicate' }
  | { kind: 'group' }
  | { kind: 'order'; direction: 'backward' | 'forward'; toEdge: boolean }
  | { kind: 'paste-style' }
  | { kind: 'select-all' }
  | { kind: 'shortcuts' }
  | { kind: 'toggle-lock' }
  | { kind: 'ungroup' };

export type DesignLabShortcutKey = {
  altKey: boolean;
  code: string;
  ctrlKey: boolean;
  key: string;
  metaKey: boolean;
  shiftKey: boolean;
};

type ShortcutGroup = 'Add layers' | 'Arrange' | 'Canvas' | 'Edit' | 'Text';

export type DesignLabShortcutEntry = {
  description: string;
  group: ShortcutGroup;
  keys: string;
};

const ADD_KEYS = {
  KeyE: 'effect',
  KeyI: 'image',
  KeyK: 'sticker',
  KeyM: 'mark',
  KeyS: 'shader',
  KeyT: 'text',
} as const satisfies Record<string, Extract<DesignLabShortcutCommand, { kind: 'add' }>['layer']>;

const ALIGN_KEYS = {
  KeyA: 'left',
  KeyD: 'right',
  KeyH: 'horizontal-center',
  KeyS: 'bottom',
  KeyV: 'vertical-center',
  KeyW: 'top',
} as const satisfies Record<string, DesignLabArrangement>;

const DISTRIBUTE_KEYS = {
  KeyH: 'distribute-horizontal',
  KeyV: 'distribute-vertical',
} as const satisfies Record<string, DesignLabArrangement>;

function lookup<T>(table: Record<string, T>, code: string): T | undefined {
  return Object.hasOwn(table, code) ? table[code] : undefined;
}

/**
 * Maps a key press to a Design Lab command. Option shortcuts use physical key
 * codes because Option changes the typed character on macOS.
 */
export function resolveDesignLabShortcut(event: DesignLabShortcutKey): DesignLabShortcutCommand | null {
  const command = event.metaKey || event.ctrlKey;
  if (command && event.altKey && !event.shiftKey) {
    if (event.code === 'KeyC') return { kind: 'copy-style' };
    if (event.code === 'KeyV') return { kind: 'paste-style' };
    return null;
  }
  if (command && event.shiftKey && !event.altKey && event.code === 'KeyL') return { kind: 'toggle-lock' };
  // Brackets by physical key: Shift turns them into braces on most layouts.
  if (command && !event.altKey && (event.code === 'BracketRight' || event.code === 'BracketLeft')) {
    return { direction: event.code === 'BracketRight' ? 'forward' : 'backward', kind: 'order', toEdge: event.shiftKey };
  }
  if (command && !event.altKey && !event.shiftKey && event.code === 'KeyA') return { kind: 'select-all' };
  if (command && !event.altKey && !event.shiftKey && event.code === 'KeyD') return { kind: 'duplicate' };
  if (command && !event.altKey && event.code === 'KeyG') return { kind: event.shiftKey ? 'ungroup' : 'group' };
  if (command) return null;
  if (!event.altKey && (event.key === 'Backspace' || event.key === 'Delete')) return { kind: 'delete' };
  if (event.altKey) {
    const arrangement = event.shiftKey ? lookup<DesignLabArrangement>(DISTRIBUTE_KEYS, event.code) : lookup<DesignLabArrangement>(ALIGN_KEYS, event.code);
    return arrangement ? { arrangement, kind: 'arrange' } : null;
  }
  if (event.key === '?') return { kind: 'shortcuts' };
  if (event.shiftKey) return null;
  const layer = lookup(ADD_KEYS, event.code);
  return layer ? { kind: 'add', layer } : null;
}

export const DESIGN_LAB_SHORTCUTS: readonly DesignLabShortcutEntry[] = [
  { description: 'Add a text layer', group: 'Add layers', keys: 'T' },
  { description: 'Add a shader layer', group: 'Add layers', keys: 'S' },
  { description: 'Add a brand mark', group: 'Add layers', keys: 'M' },
  { description: 'Add an image', group: 'Add layers', keys: 'I' },
  { description: 'Add a sticker', group: 'Add layers', keys: 'K' },
  { description: 'Add an effect to the artboard', group: 'Add layers', keys: 'E' },
  { description: 'Undo', group: 'Edit', keys: '⌘Z' },
  { description: 'Redo', group: 'Edit', keys: '⇧⌘Z' },
  { description: 'Copy, cut, paste layers', group: 'Edit', keys: '⌘C  ⌘X  ⌘V' },
  { description: 'Select all layers', group: 'Edit', keys: '⌘A' },
  { description: 'Copy style', group: 'Edit', keys: '⌥⌘C' },
  { description: 'Paste style', group: 'Edit', keys: '⌥⌘V' },
  { description: 'Duplicate selection', group: 'Edit', keys: '⌘D' },
  { description: 'Delete selection', group: 'Edit', keys: '⌫' },
  { description: 'Group or ungroup', group: 'Edit', keys: '⌘G  ⇧⌘G' },
  { description: 'Lock or unlock', group: 'Edit', keys: '⇧⌘L' },
  { description: 'Layer and canvas menus', group: 'Edit', keys: '⇧F10' },
  { description: 'Nudge, Shift for 10 px', group: 'Arrange', keys: 'Arrows' },
  { description: 'Bring forward, send backward', group: 'Arrange', keys: '⌘]  ⌘[' },
  { description: 'Bring to front, send to back', group: 'Arrange', keys: '⇧⌘]  ⇧⌘[' },
  { description: 'Align left, center, right', group: 'Arrange', keys: '⌥A  ⌥H  ⌥D' },
  { description: 'Align top, middle, bottom', group: 'Arrange', keys: '⌥W  ⌥V  ⌥S' },
  { description: 'Distribute across, down', group: 'Arrange', keys: '⌥⇧H  ⌥⇧V' },
  { description: 'Pan the canvas', group: 'Canvas', keys: 'Space-drag' },
  { description: 'Zoom around the pointer', group: 'Canvas', keys: 'Scroll' },
  { description: 'Fit canvas', group: 'Canvas', keys: 'F' },
  { description: 'Zoom in, zoom out', group: 'Canvas', keys: '+  −' },
  { description: 'Show keyboard shortcuts', group: 'Canvas', keys: '?' },
  { description: 'Bold, italic, underline', group: 'Text', keys: '⌘B  ⌘I  ⌘U' },
  { description: 'Finish editing text', group: 'Text', keys: 'Esc' },
];
