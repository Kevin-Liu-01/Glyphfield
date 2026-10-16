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
        purpose: 'any',
        sizes: '192x192',
        src: '/icon-192.png',
        type: 'image/png',
      },
      {
        purpose: 'any',
        sizes: '512x512',
        src: '/icon-512.png',
        type: 'image/png',
      },
      // The mark scaled into the maskable safe zone, so a round or squircle mask keeps all of it.
      {
        purpose: 'maskable',
        sizes: '512x512',
        src: '/icon-maskable-512.png',
        type: 'image/png',
      },
    ],
    id: '/',
    name: 'Glyphfield Brand Studio',
    orientation: 'any',
    short_name: 'Glyphfield',
    start_url: '/studio',
    theme_color: '#121212',
  };
}
