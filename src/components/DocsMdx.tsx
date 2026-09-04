import defaultMdxComponents from 'fumadocs-ui/mdx';
import {
  ArrowUpRight,
  Badge,
  BookMarked,
  Bot,
  Braces,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  Film,
  Files,
  Layers3,
  Monitor,
  PanelsTopLeft,
  Rocket,
  Search,
  Sparkles,
  Table,
  WandSparkles,
  type LucideIcon,
} from '@/components/ui/SolidIcons';
import Image from 'next/image';
import Link from 'next/link';

import type { MDXComponents } from 'mdx/types';
import type { ReactNode } from 'react';

type DocsMediaProps = {
  alt: string;
  caption: string;
  height?: number;
  meta?: string;
  src: string;
  width?: number;
};

const DOCS_CARD_ICONS = {
  agent: Bot,
  api: Braces,
  artifact: Download,
  check: CheckCircle2,
  design: Layers3,
  discover: Search,
  document: Files,
  identity: Badge,
  material: Sparkles,
  motion: Film,
  reference: BookMarked,
  render: Monitor,
  start: Rocket,
  studio: PanelsTopLeft,
  table: Table,
  time: Clock3,
  verify: Eye,
  wand: WandSparkles,
} satisfies Record<string, LucideIcon>;

type DocsCardIconName = keyof typeof DOCS_CARD_ICONS;

function DocsCardIcon({ name }: { name: DocsCardIconName }) {
  const Icon = DOCS_CARD_ICONS[name];
  return (
    <span aria-hidden='true' className='docs-card-icon'>
      <Icon weight='fill' />
    </span>
  );
}

function DocsPathGrid({ children }: { children: ReactNode }) {
  return <div className='docs-path-grid not-prose'>{children}</div>;
}

function DocsPathCard({ children, href, icon, index, title }: { children: ReactNode; href: string; icon: DocsCardIconName; index: string; title: string }) {
  return (
    <Link className='docs-path-card' href={href}>
      <span className='docs-card-topline'>
        <DocsCardIcon name={icon} />
        <span className='docs-card-index'>{index}</span>
        <ArrowUpRight aria-hidden='true' className='docs-card-arrow' />
      </span>
      <span className='docs-card-copy'>
        <strong>{title}</strong>
        <span>{children}</span>
      </span>
    </Link>
  );
}

function DocsSystemGrid({ children }: { children: ReactNode }) {
  return <div className='docs-system-grid not-prose'>{children}</div>;
}

function DocsSystemItem({ children, icon, index, title }: { children: ReactNode; icon: DocsCardIconName; index: string; title: string }) {
  return (
    <article className='docs-system-item'>
      <span className='docs-card-topline'>
        <DocsCardIcon name={icon} />
        <span className='docs-card-index'>{index}</span>
      </span>
      <strong>{title}</strong>
      <p>{children}</p>
    </article>
  );
}

function DocsThemeGallery() {
  return (
    <div className='docs-theme-gallery not-prose'>
      <figure>
        <figcaption><span>Studio / Light</span><small>1600 × 900</small></figcaption>
        <Image alt='General Translation moodboard in Glyphfield Studio light mode' height={900} src='/screenshots/studio-gt-moodboard-light-2026.png' width={1600} />
      </figure>
      <figure>
        <figcaption><span>Studio / Dark</span><small>1600 × 900</small></figcaption>
        <Image alt='General Translation moodboard in Glyphfield Studio dark mode' height={900} src='/screenshots/studio-gt-moodboard-dark-2026.png' width={1600} />
      </figure>
    </div>
  );
}

function DocsMedia({
  alt,
  caption,
  height = 900,
  meta,
  src,
  width = 1600,
}: DocsMediaProps) {
  return (
    <figure className='docs-media not-prose'>
      <div className='docs-media__frame'>
        <Image
          alt={alt}
          height={height}
          src={src}
          unoptimized={src.toLocaleLowerCase().endsWith('.gif')}
          width={width}
        />
      </div>
      <figcaption>
        <span>{caption}</span>
        {meta ? <small>{meta}</small> : null}
      </figcaption>
    </figure>
  );
}

function DocsMediaGrid({ children }: { children: ReactNode }) {
  return <div className='docs-media-grid not-prose'>{children}</div>;
}

function DocsFeatureGrid({ children }: { children: ReactNode }) {
  return <div className='docs-feature-grid not-prose'>{children}</div>;
}

function DocsFeature({ children, icon, label, title }: { children: ReactNode; icon: DocsCardIconName; label: string; title: string }) {
  return (
    <article className='docs-feature'>
      <span className='docs-feature-kicker'>
        <DocsCardIcon name={icon} />
        <span>{label}</span>
      </span>
      <strong>{title}</strong>
      <p>{children}</p>
    </article>
  );
}

export function getDocsMdxComponents(components?: MDXComponents): MDXComponents {
  return {
    ...(defaultMdxComponents as unknown as MDXComponents),
    DocsPathCard,
    DocsPathGrid,
    DocsFeature,
    DocsFeatureGrid,
    DocsMedia,
    DocsMediaGrid,
    DocsSystemGrid,
    DocsSystemItem,
    DocsThemeGallery,
    ...components,
  } as unknown as MDXComponents;
}
