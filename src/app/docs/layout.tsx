import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { T } from 'gt-next';
import { PanelsTopLeft } from 'lucide-react';
import Link from 'next/link';

import type { ReactNode } from 'react';

import DocsHeader from '@/components/DocsHeader';
import SidebarDitherPanel from '@/components/SidebarDitherPanel';
import { Button } from '@/components/ui/Button';
import { docsBaseOptions } from '@/lib/docsLayout';
import { docsSource } from '@/lib/docsSource';

export default function DocumentationLayout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      {...docsBaseOptions()}
      containerProps={{ className: 'glyphfield-docs' }}
      sidebar={{
        banner: (
          <div className='glyphfield-docs-sidebar-intro' key='sidebar-intro'>
            <SidebarDitherPanel />
            <nav aria-label='Documentation help' className='studio-sidebar-help'>
              <Button asChild className='h-9 w-full justify-start px-2.5' variant='ghost'>
                <Link href='/studio'><PanelsTopLeft aria-hidden='true' /><T>Studio</T></Link>
              </Button>
            </nav>
          </div>
        ),
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
