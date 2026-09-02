import { describe, expect, it } from 'vitest';

import { formatGitHubStarCount, parseGitHubStarCount } from '@/lib/githubRepository';

describe('GitHub repository stats', () => {
  it('accepts only finite non-negative star counts', () => {
    expect(parseGitHubStarCount({ stargazers_count: 42 })).toBe(42);
    expect(parseGitHubStarCount({ stargazers_count: 4.9 })).toBe(4);
    expect(parseGitHubStarCount({ stargazers_count: -1 })).toBeNull();
    expect(parseGitHubStarCount({ stargazers_count: '42' })).toBeNull();
    expect(parseGitHubStarCount(null)).toBeNull();
  });

  it('keeps small counts exact and compacts larger counts', () => {
    expect(formatGitHubStarCount(842)).toBe('842');
    expect(formatGitHubStarCount(1284)).toBe('1.3K');
  });
});
