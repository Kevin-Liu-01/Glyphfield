import {
  normalizeBrandIdentity,
  type BrandIdentity,
} from './brandIdentity';
import { BRAND_TYPE_STEPS } from './brandTokens';
import { parseColorRef, SEMANTIC_COLOR_ROLES } from './colorSystem';

/**
 * The BrandIdentity source contract shared by the Brand identity source drawer,
 * the Browser API (`identity.validate` / `identity.apply`), and the stateless
 * `POST /api/brand/validate` endpoint. One field spec generates both the JSON
 * Schema that agents read and the validator that enforces it.
 */
export const BRAND_SOURCE_SCHEMA_VERSION = 1;

type StringFormat =
  | 'color-id'
  | 'color-ref'
  | 'email'
  | 'hex'
  | 'local-file'
  | 'record-id'
  | 'social-handle'
  | 'web-url';

type FieldSpec =
  | { description?: string; enum?: readonly string[]; format?: StringFormat; kind: 'string'; maxLength: number; minLength?: number }
  | { description?: string; integer?: boolean; kind: 'number'; maximum: number; minimum: number }
  | { description?: string; kind: 'boolean' }
  | { description?: string; items: FieldSpec; kind: 'array'; maxItems: number; mergeKey?: 'id' | 'pair' | 'role' }
  | { description?: string; fields: Readonly<Record<string, FieldSpec>>; kind: 'object'; required?: readonly string[] };

type ObjectSpec = Extract<FieldSpec, { kind: 'object' }>;

const text = (maxLength: number, description?: string, minLength?: number): FieldSpec => ({
  description, kind: 'string', maxLength, minLength,
});
const oneOf = (values: readonly string[], description?: string): FieldSpec => ({
  description, enum: values, kind: 'string', maxLength: 40,
});
const list = (maxItems: number, maxLength: number, description?: string): FieldSpec => ({
  description, items: text(maxLength, undefined, 1), kind: 'array', maxItems,
});
const number = (minimum: number, maximum: number, description?: string, integer = false): FieldSpec => ({
  description, integer, kind: 'number', maximum, minimum,
});
const recordId = (description = 'Stable record ID. Keep it unchanged when editing.'): FieldSpec => ({
  description, format: 'record-id', kind: 'string', maxLength: 120, minLength: 1,
});
const records = (
  item: ObjectSpec,
  maxItems: number,
  description: string,
  mergeKey?: 'id' | 'pair' | 'role'
): FieldSpec => ({ description, items: item, kind: 'array', maxItems, mergeKey });

const MAX_FILE_URL_LENGTH = 7_000_000;
const LONG_TEXT = 2_000;

const ASSET_TYPES = ['background', 'icon', 'image', 'logo', 'motion', 'product', 'proof', 'reference', 'texture'] as const;
const REDISTRIBUTION = ['bundled', 'original', 'research-only', 'url-only'] as const;
const TYPOGRAPHY_ROLES = ['Display', 'Body', 'Accent', 'Code'] as const;

const ASSET_SPEC: ObjectSpec = {
  fields: {
    alt: text(400, 'Alternative text for screen readers.'),
    attribution: text(600),
    focalPoint: {
      fields: { x: number(0, 1), y: number(0, 1) },
      kind: 'object',
      required: ['x', 'y'],
    },
    id: recordId('Stable asset ID. Logo slots: mark-dark (for light surfaces), mark-light (for dark surfaces), wordmark, wordmark-light, mark-mono.'),
    label: text(200, undefined, 1),
    license: text(400),
    path: {
      description: 'A data: URL or a root-relative path served by this Glyphfield origin. Remote http(s) URLs are never fetched; add files with identity.asset.add instead.',
      format: 'local-file',
      kind: 'string',
      maxLength: MAX_FILE_URL_LENGTH,
      minLength: 1,
    },
    redistribution: oneOf(REDISTRIBUTION),
    sourceOwner: text(200),
    sourceUrl: { description: 'Where the asset came from. Recorded only; never fetched.', format: 'web-url', kind: 'string', maxLength: 2_000 },
    surface: oneOf(['light', 'dark', 'any'], 'The surface the asset is designed for: a dark mark sits on light surfaces.'),
    tags: list(24, 60),
    type: oneOf(ASSET_TYPES),
    usage: text(600),
  },
  kind: 'object',
  required: ['id', 'label', 'path', 'surface', 'type'],
};

const COLOR_REF_SPEC: FieldSpec = { format: 'color-ref', kind: 'string', maxLength: 48, minLength: 1 };
const SEMANTIC_ROLE_FIELDS: Record<string, FieldSpec> = Object.fromEntries(
  SEMANTIC_COLOR_ROLES.map(({ id, usage }) => [id, { ...COLOR_REF_SPEC, description: usage }])
);
const TYPE_STEP_NAMES = BRAND_TYPE_STEPS.map(({ name }) => name);

const IDENTITY_SPEC: ObjectSpec = {
  description: 'A complete Glyphfield BrandIdentity. Unknown fields are kept as-is.',
  fields: {
    applications: records({
      fields: {
        category: oneOf(['foundation', 'product', 'marketing', 'editorial', 'social', 'developer', 'event', 'physical']),
        description: text(600, undefined, 1),
        format: text(120, 'Size or format, such as 1600 × 1000 or 1:1 / 4:5.', 1),
        id: recordId(),
        name: text(120, undefined, 1),
      },
      kind: 'object',
      required: ['category', 'description', 'format', 'id', 'name'],
    }, 48, 'Real applications the identity must work across.', 'id'),
    artDirection: {
      fields: {
        moodboard: oneOf(['cinematic-field', 'editorial-evidence', 'knowledge-system', 'modular-proof', 'monochrome-language', 'network-atlas', 'product-spectrum', 'research-wall', 'utility-current']),
        preview: oneOf(['editorial-interruption', 'economic-ledger', 'focus-window', 'knowledge-beam', 'network-horizon', 'programmable-field', 'translation-frame', 'unified-terminal', 'utility-wave']),
        titleMaxLines: number(1, 2, undefined, true),
      },
      kind: 'object',
    },
    assets: records(ASSET_SPEC, 160, 'Logos, backgrounds, textures, imagery, product and reference files.', 'id'),
    audiences: list(24, 200, 'Who the brand addresses.'),
    builtIn: { description: 'Managed by Glyphfield; ignored on apply.', kind: 'boolean' },
    colorPairings: records({
      fields: {
        background: { format: 'color-id', kind: 'string', maxLength: 40, minLength: 1 },
        foreground: { format: 'color-id', kind: 'string', maxLength: 40, minLength: 1 },
        level: oneOf(['AA', 'AA-large'], 'AA needs 4.5:1 for text; AA-large needs 3:1 for large display text and icons.'),
        usage: text(200, undefined, 1),
      },
      kind: 'object',
      required: ['background', 'foreground', 'usage'],
    }, 32, 'Foreground/background color pairs intended for text or icons. Merged by foreground and background.', 'pair'),
    colorSystem: {
      description: 'Semantic light and dark color roles and per-color OKLCH scale settings. Role values are color refs: a colors[].id such as "ink" or one of its scale steps such as "ink.700" (steps 50, 100 … 900, 950). Omitted roles are derived from the palette.',
      fields: {
        dark: { description: 'Role overrides for dark mode.', fields: SEMANTIC_ROLE_FIELDS, kind: 'object' },
        light: { description: 'Role overrides for light mode.', fields: SEMANTIC_ROLE_FIELDS, kind: 'object' },
        scales: records({
          fields: {
            anchor: { description: 'Snap the nearest step to the exact palette HEX (default true).', kind: 'boolean' },
            chroma: number(0, 200, 'Chroma as a percentage of the palette color (default 100).'),
            darkest: number(0, 0.5, 'OKLCH lightness of step 950 (default 0.22).'),
            hueShift: number(-90, 90, 'Hue rotation in degrees from step 50 to step 950 (default 0).'),
            id: { description: 'The colors[].id this scale belongs to.', format: 'color-id', kind: 'string', maxLength: 40, minLength: 1 },
            lightest: number(0.5, 1, 'OKLCH lightness of step 50 (default 0.975).'),
          },
          kind: 'object',
          required: ['id'],
        }, 32, 'Per-color scale settings. Merged by id.', 'id'),
      },
      kind: 'object',
    },
    colors: records({
      fields: {
        hex: { description: 'Six-digit HEX such as #1A2B3C.', format: 'hex', kind: 'string', maxLength: 7, minLength: 7 },
        id: { description: 'Token-safe semantic ID. Glyphfield tools read ink, paper, muted and emphasis; success, warning, progress and error are optional extensions.', format: 'color-id', kind: 'string', maxLength: 40, minLength: 1 },
        name: text(60, undefined, 1),
        proportion: number(0, 100, 'Approximate share of visual space in percent.'),
        role: text(200, 'What the color is for.'),
      },
      kind: 'object',
      required: ['hex', 'id', 'name', 'role'],
    }, 32, 'Semantic colors.', 'id'),
    contactEmail: { format: 'email', kind: 'string', maxLength: 254 },
    customers: list(48, 120, 'Customer or client names the brand publishes. Keep proof statements in proof.'),
    description: text(600),
    dossier: {
      fields: {
        applications: list(24, 200),
        color: text(LONG_TEXT),
        graphicDevice: text(LONG_TEXT),
        imagery: text(LONG_TEXT),
        layout: text(LONG_TEXT),
        logo: text(LONG_TEXT),
        motion: text(LONG_TEXT),
        personality: text(LONG_TEXT),
        premise: text(LONG_TEXT),
        prohibited: list(32, 300, 'Do-not rules.'),
        provenance: text(LONG_TEXT),
        renderingRecipe: list(24, 300),
        typography: text(LONG_TEXT),
      },
      kind: 'object',
    },
    fonts: records({
      fields: {
        family: text(80, undefined, 1),
        fileName: text(200, undefined, 1),
        format: oneOf(['opentype', 'truetype', 'woff', 'woff2']),
        id: recordId(),
        label: text(120, undefined, 1),
        license: text(400, 'License or usage terms, such as OFL-1.1.'),
        path: { description: 'A data: URL or a root-relative path served by this origin. Add font files with identity.font.add.', format: 'local-file', kind: 'string', maxLength: MAX_FILE_URL_LENGTH, minLength: 1 },
        sourceUrl: { format: 'web-url', kind: 'string', maxLength: 2_000 },
        style: oneOf(['italic', 'normal']),
        weight: number(1, 1000),
        weightMax: number(1, 1000),
        weightMin: number(1, 1000),
      },
      kind: 'object',
      required: ['family', 'fileName', 'format', 'id', 'label', 'path', 'style', 'weight'],
    }, 24, 'Font files stored with the identity.', 'id'),
    graphicSystem: {
      fields: {
        composition: text(LONG_TEXT),
        description: text(LONG_TEXT),
        device: text(200, 'The one recognizable graphic device.'),
        imageDirection: text(LONG_TEXT),
        pattern: oneOf(['blocks', 'brackets', 'burst', 'circuit', 'flow', 'grid', 'none', 'orbit', 'rays', 'steps', 'wave']),
        rules: list(24, 300),
      },
      kind: 'object',
    },
    greetings: list(24, 120, 'Short words used by motion and language specimens.'),
    id: recordId('Project ID. Managed by Glyphfield; it cannot be changed on apply.'),
    kind: oneOf(['template', 'example', 'custom'], 'Managed by Glyphfield; ignored on apply.'),
    mission: text(600),
    motion: records({
      fields: {
        curve: text(120, 'CSS easing such as cubic-bezier(0.2, 0.8, 0.2, 1).', 1),
        description: text(600),
        durationMs: number(0, 60_000, undefined, true),
        id: recordId(),
        name: text(120, undefined, 1),
        previewPath: { format: 'local-file', kind: 'string', maxLength: MAX_FILE_URL_LENGTH },
      },
      kind: 'object',
      required: ['curve', 'durationMs', 'id', 'name'],
    }, 24, 'Named motion behaviors.', 'id'),
    name: text(80, undefined, 1),
    positioning: text(600),
    presetFingerprint: text(80, 'Managed by Glyphfield; ignored on apply.'),
    productDetails: records({
      fields: {
        name: text(120, 'A name from products.', 1),
        summary: text(240, 'One plain line that says what the product does.', 1),
      },
      kind: 'object',
      required: ['name', 'summary'],
    }, 48, 'One-line summaries for products. Replaced as a whole.'),
    products: list(48, 200),
    proof: list(48, 200, 'Verifiable proof statements such as published metrics. Customer names go in customers.'),
    proofAssets: records(ASSET_SPEC, 64, 'Customer or partner marks used as proof.', 'id'),
    references: records({
      fields: {
        assetId: recordId(),
        capturedAt: text(40),
        category: oneOf(['campaign', 'concept', 'material', 'motion', 'official']),
        id: recordId(),
        intendedUse: text(600),
        owner: text(200),
        redistribution: oneOf(REDISTRIBUTION),
        sourceUrl: { format: 'web-url', kind: 'string', maxLength: 2_000 },
        status: oneOf(['captured', 'planned', 'reviewed']),
        title: text(200, undefined, 1),
      },
      kind: 'object',
      required: ['category', 'id', 'intendedUse', 'owner', 'redistribution', 'sourceUrl', 'status', 'title'],
    }, 64, 'Research records with provenance.', 'id'),
    revision: number(0, 1_000_000, 'Managed by Glyphfield; ignored on apply.', true),
    samples: {
      description: 'Sample content templates use instead of placeholders. Samples, not claims about real people.',
      fields: {
        actions: list(12, 80, 'Short product actions for command menus, checklists and dialogs, such as "Refund a payment".'),
        code: {
          description: 'A real request, command or snippet from the brand\'s docs.',
          fields: { label: text(120, 'Such as POST /v1/payment_intents.'), snippet: text(1_200) },
          kind: 'object',
        },
        event: {
          fields: { date: text(40), location: text(80), name: text(120), time: text(40) },
          kind: 'object',
        },
        install: text(200, 'The install or getting-started command from the brand\'s docs.'),
        metric: {
          description: 'One dashboard figure, shown as sample interface data.',
          fields: { change: text(120), label: text(80), value: text(40) },
          kind: 'object',
        },
        person: {
          fields: { name: text(80), role: text(120) },
          kind: 'object',
        },
        plans: {
          description: 'Published plans or engagement types. Use the brand\'s own prices; never invent them.',
          items: {
            fields: { features: list(8, 120), name: text(60, undefined, 1), price: text(60, undefined, 1) },
            kind: 'object',
            required: ['features', 'name', 'price'],
          },
          kind: 'array',
          maxItems: 4,
        },
        release: {
          fields: { items: list(6, 160), title: text(160) },
          kind: 'object',
        },
      },
      kind: 'object',
    },
    shortName: text(8, 'The short form the brand uses, such as GT or BSMNT, or the name itself for one-word brands. Shown when no logo is available.', 1),
    socialHandle: { format: 'social-handle', kind: 'string', maxLength: 64 },
    sourceNotes: list(48, 400, 'Where the identity facts came from.'),
    strategy: {
      fields: {
        challenge: text(LONG_TEXT),
        concept: text(LONG_TEXT, 'The central idea.'),
        outcome: text(LONG_TEXT),
        personality: list(12, 80),
        pillars: list(12, 300),
        promise: text(LONG_TEXT),
      },
      kind: 'object',
    },
    style: {
      fields: {
        borderRadius: number(0, 64),
        density: oneOf(['compact', 'comfortable', 'spacious']),
        grid: oneOf(['none', 'dots', 'lines']),
        imageTreatment: oneOf(['natural', 'monochrome', 'duotone']),
        logoScale: number(40, 160),
      },
      kind: 'object',
    },
    tagline: text(200),
    typeScale: {
      description: 'Modular type scale: size = basePx × ratio^step.',
      fields: {
        basePx: number(10, 24),
        ratio: number(1.067, 1.8),
        roleSteps: {
          description: `The scale step each role is set at; omitted roles use Display display, Body body, Accent lead, Code small. Steps: ${TYPE_STEP_NAMES.join(', ')}.`,
          fields: Object.fromEntries(TYPOGRAPHY_ROLES.map((role) => [role, oneOf(TYPE_STEP_NAMES)])),
          kind: 'object',
        },
      },
      kind: 'object',
      required: ['basePx', 'ratio'],
    },
    typography: records({
      fields: {
        family: text(80, undefined, 1),
        fontId: recordId('ID of a fonts[] record that renders this role.'),
        letterSpacing: number(-12, 24, 'Tracking in px.'),
        lineHeight: number(0.7, 2.4),
        opticalSize: number(6, 144, 'Fixed optical size on the opsz axis; omit for automatic optical sizing.'),
        role: oneOf(TYPOGRAPHY_ROLES),
        slant: number(-20, 20, 'Oblique angle in degrees, positive leans right; uses the slnt axis when the font has one.'),
        usage: text(300),
        weight: number(100, 900),
      },
      kind: 'object',
      required: ['family', 'role', 'usage'],
    }, 8, 'One record per role. Merged by role.', 'role'),
    values: list(24, 200),
    voice: {
      fields: {
        avoid: list(32, 300, 'Language to avoid.'),
        examples: records({
          fields: {
            avoid: text(600, 'The off-brand version.'),
            context: text(120, 'Where the copy appears, such as Error message.', 1),
            write: text(600, 'The on-brand version.', 1),
          },
          kind: 'object',
          required: ['context', 'write'],
        }, 24, 'Before/after examples in real contexts. Replaced as a whole.'),
        phrases: list(32, 300, 'Approved phrases.'),
        principles: list(16, 200),
      },
      kind: 'object',
    },
    website: { format: 'web-url', kind: 'string', maxLength: 200 },
  },
  kind: 'object',
  required: ['id', 'name', 'assets', 'colors', 'typography'],
};

const LOCKED_FIELDS = ['builtIn', 'id', 'kind', 'presetFingerprint', 'revision'] as const;
const REMOVABLE_COLLECTIONS = ['applications', 'assets', 'colors', 'fonts', 'motion', 'proofAssets', 'references'] as const;
type RemovableCollection = (typeof REMOVABLE_COLLECTIONS)[number];

const PATTERNS: Record<StringFormat, RegExp> = {
  'color-id': /^[a-z][a-z0-9-]{0,39}$/,
  'color-ref': /^[a-z][a-z0-9-]{0,39}(?:\.(?:50|100|200|300|400|500|600|700|800|900|950))?$/,
  email: /^(?:[^\s@]+@[^\s@]+\.[^\s@]+)?$/,
  hex: /^#[0-9A-Fa-f]{6}$/,
  'local-file': /^(?:$|data:[^,]*,|\/(?!\/))/,
  'record-id': /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/,
  'social-handle': /^(?:@[A-Za-z0-9_.]{1,60})?$/,
  'web-url': /^(?:https?:\/\/\S+|[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(?:\/\S*)?)?$/i,
};

const FORMAT_HINTS: Record<StringFormat, string> = {
  'color-id': 'a token-safe ID such as "ink" or "brand-lime" (lowercase letters, digits and hyphens, starting with a letter)',
  'color-ref': 'a colors[].id such as "ink" or one of its scale steps such as "ink.700"',
  email: 'an email address or an empty string',
  hex: 'a six-digit HEX color such as "#1A2B3C"',
  'local-file': 'a data: URL or a root-relative path such as "/brands/acme/logo.svg"',
  'record-id': 'an ID of letters, digits, ".", "_", ":" or "-" that starts with a letter or digit',
  'social-handle': 'an empty string or a handle that starts with "@"',
  'web-url': 'an http(s) URL, a bare domain such as "acme.com", or an empty string',
};

export type BrandSourceIssueCode =
  | 'duplicate'
  | 'enum'
  | 'format'
  | 'invalid_input'
  | 'length'
  | 'locked'
  | 'range'
  | 'reference'
  | 'remote_url'
  | 'required'
  | 'too_many'
  | 'type'
  | 'unknown_field';

export type BrandSourceIssue = {
  code: BrandSourceIssueCode;
  message: string;
  path: string;
  severity: 'error' | 'warning';
};

export type BrandSourceMode = 'full' | 'patch';

export class BrandSourceValidationError extends TypeError {
  readonly issues: BrandSourceIssue[];

  constructor(issues: BrandSourceIssue[]) {
    const errors = issues.filter(({ severity }) => severity === 'error');
    const shown = errors.slice(0, 8).map(({ message }) => message).join(' ');
    const rest = errors.length > 8 ? ` …and ${errors.length - 8} more.` : '';
    super(`Identity source has ${errors.length} ${errors.length === 1 ? 'problem' : 'problems'}: ${shown}${rest}`);
    this.issues = issues;
    this.name = 'BrandSourceValidationError';
  }
}

function describeValue(value: unknown): string {
  if (value === undefined) return 'nothing';
  if (value === null) return 'null';
  if (Array.isArray(value)) return `an array of ${value.length}`;
  if (typeof value === 'object') return 'an object';
  if (typeof value === 'string') {
    return value.length > 48 ? `"${value.slice(0, 45)}…" (${value.length} characters)` : JSON.stringify(value);
  }
  return String(value);
}

function joinPath(path: string, key: string | number): string {
  if (typeof key === 'number') return `${path}[${key}]`;
  return path ? `${path}.${key}` : key;
}

function issue(
  issues: BrandSourceIssue[],
  code: BrandSourceIssueCode,
  path: string,
  message: string,
  severity: BrandSourceIssue['severity'] = 'error'
) {
  issues.push({ code, message, path: path || '(root)', severity });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function recordLabel(record: unknown, mergeKey?: 'id' | 'pair' | 'role'): string {
  if (!isRecord(record)) return '';
  if (mergeKey === 'role' && typeof record.role === 'string') return ` (role ${record.role})`;
  if (mergeKey === 'pair' && typeof record.foreground === 'string') return ` (${record.foreground} on ${String(record.background)})`;
  return typeof record.id === 'string' ? ` (id "${record.id}")` : '';
}

function validateString(spec: Extract<FieldSpec, { kind: 'string' }>, value: unknown, path: string, issues: BrandSourceIssue[]) {
  if (typeof value !== 'string') {
    issue(issues, 'type', path, `${path} must be a string; received ${describeValue(value)}.`);
    return;
  }
  if (spec.enum && !spec.enum.includes(value)) {
    issue(issues, 'enum', path, `${path} must be one of ${spec.enum.join(', ')}; received ${describeValue(value)}.`);
    return;
  }
  if ((spec.minLength ?? 0) > 0 && !value.trim()) {
    issue(issues, 'required', path, `${path} must not be empty.`);
    return;
  }
  if (value.length > spec.maxLength) {
    issue(issues, 'length', path, `${path} must be at most ${spec.maxLength} characters; received ${value.length}.`);
    return;
  }
  if (!spec.format || (!value && !spec.minLength)) return;
  if (spec.format === 'local-file' && /^(?:https?:)?\/\//i.test(value)) {
    issue(issues, 'remote_url', path, `${path} must be ${FORMAT_HINTS['local-file']}; remote URLs are never fetched. Add the file from its bytes with identity.asset.add or identity.font.add.`);
    return;
  }
  if (spec.format === 'local-file' && (value.includes('..') && !value.startsWith('data:'))) {
    issue(issues, 'format', path, `${path} must not contain "..".`);
    return;
  }
  if (!PATTERNS[spec.format].test(value)) {
    issue(issues, 'format', path, `${path} must be ${FORMAT_HINTS[spec.format]}; received ${describeValue(value)}.`);
  }
}

function validateNumber(spec: Extract<FieldSpec, { kind: 'number' }>, value: unknown, path: string, issues: BrandSourceIssue[]) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    issue(issues, 'type', path, `${path} must be a finite number; received ${describeValue(value)}.`);
    return;
  }
  if (value < spec.minimum || value > spec.maximum || (spec.integer && !Number.isInteger(value))) {
    issue(issues, 'range', path, `${path} must be ${spec.integer ? 'an integer' : 'a number'} from ${spec.minimum} to ${spec.maximum}; received ${value}.`);
  }
}

function validateArray(
  spec: Extract<FieldSpec, { kind: 'array' }>,
  value: unknown,
  path: string,
  issues: BrandSourceIssue[],
  mode: BrandSourceMode
) {
  if (!Array.isArray(value)) {
    issue(issues, 'type', path, `${path} must be an array; received ${describeValue(value)}.`);
    return;
  }
  if (value.length > spec.maxItems) {
    issue(issues, 'too_many', path, `${path} may contain at most ${spec.maxItems} items; received ${value.length}.`);
  }
  value.slice(0, spec.maxItems).forEach((item, index) => {
    const itemPath = joinPath(path, index);
    // A patch record only needs its merge key; the merged result is validated in full.
    const recordMode = mode === 'patch' && spec.mergeKey ? 'patch' : 'full';
    if (mode === 'patch' && spec.mergeKey === 'id' && isRecord(item) && typeof item.id !== 'string') {
      issue(issues, 'required', `${itemPath}.id`, `${itemPath}.id is required so the record can be merged; use an existing id to update it or a new id to add it.`);
    }
    if (mode === 'patch' && spec.mergeKey === 'role' && isRecord(item) && typeof item.role !== 'string') {
      issue(issues, 'required', `${itemPath}.role`, `${itemPath}.role is required so the typography role can be merged.`);
    }
    validateField(spec.items, item, itemPath, issues, recordMode, recordLabel(item, spec.mergeKey));
  });
}

function validateObject(
  spec: ObjectSpec,
  value: unknown,
  path: string,
  issues: BrandSourceIssue[],
  mode: BrandSourceMode,
  label = ''
) {
  if (!isRecord(value)) {
    issue(issues, 'type', path, `${path || 'The identity'} must be an object; received ${describeValue(value)}.`);
    return;
  }
  if (mode === 'full') {
    for (const key of spec.required ?? []) {
      if (value[key] === undefined) {
        const fieldPath = joinPath(path, key);
        issue(issues, 'required', fieldPath, `${fieldPath}${label ? ` for record${label}` : ''} is required.`);
      }
    }
  }
  for (const [key, entry] of Object.entries(value)) {
    const fieldPath = joinPath(path, key);
    const fieldSpec = spec.fields[key];
    if (!fieldSpec) {
      issue(issues, 'unknown_field', fieldPath, `${fieldPath} is not part of the BrandIdentity contract and is kept as-is.`, 'warning');
      continue;
    }
    if (entry === undefined) continue;
    validateField(fieldSpec, entry, fieldPath, issues, mode);
  }
}

function validateField(
  spec: FieldSpec,
  value: unknown,
  path: string,
  issues: BrandSourceIssue[],
  mode: BrandSourceMode,
  label = ''
) {
  if (spec.kind === 'string') validateString(spec, value, path, issues);
  else if (spec.kind === 'number') validateNumber(spec, value, path, issues);
  else if (spec.kind === 'boolean') {
    if (typeof value !== 'boolean') issue(issues, 'type', path, `${path} must be true or false; received ${describeValue(value)}.`);
  } else if (spec.kind === 'array') validateArray(spec, value, path, issues, mode);
  else validateObject(spec, value, path, issues, mode, label);
}

function duplicateIds(items: unknown, key: string, path: string, issues: BrandSourceIssue[], seen = new Map<string, string>()) {
  if (!Array.isArray(items)) return seen;
  items.forEach((item, index) => {
    if (!isRecord(item) || typeof item[key] !== 'string') return;
    const value = item[key] as string;
    const itemPath = `${path}[${index}].${key}`;
    const previous = seen.get(value);
    if (previous) issue(issues, 'duplicate', itemPath, `${itemPath} "${value}" is already used by ${previous}; ${key}s must be unique.`);
    else seen.set(value, `${path}[${index}]`);
  });
  return seen;
}

/** Role refs and scale ids in colorSystem must name colors[].id values. */
function colorSystemReferences(system: unknown, colorIds: ReadonlySet<string>, issues: BrandSourceIssue[]) {
  if (!isRecord(system)) return;
  const known = [...colorIds].join(', ') || 'none defined';
  for (const mode of ['light', 'dark'] as const) {
    const roles = system[mode];
    if (!isRecord(roles)) continue;
    for (const role of Object.keys(SEMANTIC_ROLE_FIELDS)) {
      const ref = roles[role];
      const id = typeof ref === 'string' ? parseColorRef(ref)?.id : undefined;
      if (id && !colorIds.has(id)) issue(issues, 'reference', `colorSystem.${mode}.${role}`, `colorSystem.${mode}.${role} "${String(ref)}" does not match any colors[].id (${known}).`);
    }
  }
  if (!Array.isArray(system.scales)) return;
  system.scales.forEach((scale, index) => {
    if (isRecord(scale) && typeof scale.id === 'string' && !colorIds.has(scale.id)) {
      issue(issues, 'reference', `colorSystem.scales[${index}].id`, `colorSystem.scales[${index}].id "${scale.id}" does not match any colors[].id.`);
    }
  });
}

function crossReferences(identity: Record<string, unknown>, issues: BrandSourceIssue[]) {
  duplicateIds(identity.colors, 'id', 'colors', issues);
  duplicateIds(identity.proofAssets, 'id', 'proofAssets', issues, duplicateIds(identity.assets, 'id', 'assets', issues));
  duplicateIds(identity.fonts, 'id', 'fonts', issues);
  duplicateIds(identity.applications, 'id', 'applications', issues);
  duplicateIds(identity.references, 'id', 'references', issues);
  duplicateIds(identity.motion, 'id', 'motion', issues);
  duplicateIds(identity.typography, 'role', 'typography', issues);

  const colorIds = new Set(Array.isArray(identity.colors)
    ? identity.colors.flatMap((color) => isRecord(color) && typeof color.id === 'string' ? [color.id] : [])
    : []);
  const colorIdList = [...colorIds].join(', ') || 'none defined';
  if (Array.isArray(identity.colorPairings)) {
    identity.colorPairings.forEach((pairing, index) => {
      if (!isRecord(pairing)) return;
      for (const side of ['foreground', 'background'] as const) {
        const value = pairing[side];
        if (typeof value === 'string' && !colorIds.has(value)) {
          issue(issues, 'reference', `colorPairings[${index}].${side}`, `colorPairings[${index}].${side} "${value}" does not match any colors[].id (${colorIdList}).`);
        }
      }
    });
  }

  colorSystemReferences(identity.colorSystem, colorIds, issues);

  const fonts = Array.isArray(identity.fonts) ? identity.fonts.filter(isRecord) : [];
  const fontIds = new Set(fonts.flatMap((font) => typeof font.id === 'string' ? [font.id] : []));
  const fontIdList = [...fontIds].join(', ');
  if (Array.isArray(identity.typography) && fontIds.size > 0) {
    identity.typography.forEach((role, index) => {
      if (isRecord(role) && typeof role.fontId === 'string' && !fontIds.has(role.fontId)) {
        issue(issues, 'reference', `typography[${index}].fontId`, `typography[${index}].fontId "${role.fontId}" does not match any fonts[].id (${fontIdList}). Add the file with identity.font.add or pick an existing font.`);
      }
    });
  }
  fonts.forEach((font, index) => {
    const { weight, weightMax, weightMin } = font;
    if (typeof weightMin === 'number' && typeof weightMax === 'number' && weightMin > weightMax) {
      issue(issues, 'range', `fonts[${index}].weightMin`, `fonts[${index}].weightMin (${weightMin}) must not exceed weightMax (${weightMax}).`);
    }
    if ((typeof weightMin === 'number') !== (typeof weightMax === 'number')) {
      issue(issues, 'required', `fonts[${index}]`, `fonts[${index}] must set both weightMin and weightMax for a variable font, or neither for a static font.`);
    }
    if (typeof weight === 'number' && typeof weightMin === 'number' && typeof weightMax === 'number' && (weight < weightMin || weight > weightMax)) {
      issue(issues, 'range', `fonts[${index}].weight`, `fonts[${index}].weight (${weight}) must sit within weightMin–weightMax (${weightMin}–${weightMax}).`);
    }
  });

  const assetIds = new Set([...(Array.isArray(identity.assets) ? identity.assets : []), ...(Array.isArray(identity.proofAssets) ? identity.proofAssets : [])]
    .flatMap((asset) => isRecord(asset) && typeof asset.id === 'string' ? [asset.id] : []));
  if (Array.isArray(identity.references)) {
    identity.references.forEach((reference, index) => {
      if (isRecord(reference) && typeof reference.assetId === 'string' && !assetIds.has(reference.assetId)) {
        issue(issues, 'reference', `references[${index}].assetId`, `references[${index}].assetId "${reference.assetId}" does not match any assets[].id.`, 'warning');
      }
    });
  }
}

/** Validate a complete identity (`full`) or a partial change (`patch`) without applying it. */
export function validateBrandIdentitySource(
  input: unknown,
  mode: BrandSourceMode = 'full'
): { issues: BrandSourceIssue[]; ok: boolean } {
  const issues: BrandSourceIssue[] = [];
  validateObject(IDENTITY_SPEC, input, '', issues, mode);
  if (mode === 'full' && isRecord(input) && !issues.some(({ code }) => code === 'too_many')) crossReferences(input, issues);
  return { issues, ok: !issues.some(({ severity }) => severity === 'error') };
}

function mergeKeyOf(record: Record<string, unknown>, mergeKey: 'id' | 'pair' | 'role'): string | undefined {
  if (mergeKey === 'pair') {
    return typeof record.foreground === 'string' && typeof record.background === 'string'
      ? `${record.foreground}/${record.background}`
      : undefined;
  }
  const value = record[mergeKey];
  return typeof value === 'string' ? value : undefined;
}

function mergeRecords(current: unknown, patch: unknown[], mergeKey: 'id' | 'pair' | 'role'): unknown[] {
  const merged = Array.isArray(current) ? current.map((item) => (isRecord(item) ? { ...item } : item)) : [];
  for (const item of patch) {
    if (!isRecord(item)) continue;
    const key = mergeKeyOf(item, mergeKey);
    const index = key === undefined ? -1 : merged.findIndex((candidate) => (
      isRecord(candidate) && mergeKeyOf(candidate, mergeKey) === key
    ));
    if (index >= 0) merged[index] = { ...(merged[index] as Record<string, unknown>), ...item };
    else merged.push({ ...item });
  }
  return merged;
}

function mergeObject(
  spec: ObjectSpec,
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
  replaced: ReadonlySet<string> = new Set()
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const fieldSpec = spec.fields[key];
    if (replaced.has(key)) {
      merged[key] = value;
    } else if (fieldSpec?.kind === 'object' && isRecord(value)) {
      merged[key] = mergeObject(fieldSpec, isRecord(current[key]) ? current[key] : {}, value);
    } else if (fieldSpec?.kind === 'array' && fieldSpec.mergeKey && Array.isArray(value)) {
      merged[key] = mergeRecords(current[key], value, fieldSpec.mergeKey);
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

export type BrandSourceRemoval = Partial<Record<RemovableCollection, readonly string[]>>;

export type BrandSourceApplyOptions = {
  /** `merge` (default) changes only the fields present; `replace` treats the input as the complete identity. */
  mode?: 'merge' | 'replace';
  /** Record IDs to remove from id-keyed collections, applied after the merge. */
  remove?: BrandSourceRemoval;
  /** Record collections the patch replaces as a whole instead of merging, such as ['colors', 'colorPairings']. */
  replace?: readonly string[];
};

const REPLACEABLE_COLLECTIONS = Object.entries(IDENTITY_SPEC.fields)
  .filter(([, spec]) => spec.kind === 'array' && Boolean(spec.mergeKey))
  .map(([key]) => key);

function validateReplace(replace: unknown, issues: BrandSourceIssue[]): Set<string> {
  if (replace === undefined) return new Set();
  if (!Array.isArray(replace) || !replace.every((key) => typeof key === 'string')) {
    issue(issues, 'type', 'replace', `replace must be an array of collection names such as ["colors", "colorPairings"]; received ${describeValue(replace)}.`);
    return new Set();
  }
  for (const key of replace) {
    if (!REPLACEABLE_COLLECTIONS.includes(key)) {
      issue(issues, 'enum', 'replace', `replace "${key}" is not a record collection; use ${REPLACEABLE_COLLECTIONS.join(', ')}.`);
    }
  }
  return new Set(replace);
}

function validateRemoval(remove: unknown, issues: BrandSourceIssue[]): BrandSourceRemoval {
  if (remove === undefined) return {};
  if (!isRecord(remove)) {
    issue(issues, 'type', 'remove', `remove must be an object such as { assets: ["old-logo"] }; received ${describeValue(remove)}.`);
    return {};
  }
  const output: BrandSourceRemoval = {};
  for (const [key, ids] of Object.entries(remove)) {
    if (!(REMOVABLE_COLLECTIONS as readonly string[]).includes(key)) {
      issue(issues, 'enum', `remove.${key}`, `remove.${key} is not removable; use one of ${REMOVABLE_COLLECTIONS.join(', ')}.`);
      continue;
    }
    if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string')) {
      issue(issues, 'type', `remove.${key}`, `remove.${key} must be an array of record IDs.`);
      continue;
    }
    output[key as RemovableCollection] = ids;
  }
  return output;
}

function lockedFieldWarnings(current: BrandIdentity, candidate: Record<string, unknown>, issues: BrandSourceIssue[]) {
  for (const field of LOCKED_FIELDS) {
    const value = candidate[field];
    const currentValue = current[field];
    if (value !== undefined && value !== currentValue) {
      issue(issues, 'locked', field, `${field} is managed by Glyphfield; kept ${describeValue(currentValue)}.`, 'warning');
    }
  }
}

function removeRecords(merged: Record<string, unknown>, removal: BrandSourceRemoval, issues: BrandSourceIssue[]): Record<string, unknown> {
  let next = merged;
  for (const [collection, ids] of Object.entries(removal) as [RemovableCollection, readonly string[]][]) {
    const items = Array.isArray(next[collection]) ? next[collection] as unknown[] : [];
    const missing = ids.filter((id) => !items.some((item) => isRecord(item) && item.id === id));
    missing.forEach((id) => issue(issues, 'reference', `remove.${collection}`, `remove.${collection} "${id}" does not match any ${collection}[].id.`, 'warning'));
    next = { ...next, [collection]: items.filter((item) => !(isRecord(item) && typeof item.id === 'string' && ids.includes(item.id))) };
  }
  return next;
}

function restoreLockedFields(merged: Record<string, unknown>, base: Record<string, unknown>) {
  for (const field of LOCKED_FIELDS) {
    if (base[field] === undefined) delete merged[field];
    else merged[field] = base[field];
  }
}

function addMergedErrors(merged: Record<string, unknown>, issues: BrandSourceIssue[]) {
  // Patch warnings already cover unknown fields the caller sent; add merged errors and references.
  for (const candidate of validateBrandIdentitySource(merged, 'full').issues) {
    if (candidate.severity !== 'error' && candidate.code !== 'reference') continue;
    if (!issues.some(({ message }) => message === candidate.message)) issues.push(candidate);
  }
}

/**
 * Validate and apply identity source to the active identity. Locked project
 * fields keep their current values, unknown fields are kept, and record IDs are
 * stable. Throws BrandSourceValidationError listing every error.
 */
export function applyBrandIdentitySource(
  current: BrandIdentity,
  input: unknown,
  options: BrandSourceApplyOptions = {}
): { identity: BrandIdentity; warnings: BrandSourceIssue[] } {
  const mode = options.mode ?? 'merge';
  const issues: BrandSourceIssue[] = [];
  if (mode !== 'merge' && mode !== 'replace') {
    issue(issues, 'enum', 'mode', `mode must be merge or replace; received ${describeValue(mode)}.`);
  }
  const removal = validateRemoval(options.remove, issues);
  const replaced = validateReplace(options.replace, issues);
  // A replacement may omit the project ID; it is locked to the active project anyway.
  const candidate = mode === 'replace' && isRecord(input) && input.id === undefined
    ? { ...input, id: current.id }
    : input;
  issues.push(...validateBrandIdentitySource(candidate, mode === 'replace' ? 'full' : 'patch').issues);
  if (issues.some(({ severity }) => severity === 'error') || !isRecord(candidate)) {
    throw new BrandSourceValidationError(issues);
  }
  lockedFieldWarnings(current, candidate, issues);

  const base = current as unknown as Record<string, unknown>;
  const merged = removeRecords(
    mode === 'replace' ? { ...candidate } : mergeObject(IDENTITY_SPEC, base, candidate, replaced),
    removal,
    issues
  );
  restoreLockedFields(merged, base);
  addMergedErrors(merged, issues);
  if (issues.some(({ severity }) => severity === 'error')) throw new BrandSourceValidationError(issues);

  const normalized = normalizeBrandIdentity(merged as unknown as BrandIdentity);
  return {
    identity: {
      ...normalized,
      colors: normalized.colors.map((color) => ({ ...color, hex: color.hex.toLocaleUpperCase() })),
    },
    warnings: issues,
  };
}

type JsonSchema = Record<string, unknown>;

function toJsonSchema(spec: FieldSpec, patch: boolean): JsonSchema {
  const description = spec.description ? { description: spec.description } : {};
  if (spec.kind === 'string') {
    return {
      ...description,
      ...(spec.enum ? { enum: spec.enum } : {}),
      ...(spec.format ? { pattern: PATTERNS[spec.format].source, 'x-glyphfield-format': spec.format } : {}),
      maxLength: spec.maxLength,
      ...(spec.minLength ? { minLength: spec.minLength } : {}),
      type: 'string',
    };
  }
  if (spec.kind === 'number') {
    return { ...description, maximum: spec.maximum, minimum: spec.minimum, type: spec.integer ? 'integer' : 'number' };
  }
  if (spec.kind === 'boolean') return { ...description, type: 'boolean' };
  if (spec.kind === 'array') {
    return {
      ...description,
      items: toJsonSchema(spec.items, false),
      maxItems: spec.maxItems,
      type: 'array',
      ...(spec.mergeKey ? { 'x-glyphfield-merge-key': spec.mergeKey === 'pair' ? 'foreground+background' : spec.mergeKey } : {}),
    };
  }
  return {
    ...description,
    additionalProperties: true,
    properties: Object.fromEntries(Object.entries(spec.fields).map(([key, field]) => [key, toJsonSchema(field, false)])),
    ...(!patch && spec.required?.length ? { required: spec.required } : {}),
    type: 'object',
  };
}

/** JSON Schema (2020-12) for a complete BrandIdentity source document. */
export const BRAND_IDENTITY_SOURCE_SCHEMA: JsonSchema = {
  $id: 'https://glyphfield.app/schemas/brand-identity.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'Glyphfield BrandIdentity',
  ...toJsonSchema(IDENTITY_SPEC, false),
  'x-glyphfield-schema-version': BRAND_SOURCE_SCHEMA_VERSION,
};

/** JSON Schema for an identity.apply merge patch: every field optional, records merged by key. */
export const BRAND_IDENTITY_PATCH_SCHEMA: JsonSchema = {
  $id: 'https://glyphfield.app/schemas/brand-identity-patch.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'Glyphfield BrandIdentity merge patch',
  ...toJsonSchema({ ...IDENTITY_SPEC, description: 'Fields to change. Objects merge by key, id-keyed record arrays merge by id (typography by role, colorPairings by foreground and background), and string lists are replaced.' }, true),
  'x-glyphfield-schema-version': BRAND_SOURCE_SCHEMA_VERSION,
};

export const BRAND_SOURCE_MERGE_RULES = [
  'Objects (strategy, voice, graphicSystem, dossier, artDirection, style, typeScale, colorSystem) merge by key; colorSystem.scales merge by id.',
  'Record arrays merge by id: a matching id updates that record, a new id appends one, and records you omit are kept.',
  'typography merges by role; colorPairings merge by foreground and background.',
  'String lists (pillars, phrases, audiences, products, proof, rules…) and voice.examples are replaced as a whole.',
  'replace: ["colors", "colorPairings", …] replaces those record collections as a whole, for example when a project started from a template.',
  'remove: { assets: ["id"], colors: ["id"], … } deletes records after the merge.',
  'id, builtIn, kind, revision and presetFingerprint are managed by Glyphfield and keep their current values.',
  'Asset, font and motion file paths must be data: URLs or root-relative paths; remote URLs are rejected, never fetched.',
  'Unknown fields are kept and reported as warnings.',
] as const;

export const BRAND_LOGO_SLOTS = [
  { id: 'mark-dark', label: 'Mark for light surfaces', required: true, surface: 'light' },
  { id: 'mark-light', label: 'Mark for dark surfaces', required: true, surface: 'dark' },
  { id: 'wordmark', label: 'Wordmark for light surfaces', required: false, surface: 'light' },
  { id: 'wordmark-light', label: 'Wordmark for dark surfaces', required: false, surface: 'dark' },
  { id: 'mark-mono', label: 'One-color mark', required: false, surface: 'any' },
] as const;

export type BrandLogoSlot = (typeof BRAND_LOGO_SLOTS)[number]['id'];
