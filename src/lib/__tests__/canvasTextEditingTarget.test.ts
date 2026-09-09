// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';

import { isCanvasTextEditingTarget } from '@/lib/canvasInteraction';

describe('canvas native editing targets', () => {
  it.each(['input', 'textarea', 'select'])('recognizes native %s controls', (tag) => {
    expect(isCanvasTextEditingTarget(document.createElement(tag))).toBe(true);
  });

  it.each(['plaintext-only', 'true', '', 'TRUE'])('recognizes %s editing hosts and their nested content', (value) => {
    const host = document.createElement('div');
    const content = document.createElement('span');
    host.setAttribute('contenteditable', value);
    host.append(content);
    expect(isCanvasTextEditingTarget(host)).toBe(true);
    expect(isCanvasTextEditingTarget(content)).toBe(true);
  });

  it('respects an explicitly non-editable island without blocking its input controls', () => {
    const editor = document.createElement('div');
    editor.setAttribute('contenteditable', 'plaintext-only');
    const island = document.createElement('span');
    island.setAttribute('contenteditable', 'false');
    const label = document.createElement('span');
    const input = document.createElement('input');
    island.append(label, input);
    editor.append(island);
    expect(isCanvasTextEditingTarget(label)).toBe(false);
    expect(isCanvasTextEditingTarget(input)).toBe(true);
  });

  it('uses the browser editability property when provided', () => {
    const element = document.createElement('div');
    Object.defineProperty(element, 'isContentEditable', { value: true });
    expect(isCanvasTextEditingTarget(element)).toBe(true);
  });

  it('ignores non-editing surfaces and missing targets', () => {
    expect(isCanvasTextEditingTarget(document.createElement('div'))).toBe(false);
    expect(isCanvasTextEditingTarget(null)).toBe(false);
    expect(isCanvasTextEditingTarget(window)).toBe(false);
  });
});
