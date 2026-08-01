import { AGENT_CORS_HEADERS } from '@/lib/agentApi';
import { AGENT_LAB_CATALOG } from '@/lib/agentCatalog';

export function GET() {
  return Response.json(AGENT_LAB_CATALOG, {
    headers: {
      ...AGENT_CORS_HEADERS,
      'Cache-Control': 'public, max-age=300',
    },
  });
}
