import { createFromSource } from 'fumadocs-core/search/server';

import { docsSource } from '@/lib/docsSource';

export const { GET } = createFromSource(docsSource, {
  language: 'english',
});
