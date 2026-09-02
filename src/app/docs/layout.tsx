import './docs.css';

import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { T } from 'gt-next';
import { PanelsTopLeft } from '@/components/ui/SolidIcons';
import Link from 'next/link';

import type { ReactNode } from 'react';

import DocsHeader from '@/components/DocsHeader';
import SidebarDitherPanel from '@/components/SidebarDitherPanel';
import { docsBaseOptions } from '@/lib/docsLayout';
import { docsSource } from '@/lib/docsSource';

export default function DocumentationLayout({ children }: { children: ReactNode }) {
  return (
    <RootProvider theme={{ enabled: false }}>
      <DocsLayout
        {...docsBaseOptions()}
        containerProps={{ className: 'glyphfield-docs' }}
        sidebar={{
          banner: (
            <div className='glyphfield-docs-sidebar-intro' key='sidebar-intro'>
              <SidebarDitherPanel />
              <nav aria-label='Documentation help' className='studio-sidebar-help'>
                <Link className='glyphfield-docs-sidebar-studio-link' href='/studio'>
                  <PanelsTopLeft aria-hidden='true' />
                  <T>Studio</T>
                </Link>
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
    </RootProvider>
  );
}
