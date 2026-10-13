import { AGENT_CORS_HEADERS } from '@/lib/agentApi';
import {
  BRAND_VALIDATE_CONTRACT,
  brandApiErrorBody,
  readBrandJsonRequest,
  validateBrandRequest,
} from '@/lib/brandApi';

export const runtime = 'nodejs';

export function GET() {
  return Response.json(BRAND_VALIDATE_CONTRACT, {
    headers: { ...AGENT_CORS_HEADERS, 'Cache-Control': 'public, max-age=300' },
  });
}

export function OPTIONS() {
  return new Response(null, { headers: AGENT_CORS_HEADERS, status: 204 });
}

export async function POST(request: Request) {
  try {
    return Response.json(validateBrandRequest(await readBrandJsonRequest(request)), {
      headers: { ...AGENT_CORS_HEADERS, 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const { body, status } = brandApiErrorBody(error);
    return Response.json(body, { headers: AGENT_CORS_HEADERS, status });
  }
}
