import { DocsLayout } from 'fumadocs-ui/layouts/docs';

import type { ReactNode } from 'react';

import { docsBaseOptions } from '@/lib/docsLayout';
import { docsSource } from '@/lib/docsSource';

export default function DocumentationLayout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      {...docsBaseOptions()}
      containerProps={{ className: 'glyphfield-docs' }}
      sidebar={{ defaultOpenLevel: 1, prefetch: false }}
      tree={docsSource.getPageTree()}
    >
      {children}
    </DocsLayout>
  );
}
