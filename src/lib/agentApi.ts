import {
  STUDIO_AGENT_CAPABILITIES,
  STUDIO_STANDARD_ACTION_CONTRACTS,
  STUDIO_TOOL_ACTION_CONTRACTS,
} from './studioAgentCapabilities';
import { BRAND_ELEMENTS } from './brandElements';
import { SURFACE_MATERIAL_IDS } from './backgroundSvg';
import { OPEN_SURFACE_LIBRARY_IDS } from './openSurfaceLibrary';
import { AGENT_SHADER_LIBRARY } from './agentCatalog';

export const GLYPHFIELD_AGENT_API_VERSION = '0.3.0';

export const AGENT_CORS_HEADERS = {
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
} as const;

const AGENT_GENERATION_EXAMPLES = {
  background: {
    identity: { preset: 'gt' },
    kind: 'background',
    output: 'json',
    settings: {
      colorA: '#FFFFFF',
      colorB: '#181818',
      colorC: '#737373',
      height: 630,
      pattern: 'dots',
      patternOpacity: 12,
      surfaceDepth: 68,
      surfaceMaterial: 'woven-wire',
      surfaceMetallic: 90,
      surfaceOpenArea: 62,
      surfaceRoughness: 24,
      surfaceScale: 38,
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
  designSequence: {
    backgroundColor: '#111216',
    effect: {
      background: '#111216',
      foreground: '#F5F5F2',
      kind: 'bayer',
      opacity: 0.76,
    },
    export: {
      fps: 30,
      quality: 'best',
      width: 1920,
    },
    identity: { preset: 'gt' },
    includeBrandMark: true,
    kind: 'design-sequence',
    ratio: 'wide',
    sequence: {
      cutCount: 10,
      finalHoldMs: 5000,
      pace: 'accelerating',
    },
    shader: {
      materialId: 'paper-gem-smoke',
      shaderSize: 1,
    },
    texts: [{ value: 'Open Source', weight: 500 }],
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

const HEX_COLOR_SCHEMA = { pattern: '^#[0-9A-Fa-f]{6}$', type: 'string' } as const;
const IMAGE_DATA_URL_SCHEMA = {
  maxLength: 5_000_000,
  pattern: '^data:image/(gif|jpeg|png|svg\\+xml|webp);base64,[A-Za-z0-9+/=]+$',
  type: 'string',
} as const;
const AGENT_IDENTITY_SCHEMA = {
  additionalProperties: true,
  properties: {
    description: { maxLength: 320, minLength: 1, type: 'string' },
    ink: HEX_COLOR_SCHEMA,
    logoDataUrl: IMAGE_DATA_URL_SCHEMA,
    name: { maxLength: 80, minLength: 1, type: 'string' },
    paper: HEX_COLOR_SCHEMA,
    positioning: { maxLength: 320, minLength: 1, type: 'string' },
    preset: { enum: ['custom', 'starter', 'template', 'gt', 'ramp', 'mintlify', 'tailwind', 'viteplus', 'cloudflare', 'stripe'], type: 'string' },
    shortName: { maxLength: 8, minLength: 1, type: 'string' },
    tagline: { maxLength: 180, minLength: 1, type: 'string' },
    website: { maxLength: 200, minLength: 1, type: 'string' },
  },
  type: 'object',
} as const;
const LIVE_MATERIAL_SETTINGS_SCHEMA = {
  additionalProperties: false,
  properties: Object.fromEntries(Object.entries(AGENT_SHADER_LIBRARY.controls).map(([name, control]) => [
    name,
    control.type === 'hex-color'
      ? HEX_COLOR_SCHEMA
      : {
          ...(control.maximum === undefined ? {} : { maximum: control.maximum }),
          ...(control.minimum === undefined ? {} : { minimum: control.minimum }),
          type: 'number',
        },
  ])),
  type: 'object',
} as const;

export const AGENT_GENERATION_REQUEST_SCHEMA = {
  discriminator: { propertyName: 'kind' },
  oneOf: [
    {
      additionalProperties: false,
      properties: {
        identity: AGENT_IDENTITY_SCHEMA,
        kind: { const: 'background' },
        output: { enum: ['json', 'raw'], type: 'string' },
        settings: {
          additionalProperties: true,
          properties: {
            angle: { maximum: 360, minimum: -360, type: 'number' },
            bandCount: { maximum: 24, minimum: 3, type: 'integer' },
            bandDepth: { maximum: 100, minimum: 0, type: 'number' },
            bandGap: { maximum: 64, minimum: 0, type: 'number' },
            colorA: HEX_COLOR_SCHEMA,
            colorB: HEX_COLOR_SCHEMA,
            colorC: HEX_COLOR_SCHEMA,
            ditherMatrix: { enum: [2, 4, 8], type: 'integer' },
            ditherShape: { enum: ['dots', 'squares'], type: 'string' },
            focalX: { maximum: 100, minimum: 0, type: 'number' },
            focalY: { maximum: 100, minimum: 0, type: 'number' },
            gradient: { enum: ['linear', 'radial', 'mesh', 'orbit', 'wave', 'bloom'], type: 'string' },
            grain: { maximum: 100, minimum: 0, type: 'number' },
            height: { maximum: 4096, minimum: 64, type: 'integer' },
            lightingEnabled: { type: 'boolean' },
            logoColor: HEX_COLOR_SCHEMA,
            logoOpacity: { maximum: 100, minimum: 0, type: 'number' },
            logoScale: { maximum: 90, minimum: 5, type: 'number' },
            logoTone: { enum: ['black', 'white'], type: 'string' },
            logoX: { maximum: 50, minimum: -50, type: 'number' },
            logoY: { maximum: 50, minimum: -50, type: 'number' },
            pattern: { enum: ['none', 'dots', 'lines', 'grid', 'fibers', 'speckles', 'topographic', 'crosshatch'], type: 'string' },
            patternOpacity: { maximum: 100, minimum: 0, type: 'number' },
            relief: { maximum: 80, minimum: 0, type: 'number' },
            spacing: { maximum: 256, minimum: 8, type: 'integer' },
            style: { enum: ['gradient', 'grain-gradient', 'dither', 'pattern'], type: 'string' },
            surfaceAngle: { maximum: 180, minimum: 0, type: 'number' },
            surfaceDepth: { maximum: 100, minimum: 0, type: 'number' },
            surfaceIrregularity: { maximum: 100, minimum: 0, type: 'number' },
            surfaceLibraryAssetId: { enum: ['', ...OPEN_SURFACE_LIBRARY_IDS], type: 'string' },
            surfaceMaterial: { enum: SURFACE_MATERIAL_IDS, type: 'string' },
            surfaceMetallic: { maximum: 100, minimum: 0, type: 'number' },
            surfaceOpenArea: { maximum: 92, minimum: 0, type: 'number' },
            surfaceRoughness: { maximum: 100, minimum: 0, type: 'number' },
            surfaceScale: { maximum: 140, minimum: 12, type: 'number' },
            surfaceTextureAmount: { maximum: 100, minimum: 0, type: 'number' },
            width: { maximum: 4096, minimum: 64, type: 'integer' },
          },
          type: 'object',
        },
      },
      required: ['kind'],
      type: 'object',
    },
    {
      additionalProperties: false,
      properties: {
        backgroundColor: HEX_COLOR_SCHEMA,
        effect: {
          additionalProperties: true,
          properties: {
            background: HEX_COLOR_SCHEMA,
            cellSize: { maximum: 64, minimum: 1, type: 'number' },
            contrast: { maximum: 4, minimum: 0.1, type: 'number' },
            foreground: HEX_COLOR_SCHEMA,
            invert: { type: 'boolean' },
            kind: { enum: ['ascii', 'bayer', 'halftone', 'posterize'], type: 'string' },
            levels: { maximum: 8, minimum: 2, type: 'integer' },
            opacity: { maximum: 1, minimum: 0, type: 'number' },
            threshold: { maximum: 1, minimum: 0, type: 'number' },
          },
          type: 'object',
        },
        export: {
          additionalProperties: true,
          properties: {
            durationMs: { maximum: 4000, minimum: 1200, type: 'integer' },
            fps: { enum: [12, 15, 24, 30], type: 'integer' },
            gifLoop: { enum: ['raw', 'seamless'], type: 'string' },
            quality: { enum: ['fast', 'balanced', 'best'], type: 'string' },
            width: { maximum: 3840, minimum: 320, type: 'integer' },
          },
          type: 'object',
        },
        identity: AGENT_IDENTITY_SCHEMA,
        includeBrandMark: { type: 'boolean' },
        kind: { const: 'design-sequence' },
        ratio: { enum: ['wide', 'square', 'opengraph'], type: 'string' },
        sequence: {
          additionalProperties: true,
          properties: {
            cutCount: { maximum: 12, minimum: 8, type: 'integer' },
            finalHoldMs: { maximum: 6000, minimum: 3000, type: 'integer' },
            pace: { enum: ['accelerating', 'even'], type: 'string' },
          },
          type: 'object',
        },
        shader: {
          additionalProperties: true,
          properties: {
            blendMode: { enum: ['multiply', 'normal', 'overlay', 'screen'], type: 'string' },
            materialId: { enum: AGENT_SHADER_LIBRARY.materials.map(({ id }) => id), type: 'string' },
            opacity: { maximum: 1, minimum: 0, type: 'number' },
            settings: LIVE_MATERIAL_SETTINGS_SCHEMA,
            shaderSize: { maximum: 10, minimum: 0.1, type: 'number' },
          },
          type: 'object',
        },
        texts: {
          items: {
            additionalProperties: true,
            properties: {
              align: { enum: ['center', 'left', 'right'], type: 'string' },
              color: HEX_COLOR_SCHEMA,
              fontRole: { enum: ['Accent', 'Body', 'Code', 'Display'], type: 'string' },
              lineHeight: { maximum: 1.8, minimum: 0.7, type: 'number' },
              name: { maxLength: 80, minLength: 1, type: 'string' },
              opacity: { maximum: 1, minimum: 0, type: 'number' },
              scale: { maximum: 3, minimum: 0.2, type: 'number' },
              tracking: { maximum: 0.2, minimum: -0.12, type: 'number' },
              value: { maxLength: 1000, minLength: 1, type: 'string' },
              weight: { maximum: 900, minimum: 100, type: 'integer' },
              widthScale: { maximum: 3, minimum: 0.25, type: 'number' },
              wrap: { enum: ['nowrap', 'wrap'], type: 'string' },
              x: { maximum: 5000, minimum: -5000, type: 'number' },
              y: { maximum: 5000, minimum: -5000, type: 'number' },
            },
            type: 'object',
          },
          maxItems: 32,
          type: 'array',
        },
      },
      required: ['kind'],
      type: 'object',
    },
    {
      additionalProperties: false,
      properties: {
        elementId: { enum: BRAND_ELEMENTS.map(({ id }) => id), type: 'string' },
        identity: AGENT_IDENTITY_SCHEMA,
        kind: { const: 'element-brief' },
      },
      required: ['elementId', 'kind'],
      type: 'object',
    },
    {
      additionalProperties: false,
      properties: {
        background: HEX_COLOR_SCHEMA,
        backgroundImageDataUrl: IMAGE_DATA_URL_SCHEMA,
        body: { maxLength: 1000, minLength: 1, type: 'string' },
        foreground: HEX_COLOR_SCHEMA,
        identity: AGENT_IDENTITY_SCHEMA,
        kind: { const: 'template' },
        output: { enum: ['json', 'raw'], type: 'string' },
        partnerId: { maxLength: 80, minLength: 1, type: 'string' },
        partnerLogoDataUrl: IMAGE_DATA_URL_SCHEMA,
        slideLayout: { enum: ['title', 'section', 'agenda', 'split', 'metrics', 'quote', 'timeline', 'statement', 'comparison', 'process', 'chart', 'team', 'image', 'closing'], type: 'string' },
        template: { enum: ['slides', 'blog', 'partnership'], type: 'string' },
        texture: { enum: ['white', 'dark', 'grid', 'noise'], type: 'string' },
        title: { maxLength: 240, minLength: 1, type: 'string' },
      },
      required: ['kind'],
      type: 'object',
    },
  ],
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
      preset: 'starter | template | gt | ramp | mintlify | tailwind | viteplus | cloudflare | stripe | custom',
      shortName: 'Optional string, maximum 8 characters',
      tagline: 'Optional string, maximum 180 characters',
      website: 'Optional string, maximum 200 characters',
    },
  },
  kinds: {
    background: {
      description: 'Generate a standalone SVG gradient, grain, dither, pattern, or tactile physical surface.',
      fields: {
        identity: 'Agent identity object',
        kind: 'background',
        output: 'json | raw; defaults to json',
        settings: {
          angle: '-360–360',
          bandCount: '3–24 integer',
          bandDepth: '0–100',
          bandGap: '0–64',
          colorA: 'Six-digit HEX',
          colorB: 'Six-digit HEX',
          colorC: 'Six-digit HEX',
          ditherMatrix: '2 | 4 | 8',
          ditherShape: 'dots | squares',
          focalX: '0–100',
          focalY: '0–100',
          gradient: 'linear | radial | mesh | orbit | wave | bloom',
          grain: '0–100',
          height: '64–4096 integer; total pixels may not exceed 12,000,000',
          logoColor: 'Six-digit HEX',
          logoScale: '5–90',
          logoOpacity: '0–100',
          logoX: '-50–50',
          logoY: '-50–50',
          logoTone: 'black | white',
          lightingEnabled: 'Boolean; use false for flat bands without gradient lighting',
          pattern: 'none | dots | lines | grid | fibers | speckles | topographic | crosshatch',
          patternOpacity: '0–100',
          relief: '0–80',
          spacing: '8–256 integer',
          style: 'gradient | grain-gradient | dither | pattern',
          surfaceAngle: '0–180',
          surfaceDepth: '0–100 height/relief response',
          surfaceIrregularity: '0–100 surface variation',
          surfaceLibraryAssetId: `Empty or one of: ${OPEN_SURFACE_LIBRARY_IDS.join(' | ')}`,
          surfaceMaterial: SURFACE_MATERIAL_IDS.join(' | '),
          surfaceMetallic: '0–100 specular response',
          surfaceOpenArea: '0–92 porosity or opening ratio',
          surfaceRoughness: '0–100 highlight spread',
          surfaceScale: '12–140 physical pattern scale',
          surfaceTextureAmount: '0–100 texture-map contribution',
          width: '64–4096 integer; total pixels may not exceed 12,000,000',
        },
      },
      mimeTypes: ['application/json', 'image/svg+xml'],
    },
    'design-sequence': {
      description: 'Create an apply-ready Design Lab compatibility document for a fixed composition. Design Lab validates and normalizes it to the current CanvasDocument before authentic browser-native PNG, JPG, GIF, and MP4 export.',
      fields: {
        backgroundColor: 'Optional six-digit HEX; defaults to #111216',
        effect: 'Optional bayer | ascii | halftone | posterize converter with opacity and converter settings',
        export: 'width 320–3840; fps 12 | 15 | 24 | 30; quality fast | balanced | best; durationMs 1200–4000; gifLoop raw | seamless',
        identity: 'Agent identity object',
        includeBrandMark: 'Boolean; defaults to true',
        kind: 'design-sequence',
        ratio: 'wide | square | opengraph',
        sequence: 'cutCount 8–12; finalHoldMs 3000–6000; pace accelerating | even',
        shader: 'materialId from /api/materials; blendMode; opacity; shaderSize 0.1–10; shared settings',
        texts: 'Optional array of up to 32 positioned text layers',
      },
      mimeTypes: ['application/json'],
      programmaticExport: "Open /studio, apply response.document (version 3 compatibility source), re-read the normalized CanvasDocument schema 2 / Design Lab source 4, then invoke design.export with format png | jpg | gif | mp4, optional mode shader-sequence, and optional download true.",
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
        foreground: 'Optional six-digit HEX',
        identity: 'Agent identity object',
        kind: 'template',
        output: 'json | raw; defaults to json',
        partnerId: 'Optional public proof asset ID from /api/identities',
        partnerLogoDataUrl: 'Optional base64 image data URL, maximum 5 MB',
        slideLayout: 'title | section | agenda | split | metrics | quote | timeline | statement | comparison | process | chart | team | image | closing',
        template: 'slides | blog | partnership',
        texture: 'white | dark | grid | noise',
        title: 'Optional string, maximum 240 characters',
      },
      mimeTypes: ['application/json', 'image/svg+xml'],
    },
  },
  method: 'POST',
  requestContentType: 'application/json',
  requestSchema: AGENT_GENERATION_REQUEST_SCHEMA,
  unknownTopLevelFields: 'Rejected with HTTP 400 and error code unknown_field',
  schemaVersion: 3,
} as const;

export const STUDIO_BROWSER_API_CONTRACT = {
  event: 'glyphfield:studio-api-ready',
  global: 'window.glyphfield.studio',
  operations: {
    activate: 'Activate any visible control by its accessible label',
    activeTool: 'Return the active Studio tool ID',
    applySource: 'Apply a JSON object or string through the active tool validator',
    controls: 'List visible interactive controls and current values',
    describe: 'List exact actions, input/output contracts, source support, exports, and HTTP capability for the active tool',
    download: 'Save a generated Blob artifact with its deterministic file name',
    invoke: 'Invoke source, control, export, or tool-specific actions',
    readSource: 'Read the exact current source document',
    set: 'Set a visible form control by accessible label',
  },
  standardActionContracts: STUDIO_STANDARD_ACTION_CONTRACTS,
  standardActions: Object.keys(STUDIO_STANDARD_ACTION_CONTRACTS),
  toolCapabilities: STUDIO_AGENT_CAPABILITIES,
  toolActions: STUDIO_TOOL_ACTION_CONTRACTS,
  version: 1,
} as const;

export const GLYPHFIELD_AGENT_SKILLS = [
  {
    id: 'glyphfield-create',
    repositoryPath: 'skills/glyphfield-create',
    useFor: 'Layered Design Lab composition, shaders, authored layers, and saved designs',
  },
  {
    id: 'glyphfield-api',
    repositoryPath: 'skills/glyphfield-api',
    useFor: 'Deterministic HTTP discovery, generation, and batch workflows',
  },
  {
    id: 'glyphfield-studio',
    repositoryPath: 'skills/glyphfield-studio',
    useFor: 'Authentic browser Studio operation, source round trips, and local files',
  },
  {
    id: 'glyphfield-export',
    repositoryPath: 'skills/glyphfield-export',
    useFor: 'Still and motion export with artifact, loop, frame, and audio verification',
  },
] as const;

export const AGENT_MANIFEST = {
  description: 'Discover Glyphfield labs, shaders, identities, generation contracts, and the programmatic Studio browser API from one agent-readable interface.',
  execution: {
    completion: [
      'Re-read source or controls after every mutation and confirm the requested state.',
      'For a rendered artifact, verify that the returned Blob is non-empty and its MIME type and file name match the requested format.',
      'For visual work, inspect the authentic rendered canvas; for motion, inspect more than the first frame and verify the requested loop behavior.',
      'For an exact saved shader look, invoke design.frame.capture and retain its portable source. Continuous playback is not proof of a finite seamless loop.',
      'Use design.frame.pause to pause without creating captured-frame assets. PNG/JPG export freezes the current visible frame; GIF/MP4 explicitly sample motion from its anchor. Exports leave the canvas paused and do not persist new frame assets.',
      'Report browser capability failures explicitly. Never claim an export completed from a successful request alone.',
    ],
    discoveryOrder: [
      '/api/agent',
      '/api/labs',
      '/api/materials or another task-specific catalog',
      '/api/generate for the current schema',
      '/docs/agents/choose-interface.md for interface selection',
    ],
    mutation: [
      'Read the current source document before editing an open Studio artifact.',
      'Preserve unknown document fields and make the smallest targeted change.',
      'Apply through the active tool validator; do not mutate React state or storage directly.',
      'Do not run browser exports concurrently because they share renderer and encoder resources.',
    ],
    never: [
      'Do not invent catalog IDs, accessible labels, source fields, or enum values.',
      'Do not put filesystem paths into browser file inputs; construct an authorized File object.',
      'Do not silently replace MP4 with GIF or a live shader with a static approximation.',
      'Do not retry an unchanged validation failure.',
    ],
  },
  generation: AGENT_GENERATION_CONTRACT,
  interfaces: {
    browser: {
      bestFor: ['Canvas', 'WebGL', 'local files', 'local fonts', 'visual placement', 'PNG', 'JPG', 'GIF', 'MP4', 'Lottie'],
      contract: '/docs/reference/browser-api.md',
      global: STUDIO_BROWSER_API_CONTRACT.global,
      workspace: '/studio',
    },
    docs: {
      complete: '/llms-full.txt',
      concise: '/llms.txt',
      markdownPattern: '/docs/:path.md',
      search: '/api/search',
    },
    http: {
      bestFor: ['discovery', 'deterministic SVG', 'identity data', 'element briefs', 'Design Lab source generation'],
      contract: '/openapi.json',
      generation: '/api/generate',
    },
  },
  name: 'Glyphfield Agent API',
  policies: {
    assets: 'Use only assets you are authorized to process. Remote URL fetching is not supported.',
    data: 'Generation requests are processed in memory and are not persisted by Glyphfield.',
    license: 'Glyphfield source is licensed under MIT; see /LICENSE and /llms.txt. Bundled third-party marks remain separately owned.',
  },
  resources: {
    catalog: '/api/catalog',
    docs: '/docs',
    fullInstructions: '/llms-full.txt',
    elements: '/api/elements',
    generate: '/api/generate',
    identities: '/api/identities',
    instructions: '/llms.txt',
    markdownDocs: '/docs/:path.md',
    integrationGuide: '/docs/agents/connect',
    labs: '/api/labs',
    materials: '/api/materials',
    openapi: '/openapi.json',
    search: '/api/search',
    skillGuide: '/docs/skills.md',
    surfaceTextures: '/api/surface-textures/:assetId/:map',
    workspace: '/studio',
  },
  schemaVersion: 3,
  skills: {
    guide: '/docs/skills.md',
    packages: GLYPHFIELD_AGENT_SKILLS,
    repositoryDirectory: 'skills',
  },
  studioBrowserApi: STUDIO_BROWSER_API_CONTRACT,
  version: GLYPHFIELD_AGENT_API_VERSION,
} as const;

export const OPENAPI_DOCUMENT = {
  components: {
    schemas: {
      AgentGenerationRequest: AGENT_GENERATION_REQUEST_SCHEMA,
      ErrorEnvelope: {
        additionalProperties: false,
        properties: {
          error: {
            additionalProperties: false,
            properties: {
              code: { type: 'string' },
              field: { type: 'string' },
              message: { type: 'string' },
            },
            required: ['code', 'field', 'message'],
            type: 'object',
          },
          schemaVersion: { const: 1 },
        },
        required: ['error', 'schemaVersion'],
        type: 'object',
      },
    },
  },
  info: {
    description: AGENT_MANIFEST.description,
    title: AGENT_MANIFEST.name,
    version: GLYPHFIELD_AGENT_API_VERSION,
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
                designSequence: { value: AGENT_GENERATION_EXAMPLES.designSequence },
                slide: { value: AGENT_GENERATION_EXAMPLES.slide },
              },
              schema: { $ref: '#/components/schemas/AgentGenerationRequest' },
            },
          },
          required: true,
        },
        responses: {
          '200': { description: 'Generated JSON artifact envelope, raw SVG, or element brief' },
          '400': { description: 'Structured validation error' },
          '413': { description: 'Request body exceeds 5 MB' },
          '415': { description: 'Content-Type must be application/json' },
          '429': { description: 'Production request rate limit exceeded' },
        },
        summary: 'Generate a Glyphfield artifact',
      },
    },
    '/api/identities': {
      get: {
        responses: { '200': { description: 'Built-in template, GT, and reference identity records' } },
        summary: 'List built-in brand identities and asset IDs',
      },
    },
    '/api/labs': {
      get: {
        responses: { '200': { description: 'Complete Studio lab-plugin catalog and shared-library capabilities' } },
        summary: 'List every Studio lab plugin available to agents',
      },
    },
    '/api/materials': {
      get: {
        responses: { '200': { description: 'Complete shader library, controls, palettes, presets, attribution, layer compatibility, per-material motion/seek/loop capabilities, and PNG frame persistence contract' } },
        summary: 'List every shader available for independent background and logo layers',
      },
    },
    '/api/og': {
      get: {
        parameters: [
          { in: 'query', name: 'title', schema: { maxLength: 84, type: 'string' } },
          { in: 'query', name: 'description', schema: { maxLength: 180, type: 'string' } },
          { in: 'query', name: 'url', schema: { maxLength: 80, type: 'string' } },
          { in: 'query', name: 'accent', schema: HEX_COLOR_SCHEMA },
        ],
        responses: { '200': { description: '1200 × 630 PNG social preview image' } },
        summary: 'Render a parameterized OpenGraph image',
      },
    },
    '/api/og-home': {
      get: {
        responses: { '200': { description: '1200 × 630 PNG home-page social preview image' } },
        summary: 'Render the canonical home-page OpenGraph image',
      },
    },
    '/api/search': {
      get: {
        parameters: [{ in: 'query', name: 'query', required: true, schema: { minLength: 1, type: 'string' } }],
        responses: { '200': { description: 'Ranked documentation search results' } },
        summary: 'Search the processed Glyphfield documentation corpus',
      },
    },
    '/api/github-stars': {
      get: {
        responses: {
          '200': { description: 'Current public repository star count and update timestamp' },
          '503': { description: 'Star count is temporarily unavailable' },
        },
        summary: 'Read the optional repository star count used by product chrome',
      },
    },
    '/api/surface-textures/{assetId}/{map}': {
      get: {
        parameters: [
          { in: 'path', name: 'assetId', required: true, schema: { type: 'string' } },
          { in: 'path', name: 'map', required: true, schema: { enum: ['color', 'displacement', 'metalness', 'normal', 'roughness'], type: 'string' } },
        ],
        responses: {
          '200': { description: 'Allowlisted CC0 texture map with provider and license headers' },
          '404': { description: 'Unknown asset, map type, or unavailable map' },
          '502': { description: 'Allowlisted upstream provider is unavailable' },
        },
        summary: 'Fetch an allowlisted open-surface texture map',
      },
    },
    '/api/docs/{slug}': {
      get: {
        parameters: [{ in: 'path', name: 'slug', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'One documentation page as processed Markdown' }, '404': { description: 'Documentation page not found' } },
        summary: 'Read one documentation page as Markdown',
      },
    },
    '/llms-full.txt': {
      get: {
        responses: { '200': { description: 'Complete concatenated Glyphfield documentation corpus' } },
        summary: 'Load the complete agent-readable documentation corpus',
      },
    },
    '/llms.txt': {
      get: {
        responses: { '200': { description: 'Concise agent router and operating contract' } },
        summary: 'Load concise agent instructions',
      },
    },
    '/openapi.json': {
      get: {
        responses: { '200': { description: 'This OpenAPI 3.1 contract' } },
        summary: 'Read the machine-readable HTTP API contract',
      },
    },
    '/og/docs/{slug}/image.png': {
      get: {
        parameters: [{ in: 'path', name: 'slug', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: '1200 × 630 PNG documentation social preview image' }, '404': { description: 'Documentation page not found' } },
        summary: 'Render the canonical OpenGraph image for one documentation page',
      },
    },
  },
} as const;
