import type { MetadataRoute } from 'next';

import { absoluteUrl } from '@/lib/seo';

export const SOCIAL_PREVIEW_CRAWLERS = [
  'facebookexternalhit',
  'Facebot',
  'LinkedInBot',
  'Discordbot',
  'Slackbot-LinkExpanding',
  'TelegramBot',
  'Pinterestbot',
] as const;

// Every group below allows the whole site. The owner wants search, answer-engine, and
// model-training crawlers to read everything; the named groups document which agents were
// considered, and `*` covers every other crawler.
export const ANSWER_ENGINE_CRAWLERS = [
  'OAI-SearchBot',
  'ChatGPT-User',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
  'Applebot',
  'Amazonbot',
  'DuckAssistBot',
  'MistralAI-User',
] as const;

export const MODEL_DEVELOPMENT_CRAWLERS = [
  'GPTBot',
  'ClaudeBot',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'Meta-ExternalAgent',
] as const;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        allow: [
          '/',
          '/api/og',
          '/api/og-home',
          '/opengraph-image',
          '/twitter-image',
        ],
        userAgent: 'Twitterbot',
      },
      {
        allow: [
          '/',
          '/api/og',
          '/api/og-home',
          '/opengraph-image',
          '/twitter-image',
          '/studio/opengraph-image',
          '/studio/twitter-image',
          '/og/docs/',
        ],
        userAgent: [...SOCIAL_PREVIEW_CRAWLERS],
      },
      {
        allow: '/',
        userAgent: [...ANSWER_ENGINE_CRAWLERS],
      },
      {
        allow: '/',
        userAgent: [...MODEL_DEVELOPMENT_CRAWLERS],
      },
      {
        allow: '/',
        userAgent: '*',
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
