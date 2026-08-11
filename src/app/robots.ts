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

export const ANSWER_ENGINE_CRAWLERS = [
  'OAI-SearchBot',
  'ChatGPT-User',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
] as const;

export const MODEL_DEVELOPMENT_CRAWLERS = [
  'GPTBot',
  'ClaudeBot',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
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
