import { AGENT_CORS_HEADERS } from '@/lib/agentApi';
import { getOpenSurfaceAsset, openSurfaceRemoteMapUrl, type OpenSurfaceMap } from '@/lib/openSurfaceLibrary';

const MAP_TYPES = new Set<OpenSurfaceMap>(['color', 'displacement', 'metalness', 'normal', 'roughness']);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ assetId: string; map: string }> }
) {
  const { assetId, map } = await params;
  const asset = getOpenSurfaceAsset(assetId);
  if (!asset || !MAP_TYPES.has(map as OpenSurfaceMap)) {
    return Response.json(
      { error: 'Unknown open surface map.' },
      { headers: AGENT_CORS_HEADERS, status: 404 }
    );
  }

  const remoteUrl = openSurfaceRemoteMapUrl(asset, map as OpenSurfaceMap);
  if (!remoteUrl) {
    return Response.json(
      { error: 'This material does not include that map.' },
      { headers: AGENT_CORS_HEADERS, status: 404 }
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(remoteUrl, { next: { revalidate: 60 * 60 * 24 * 30 } });
  } catch {
    return Response.json(
      { error: 'The upstream texture could not be reached.' },
      { headers: AGENT_CORS_HEADERS, status: 502 }
    );
  }
  if (!upstream.ok || !upstream.body) {
    return Response.json(
      { error: 'The upstream texture is unavailable.' },
      { headers: AGENT_CORS_HEADERS, status: 502 }
    );
  }

  return new Response(upstream.body, {
    headers: {
      ...AGENT_CORS_HEADERS,
      'Cache-Control': 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800',
      'Content-Type': upstream.headers.get('content-type') ?? 'image/jpeg',
      'X-Surface-License': asset.license,
      'X-Surface-Provider': asset.provider,
    },
  });
}

export function OPTIONS() {
  return new Response(null, { headers: AGENT_CORS_HEADERS, status: 204 });
}
