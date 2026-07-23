import { AGENT_CORS_HEADERS } from '@/lib/agentApi';
import { STUDIO_CATEGORIES, STUDIO_TOOLS } from '@/lib/studioCatalog';
import { PRODUCT_BRAND } from '@/lib/productBrand';

export function GET() {
  return Response.json(
    {
      categories: STUDIO_CATEGORIES,
      license: {
        identifier: 'All Rights Reserved',
        serviceUse: 'browsing and artifact generation permitted',
        sourceGrant: 'inspection, evaluation, and automated indexing only',
        sourceAvailable: true,
      },
      browserStudioLocalFiles: true,
      localOnly: false,
      name: PRODUCT_BRAND.name,
      resources: {
        agent: '/api/agent',
        elements: '/api/elements',
        generate: '/api/generate',
        identities: '/api/identities',
        instructions: '/llms.txt',
        openapi: '/openapi.json',
        workspace: '/studio',
      },
      tools: STUDIO_TOOLS,
      version: '0.2.0',
    },
    { headers: AGENT_CORS_HEADERS }
  );
}
