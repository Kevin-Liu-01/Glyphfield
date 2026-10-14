import { describe, expect, it } from 'vitest';

import robots, { ANSWER_ENGINE_CRAWLERS, MODEL_DEVELOPMENT_CRAWLERS } from '@/app/robots';
import { SITE_URL } from '@/lib/seo';

function robotRules() {
  const rules = robots().rules;
  return Array.isArray(rules) ? rules : [rules];
}

describe('social preview crawler access', () => {
  it('keeps Twitterbot access to the public OpenGraph endpoints', () => {
    const twitterRules = robotRules().find((rule) =>
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
    const answerEngineRules = robotRules().find((rule) =>
      Array.isArray(rule.userAgent) && rule.userAgent.includes('OAI-SearchBot')
    );

    expect(answerEngineRules?.allow).toBe('/');
    expect(answerEngineRules?.userAgent).toEqual([...ANSWER_ENGINE_CRAWLERS]);
    expect(ANSWER_ENGINE_CRAWLERS).toEqual(expect.arrayContaining([
      'Applebot',
      'Amazonbot',
      'DuckAssistBot',
      'MistralAI-User',
    ]));
  });

  it('allows model-training crawlers', () => {
    const modelRules = robotRules().find((rule) =>
      Array.isArray(rule.userAgent) && rule.userAgent.includes('GPTBot')
    );

    expect(modelRules?.allow).toBe('/');
    expect(modelRules?.userAgent).toEqual([...MODEL_DEVELOPMENT_CRAWLERS]);
  });
});

describe('site-wide crawler policy', () => {
  it('keeps every page open to every crawler', () => {
    for (const rule of robotRules()) {
      expect(rule.disallow).toBeUndefined();
      expect([rule.allow].flat()).toContain('/');
    }
    expect(robotRules().find((rule) => rule.userAgent === '*')?.allow).toBe('/');
  });

  it('points to the sitemap on the public origin', () => {
    expect(robots().sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });
});
