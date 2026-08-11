import { ImageResponse } from 'next/og';

import BrandOpenGraphImage, { OPEN_GRAPH_SIZE } from '@/components/BrandOpenGraphImage';
import { getOpenGraphFonts } from '@/lib/openGraphFonts';
import { PRODUCT_BRAND } from '@/lib/productBrand';

export const alt = 'Glyphfield — open-source brand design and motion studio';
export const contentType = 'image/png';
export const runtime = 'nodejs';
export const size = OPEN_GRAPH_SIZE;

export default async function OpenGraphImage() {
  return new ImageResponse(
    <BrandOpenGraphImage
      accent='#8b5cf6'
      description={PRODUCT_BRAND.description}
      highlightedTitle='The whole brand'
      title='One studio for the whole brand.'
    />,
    { ...size, fonts: await getOpenGraphFonts() }
  );
}
