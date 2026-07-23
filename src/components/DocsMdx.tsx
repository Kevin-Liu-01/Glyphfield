import defaultMdxComponents from 'fumadocs-ui/mdx';
import { ArrowUpRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import type { MDXComponents } from 'mdx/types';
import type { ReactNode } from 'react';

function DocsPathGrid({ children }: { children: ReactNode }) {
  return <div className='docs-path-grid not-prose'>{children}</div>;
}

function DocsPathCard({ children, href, index, title }: { children: ReactNode; href: string; index: string; title: string }) {
  return (
    <Link className='docs-path-card' href={href}>
      <span>{index}</span>
      <ArrowUpRight aria-hidden='true' />
      <strong>{title}</strong>
      <p>{children}</p>
    </Link>
  );
}

function DocsSystemGrid({ children }: { children: ReactNode }) {
  return <div className='docs-system-grid not-prose'>{children}</div>;
}

function DocsSystemItem({ children, index, title }: { children: ReactNode; index: string; title: string }) {
  return (
    <article className='docs-system-item'>
      <span>{index}</span>
      <strong>{title}</strong>
      <p>{children}</p>
    </article>
  );
}

function DocsThemeGallery() {
  return (
    <div className='docs-theme-gallery not-prose'>
      <figure>
        <figcaption><span>Studio / Light</span><small>1280 × 720</small></figcaption>
        <Image alt='Glyphfield Studio moodboard in light mode' height={720} src='/screenshots/studio-moodboard-light-2026.png' width={1280} />
      </figure>
      <figure>
        <figcaption><span>Studio / Dark</span><small>1280 × 720</small></figcaption>
        <Image alt='Glyphfield Studio moodboard in dark mode' height={720} src='/screenshots/studio-moodboard-dark-2026.png' width={1280} />
      </figure>
    </div>
  );
}

export function getDocsMdxComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    DocsPathCard,
    DocsPathGrid,
    DocsSystemGrid,
    DocsSystemItem,
    DocsThemeGallery,
    ...components,
  };
}
