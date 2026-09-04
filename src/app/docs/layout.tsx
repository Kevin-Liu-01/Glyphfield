import './docs.css';

import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { T } from 'gt-next';
import { Books, Bot, Braces, PanelsTopLeft, Search } from '@/components/ui/SolidIcons';
import Image from 'next/image';
import Link from 'next/link';

import type { ReactNode } from 'react';

import DocsControls from '@/components/DocsControls';
import DocsHeader from '@/components/DocsHeader';
import DocsMobileA11y from '@/components/DocsMobileA11y';
import DocsSidebarFooter from '@/components/DocsSidebarFooter';
import DocsSidebarMotion from '@/components/DocsSidebarMotion';
import SidebarDitherPanel from '@/components/SidebarDitherPanel';
import { docsBaseOptions } from '@/lib/docsLayout';
import { docsSource } from '@/lib/docsSource';
import { PRODUCT_BRAND } from '@/lib/productBrand';

export default function DocumentationLayout({ children }: { children: ReactNode }) {
  return (
    <RootProvider theme={{ enabled: false }}>
      <DocsLayout
        {...docsBaseOptions()}
        containerProps={{ className: 'glyphfield-docs', id: 'nd-docs-layout' }}
        sidebar={{
          banner: (
            <div className='glyphfield-docs-sidebar-intro' key='sidebar-intro'>
              <Link className='glyphfield-docs-sidebar-mobile-brand' href='/docs'>
                <Image alt='' height={27} src={PRODUCT_BRAND.markPath} width={27} />
                <span>{PRODUCT_BRAND.name}</span>
                <small>Docs</small>
              </Link>
              <SidebarDitherPanel
                icons={[<Books />, <Braces />, <Bot />, <Search />]}
                variant='docs'
              />
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
          footer: <DocsSidebarFooter key='docs-sidebar-footer' />,
          prefetch: false,
        }}
        slots={{ header: DocsHeader }}
        tree={docsSource.getPageTree()}
      >
        <DocsControls />
        <DocsMobileA11y />
        <DocsSidebarMotion />
        {children}
      </DocsLayout>
    </RootProvider>
  );
}
