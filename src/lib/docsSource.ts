import { docs } from 'collections/server';
import { loader } from 'fumadocs-core/source';
import { lucideIconsPlugin } from 'fumadocs-core/source/lucide-icons';

export const docsSource = loader({
  baseUrl: '/docs',
  plugins: [lucideIconsPlugin()],
  source: docs.toFumadocsSource(),
});
