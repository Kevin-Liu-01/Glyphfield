import { docs } from 'collections/server';
import { loader } from 'fumadocs-core/source';
import { lucideIconsPlugin } from 'fumadocs-core/source/lucide-icons';

export const docsSource = loader({
  baseUrl: '/docs',
  plugins: [lucideIconsPlugin()],
  source: docs.toFumadocsSource(),
});

export function getDocumentationImage(page: { slugs: string[] }) {
  const segments = [...page.slugs, 'image.png'];

  return {
    height: 630,
    url: `/og/docs/${segments.join('/')}`,
    width: 1200,
  } as const;
}
