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
          surfaceMaterial: 'none | kerf-wood | woven-wire | perforated-metal | carved-stone | embossed-paper | brushed-metal | hammered-foil | corrugated-polymer | cork-composite | frosted-glass',
          surfaceMetallic: '0–100 specular response',
          surfaceOpenArea: '0–92 porosity or opening ratio',
          surfaceRoughness: '0–100 highlight spread',
          surfaceScale: '12–140 physical pattern scale',
          width: '64–4096 integer; total pixels may not exceed 12,000,000',
        },
      },
      mimeTypes: ['application/json', 'image/svg+xml'],
    },
    'design-sequence': {
      description: 'Create an exact Design Lab source document for a fixed composition with authentic browser-native PNG, JPG, GIF, and MP4 export.',
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
      programmaticExport: "Open /studio, apply response.document, then invoke design.export with format png | jpg | gif | mp4, optional mode shader-sequence, and optional download true.",
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
  unknownTopLevelFields: 'Rejected with HTTP 400 and error code unknown_field',
  schemaVersion: 2,
} as const;

export const STUDIO_BROWSER_API_CONTRACT = {
  event: 'glyphfield:studio-api-ready',
  global: 'window.glyphfield.studio',
  operations: {
    activate: 'Activate any visible control by its accessible label',
    activeTool: 'Return the active Studio tool ID',
    applySource: 'Apply a JSON object or string through the active tool validator',
    controls: 'List visible interactive controls and current values',
    describe: 'List exact actions and source support for the active tool',
    download: 'Save a generated Blob artifact with its deterministic file name',
    invoke: 'Invoke source, control, export, or tool-specific actions',
    readSource: 'Read the exact current source document',
    set: 'Set a visible form control by accessible label',
  },
  standardActions: ['source.read', 'source.apply', 'controls.list', 'control.activate', 'control.set', 'artifact.download'],
  version: 1,
} as const;

export const AGENT_MANIFEST = {
  description: 'Discover Glyphfield labs, shaders, identities, generation contracts, and the programmatic Studio browser API from one agent-readable interface.',
  generation: AGENT_GENERATION_CONTRACT,
  name: 'Glyphfield Agent API',
  policies: {
    assets: 'Use only assets you are authorized to process. Remote URL fetching is not supported.',
    data: 'Generation requests are processed in memory and are not persisted by Glyphfield.',
    license: 'Glyphfield source is licensed under MIT; see /LICENSE and /llms.txt. Bundled third-party marks remain separately owned.',
  },
  resources: {
    catalog: '/api/catalog',
    docs: '/docs',
    elements: '/api/elements',
    generate: '/api/generate',
    identities: '/api/identities',
    instructions: '/llms.txt',
    integrationGuide: '/docs/agents/connect',
    labs: '/api/labs',
    materials: '/api/materials',
    openapi: '/openapi.json',
    workspace: '/studio',
  },
  schemaVersion: 2,
  studioBrowserApi: STUDIO_BROWSER_API_CONTRACT,
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
                designSequence: { value: AGENT_GENERATION_EXAMPLES.designSequence },
                slide: { value: AGENT_GENERATION_EXAMPLES.slide },
              },
              schema: {
                oneOf: [
                  { required: ['kind', 'settings'], type: 'object' },
                  { required: ['kind', 'shader', 'sequence'], type: 'object' },
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
        responses: { '200': { description: 'Complete shader library, controls, palettes, presets, attribution, and background/logo layer compatibility' } },
        summary: 'List every shader available for independent background and logo layers',
      },
    },
  },
} as const;
