import { AGENT_CORS_HEADERS } from '@/lib/agentApi';
import { AGENT_SHADER_LIBRARY } from '@/lib/agentCatalog';

export function GET() {
  return Response.json(AGENT_SHADER_LIBRARY, {
    headers: {
      ...AGENT_CORS_HEADERS,
      'Cache-Control': 'public, max-age=300',
    },
  });
}
