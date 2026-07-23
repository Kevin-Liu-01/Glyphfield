import { notFound } from 'next/navigation';
import { ImageResponse } from 'next/og';

import BrandOpenGraphImage, { OPEN_GRAPH_SIZE } from '@/components/BrandOpenGraphImage';
import { docsSource } from '@/lib/docsSource';

type DocumentationImageRouteProps = {
  params: Promise<{ slug: string[] }>;
};

export const revalidate = false;

export async function GET(_request: Request, { params }: DocumentationImageRouteProps) {
  const { slug } = await params;
  const page = docsSource.getPage(slug.slice(0, -1));
  if (!page) notFound();

  return new ImageResponse(
    <BrandOpenGraphImage
      accent='#a7f35a'
      description={page.data.description ?? 'Learn how to build and operate a connected brand system with Glyphfield.'}
      index='DOC'
      kicker='Documentation'
      title={page.data.title}
    />,
    OPEN_GRAPH_SIZE
  );
}

export function generateStaticParams() {
  return docsSource.getPages().map((page) => ({
    slug: [...page.slugs, 'image.png'],
  }));
}
