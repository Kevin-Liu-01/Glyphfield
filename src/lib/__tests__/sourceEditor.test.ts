import { describe, expect, it } from 'vitest';

import {
  sourceEditorDeletesPair,
  sourceEditorEnterInsertion,
  sourceEditorIndentReplacement,
  sourceEditorPairInsertion,
  sourceEditorSections,
  sourceEditorShortcut,
  sourceEditorSkipClosing,
} from '../sourceEditor';

const shortcut = (key: string, overrides: Partial<Parameters<typeof sourceEditorShortcut>[0]> = {}) => (
  sourceEditorShortcut({
    altKey: false,
    controlKey: false,
    key,
    metaKey: false,
    shiftKey: false,
    ...overrides,
  })
);

describe('source editor behavior', () => {
  it('maps cross-platform editor shortcuts without swallowing normal keys', () => {
    expect(shortcut('f', { metaKey: true })).toBe('find');
    expect(shortcut('F', { controlKey: true })).toBe('find');
    expect(shortcut('s', { controlKey: true })).toBe('apply');
    expect(shortcut('Enter', { metaKey: true })).toBe('apply');
    expect(shortcut('f', { altKey: true, shiftKey: true })).toBe('format');
    expect(shortcut('Escape')).toBe('close');
    expect(shortcut('a')).toBeNull();
  });

  it('creates smart indented lines between object and array pairs', () => {
    expect(sourceEditorEnterInsertion('{}', 1, '  ')).toEqual({
      cursorOffset: 3,
      inserted: '\n  \n',
    });
    expect(sourceEditorEnterInsertion('  []', 3, '  ')).toEqual({
      cursorOffset: 5,
      inserted: '\n    \n  ',
    });
    expect(sourceEditorEnterInsertion('  "key": true', 13, '  ')).toEqual({
      cursorOffset: 3,
      inserted: '\n  ',
    });
    expect(sourceEditorEnterInsertion('{', 1, '  ')).toEqual({
      cursorOffset: 3,
      inserted: '\n  ',
    });
  });

  it('pairs JSON delimiters, wraps selections, and leaves quotes inside strings alone', () => {
    expect(sourceEditorPairInsertion('', 0, 0, '{')).toEqual({ cursorOffset: 1, inserted: '{}' });
    expect(sourceEditorPairInsertion('value', 0, 5, '[')).toEqual({ cursorOffset: 6, inserted: '[value]' });
    expect(sourceEditorPairInsertion('', 0, 0, '"')).toEqual({ cursorOffset: 1, inserted: '""' });
    expect(sourceEditorPairInsertion('{"key": "value"}', 10, 10, '"')).toBeNull();
    expect(sourceEditorPairInsertion('{"key": "a\\"b"}', 12, 12, '"')).toBeNull();
    expect(sourceEditorPairInsertion('', 0, 0, 'x')).toBeNull();
  });

  it('skips existing closers and deletes empty pairs as one edit', () => {
    expect(sourceEditorSkipClosing('}', 0, '}')).toBe(true);
    expect(sourceEditorSkipClosing(']', 0, ']')).toBe(true);
    expect(sourceEditorSkipClosing('"', 0, '"')).toBe(true);
    expect(sourceEditorSkipClosing('}', 0, ']')).toBe(false);
    expect(sourceEditorSkipClosing('x', 0, 'x')).toBe(false);
    expect(sourceEditorDeletesPair('{}', 1)).toBe(true);
    expect(sourceEditorDeletesPair('[]', 1)).toBe(true);
    expect(sourceEditorDeletesPair('""', 1)).toBe(true);
    expect(sourceEditorDeletesPair('{x}', 1)).toBe(false);
    expect(sourceEditorDeletesPair('', 0)).toBe(false);
  });

  it('indents a cursor or a multiline selection and preserves the selection', () => {
    expect(sourceEditorIndentReplacement('abc', 1, 1, false, '  ')).toEqual({
      selectionEnd: 3,
      selectionStart: 3,
      value: 'a  bc',
    });
    expect(sourceEditorIndentReplacement('one\ntwo\nthree', 1, 8, false, '  ')).toEqual({
      selectionEnd: 12,
      selectionStart: 3,
      value: '  one\n  two\nthree',
    });
    expect(sourceEditorIndentReplacement('one\ntwo\nthree', 0, 3, false, '  ')).toEqual({
      selectionEnd: 5,
      selectionStart: 2,
      value: '  one\ntwo\nthree',
    });
    expect(sourceEditorIndentReplacement('one\ntwo', 0, 7, false, '  ')).toEqual({
      selectionEnd: 11,
      selectionStart: 2,
      value: '  one\n  two',
    });
  });

  it('outdents mixed tabs and spaces, including a selection ending on a newline', () => {
    expect(sourceEditorIndentReplacement('\tone\n  two\nthree', 0, 11, true, '  ')).toEqual({
      selectionEnd: 8,
      selectionStart: 0,
      value: 'one\ntwo\nthree',
    });
    expect(sourceEditorIndentReplacement('  one\n  two\n', 0, 12, true, '  ')).toEqual({
      selectionEnd: 8,
      selectionStart: 0,
      value: 'one\ntwo\n',
    });
  });

  it('indexes only top-level JSON sections and tolerates incomplete edits', () => {
    const source = `{
  "version": 3,
  "composition": {
    "label": "escaped \\"quote\\" and { bracket"
  },
  "assets": [
    { "id": "asset-1", "nested": true }
  ]
}`;
    expect(sourceEditorSections(source)).toEqual([
      { key: 'version', line: 2, position: source.indexOf('"version"') },
      { key: 'composition', line: 3, position: source.indexOf('"composition"') },
      { key: 'assets', line: 6, position: source.indexOf('"assets"') },
    ]);
    expect(sourceEditorSections('{\n  "broken\\": 1,\n  "valid": 2\n}')).toEqual([]);
    expect(sourceEditorSections(String.raw`{"bad\x": 1}`)).toEqual([]);
  });
});
