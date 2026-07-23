import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

import {
  AGENT_CORS_HEADERS,
  AGENT_GENERATION_CONTRACT,
} from '@/lib/agentApi';
import {
  AgentGenerationError,
  agentAssetPaths,
  planAgentGeneration,
  renderAgentGeneration,
  type AgentArtifact,
} from '@/lib/agentGeneration';

export const runtime = 'nodejs';

const MAXIMUM_REQUEST_BYTES = 5_250_000;

function assetMimeType(path: string): string {
  const extension = extname(path).toLocaleLowerCase();
  if (extension === '.svg') return 'image/svg+xml';
  if (extension === '.png') return 'image/png';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.gif') return 'image/gif';
  if (extension === '.webp') return 'image/webp';
  throw new AgentGenerationError('A bundled asset has an unsupported format.', 'asset');
}

async function publicAssetDataUrl(path: string): Promise<string> {
  if (!path.startsWith('/') || path.includes('..')) {
    throw new AgentGenerationError('A bundled asset path is invalid.', 'asset');
  }
  const contents = await readFile(join(process.cwd(), 'public', path.slice(1)));
  return `data:${assetMimeType(path)};base64,${contents.toString('base64')}`;
}

function errorResponse(error: unknown): Response {
  if (error instanceof AgentGenerationError) {
    return Response.json(
      {
        error: {
          code: error.code,
          field: error.field,
          message: error.message,
        },
        schemaVersion: 1,
      },
      { headers: AGENT_CORS_HEADERS, status: error.status }
    );
  }

  if (error instanceof SyntaxError) {
    return Response.json(
      {
        error: {
          code: 'invalid_json',
          field: 'request',
          message: 'The request body must be valid JSON.',
        },
        schemaVersion: 1,
      },
      { headers: AGENT_CORS_HEADERS, status: 400 }
    );
  }

  return Response.json(
    {
      error: {
        code: 'generation_failed',
        field: 'request',
        message: 'Glyphfield could not generate this artifact.',
      },
      schemaVersion: 1,
    },
    { headers: AGENT_CORS_HEADERS, status: 500 }
  );
}

function artifactResponse(artifact: AgentArtifact): Response {
  if (artifact.mimeType === 'application/json') {
    return new Response(artifact.content, {
      headers: {
        ...AGENT_CORS_HEADERS,
        'Cache-Control': 'no-store',
        'Content-Disposition': `inline; filename="${artifact.filename}"`,
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
  }

  if (artifact.output === 'raw') {
    return new Response(artifact.content, {
      headers: {
        ...AGENT_CORS_HEADERS,
        'Cache-Control': 'no-store',
        'Content-Disposition': `inline; filename="${artifact.filename}"`,
        'Content-Type': 'image/svg+xml; charset=utf-8',
      },
    });
  }

  return Response.json(
    {
      artifact: {
        content: artifact.content,
        filename: artifact.filename,
        height: artifact.height,
        mimeType: artifact.mimeType,
        width: artifact.width,
      },
      schemaVersion: 1,
    },
    {
      headers: {
        ...AGENT_CORS_HEADERS,
        'Cache-Control': 'no-store',
      },
    }
  );
}

export function GET() {
  return Response.json(AGENT_GENERATION_CONTRACT, {
    headers: {
      ...AGENT_CORS_HEADERS,
      'Cache-Control': 'public, max-age=300',
    },
  });
}

export function OPTIONS() {
  return new Response(null, { headers: AGENT_CORS_HEADERS, status: 204 });
}

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLocaleLowerCase().includes('application/json')) {
    return Response.json(
      {
        error: {
          code: 'unsupported_media_type',
          field: 'Content-Type',
          message: 'Content-Type must be application/json.',
        },
        schemaVersion: 1,
      },
      { headers: AGENT_CORS_HEADERS, status: 415 }
    );
  }
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAXIMUM_REQUEST_BYTES) {
    return Response.json(
      {
        error: {
          code: 'request_too_large',
          field: 'request',
          message: 'The request body must not exceed 5 MB.',
        },
        schemaVersion: 1,
      },
      { headers: AGENT_CORS_HEADERS, status: 413 }
    );
  }

  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, 'utf8') > MAXIMUM_REQUEST_BYTES) {
      return Response.json(
        {
          error: {
            code: 'request_too_large',
            field: 'request',
            message: 'The request body must not exceed 5 MB.',
          },
          schemaVersion: 1,
        },
        { headers: AGENT_CORS_HEADERS, status: 413 }
      );
    }
    const plan = planAgentGeneration(JSON.parse(rawBody));
    const paths = agentAssetPaths(plan);
    const entries = await Promise.all(
      paths.map(async (path) => [path, await publicAssetDataUrl(path)] as const)
    );
    return artifactResponse(renderAgentGeneration(plan, Object.fromEntries(entries)));
  } catch (error) {
    return errorResponse(error);
  }
}
