import { ImageResponse } from 'next/og';

import BrandOpenGraphImage, {
  HOME_OPEN_GRAPH_ALT,
  HOME_OPEN_GRAPH_CARD,
  TWITTER_IMAGE_SIZE,
  getBrandOpenGraphFonts,
} from '@/components/BrandOpenGraphImage';

export const alt = HOME_OPEN_GRAPH_ALT;
export const contentType = 'image/png';
export const runtime = 'nodejs';
export const size = TWITTER_IMAGE_SIZE;

export default async function TwitterImage() {
  return new ImageResponse(
    <BrandOpenGraphImage {...HOME_OPEN_GRAPH_CARD} height={size.height} />,
    { ...size, fonts: await getBrandOpenGraphFonts() }
  );
}
