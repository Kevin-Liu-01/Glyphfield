import { ImageResponse } from 'next/og';

import BrandOpenGraphImage, { OPEN_GRAPH_SIZE } from '@/components/BrandOpenGraphImage';
import { getOpenGraphFonts } from '@/lib/openGraphFonts';
import { PRODUCT_BRAND } from '@/lib/productBrand';

export const revalidate = false;
export const runtime = 'nodejs';

export async function GET() {
  return new ImageResponse(
    <BrandOpenGraphImage
      accent='#6f5cff'
      description={PRODUCT_BRAND.description}
      index='01'
      kicker='Identity systems'
      title='One brand studio for every surface.'
    />,
    { ...OPEN_GRAPH_SIZE, fonts: await getOpenGraphFonts() }
  );
}
