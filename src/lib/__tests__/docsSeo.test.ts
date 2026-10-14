import { describe, expect, it, vi } from 'vitest';

const gitLastModified = vi.hoisted(() => vi.fn());
vi.mock('@/lib/gitLastModified', () => ({ gitLastModified }));
vi.mock('@/lib/docsSource', async () => (await import('./docsSourceFixture')).docsSourceMock);

import {
  docsNavigationEntries,
  docsPageLastModified,
  docsSections,
  orderedDocsPages,
} from '../docsSeo';

describe('docs navigation', () => {
  it('lists sidebar pages in order with their folders and skips external links', () => {
    const agents = { name: 'Agents', url: '/docs/agents' };
    const designLab = [{ name: 'Studio', url: undefined }, { name: 'Design Lab', url: '/docs/studio/design-lab' }];
    expect(docsNavigationEntries()).toEqual([
      { sections: [], url: '/docs' },
      { sections: [], url: '/docs/getting-started' },
      { sections: [agents], url: '/docs/agents' },
      { sections: [agents], url: '/docs/agents/connect' },
      { sections: designLab, url: '/docs/studio/design-lab' },
      { sections: designLab, url: '/docs/studio/design-lab/layers' },
    ]);
  });

  it('maps folders to their index pages and drops a folder from its own index page', () => {
    expect(docsSections('/docs/agents')).toEqual([]);
    expect(docsSections('/docs/agents/connect')).toEqual([{ name: 'Agents', url: '/docs/agents' }]);
    expect(docsSections('/docs/studio/design-lab')).toEqual([{ name: 'Studio', url: undefined }]);
    expect(docsSections('/docs/studio/design-lab/layers')).toEqual([
      { name: 'Studio', url: undefined },
      { name: 'Design Lab', url: '/docs/studio/design-lab' },
    ]);
    expect(docsSections('/docs/agents/skills')).toEqual([]);
  });

  it('links a section to its sidebar folder even when the page URL lives in another folder', () => {
    const tree = {
      children: [{
        children: [{ name: 'Tactile backgrounds', type: 'page', url: '/docs/studio/logo-background' }],
        index: { name: 'Agents', type: 'page', url: '/docs/agents' },
        name: 'Agents',
        type: 'folder',
      }],
      name: 'Docs',
    } as unknown as Parameters<typeof docsNavigationEntries>[0];
    expect(docsNavigationEntries(tree)).toContainEqual({
      sections: [{ name: 'Agents', url: '/docs/agents' }],
      url: '/docs/studio/logo-background',
    });
  });

  it('orders every page by the sidebar and appends hidden pages', () => {
    expect(orderedDocsPages().map(({ url }) => url)).toEqual([
      '/docs',
      '/docs/getting-started',
      '/docs/agents',
      '/docs/agents/connect',
      '/docs/studio/design-lab',
      '/docs/studio/design-lab/layers',
      '/docs/agents/skills',
    ]);
  });

  it('reads the modification date of the page source from git', () => {
    const date = new Date('2026-09-11T16:54:16Z');
    gitLastModified.mockReturnValueOnce(date);

    expect(docsPageLastModified({ data: { info: { path: 'agents\\connect.mdx' } } })).toBe(date);
    expect(gitLastModified).toHaveBeenCalledWith('content/docs/agents/connect.mdx', 'content/docs');
  });
});
