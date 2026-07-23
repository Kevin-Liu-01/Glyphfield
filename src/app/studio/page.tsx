import StudioApp from '@/components/StudioApp';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  description:
    'Build, tune, and export motion, graphics, templates, and brand applications from one connected identity.',
  openGraph: {
    description:
      'Build, tune, and export motion, graphics, templates, and brand applications from one connected identity.',
    title: 'Studio',
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
  return <StudioApp />;
}
