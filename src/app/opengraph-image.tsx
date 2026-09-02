import { ImageResponse } from 'next/og';

import BrandOpenGraphImage from '@/components/BrandOpenGraphImage';
import { OPEN_GRAPH_SIZE } from '@/lib/openGraph';
import { getOpenGraphFonts } from '@/lib/openGraphFonts';

export const alt = 'Glyphfield — one studio for the whole brand';
export const contentType = 'image/png';
export const runtime = 'nodejs';
export const size = OPEN_GRAPH_SIZE;

export default async function OpenGraphImage() {
  return new ImageResponse(
    <BrandOpenGraphImage
      accent='#7058FF'
      description='Build identity, motion, graphics, and production-ready assets in one connected workspace.'
      highlightedTitle='the whole brand'
      title='One studio for the whole brand.'
      url='glyphfield.com'
    />,
    { ...size, fonts: await getOpenGraphFonts() }
  );
}
