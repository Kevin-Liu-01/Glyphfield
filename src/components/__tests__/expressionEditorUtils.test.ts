import { describe, expect, it } from 'vitest';

import { parseLineList } from '../expressions/expressionEditorUtils';

describe('parseLineList', () => {
  it('parses numbers and ascending ranges', () => {
    expect(parseLineList('2, 4-6')).toEqual([2, 4, 5, 6]);
    expect(parseLineList('3-1')).toEqual([1, 2, 3]);
    expect(parseLineList('')).toEqual([]);
  });

  it('bounds every range at 200 lines from its lower end', () => {
    const lines = parseLineList('1000000000-1');
    expect(lines).toHaveLength(200);
    expect(lines[0]).toBe(1);
    expect(lines[199]).toBe(200);
  });

  it('skips endpoints beyond safe integers and starts ranges at line 1', () => {
    expect(parseLineList('9007199254740993')).toEqual([]);
    expect(parseLineList('9007199254740993-4')).toEqual([]);
    expect(parseLineList('0')).toEqual([]);
    expect(parseLineList('0-3')).toEqual([1, 2, 3]);
  });
});
