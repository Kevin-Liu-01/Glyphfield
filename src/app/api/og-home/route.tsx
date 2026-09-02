import { ImageResponse } from 'next/og';

import BrandOpenGraphImage from '@/components/BrandOpenGraphImage';
import { OPEN_GRAPH_SIZE } from '@/lib/openGraph';
import { getOpenGraphFonts } from '@/lib/openGraphFonts';

export const revalidate = false;
export const runtime = 'nodejs';

export async function GET() {
  return new ImageResponse(
    <BrandOpenGraphImage
      accent='#7058FF'
      description='Build identity, motion, graphics, and production-ready assets in one connected workspace.'
      highlightedTitle='the whole brand'
      title='One studio for the whole brand.'
      url='glyphfield.com'
    />,
    { ...OPEN_GRAPH_SIZE, fonts: await getOpenGraphFonts() }
  );
}
