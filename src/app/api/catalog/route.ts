import { AGENT_CORS_HEADERS } from '@/lib/agentApi';
import { AGENT_LAB_CATALOG, AGENT_SHADER_LIBRARY } from '@/lib/agentCatalog';
import { STUDIO_CATEGORIES, STUDIO_TOOLS } from '@/lib/studioCatalog';
import { PRODUCT_BRAND } from '@/lib/productBrand';

export function GET() {
  return Response.json(
    {
      categories: STUDIO_CATEGORIES,
      license: {
        identifier: 'MIT',
        serviceUse: 'browsing and artifact generation permitted',
        sourceGrant: 'use, copy, modify, merge, publish, distribute, sublicense, and sell',
        sourceAvailable: true,
        url: 'https://opensource.org/license/mit',
      },
      browserStudioLocalFiles: true,
      counts: {
        labPlugins: AGENT_LAB_CATALOG.count,
        shaders: AGENT_SHADER_LIBRARY.count,
      },
      labPlugins: AGENT_LAB_CATALOG.plugins,
      localOnly: false,
      name: PRODUCT_BRAND.name,
      resources: {
        agent: '/api/agent',
        docs: '/docs',
        elements: '/api/elements',
        generate: '/api/generate',
        identities: '/api/identities',
        instructions: '/llms.txt',
        integrationGuide: '/docs/agents/connect',
        labs: '/api/labs',
        materials: '/api/materials',
        openapi: '/openapi.json',
        workspace: '/studio',
      },
      shaderLibrary: AGENT_SHADER_LIBRARY,
      tools: STUDIO_TOOLS,
      version: '0.2.0',
    },
    { headers: AGENT_CORS_HEADERS }
  );
}
