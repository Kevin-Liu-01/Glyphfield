import { describe, expect, it } from 'vitest';

import { DESIGN_LAB_SHORTCUTS, resolveDesignLabShortcut, type DesignLabShortcutKey } from '../designLabShortcuts';

function key(code: string, options: Partial<DesignLabShortcutKey> = {}): DesignLabShortcutKey {
  return { altKey: false, code, ctrlKey: false, key: code.replace(/^Key/, '').toLowerCase(), metaKey: false, shiftKey: false, ...options };
}

describe('Design Lab keyboard shortcuts', () => {
  it('adds layers with single letters and ignores modified letters', () => {
    expect(resolveDesignLabShortcut(key('KeyT'))).toEqual({ kind: 'add', layer: 'text' });
    expect(resolveDesignLabShortcut(key('KeyS'))).toEqual({ kind: 'add', layer: 'shader' });
    expect(resolveDesignLabShortcut(key('KeyK'))).toEqual({ kind: 'add', layer: 'sticker' });
    expect(resolveDesignLabShortcut(key('KeyT', { metaKey: true }))).toBeNull();
    expect(resolveDesignLabShortcut(key('KeyT', { shiftKey: true }))).toBeNull();
    expect(resolveDesignLabShortcut(key('KeyQ'))).toBeNull();
  });

  it('reads Option chords by physical key so macOS dead keys still align', () => {
    expect(resolveDesignLabShortcut(key('KeyA', { altKey: true, key: 'å' }))).toEqual({ arrangement: 'left', kind: 'arrange' });
    expect(resolveDesignLabShortcut(key('KeyV', { altKey: true, key: '√' }))).toEqual({ arrangement: 'vertical-center', kind: 'arrange' });
    expect(resolveDesignLabShortcut(key('KeyH', { altKey: true, shiftKey: true, key: 'Ó' })))
      .toEqual({ arrangement: 'distribute-horizontal', kind: 'arrange' });
  });

  it('maps style, lock and help chords on both platforms', () => {
    expect(resolveDesignLabShortcut(key('KeyC', { altKey: true, metaKey: true }))).toEqual({ kind: 'copy-style' });
    expect(resolveDesignLabShortcut(key('KeyV', { altKey: true, ctrlKey: true }))).toEqual({ kind: 'paste-style' });
    expect(resolveDesignLabShortcut(key('KeyL', { metaKey: true, shiftKey: true }))).toEqual({ kind: 'toggle-lock' });
    expect(resolveDesignLabShortcut(key('Slash', { key: '?', shiftKey: true }))).toEqual({ kind: 'shortcuts' });
    // Plain copy and paste stay with the layer clipboard.
    expect(resolveDesignLabShortcut(key('KeyC', { metaKey: true }))).toBeNull();
  });

  it('lists every chord it handles in the shortcuts sheet', () => {
    const listed = DESIGN_LAB_SHORTCUTS.map(({ keys }) => keys).join(' ');
    for (const chord of ['T', 'S', 'M', 'I', 'K', 'E', '⌥A', '⌥H', '⌥D', '⌥W', '⌥V', '⌥S', '⌥⇧H', '⌥⇧V', '⌥⌘C', '⌥⌘V', '⇧⌘L', '?']) {
      expect(listed).toContain(chord);
    }
  });
});
