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
import { docsSource, getDocumentationImage } from '@/lib/docsSource';
import { PRODUCT_BRAND } from '@/lib/productBrand';
import { SITE_URL, absoluteUrl, serializeJsonLd } from '@/lib/seo';

type DocumentationPageProps = {
  params: Promise<{ slug?: string[] }>;
};

export default async function DocumentationPage({ params }: DocumentationPageProps) {
  const { slug } = await params;
  const page = docsSource.getPage(slug);
  if (!page) notFound();

  const Content = page.data.body;
  const canonicalUrl = absoluteUrl(page.url);
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
  const image = getDocumentationImage(page);
  const breadcrumbItems = [
    {
      '@type': 'ListItem',
      item: absoluteUrl('/'),
      name: 'Glyphfield',
      position: 1,
    },
    ...(page.url === '/docs'
      ? []
      : [
          {
            '@type': 'ListItem',
            item: absoluteUrl('/docs'),
            name: 'Documentation',
            position: 2,
          },
        ]),
    {
      '@type': 'ListItem',
      item: canonicalUrl,
      name: page.data.title,
      position: page.url === '/docs' ? 2 : 3,
    },
  ];
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TechArticle',
        author: { '@id': `${SITE_URL}/#creator` },
        description: page.data.description,
        headline: page.data.title,
        image: absoluteUrl(image.url),
        inLanguage: 'en-US',
        isPartOf: {
          '@id': `${SITE_URL}/docs#documentation`,
          '@type': 'CreativeWorkSeries',
          name: 'Glyphfield documentation',
          url: absoluteUrl('/docs'),
        },
        mainEntityOfPage: canonicalUrl,
        publisher: { '@id': `${SITE_URL}/#creator` },
        url: canonicalUrl,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbItems,
      },
    ],
  };

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
            <DocsPageActions
              markdownUrl={markdownUrl}
              sourceUrl={sourceUrl}
            />
            <span>{lastUpdatedLabel ? `Last updated ${lastUpdatedLabel}` : 'Maintained with source'}</span>
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

export async function generateMetadata({ params }: DocumentationPageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = docsSource.getPage(slug);
  if (!page) notFound();

  const image = getDocumentationImage(page);
  const title = `${page.data.title} · ${PRODUCT_BRAND.name} Docs`;

  return {
    alternates: {
      canonical: page.url,
      types: {
        'text/markdown': `${page.url}.md`,
      },
    },
    category: 'documentation',
    description: page.data.description,
    openGraph: {
      description: page.data.description,
      images: [{ ...image, alt: `${page.data.title} — ${PRODUCT_BRAND.name} documentation` }],
      title,
      type: 'article',
      url: page.url,
    },
    title: { absolute: title },
    twitter: {
      card: 'summary_large_image',
      description: page.data.description,
      images: [image.url],
      title,
    },
  };
}
