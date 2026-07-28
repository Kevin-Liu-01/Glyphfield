import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('social preview crawler access', () => {
  it('keeps Twitterbot access to the public OpenGraph endpoints', () => {
    const robots = readFileSync(resolve(process.cwd(), 'public/robots.txt'), 'utf8');
    const twitterRules = robots.split(/\n\s*\n/).find((group) =>
      group.toLowerCase().includes('user-agent: twitterbot')
    );

    expect(twitterRules).toContain('Allow: /api/og');
    expect(twitterRules).toContain('Allow: /api/og-home');
    expect(twitterRules).toContain('Allow: /opengraph-image');
    expect(twitterRules).toContain('Allow: /twitter-image');
  });
});
