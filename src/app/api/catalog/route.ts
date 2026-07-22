import { STUDIO_CATEGORIES, STUDIO_TOOLS } from '@/lib/studioCatalog';
import { PRODUCT_BRAND } from '@/lib/productBrand';

export function GET() {
  return Response.json({
    categories: STUDIO_CATEGORIES,
    license: {
      grant: 'inspection, evaluation, and automated indexing only',
      identifier: 'All Rights Reserved',
      sourceAvailable: true,
    },
    localOnly: true,
    name: PRODUCT_BRAND.name,
    resources: {
      elements: '/api/elements',
      identities: '/api/identities',
      instructions: '/llms.txt',
      workspace: '/studio',
    },
    tools: STUDIO_TOOLS,
    version: '0.1.0',
  });
}
