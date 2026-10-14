import { ImageResponse } from 'next/og';

import BrandOpenGraphImage, {
  HOME_OPEN_GRAPH_CARD,
  OPEN_GRAPH_IMAGE_SIZE,
  getBrandOpenGraphFonts,
} from '@/components/BrandOpenGraphImage';

export const revalidate = false;
export const runtime = 'nodejs';

export async function GET() {
  return new ImageResponse(
    <BrandOpenGraphImage {...HOME_OPEN_GRAPH_CARD} />,
    { ...OPEN_GRAPH_IMAGE_SIZE, fonts: await getBrandOpenGraphFonts() }
  );
}
