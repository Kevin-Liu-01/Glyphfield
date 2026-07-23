import { describe, expect, it } from 'vitest';

import { highlightCode } from '../codeHighlight';

describe('highlightCode', () => {
  it.each([
    ['typescript', `export const greeting = 'Hello';`],
    ['python', `result = translate('Hello')`],
    ['bash', `$ gt translate --locales es,ja`],
  ] as const)('preserves %s source while returning syntax-colored tokens', (language, source) => {
    const lines = highlightCode(source, language);

    expect(lines.flatMap((line) => line.tokens).map(({ content }) => content).join(''))
      .toBe(source);
    expect(new Set(lines.flatMap((line) => line.tokens).map(({ color }) => color)).size)
      .toBeGreaterThan(1);
  });

  it('keeps command output semantically distinct from shell syntax', () => {
    const lines = highlightCode('$ gt init\n✓ project connected', 'bash');

    expect(lines[1]?.kind).toBe('success');
    expect(lines[1]?.tokens).toEqual([
      { color: '#3FB950', content: '✓ project connected' },
    ]);
  });
});
