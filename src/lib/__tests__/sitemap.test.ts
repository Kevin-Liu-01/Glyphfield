import { describe, expect, it, vi } from 'vitest';

const gitLastModified = vi.hoisted(() => vi.fn((filePath: string) => (
  filePath === 'content/docs/agents/connect.mdx' ? new Date('2026-09-11T16:54:16Z') : undefined
)));
vi.mock('@/lib/gitLastModified', () => ({ gitLastModified }));
vi.mock('@/lib/docsSource', async () => (await import('./docsSourceFixture')).docsSourceMock);

import sitemap from '@/app/sitemap';
import { SITE_URL, STUDIO_SCREENSHOT, absoluteUrl } from '../seo';

describe('sitemap', () => {
  const entries = sitemap();

  it('lists the home page, the Studio, and every sidebar docs page in order', () => {
    expect(entries.map(({ url }) => url)).toEqual([
      SITE_URL,
      absoluteUrl('/studio'),
      absoluteUrl('/docs'),
      absoluteUrl('/docs/getting-started'),
      absoluteUrl('/docs/agents'),
      absoluteUrl('/docs/agents/connect'),
      absoluteUrl('/docs/studio/design-lab'),
      absoluteUrl('/docs/studio/design-lab/layers'),
    ]);
  });

  it('leaves out docs pages that are hidden from the sidebar', () => {
    expect(entries.map(({ url }) => url)).not.toContain(absoluteUrl('/docs/agents/skills'));
  });

  it('only sets lastModified when git history proves the date', () => {
    const dated = entries.filter((entry) => entry.lastModified);
    expect(dated).toEqual([expect.objectContaining({
      lastModified: new Date('2026-09-11T16:54:16Z'),
      url: absoluteUrl('/docs/agents/connect'),
    })]);
  });

  it('attaches absolute social images and the Studio screenshot', () => {
    expect(entries[1]?.images).toEqual([absoluteUrl('/studio/opengraph-image'), absoluteUrl(STUDIO_SCREENSHOT.path)]);
    expect(entries.find(({ url }) => url === absoluteUrl('/docs/agents/connect'))?.images)
      .toEqual([absoluteUrl('/og/docs/agents/connect/image.png')]);
    for (const entry of entries) {
      for (const image of entry.images ?? []) expect(image.startsWith(`${SITE_URL}/`)).toBe(true);
    }
  });
});
