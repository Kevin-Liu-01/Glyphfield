import { ImageResponse } from 'next/og';

import BrandOpenGraphImage, {
  STUDIO_OPEN_GRAPH_ALT,
  STUDIO_OPEN_GRAPH_CARD,
  TWITTER_IMAGE_SIZE,
  getBrandOpenGraphFonts,
  getStudioScreenshot,
} from '@/components/BrandOpenGraphImage';

export const alt = STUDIO_OPEN_GRAPH_ALT;
export const contentType = 'image/png';
export const runtime = 'nodejs';
export const size = TWITTER_IMAGE_SIZE;

export default async function TwitterImage() {
  const [fonts, screenshot] = await Promise.all([getBrandOpenGraphFonts(), getStudioScreenshot()]);
  return new ImageResponse(
    <BrandOpenGraphImage {...STUDIO_OPEN_GRAPH_CARD} height={size.height} screenshot={screenshot} />,
    { ...size, fonts }
  );
}
