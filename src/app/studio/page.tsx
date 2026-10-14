import './studio.css';

import StudioApp from '@/components/StudioApp';
import { PRODUCT_BRAND } from '@/lib/productBrand';
import { STUDIO_DESCRIPTION, STUDIO_TITLE, serializeJsonLd, studioJsonLd } from '@/lib/seo';

import type { Metadata } from 'next';

// The canonical is static, so /studio?tool=... and /studio?project=... all canonicalize to /studio.
export const metadata: Metadata = {
  alternates: {
    canonical: '/studio',
  },
  description: STUDIO_DESCRIPTION,
  openGraph: {
    description: STUDIO_DESCRIPTION,
    locale: 'en_US',
    siteName: PRODUCT_BRAND.name,
    title: STUDIO_TITLE,
    type: 'website',
    url: '/studio',
  },
  title: { absolute: STUDIO_TITLE },
  twitter: {
    card: 'summary_large_image',
    description: STUDIO_DESCRIPTION,
    title: STUDIO_TITLE,
  },
};

export default function StudioPage() {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(studioJsonLd()) }}
        type='application/ld+json'
      />
      <StudioApp />
    </>
  );
}
