import type { MetadataRoute } from 'next';

import { docsSource } from '@/lib/docsSource';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_STUDIO_URL ?? 'https://studio.generaltranslation.com';

  const documentation = docsSource.getPages().map((page) => ({
    changeFrequency: 'weekly' as const,
    lastModified: new Date(),
    priority: page.url === '/docs' ? 0.9 : 0.7,
    url: `${baseUrl}${page.url}`,
  }));

  return [
    {
      changeFrequency: 'monthly',
      lastModified: new Date(),
      priority: 1,
      url: baseUrl,
    },
    {
      changeFrequency: 'weekly',
      lastModified: new Date(),
      priority: 0.9,
      url: `${baseUrl}/studio`,
    },
    ...documentation,
  ];
}
