import type { MetadataRoute } from 'next';

import { docsNavigationEntries, docsPageLastModified } from '@/lib/docsSeo';
import { docsSource, getDocumentationImage } from '@/lib/docsSource';
import { SITE_URL, STUDIO_SCREENSHOT, absoluteUrl } from '@/lib/seo';

// Docs pages are listed in sidebar order. Pages hidden from the sidebar (redirect stubs) are left out.
// lastModified comes from git history and is omitted when the build's history cannot prove it.
export default function sitemap(): MetadataRoute.Sitemap {
  const pages = new Map(docsSource.getPages().map((page) => [page.url, page]));
  const documentation = docsNavigationEntries().flatMap(({ url }): MetadataRoute.Sitemap => {
    const page = pages.get(url);
    if (!page) return [];
    const lastModified = docsPageLastModified(page);

    return [{
      changeFrequency: 'weekly',
      images: [absoluteUrl(getDocumentationImage(page).url)],
      ...(lastModified ? { lastModified } : {}),
      priority: page.url === '/docs' ? 0.9 : 0.7,
      url: absoluteUrl(page.url),
    }];
  });

  return [
    {
      changeFrequency: 'monthly',
      images: [absoluteUrl('/opengraph-image')],
      priority: 1,
      url: SITE_URL,
    },
    {
      changeFrequency: 'weekly',
      images: [absoluteUrl('/studio/opengraph-image'), absoluteUrl(STUDIO_SCREENSHOT.path)],
      priority: 0.9,
      url: absoluteUrl('/studio'),
    },
    ...documentation,
  ];
}
