import { AGENT_CORS_HEADERS, AGENT_MANIFEST } from '@/lib/agentApi';

export function GET() {
  return Response.json(AGENT_MANIFEST, {
    headers: {
      ...AGENT_CORS_HEADERS,
      'Cache-Control': 'public, max-age=300',
    },
  });
}
