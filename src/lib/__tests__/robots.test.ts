import { describe, expect, it } from 'vitest';

import robots, { ANSWER_ENGINE_CRAWLERS } from '@/app/robots';

describe('social preview crawler access', () => {
  it('keeps Twitterbot access to the public OpenGraph endpoints', () => {
    const rules = robots().rules;
    const twitterRules = (Array.isArray(rules) ? rules : [rules]).find((rule) =>
      rule.userAgent === 'Twitterbot'
    );
    const allowedPaths = Array.isArray(twitterRules?.allow)
      ? twitterRules.allow
      : [twitterRules?.allow];

    expect(allowedPaths).toContain('/api/og');
    expect(allowedPaths).toContain('/api/og-home');
    expect(allowedPaths).toContain('/opengraph-image');
    expect(allowedPaths).toContain('/twitter-image');
  });

  it('allows the current answer-engine crawler group', () => {
    const rules = robots().rules;
    const answerEngineRules = (Array.isArray(rules) ? rules : [rules]).find((rule) =>
      Array.isArray(rule.userAgent) && rule.userAgent.includes('OAI-SearchBot')
    );

    expect(answerEngineRules?.allow).toBe('/');
    expect(answerEngineRules?.userAgent).toEqual([...ANSWER_ENGINE_CRAWLERS]);
  });
});
