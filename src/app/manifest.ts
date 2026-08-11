import type { MetadataRoute } from 'next';

import { HOME_DESCRIPTION } from '@/lib/seo';

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: '#f8f8f5',
    categories: ['design', 'graphics', 'productivity'],
    description: HOME_DESCRIPTION,
    display: 'standalone',
    icons: [
      {
        purpose: 'any',
        sizes: 'any',
        src: '/icon.svg',
        type: 'image/svg+xml',
      },
      {
        purpose: 'maskable',
        sizes: 'any',
        src: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    id: '/',
    name: 'Glyphfield — Brand Studio',
    orientation: 'any',
    short_name: 'Glyphfield',
    start_url: '/studio',
    theme_color: '#121212',
  };
}
