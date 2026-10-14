import type { Root } from 'fumadocs-core/page-tree';

/** A small stand-in for the Fumadocs docs source, for tests that cannot compile MDX. */

type FixturePage = {
  data: {
    description: string;
    getText: (type: 'processed' | 'raw') => Promise<string>;
    info: { path: string };
    title: string;
  };
  slugs: string[];
  url: string;
};

function fixturePage(slugs: string[], title: string, description: string, path: string): FixturePage {
  return {
    data: {
      description,
      getText: async () => `## ${title} body\n\nBody text for ${title}.`,
      info: { path },
      title,
    },
    slugs,
    url: slugs.length ? `/docs/${slugs.join('/')}` : '/docs',
  };
}

export const FIXTURE_PAGES: FixturePage[] = [
  fixturePage(['agents', 'skills'], 'Skills moved', 'A stub page that is not in the sidebar.', 'agents/skills.mdx'),
  fixturePage(['agents', 'connect'], 'Connect an agent', 'Discover Glyphfield and submit a generation request.', 'agents/connect.mdx'),
  fixturePage(['agents'], 'Agent integration', 'Give agents structured discovery.', 'agents/index.mdx'),
  fixturePage(['getting-started'], 'Getting started', 'Open the Studio and export a file.', 'getting-started.mdx'),
  fixturePage([], 'Documentation', 'Define one brand system.', 'index.mdx'),
  fixturePage(['studio', 'design-lab', 'layers'], 'Layers and editing', 'Edit Design Lab layers.', 'studio/design-lab/layers.mdx'),
  fixturePage(['studio', 'design-lab'], 'Design Lab', 'Compose layers on an open canvas.', 'studio/design-lab/index.mdx'),
];

export const FIXTURE_TREE: Root = {
  children: [
    { name: 'Documentation', type: 'page', url: '/docs' },
    { name: 'Getting started', type: 'page', url: '/docs/getting-started' },
    {
      children: [
        { name: 'Agent integration', type: 'page', url: '/docs/agents' },
        { name: 'Connect an agent', type: 'page', url: '/docs/agents/connect' },
      ],
      name: 'Agents',
      type: 'folder',
    },
    {
      children: [
        {
          children: [{ name: 'Layers and editing', type: 'page', url: '/docs/studio/design-lab/layers' }],
          index: { name: 'Design Lab', type: 'page', url: '/docs/studio/design-lab' },
          name: 'Design Lab',
          type: 'folder',
        },
      ],
      name: 'Studio',
      type: 'folder',
    },
    { name: 'GitHub', type: 'page', url: 'https://github.com/Kevin-Liu-01/Glyphfield', external: true },
  ],
  name: 'Glyphfield',
};

export const docsSourceMock = {
  docsSource: {
    getPage: (slugs: string[] = []) => FIXTURE_PAGES.find((page) => page.slugs.join('/') === slugs.join('/')),
    getPages: () => FIXTURE_PAGES,
    getPageTree: () => FIXTURE_TREE,
  },
  getDocumentationImage: (page: { slugs: string[] }) => ({
    height: 630,
    url: `/og/docs/${[...page.slugs, 'image.png'].join('/')}`,
    width: 1200,
  }),
};
