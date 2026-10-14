import { notFound } from 'next/navigation';
import { ImageResponse } from 'next/og';

import BrandOpenGraphImage, { OPEN_GRAPH_IMAGE_SIZE, getBrandOpenGraphFonts } from '@/components/BrandOpenGraphImage';
import { docsSections } from '@/lib/docsSeo';
import { docsSource } from '@/lib/docsSource';

type DocumentationImageRouteProps = {
  params: Promise<{ slug: string[] }>;
};

export const revalidate = false;
export const runtime = 'nodejs';

/** The page title leads; the footer names the sidebar section and the page's address. */
export async function GET(_request: Request, { params }: DocumentationImageRouteProps) {
  const { slug } = await params;
  const page = docsSource.getPage(slug.slice(0, -1));
  if (!page) notFound();

  const sections = docsSections(page.url).map(({ name }) => name);

  return new ImageResponse(
    <BrandOpenGraphImage
      note={sections.length ? sections.join(' · ') : 'Documentation'}
      title={page.data.title}
      url={`glyphfield.com${page.url}`}
    />,
    { ...OPEN_GRAPH_IMAGE_SIZE, fonts: await getBrandOpenGraphFonts() }
  );
}

export function generateStaticParams() {
  return docsSource.getPages().map((page) => ({
    slug: [...page.slugs, 'image.png'],
  }));
}
