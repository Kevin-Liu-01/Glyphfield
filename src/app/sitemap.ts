import type { MetadataRoute } from 'next';

import { docsSource } from '@/lib/docsSource';
import { SITE_URL, absoluteUrl } from '@/lib/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  const documentation = docsSource.getPages().map((page) => ({
    changeFrequency: 'weekly' as const,
    images: [absoluteUrl(`/og/docs/${[...page.slugs, 'image.png'].join('/')}`)],
    priority: page.url === '/docs' ? 0.9 : 0.7,
    url: absoluteUrl(page.url),
  }));

  return [
    {
      changeFrequency: 'monthly',
      images: [absoluteUrl('/opengraph-image')],
      priority: 1,
      url: SITE_URL,
    },
    {
      changeFrequency: 'weekly',
      images: [absoluteUrl('/studio/opengraph-image')],
      priority: 0.9,
      url: absoluteUrl('/studio'),
    },
    ...documentation,
  ];
}
