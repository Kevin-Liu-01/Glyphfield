import { notFound } from 'next/navigation';
import { ImageResponse } from 'next/og';

import BrandOpenGraphImage, { OPEN_GRAPH_SIZE } from '@/components/BrandOpenGraphImage';
import { docsSource } from '@/lib/docsSource';
import { getOpenGraphFonts } from '@/lib/openGraphFonts';

type DocumentationImageRouteProps = {
  params: Promise<{ slug: string[] }>;
};

export const revalidate = false;
export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: DocumentationImageRouteProps) {
  const { slug } = await params;
  const page = docsSource.getPage(slug.slice(0, -1));
  if (!page) notFound();

  return new ImageResponse(
    <BrandOpenGraphImage
      accent='#C8C0FF'
      description={page.data.description ?? 'Learn how to build and operate a connected brand system with Glyphfield.'}
      title={page.data.title}
      url={`glyphfield.com/docs/${slug.slice(0, -1).join('/')}`}
    />,
    { ...OPEN_GRAPH_SIZE, fonts: await getOpenGraphFonts() }
  );
}

export function generateStaticParams() {
  return docsSource.getPages().map((page) => ({
    slug: [...page.slugs, 'image.png'],
  }));
}
