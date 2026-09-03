'use client';

import { House } from '@phosphor-icons/react';
import Link from 'next/link';

import DocsThemeButton from '@/components/DocsThemeButton';
import { BookOpenText, Braces, Github } from '@/components/ui/SolidIcons';
import { PRODUCT_BRAND } from '@/lib/productBrand';

const footerLinks = [
  { href: '/', icon: House, label: 'Home' },
  { href: '/llms.txt', icon: BookOpenText, label: 'Agent guide' },
  { href: '/api/agent', icon: Braces, label: 'Agent API' },
] as const;

export default function DocsSidebarFooter() {
  return (
    <div className='glyphfield-docs-sidebar-footer'>
      <nav aria-label='Documentation resources'>
        {footerLinks.map(({ href, icon: Icon, label }) => (
          <Link href={href} key={href}>
            <Icon aria-hidden='true' weight='fill' />
            <span>{label}</span>
          </Link>
        ))}
        <a href={PRODUCT_BRAND.repository.url} rel='noreferrer' target='_blank'>
          <Github aria-hidden='true' weight='fill' />
          <span>GitHub</span>
        </a>
      </nav>
      <div className='glyphfield-docs-sidebar-footer__meta'>
        <span>Open source · MIT</span>
        <DocsThemeButton />
      </div>
    </div>
  );
}
