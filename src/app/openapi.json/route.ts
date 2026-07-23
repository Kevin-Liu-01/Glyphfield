import { AGENT_CORS_HEADERS, OPENAPI_DOCUMENT } from '@/lib/agentApi';

export function GET() {
  return Response.json(OPENAPI_DOCUMENT, {
    headers: {
      ...AGENT_CORS_HEADERS,
      'Cache-Control': 'public, max-age=300',
    },
  });
}
