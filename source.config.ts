import { defineConfig, defineDocs } from 'fumadocs-mdx/config';

import { gitLastModified } from './src/lib/gitLastModified';

export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    // Real commit dates only: a shallow CI clone would otherwise stamp every page with the build date.
    lastModified: async (filePath) => gitLastModified(filePath, 'content/docs'),
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
});

export default defineConfig();
