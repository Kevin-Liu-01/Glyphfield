// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { editableTextValue, readTextSelection, renderTextRuns, restoreTextSelection } from '../richTextDom';

afterEach(() => document.body.replaceChildren());
describe('native text selection across styled spans', () => {
  it('reads and restores offsets across spans, newlines and emoji without HTML insertion', () => {
    const root = document.createElement('span');
    document.body.append(root);
    const value = 'A😀\n<script>text';
    renderTextRuns(root, value, [{ start: 1, end: 3, style: { weight: 700 } }], (style) => ({ fontWeight: String(style.weight ?? 400) }));
    expect(editableTextValue(root)).toBe(value);
    expect(root.querySelector('script')).toBeNull();
    restoreTextSelection(root, { start: 1, end: 10 });
    expect(readTextSelection(root)).toEqual({ start: 1, end: 10 });
  });
  it('normalizes browser-generated line breaks while retaining empty lines', () => {
    const root = document.createElement('span');
    root.innerHTML = 'Hello<div>world</div><div><br></div>';
    expect(editableTextValue(root)).toBe('Hello\nworld\n');
    root.innerHTML = 'Hello<br>world';
    expect(editableTextValue(root)).toBe('Hello\nworld');
    root.innerHTML = 'Hello<div>world</div><div><br></div><div>end</div>';
    expect(editableTextValue(root)).toBe('Hello\nworld\n\nend');
  });
  it('preserves backward selection direction when spans are rebuilt', () => {
    const root = document.createElement('span');
    document.body.append(root);
    renderTextRuns(root, 'one two', [{ start: 0, end: 3, style: { underline: true } }], () => ({}));
    restoreTextSelection(root, { start: 1, end: 6, backward: true });
    expect(readTextSelection(root)).toEqual({ start: 1, end: 6, backward: true });
  });
  it('counts native BR nodes while restoring a caret on a later line', () => {
    const root = document.createElement('span');
    root.innerHTML = '<br>First<br><br>Second';
    document.body.append(root);
    restoreTextSelection(root, { start: 10, end: 12 });
    expect(window.getSelection()?.toString()).toBe('co');
    expect(readTextSelection(root)).toEqual({ start: 10, end: 12 });
    restoreTextSelection(root, { start: 1, end: 1 });
    expect(readTextSelection(root)).toEqual({ start: 1, end: 1 });
  });
});
