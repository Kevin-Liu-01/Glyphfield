import StudioApp from '@/components/StudioApp';
import { SITE_URL, absoluteUrl, serializeJsonLd } from '@/lib/seo';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: {
    canonical: '/studio',
  },
  description:
    'Build, tune, and export motion, graphics, templates, and brand applications from one connected identity.',
  openGraph: {
    description:
      'Build, tune, and export motion, graphics, templates, and brand applications from one connected identity.',
    title: 'Studio',
    url: '/studio',
  },
  title: 'Studio',
  twitter: {
    card: 'summary_large_image',
    description:
      'Build, tune, and export motion, graphics, templates, and brand applications from one connected identity.',
    title: 'Glyphfield Studio',
  },
};

export default function StudioPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@id': `${SITE_URL}/#software`,
    '@type': 'SoftwareApplication',
    applicationCategory: 'DesignApplication',
    browserRequirements: 'Requires JavaScript and a modern web browser',
    description:
      'Build, tune, and export motion, graphics, templates, and brand applications from one connected identity.',
    isAccessibleForFree: true,
    name: 'Glyphfield Studio',
    operatingSystem: 'Any',
    url: absoluteUrl('/studio'),
  };

  return (
    <>
      <script
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
        type='application/ld+json'
      />
      <StudioApp />
    </>
  );
}
