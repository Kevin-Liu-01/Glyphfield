import { auditBrandHealth } from './brandHealth';
import { normalizeBrandIdentity, type BrandIdentity } from './brandIdentity';
import { brandKitTextFile } from './brandKit';
import {
  BRAND_IDENTITY_PATCH_SCHEMA,
  BRAND_IDENTITY_SOURCE_SCHEMA,
  BRAND_LOGO_SLOTS,
  BRAND_SOURCE_MERGE_RULES,
  BRAND_SOURCE_SCHEMA_VERSION,
  validateBrandIdentitySource,
  type BrandSourceIssue,
} from './brandSource';

/**
 * Stateless brand HTTP contracts. Nothing is persisted and nothing is fetched:
 * file paths must already be data: URLs or paths on this origin, matching the
 * /api/generate rules. Unknown top-level request fields are rejected.
 */
export const BRAND_API_MAX_REQUEST_BYTES = 5_250_000;
const KIT_TEXT_FORMATS = ['dtcg', 'css', 'tailwind', 'markdown'] as const;
type BrandKitTextFormat = (typeof KIT_TEXT_FORMATS)[number];

export class BrandApiError extends Error {
  readonly code: string;
  readonly field: string;
  readonly status: number;

  constructor(message: string, field: string, code = 'invalid_request', status = 400) {
    super(message);
    this.code = code;
    this.field = field;
    this.name = 'BrandApiError';
    this.status = status;
  }
}

const VALIDATE_EXAMPLE = {
  identity: {
    colors: [{ hex: '#0B0B0C', id: 'ink' }, { hex: '#C6FF3D', id: 'emphasis', name: 'Signal lime', proportion: 10, role: 'Primary action and focus' }],
    tagline: 'Fast, careful tools for small teams.',
    voice: { examples: [{ avoid: 'Oops! Something went wrong.', context: 'Error message', write: 'That did not save. Check your connection and try again.' }] },
  },
  mode: 'patch',
} as const;

export const BRAND_VALIDATE_CONTRACT = {
  description: 'Validate and normalize BrandIdentity source without persisting it. A full identity also returns its brand health audit. Apply the result in the browser with identity.apply.',
  endpoint: '/api/brand/validate',
  example: VALIDATE_EXAMPLE,
  logoSlots: BRAND_LOGO_SLOTS,
  maximumRequestBytes: BRAND_API_MAX_REQUEST_BYTES,
  mergeRules: BRAND_SOURCE_MERGE_RULES,
  method: 'POST',
  patchSchema: BRAND_IDENTITY_PATCH_SCHEMA,
  request: {
    identity: 'A complete BrandIdentity (mode full) or a merge patch (mode patch).',
    mode: 'full | patch; defaults to full',
  },
  response: {
    health: 'Brand health report for a valid full identity, otherwise null',
    identity: 'Normalized identity for a valid full identity, otherwise null',
    issues: '[{ code, message, path, severity }]',
    ok: 'true when there are no errors; warnings do not fail validation',
  },
  schema: BRAND_IDENTITY_SOURCE_SCHEMA,
  schemaVersion: BRAND_SOURCE_SCHEMA_VERSION,
} as const;

export const BRAND_KIT_CONTRACT = {
  description: 'Render one brand kit text file from a complete identity: W3C DTCG tokens, CSS custom properties, a Tailwind CSS v4 @theme block or brand.md for coding agents. The ZIP, logo pack and font files are produced in the browser by identity.export.kit.',
  endpoint: '/api/brand/kit',
  formats: {
    css: 'text/css; --brand-* custom properties',
    dtcg: 'application/json; W3C Design Tokens (2025.10)',
    markdown: 'text/markdown; brand.md guidelines for coding agents',
    tailwind: 'text/css; Tailwind CSS v4 @theme block',
  },
  maximumRequestBytes: BRAND_API_MAX_REQUEST_BYTES,
  method: 'POST',
  request: { format: KIT_TEXT_FORMATS.join(' | '), identity: 'A complete, valid BrandIdentity' },
} as const;

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BrandApiError(`${field} must be a JSON object.`, field);
  }
  return value as Record<string, unknown>;
}

function assertFields(body: Record<string, unknown>, allowed: readonly string[]) {
  const unknown = Object.keys(body).filter((key) => !allowed.includes(key)).sort()[0];
  if (unknown) throw new BrandApiError(`${unknown} is not part of this request; send ${allowed.join(', ')}.`, unknown, 'unknown_field');
}

export type BrandValidationResponse = {
  health: ReturnType<typeof auditBrandHealth> | null;
  identity: BrandIdentity | null;
  issues: BrandSourceIssue[];
  ok: boolean;
  schemaVersion: typeof BRAND_SOURCE_SCHEMA_VERSION;
};

export function validateBrandRequest(input: unknown): BrandValidationResponse {
  const body = record(input, 'request');
  assertFields(body, ['identity', 'mode']);
  if (body.identity === undefined) throw new BrandApiError('identity is required.', 'identity');
  const mode = body.mode ?? 'full';
  if (mode !== 'full' && mode !== 'patch') throw new BrandApiError('mode must be full or patch.', 'mode');
  const { issues, ok } = validateBrandIdentitySource(body.identity, mode);
  const identity = ok && mode === 'full' ? normalizeBrandIdentity(body.identity as BrandIdentity) : null;
  return {
    health: identity ? auditBrandHealth(identity) : null,
    identity,
    issues,
    ok,
    schemaVersion: BRAND_SOURCE_SCHEMA_VERSION,
  };
}

export function renderBrandKitRequest(input: unknown): { content: string; filename: string; mimeType: string } {
  const body = record(input, 'request');
  assertFields(body, ['format', 'identity']);
  const format = body.format;
  if (typeof format !== 'string' || !(KIT_TEXT_FORMATS as readonly string[]).includes(format)) {
    throw new BrandApiError(`format must be one of ${KIT_TEXT_FORMATS.join(', ')}.`, 'format');
  }
  const { issues, ok } = validateBrandIdentitySource(body.identity, 'full');
  if (!ok) {
    const first = issues.find(({ severity }) => severity === 'error')!;
    throw new BrandApiError(`identity is not valid: ${first.message} Validate with POST /api/brand/validate first.`, `identity.${first.path}`, 'invalid_identity');
  }
  const file = brandKitTextFile(normalizeBrandIdentity(body.identity as BrandIdentity), format as BrandKitTextFormat);
  return {
    content: new TextDecoder().decode(file.bytes),
    filename: file.name.split('/').pop()!,
    mimeType: file.mimeType,
  };
}

/** Parse a JSON request with the same media-type and size rules as /api/generate. */
export async function readBrandJsonRequest(request: Request): Promise<unknown> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLocaleLowerCase().includes('application/json')) {
    throw new BrandApiError('Content-Type must be application/json.', 'Content-Type', 'unsupported_media_type', 415);
  }
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declared) && declared > BRAND_API_MAX_REQUEST_BYTES) {
    throw new BrandApiError('The request body must not exceed 5 MB. Validate embedded files in the browser with identity.validate.', 'request', 'request_too_large', 413);
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > BRAND_API_MAX_REQUEST_BYTES) {
    throw new BrandApiError('The request body must not exceed 5 MB. Validate embedded files in the browser with identity.validate.', 'request', 'request_too_large', 413);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new BrandApiError('The request body must be valid JSON.', 'request', 'invalid_json');
  }
}

export function brandApiErrorBody(error: unknown): { body: { error: { code: string; field: string; message: string }; schemaVersion: 1 }; status: number } {
  if (error instanceof BrandApiError) {
    return { body: { error: { code: error.code, field: error.field, message: error.message }, schemaVersion: 1 }, status: error.status };
  }
  return { body: { error: { code: 'brand_request_failed', field: 'request', message: 'Glyphfield could not process this brand request.' }, schemaVersion: 1 }, status: 500 };
}
