'use client';

import { BookOpen, PanelLeft } from 'lucide-react';
import { T, useGT } from 'gt-next';
import { useDocsLayout } from 'fumadocs-ui/layouts/docs';

import type { ComponentProps } from 'react';

export default function DocsHeader({ className, ...props }: ComponentProps<'header'>) {
  const gt = useGT();
  const { slots } = useDocsLayout();
  const NavTitle = slots.navTitle;
  const SearchFull = slots.searchTrigger ? slots.searchTrigger.full : null;
  const SearchSmall = slots.searchTrigger ? slots.searchTrigger.sm : null;
  const ThemeSwitch = slots.themeSwitch || null;
  const SidebarTrigger = slots.sidebar.trigger;

  return (
    <header
      {...props}
      className={['glyphfield-docs-header', className].filter(Boolean).join(' ')}
      id='nd-subnav'
    >
      {NavTitle ? <NavTitle className='glyphfield-docs-header-brand' /> : null}
      <div className='glyphfield-docs-header-context'>
        <BookOpen aria-hidden='true' />
        <strong><T>Documentation</T></strong>
        <span>/</span>
        <small><T>System reference</T></small>
      </div>
      <div className='glyphfield-docs-header-search'>
        {SearchFull ? <SearchFull hideIfDisabled /> : null}
      </div>
      <nav aria-label={gt('Documentation utilities')} className='glyphfield-docs-header-actions'>
        {ThemeSwitch ? <ThemeSwitch className='glyphfield-docs-header-mobile-theme' /> : null}
        {SearchSmall ? <SearchSmall className='glyphfield-docs-mobile-search' hideIfDisabled /> : null}
        <SidebarTrigger aria-label={gt('Open documentation navigation')} className='glyphfield-docs-sidebar-trigger'>
          <PanelLeft aria-hidden='true' />
        </SidebarTrigger>
      </nav>
    </header>
  );
}
