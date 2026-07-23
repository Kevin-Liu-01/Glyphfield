import { ImageResponse } from 'next/og';

import BrandOpenGraphImage, { OPEN_GRAPH_SIZE } from '@/components/BrandOpenGraphImage';
import { PRODUCT_BRAND } from '@/lib/productBrand';

export const alt = 'Glyphfield — one brand studio for every surface';
export const contentType = 'image/png';
export const size = OPEN_GRAPH_SIZE;

export default function OpenGraphImage() {
  return new ImageResponse(
    <BrandOpenGraphImage
      accent='#8b5cf6'
      description={PRODUCT_BRAND.description}
      index='01'
      kicker='Identity systems'
      title='One brand studio for every surface.'
    />,
    size
  );
}
