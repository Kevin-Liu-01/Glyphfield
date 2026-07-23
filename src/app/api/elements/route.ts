import {
  BRAND_ELEMENT_CATEGORIES,
  BRAND_ELEMENTS,
} from '@/lib/brandElements';
import { AGENT_CORS_HEADERS } from '@/lib/agentApi';

export function GET() {
  return Response.json(
    {
      categories: BRAND_ELEMENT_CATEGORIES,
      count: BRAND_ELEMENTS.length,
      elements: BRAND_ELEMENTS,
      generation: {
        endpoint: '/api/generate',
        kind: 'element-brief',
        requestKey: 'elementId',
      },
      schemaVersion: 1,
    },
    { headers: AGENT_CORS_HEADERS }
  );
}
