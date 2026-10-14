import { ImageResponse } from 'next/og';

import BrandOpenGraphImage, {
  OPEN_GRAPH_IMAGE_SIZE,
  STUDIO_OPEN_GRAPH_ALT,
  STUDIO_OPEN_GRAPH_CARD,
  getBrandOpenGraphFonts,
  getStudioScreenshot,
} from '@/components/BrandOpenGraphImage';

export const alt = STUDIO_OPEN_GRAPH_ALT;
export const contentType = 'image/png';
export const runtime = 'nodejs';
export const size = OPEN_GRAPH_IMAGE_SIZE;

export default async function OpenGraphImage() {
  const [fonts, screenshot] = await Promise.all([getBrandOpenGraphFonts(), getStudioScreenshot()]);
  return new ImageResponse(
    <BrandOpenGraphImage {...STUDIO_OPEN_GRAPH_CARD} height={size.height} screenshot={screenshot} />,
    { ...size, fonts }
  );
}
