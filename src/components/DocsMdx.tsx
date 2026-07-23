import defaultMdxComponents from 'fumadocs-ui/mdx';
import { ArrowUpRight } from 'lucide-react';
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

export function getDocsMdxComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    DocsPathCard,
    DocsPathGrid,
    DocsSystemGrid,
    DocsSystemItem,
    ...components,
  };
}
