import { ImageResponse } from 'next/og';

import BrandOpenGraphImage, { OPEN_GRAPH_SIZE } from '@/components/BrandOpenGraphImage';

export const alt = 'Glyphfield Studio — build the identity, then make everything else';
export const contentType = 'image/png';
export const size = OPEN_GRAPH_SIZE;

export default function OpenGraphImage() {
  return new ImageResponse(
    <BrandOpenGraphImage
      accent='#20d8c7'
      description='Build, tune, and export motion, graphics, templates, and brand applications from one connected identity.'
      index='02'
      kicker='Interactive workspace'
      title='Build the identity. Make everything else.'
    />,
    size
  );
}
