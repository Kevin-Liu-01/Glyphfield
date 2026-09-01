import { describe, expect, it } from 'vitest';

import {
  formatSource,
  inspectSourceText,
  parseSourceObject,
} from '@/lib/sourceCode';

describe('source code parsing', () => {
  it('accepts non-breaking spaces introduced by rich-text paste', () => {
    const source = '{\n\u00a0\u00a0"version": 3,\n\u00a0\u00a0"composition": {\n\u00a0\u00a0\u00a0\u00a0"layerOrder": []\n\u00a0\u00a0}\n}';

    expect(parseSourceObject(source)).toEqual({
      composition: { layerOrder: [] },
      version: 3,
    });
    expect(inspectSourceText(source)).toMatchObject({
      normalized: true,
      valid: true,
    });
  });

  it('preserves non-breaking spaces inside JSON strings', () => {
    expect(parseSourceObject('{"label":"Open\u00a0Source"}')).toEqual({
      label: 'Open\u00a0Source',
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

  it('formats normalized source as clean two-space JSON', () => {
    expect(formatSource('{\n\u00a0\u00a0"version":3\n}')).toBe('{\n  "version": 3\n}');
  });
});
