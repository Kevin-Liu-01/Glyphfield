import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from 'fumadocs-ui/layouts/docs/page';
import { notFound } from 'next/navigation';

import type { Metadata } from 'next';

import { getDocsMdxComponents } from '@/components/DocsMdx';
import DocsPageActions from '@/components/DocsPageActions';
import { AlertCircle, ArrowUpRight, FilePenLine } from '@/components/ui/SolidIcons';
import { docsPageLastModified, docsSections } from '@/lib/docsSeo';
import { docsSource, getDocumentationImage } from '@/lib/docsSource';
import { PRODUCT_BRAND } from '@/lib/productBrand';
import {
  docsPageJsonLd,
  docsPageMetadata,
  serializeJsonLd,
  type DocsPageSeoInput,
} from '@/lib/seo';

type DocumentationPageProps = {
  params: Promise<{ slug?: string[] }>;
};

export default async function DocumentationPage({ params }: DocumentationPageProps) {
  const { slug } = await params;
  const page = docsSource.getPage(slug);
  if (!page) notFound();

  const Content = page.data.body;
  const markdownUrl = `${page.url}.md`;
  const sourcePath = page.data.info.path.replaceAll('\\', '/');
  const sourceUrl = `${PRODUCT_BRAND.repository.url}/blob/main/content/docs/${sourcePath}`;
  const issueUrl = `${PRODUCT_BRAND.repository.url}/issues/new?${new URLSearchParams({
    title: `Docs: ${page.data.title}`,
  })}`;
  const lastModifiedValue = page.data._exports.lastModified;
  const lastModified = lastModifiedValue instanceof Date
    ? lastModifiedValue
    : typeof lastModifiedValue === 'string' || typeof lastModifiedValue === 'number'
      ? new Date(lastModifiedValue)
      : null;
  const lastUpdatedLabel = lastModified && !Number.isNaN(lastModified.getTime())
    ? new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
      year: 'numeric',
    }).format(lastModified)
    : null;
  const jsonLd = docsPageJsonLd(docsPageSeoInput(page));

  return (
    <>
      <script
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
        type='application/ld+json'
      />
      <DocsPage
        breadcrumb={{ enabled: false }}
        className='glyphfield-doc-page'
        tableOfContent={{ style: 'clerk' }}
        toc={page.data.toc}
      >
        <header className='glyphfield-doc-page-header'>
          <DocsTitle className='glyphfield-doc-title'>{page.data.title}</DocsTitle>
          <DocsDescription className='glyphfield-doc-description'>{page.data.description}</DocsDescription>
          <div className='glyphfield-doc-page-meta'>
            <span className='glyphfield-doc-page-updated'>
              {lastUpdatedLabel ? `Last updated ${lastUpdatedLabel}` : 'Maintained with source'}
            </span>
            <DocsPageActions
              markdownUrl={markdownUrl}
              sourceUrl={sourceUrl}
            />
          </div>
        </header>
        <DocsBody className='glyphfield-docs-body'>
          <Content components={getDocsMdxComponents()} />
        </DocsBody>
        <nav aria-label='Page feedback' className='glyphfield-doc-footer-actions'>
          <a href={sourceUrl} rel='noreferrer' target='_blank'>
            <FilePenLine aria-hidden='true' />
            Edit this page
            <ArrowUpRight aria-hidden='true' />
          </a>
          <a href={issueUrl} rel='noreferrer' target='_blank'>
            <AlertCircle aria-hidden='true' />
            Report an issue
            <ArrowUpRight aria-hidden='true' />
          </a>
        </nav>
      </DocsPage>
    </>
  );
}

export function generateStaticParams() {
  return docsSource.generateParams();
}

function docsPageSeoInput(page: NonNullable<ReturnType<typeof docsSource.getPage>>): DocsPageSeoInput {
  return {
    dateModified: docsPageLastModified(page),
    description: page.data.description ?? '',
    imageUrl: getDocumentationImage(page).url,
    sections: docsSections(page.url),
    title: page.data.title,
    url: page.url,
  };
}

export async function generateMetadata({ params }: DocumentationPageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = docsSource.getPage(slug);
  if (!page) notFound();

  return docsPageMetadata(docsPageSeoInput(page));
}
