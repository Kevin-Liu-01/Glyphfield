'use client';

import { House } from '@phosphor-icons/react';
import Link from 'next/link';

import DocsThemeButton from '@/components/DocsThemeButton';
import MitLogo from '@/components/MitLogo';
import { BookOpenText, Braces, Github } from '@/components/ui/SolidIcons';
import { PRODUCT_BRAND } from '@/lib/productBrand';

// Text and JSON resources are plain links: a Next link would prefetch them as pages and 404.
const footerLinks = [
  { href: '/', icon: House, label: 'Home', page: true },
  { href: '/llms.txt', icon: BookOpenText, label: 'Agent guide', page: false },
  { href: '/api/agent', icon: Braces, label: 'Agent API', page: false },
] as const;

export default function DocsSidebarFooter() {
  return (
    <div className='glyphfield-docs-sidebar-footer'>
      <nav aria-label='Documentation resources'>
        {footerLinks.map(({ href, icon: Icon, label, page }) => {
          const content = <><Icon aria-hidden='true' weight='fill' /><span>{label}</span></>;
          return page ? <Link href={href} key={href}>{content}</Link> : <a href={href} key={href}>{content}</a>;
        })}
        <a href={PRODUCT_BRAND.repository.url} rel='noreferrer' target='_blank'>
          <Github aria-hidden='true' weight='fill' />
          <span>GitHub</span>
        </a>
      </nav>
      <div className='glyphfield-docs-sidebar-footer__meta'>
        <span className='glyphfield-docs-sidebar-footer__license'>
          <span>Open source ·</span>
          <MitLogo />
          <span className='sr-only'>MIT licensed</span>
        </span>
        <DocsThemeButton />
      </div>
    </div>
  );
}
