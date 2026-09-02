import { describe, expect, it, vi } from 'vitest';

import {
  formatSource,
  inspectSourceText,
  normalizeSourceText,
  parseSourceObject,
  sourceBoolean,
  sourceNumber,
  sourceObject,
  sourceObjectArray,
  sourceString,
  sourceStringArray,
  stringifySource,
} from '@/lib/sourceCode';

describe('source code parsing', () => {
  it('accepts non-breaking spaces introduced by rich-text paste', () => {
    const source = '{\n\u00a0\u00a0"version": 3,\n\u00a0\u00a0"composition": {\n\u00a0\u00a0\u00a0\u00a0"layerOrder": []\n\u00a0\u00a0}\n}';

    expect(() => JSON.parse(source)).toThrow(/position 2|line 2 column 1/i);

    expect(parseSourceObject(source)).toEqual({
      composition: { layerOrder: [] },
      version: 3,
    });
    const diagnostic = inspectSourceText(source);
    expect(diagnostic).toMatchObject({
      normalized: true,
      valid: true,
    });
    expect(JSON.parse(diagnostic.source)).toEqual({
      composition: { layerOrder: [] },
      version: 3,
    });
  });

  it('preserves non-breaking spaces inside JSON strings', () => {
    expect(parseSourceObject('{"label":"Open\u00a0Source \\\"quoted\\\" \\\\ path"}')).toEqual({
      label: 'Open\u00a0Source "quoted" \\ path',
    });
  });

  it('accepts JSON copied inside a Markdown code fence', () => {
    expect(parseSourceObject('```json\n{\n  "version": 3\n}\n```')).toEqual({
      version: 3,
    });
  });

  it('returns line-aware diagnostics for invalid JSON', () => {
    const diagnostic = inspectSourceText('{\n  "version": 3,\n  broken\n}');

    expect(diagnostic.valid).toBe(false);
    expect(diagnostic.line).toBe(3);
    expect(diagnostic.column).toBe(3);
    expect(diagnostic.message).toContain('Line 3, column 3');
  });

  it('normalizes position-only and line-only diagnostics across JSON runtimes', () => {
    const parse = vi.spyOn(JSON, 'parse');
    parse.mockImplementationOnce(() => {
      throw new SyntaxError('Unexpected token in JSON at position 4');
    });
    expect(inspectSourceText('{\n x}')).toMatchObject({ column: 3, line: 2, position: 4 });

    parse.mockImplementationOnce(() => {
      throw new SyntaxError('Expected property name at line 2 column 3');
    });
    expect(inspectSourceText('{\n x}')).toMatchObject({ column: 3, line: 2, position: 4 });

    parse.mockImplementationOnce(() => {
      throw 'invalid source';
    });
    expect(inspectSourceText('{')).toMatchObject({
      message: 'JSON syntax error — The source is not valid JSON.',
      valid: false,
    });

    parse.mockImplementationOnce(() => {
      throw new SyntaxError('Expected property name at line 4 column 2');
    });
    expect(inspectSourceText('{')).toMatchObject({ line: 4, position: 1 });

    parse.mockImplementationOnce(() => {
      throw new SyntaxError(' at position 1');
    });
    expect(inspectSourceText('{')).toMatchObject({
      message: 'Line 1, column 2 — The source is not valid JSON.',
    });
    parse.mockRestore();
  });

  it('formats normalized source as clean two-space JSON', () => {
    expect(formatSource('{\n\u00a0\u00a0"version":3\n}')).toBe('{\n  "version": 3\n}');
  });

  it('normalizes all rich-text separators outside strings while preserving line positions', () => {
    const source = '\uFEFF{\u2028\u2007"version"\u202F:\u30003\u2029}';
    const normalized = normalizeSourceText(source);

    expect(normalized).toHaveLength(source.length);
    expect(normalized).toBe(' {\n "version" : 3\n}');
    expect(parseSourceObject(source)).toEqual({ version: 3 });
  });

  it('leaves incomplete or unlabeled Markdown fences diagnosable in place', () => {
    const openOnly = '```json\n{"version":3}';
    const closeOnly = '{"version":3}\n```';

    expect(normalizeSourceText(openOnly)).toBe(openOnly);
    expect(normalizeSourceText(closeOnly)).toBe(closeOnly);
    expect(inspectSourceText(openOnly).valid).toBe(false);
    expect(inspectSourceText(closeOnly).valid).toBe(false);
  });

  it('rejects valid JSON values that are not composition objects', () => {
    expect(() => parseSourceObject('null')).toThrow('Source must contain a JSON object.');
    expect(() => parseSourceObject('[]')).toThrow('Source must contain a JSON object.');
    expect(() => formatSource('{broken}')).toThrow(/Line 1, column 2|JSON syntax error/);
  });

  it('reads typed source fields without coercing invalid values', () => {
    const value: Record<string, unknown> = {
      active: true,
      count: 4,
      invalidCount: Number.NaN,
      items: ['a', 'b'],
      mixedItems: ['a', 2],
      nested: { id: 'child' },
      nestedItems: [{ id: 'a' }, { id: 'b' }],
      title: 'Canvas',
    };

    expect(sourceString(value, 'title', 'Untitled')).toBe('Canvas');
    expect(sourceString(value, 'missing', 'Untitled')).toBe('Untitled');
    expect(sourceNumber(value, 'count', 0)).toBe(4);
    expect(sourceNumber(value, 'invalidCount', 9)).toBe(9);
    expect(sourceNumber(value, 'missing', 8)).toBe(8);
    expect(sourceBoolean(value, 'active', false)).toBe(true);
    expect(sourceBoolean(value, 'missing', false)).toBe(false);
    expect(sourceObject(value, 'nested')).toEqual({ id: 'child' });
    expect(sourceObject(value, 'items')).toBeNull();
    expect(sourceObject(value, 'missing')).toBeNull();
    expect(sourceStringArray(value, 'items', [])).toEqual(['a', 'b']);
    expect(sourceStringArray(value, 'mixedItems', ['fallback'])).toEqual(['fallback']);
    expect(sourceStringArray(value, 'missing', ['fallback'])).toEqual(['fallback']);
    expect(sourceObjectArray(value, 'nestedItems')).toEqual([{ id: 'a' }, { id: 'b' }]);
    expect(sourceObjectArray(value, 'mixedItems')).toBeNull();
    expect(sourceObjectArray(value, 'missing')).toBeNull();
    expect(stringifySource({ b: 2, a: 1 })).toBe('{\n  "b": 2,\n  "a": 1\n}');
  });
});
