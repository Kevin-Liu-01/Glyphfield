import { DocsLayout } from 'fumadocs-ui/layouts/docs';

import type { ReactNode } from 'react';

import DocsHeader from '@/components/DocsHeader';
import { docsBaseOptions } from '@/lib/docsLayout';
import { docsSource } from '@/lib/docsSource';

export default function DocumentationLayout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      {...docsBaseOptions()}
      containerProps={{ className: 'glyphfield-docs' }}
      sidebar={{
        banner: <div aria-hidden='true' className='glyphfield-docs-sidebar-signal'><span>{'{ }'}</span></div>,
        collapsible: false,
        defaultOpenLevel: 0,
        prefetch: false,
      }}
      slots={{ header: DocsHeader }}
      tree={docsSource.getPageTree()}
    >
      {children}
    </DocsLayout>
  );
}
