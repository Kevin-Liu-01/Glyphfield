import { AGENT_CORS_HEADERS } from '@/lib/agentApi';
import {
  BRAND_KIT_CONTRACT,
  brandApiErrorBody,
  readBrandJsonRequest,
  renderBrandKitRequest,
} from '@/lib/brandApi';

export const runtime = 'nodejs';

export function GET() {
  return Response.json(BRAND_KIT_CONTRACT, {
    headers: { ...AGENT_CORS_HEADERS, 'Cache-Control': 'public, max-age=300' },
  });
}

export function OPTIONS() {
  return new Response(null, { headers: AGENT_CORS_HEADERS, status: 204 });
}

export async function POST(request: Request) {
  try {
    const file = renderBrandKitRequest(await readBrandJsonRequest(request));
    return new Response(file.content, {
      headers: {
        ...AGENT_CORS_HEADERS,
        'Cache-Control': 'no-store',
        'Content-Disposition': `inline; filename="${file.filename}"`,
        'Content-Type': `${file.mimeType}; charset=utf-8`,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    const { body, status } = brandApiErrorBody(error);
    return Response.json(body, { headers: AGENT_CORS_HEADERS, status });
  }
}
