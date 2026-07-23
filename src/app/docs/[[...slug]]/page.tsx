import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from 'fumadocs-ui/layouts/docs/page';
import { notFound } from 'next/navigation';

import type { Metadata } from 'next';

import { getDocsMdxComponents } from '@/components/DocsMdx';
import { docsSource, getDocumentationImage } from '@/lib/docsSource';
import { PRODUCT_BRAND } from '@/lib/productBrand';

type DocumentationPageProps = {
  params: Promise<{ slug?: string[] }>;
};

export default async function DocumentationPage({ params }: DocumentationPageProps) {
  const { slug } = await params;
  const page = docsSource.getPage(slug);
  if (!page) notFound();

  const Content = page.data.body;

  return (
    <DocsPage toc={page.data.toc}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <Content components={getDocsMdxComponents()} />
      </DocsBody>
    </DocsPage>
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
    description: page.data.description,
    openGraph: {
      description: page.data.description,
      images: [{ ...image, alt: `${page.data.title} — ${PRODUCT_BRAND.name} documentation` }],
      title,
      type: 'article',
    },
    title,
    twitter: {
      card: 'summary_large_image',
      description: page.data.description,
      images: [image.url],
      title,
    },
  };
}
