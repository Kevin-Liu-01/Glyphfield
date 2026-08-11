import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from 'fumadocs-ui/layouts/docs/page';
import { notFound } from 'next/navigation';

import type { Metadata } from 'next';

import { getDocsMdxComponents } from '@/components/DocsMdx';
import DocsTocActions from '@/components/DocsTocActions';
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
  const location = page.slugs.length > 0 ? page.slugs.join(' / ') : 'overview';
  const canonicalUrl = absoluteUrl(page.url);
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
        tableOfContent={{ header: <DocsTocActions /> }}
        toc={page.data.toc}
      >
        <header className='glyphfield-doc-page-header'>
          <div className='glyphfield-doc-page-kicker'><span>GLYPHFIELD / DOCS</span><span>{location}</span></div>
          <DocsTitle className='glyphfield-doc-title'>{page.data.title}</DocsTitle>
          <DocsDescription className='glyphfield-doc-description'>{page.data.description}</DocsDescription>
        </header>
        <DocsBody className='glyphfield-docs-body'>
          <Content components={getDocsMdxComponents()} />
        </DocsBody>
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
