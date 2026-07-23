export const AGENT_CORS_HEADERS = {
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
} as const;

export const AGENT_GENERATION_EXAMPLES = {
  background: {
    identity: { preset: 'gt' },
    kind: 'background',
    output: 'json',
    settings: {
      colorA: '#FFFFFF',
      colorB: '#181818',
      height: 630,
      pattern: 'dots',
      patternOpacity: 18,
      logoOpacity: 100,
      logoX: 0,
      logoY: 0,
      style: 'grain-gradient',
      width: 1200,
    },
  },
  brief: {
    elementId: 'email-signature',
    identity: {
      name: 'Acme',
      preset: 'custom',
      tagline: 'Tools for careful teams.',
      website: 'acme.test',
    },
    kind: 'element-brief',
  },
  slide: {
    body: 'Foundation\nExpression\nApplication\nDelivery',
    identity: { preset: 'gt' },
    kind: 'template',
    output: 'raw',
    slideLayout: 'agenda',
    template: 'slides',
    texture: 'white',
    title: 'Code is the source of truth.',
  },
} as const;

export const AGENT_GENERATION_CONTRACT = {
  endpoint: '/api/generate',
  examples: AGENT_GENERATION_EXAMPLES,
  identity: {
    fields: {
      description: 'Optional string, maximum 320 characters',
      ink: 'Optional six-digit HEX color',
      logoDataUrl: 'Optional base64 image data URL, maximum 5 MB',
      name: 'Optional string, maximum 80 characters',
      paper: 'Optional six-digit HEX color',
      positioning: 'Optional string, maximum 320 characters',
      preset: 'starter | gt | custom',
      shortName: 'Optional string, maximum 8 characters',
      tagline: 'Optional string, maximum 180 characters',
      website: 'Optional string, maximum 200 characters',
    },
  },
  kinds: {
    background: {
      description: 'Generate a standalone SVG gradient, grain, dither, or pattern background.',
      fields: {
        identity: 'Agent identity object',
        kind: 'background',
        output: 'json | raw; defaults to json',
        settings: {
          angle: '-360–360',
          colorA: 'Six-digit HEX',
          colorB: 'Six-digit HEX',
          ditherMatrix: '2 | 4 | 8',
          gradient: 'linear | radial',
          grain: '0–100',
          height: '64–4096 integer; total pixels may not exceed 12,000,000',
          logoScale: '5–90',
          logoOpacity: '0–100',
          logoX: '-50–50',
          logoY: '-50–50',
          logoTone: 'black | white',
          pattern: 'none | dots | lines | grid',
          patternOpacity: '0–100',
          spacing: '8–256 integer',
          style: 'gradient | grain-gradient | dither | pattern',
          width: '64–4096 integer; total pixels may not exceed 12,000,000',
        },
      },
      mimeTypes: ['application/json', 'image/svg+xml'],
    },
    'element-brief': {
      description: 'Resolve one /api/elements record against a preset or custom identity.',
      fields: {
        elementId: 'Required ID from /api/elements',
        identity: 'Agent identity object',
        kind: 'element-brief',
      },
      mimeTypes: ['application/json'],
    },
    template: {
      description: 'Generate a standalone slide, blog cover, or partnership SVG.',
      fields: {
        background: 'Optional six-digit HEX',
        backgroundImageDataUrl: 'Optional base64 image data URL, maximum 5 MB',
        body: 'Optional string, maximum 1000 characters; newline-delimited for lists',
        eyebrow: 'Optional string, maximum 80 characters',
        foreground: 'Optional six-digit HEX',
        identity: 'Agent identity object',
        kind: 'template',
        output: 'json | raw; defaults to json',
        partnerId: 'Optional public proof asset ID from /api/identities',
        partnerLogoDataUrl: 'Optional base64 image data URL, maximum 5 MB',
        slideLayout: 'title | section | agenda | split | metrics | quote | timeline | closing',
        template: 'slides | blog | partnership',
        texture: 'white | dark | grid | noise',
        title: 'Optional string, maximum 240 characters',
      },
      mimeTypes: ['application/json', 'image/svg+xml'],
    },
  },
  method: 'POST',
  requestContentType: 'application/json',
  schemaVersion: 1,
} as const;

export const AGENT_MANIFEST = {
  description: 'Discover and generate Glyphfield brand-system artifacts without operating the UI.',
  generation: AGENT_GENERATION_CONTRACT,
  name: 'Glyphfield Agent API',
  policies: {
    assets: 'Use only assets you are authorized to process. Remote URL fetching is not supported.',
    data: 'Generation requests are processed in memory and are not persisted by Glyphfield.',
    license: 'The deployed API may be used for artifact generation. Source remains All Rights Reserved; see /LICENSE and /llms.txt.',
  },
  resources: {
    catalog: '/api/catalog',
    elements: '/api/elements',
    generate: '/api/generate',
    identities: '/api/identities',
    instructions: '/llms.txt',
    openapi: '/openapi.json',
    workspace: '/studio',
  },
  schemaVersion: 1,
  version: '0.2.0',
} as const;

export const OPENAPI_DOCUMENT = {
  info: {
    description: AGENT_MANIFEST.description,
    title: AGENT_MANIFEST.name,
    version: '0.2.0',
  },
  openapi: '3.1.0',
  paths: {
    '/api/agent': {
      get: {
        responses: {
          '200': { description: 'Agent manifest and generation contract' },
        },
        summary: 'Discover the Glyphfield agent API',
      },
    },
    '/api/catalog': {
      get: {
        responses: { '200': { description: 'Studio tool catalog' } },
        summary: 'List Studio tools and resource URLs',
      },
    },
    '/api/elements': {
      get: {
        responses: { '200': { description: 'Brand element taxonomy' } },
        summary: 'List brand elements and generation metadata',
      },
    },
    '/api/generate': {
      get: {
        responses: { '200': { description: 'Generation schema and examples' } },
        summary: 'Read the generation contract',
      },
      post: {
        requestBody: {
          content: {
            'application/json': {
              examples: {
                background: { value: AGENT_GENERATION_EXAMPLES.background },
                brief: { value: AGENT_GENERATION_EXAMPLES.brief },
                slide: { value: AGENT_GENERATION_EXAMPLES.slide },
              },
              schema: {
                oneOf: [
                  { required: ['kind', 'settings'], type: 'object' },
                  { required: ['kind', 'template'], type: 'object' },
                  { required: ['kind', 'elementId'], type: 'object' },
                ],
              },
            },
          },
          required: true,
        },
        responses: {
          '200': { description: 'Generated JSON artifact envelope, raw SVG, or element brief' },
          '400': { description: 'Structured validation error' },
          '413': { description: 'Request body exceeds 5 MB' },
          '415': { description: 'Content-Type must be application/json' },
        },
        summary: 'Generate a Glyphfield artifact',
      },
    },
    '/api/identities': {
      get: {
        responses: { '200': { description: 'Built-in Starter and GT identity records' } },
        summary: 'List built-in brand identities and asset IDs',
      },
    },
  },
} as const;
