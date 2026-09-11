import type { StudioToolId } from './studioCatalog';

export type NavigableStudioToolId = Exclude<
  StudioToolId,
  'backgrounds' | 'logo' | 'logo-shader' | 'surface'
>;

export type StudioActionContract = {
  description: string;
  input: string;
  output: string;
};

export type StudioExportCapability = {
  action?: string;
  format: string;
  route: 'browser-action' | 'browser-control' | 'http';
};

export type StudioSourceCapability = false | {
  apply: true;
  boundary: string;
  format: 'JSON';
  read: true;
};

export type StudioAgentCapability = {
  directHttpGeneration: readonly ('background' | 'design-sequence' | 'element-brief' | 'template')[];
  exports: readonly StudioExportCapability[];
  source: StudioSourceCapability;
};

export const STUDIO_STANDARD_ACTION_CONTRACTS = {
  'artifact.download': {
    description: 'Download a previously returned Blob artifact using its deterministic file name.',
    input: '{ blob: Blob, fileName: non-empty string }',
    output: '{ fileName: string }',
  },
  'control.activate': {
    description: 'Activate one enabled control in the active Studio workspace by exact accessible label.',
    input: 'Accessible control label string',
    output: 'null',
  },
  'control.set': {
    description: 'Set one enabled form control in the active Studio workspace by exact accessible label.',
    input: '{ label: string, value: string | number | boolean | File | File[] }',
    output: 'null',
  },
  'controls.list': {
    description: 'List enabled interactive controls scoped to the active Studio workspace.',
    input: 'No input',
    output: 'Array of { kind, label, value? }',
  },
  'source.apply': {
    description: 'Validate and apply a JSON string or object through the active tool source boundary.',
    input: 'JSON string or object',
    output: 'Normalized source string when readable, otherwise null',
  },
  'source.read': {
    description: 'Read the active tool source document without mutating it.',
    input: 'No input',
    output: 'JSON string',
  },
} as const satisfies Record<string, StudioActionContract>;

const EXPORT_ARTIFACT = 'ExportPreviewAsset with a non-empty Blob and deterministic fileName; use studio.download(artifact) to save';

export const STUDIO_TOOL_ACTION_CONTRACTS = {
  animation: {
    'animation.export': {
      description: 'Render the current Animation workspace with its authentic timeline, shaders, and MP4 audio mix.',
      input: "{ format: 'gif' | 'mp4', download?: boolean }",
      output: EXPORT_ARTIFACT,
    },
    'animation.export.gif': {
      description: 'Render the current Animation workspace as GIF.',
      input: 'No input',
      output: EXPORT_ARTIFACT,
    },
    'animation.export.mp4': {
      description: 'Render the current Animation workspace as MP4, including configured timeline audio.',
      input: 'No input',
      output: EXPORT_ARTIFACT,
    },
    'animation.export.project': {
      description: 'Package the complete editable animation and authorized local assets.',
      input: 'No input',
      output: EXPORT_ARTIFACT,
    },
  },
  'brand-book': {
    'brand-book.print': {
      description: 'Open the browser print flow for the complete identity-derived brand book.',
      input: 'No input',
      output: 'null',
    },
  },
  'brand-elements': {
    'brand-element.export.brief': {
      description: 'Create the selected brand element configuration brief as JSON.',
      input: 'No input',
      output: EXPORT_ARTIFACT,
    },
  },
  colors: {
    'colors.tokens.copy': {
      description: 'Copy the current normalized OKLCH color tokens to the clipboard.',
      input: 'No input',
      output: 'The copied CSS custom-property string',
    },
    'colors.tokens.read': {
      description: 'Return the current normalized OKLCH color tokens without accessing the clipboard.',
      input: 'No input',
      output: 'CSS custom-property string',
    },
  },
  'design-board': {
    'moodboard.export.identity': {
      description: 'Export the active identity used by the moodboard as JSON.',
      input: 'No input',
      output: EXPORT_ARTIFACT,
    },
    'moodboard.export.png': {
      description: 'Render the current moodboard composition as PNG.',
      input: 'No input',
      output: EXPORT_ARTIFACT,
    },
  },
  identity: {
    'identity.export.json': {
      description: 'Export the complete active BrandIdentity as JSON.',
      input: 'No input',
      output: EXPORT_ARTIFACT,
    },
  },
  lottie: {
    'lottie.export': {
      description: 'Export either the current rendered PNG frame or the edited JSON/.lottie source.',
      input: "{ format: 'png' | 'source', download?: boolean }",
      output: EXPORT_ARTIFACT,
    },
    'lottie.export.frame.png': {
      description: 'Render the current Lottie frame and configured background as PNG.',
      input: 'No input',
      output: EXPORT_ARTIFACT,
    },
    'lottie.export.source': {
      description: 'Export edited JSON or the original .lottie archive according to the active source.',
      input: 'No input',
      output: EXPORT_ARTIFACT,
    },
  },
  blog: {
    'blog.export.png': { description: 'Render the current blog-cover composition as PNG.', input: 'No input', output: EXPORT_ARTIFACT },
  },
  material: {
    'design.export': {
      description: 'Render a still or motion artifact using the authentic Design Lab renderer.',
      input: "{ format: 'png' | 'jpg' | 'gif' | 'mp4', mode?: 'standard' | 'shader-sequence', download?: boolean }",
      output: EXPORT_ARTIFACT,
    },
    'design.export.gif': { description: 'Render the current design as GIF.', input: 'No input', output: EXPORT_ARTIFACT },
    'design.export.jpg': { description: 'Render the current design as JPG.', input: 'No input', output: EXPORT_ARTIFACT },
    'design.export.mp4': { description: 'Render the current design as MP4.', input: 'No input', output: EXPORT_ARTIFACT },
    'design.export.png': { description: 'Render the current design as PNG.', input: 'No input', output: EXPORT_ARTIFACT },
    'design.export.project': {
      description: 'Package every editable artboard, authorized local image, shader frame, and local font in the portable project format.',
      input: 'No input',
      output: 'ExportPreviewAsset: non-empty application/json Blob, .glyphfield.json fileName, format JSON, previewKind file; use studio.download(artifact) to save',
    },
    'design.export.shader-sequence.gif': { description: 'Render the configured shader sequence as GIF.', input: 'No input', output: EXPORT_ARTIFACT },
    'design.export.shader-sequence.mp4': { description: 'Render the configured shader sequence as MP4.', input: 'No input', output: EXPORT_ARTIFACT },
    'design.frame.capture': {
      description: 'Freeze ready native shader pixels and persist lossless PNG checkpoints with editable renderer state.',
      input: 'No input',
      output: 'Portable CanvasDocument JSON string with embedded captured-frame assets',
    },
    'design.frame.pause': {
      description: 'Synchronously pause the visible native shader frame without encoding PNGs or writing captured-frame assets.',
      input: 'No input',
      output: 'null',
    },
    'design.frame.play': { description: 'Resume native shader playback.', input: 'No input', output: 'null' },
    'design.frame.seek': {
      description: 'Select shader time for editable, seekable materials; reject stateful simulation replay.',
      input: '{ timeMs: non-negative finite number }',
      output: 'null',
    },
    'design.motion.describe': {
      description: 'Describe current layer providers, seek/capture support, and known or unverified loop behavior.',
      input: 'No input',
      output: 'Motion capability object for every active shader layer',
    },
    'design.sequence.configure': { description: 'Update validated shader-sequence settings.', input: 'Partial shader-sequence settings object', output: 'null' },
    'design.sequence.describe': { description: 'Describe resolved shader-sequence settings, duration, and material timeline.', input: 'No input', output: '{ durationMs, materials, settings }' },
    'design.sequence.preview': { description: 'Start the configured shader-sequence preview.', input: 'No input', output: 'null' },
    'design.sequence.stop': { description: 'Stop the shader-sequence preview.', input: 'No input', output: 'null' },
  },
  opengraph: {
    'opengraph.export.png': { description: 'Render the current OpenGraph composition as PNG.', input: 'No input', output: EXPORT_ARTIFACT },
  },
  partnership: {
    'partnership.export.png': { description: 'Render the current partnership lockup as PNG.', input: 'No input', output: EXPORT_ARTIFACT },
  },
  slides: {
    'slides.export.png': { description: 'Render the current slide composition as PNG.', input: 'No input', output: EXPORT_ARTIFACT },
  },
  terminal: {
    'terminal.export.png': { description: 'Render the current syntax-highlighted terminal card as PNG.', input: 'No input', output: EXPORT_ARTIFACT },
  },
} as const satisfies Partial<Record<NavigableStudioToolId, Record<string, StudioActionContract>>>;

export const STUDIO_AGENT_CAPABILITIES = {
  animation: {
    directHttpGeneration: [],
    exports: [
      { action: 'animation.export.gif', format: 'GIF', route: 'browser-action' },
      { action: 'animation.export.mp4', format: 'MP4', route: 'browser-action' },
      { action: 'animation.export.project', format: 'JSON project', route: 'browser-action' },
    ],
    source: { apply: true, boundary: 'CanvasDocument schema 2 with Animation state and portable assets', format: 'JSON', read: true },
  },
  blog: { directHttpGeneration: ['template'], exports: [{ action: 'blog.export.png', format: 'PNG', route: 'browser-action' }, { format: 'SVG', route: 'http' }], source: { apply: true, boundary: 'Blog cover workspace document', format: 'JSON', read: true } },
  'brand-book': { directHttpGeneration: [], exports: [{ action: 'brand-book.print', format: 'PDF print flow', route: 'browser-action' }], source: false },
  'brand-elements': { directHttpGeneration: ['element-brief'], exports: [{ action: 'brand-element.export.brief', format: 'JSON brief', route: 'browser-action' }], source: { apply: true, boundary: 'Selected brand-element override', format: 'JSON', read: true } },
  buttons: { directHttpGeneration: [], exports: [], source: { apply: true, boundary: 'Component Library workspace configuration', format: 'JSON', read: true } },
  colors: { directHttpGeneration: [], exports: [{ action: 'colors.tokens.copy', format: 'CSS variables / color tokens via clipboard', route: 'browser-action' }], source: { apply: true, boundary: 'Identity-bound color token workspace', format: 'JSON', read: true } },
  'design-board': { directHttpGeneration: [], exports: [{ action: 'moodboard.export.png', format: 'PNG', route: 'browser-action' }, { action: 'moodboard.export.identity', format: 'Identity JSON', route: 'browser-action' }], source: { apply: true, boundary: 'Moodboard composition and export settings', format: 'JSON', read: true } },
  identity: { directHttpGeneration: [], exports: [{ action: 'identity.export.json', format: 'BrandIdentity JSON', route: 'browser-action' }], source: { apply: true, boundary: 'Complete BrandIdentity', format: 'JSON', read: true } },
  lottie: { directHttpGeneration: [], exports: [{ action: 'lottie.export.frame.png', format: 'PNG frame', route: 'browser-action' }, { action: 'lottie.export.source', format: 'JSON or .lottie', route: 'browser-action' }], source: { apply: true, boundary: 'Portable Lottie composition; raw animation data retained when authorized', format: 'JSON', read: true } },
  material: { directHttpGeneration: ['design-sequence'], exports: [{ action: 'design.export.png', format: 'PNG', route: 'browser-action' }, { action: 'design.export.jpg', format: 'JPG', route: 'browser-action' }, { action: 'design.export.gif', format: 'GIF', route: 'browser-action' }, { action: 'design.export.mp4', format: 'MP4', route: 'browser-action' }, { action: 'design.export.project', format: 'JSON project', route: 'browser-action' }], source: { apply: true, boundary: 'CanvasDocument schema 2 with Design Lab metadata source 4', format: 'JSON', read: true } },
  opengraph: { directHttpGeneration: ['background'], exports: [{ action: 'opengraph.export.png', format: 'PNG', route: 'browser-action' }, { format: 'SVG background', route: 'http' }], source: { apply: true, boundary: 'OpenGraph workspace document', format: 'JSON', read: true } },
  partnership: { directHttpGeneration: ['template'], exports: [{ action: 'partnership.export.png', format: 'PNG', route: 'browser-action' }, { format: 'SVG', route: 'http' }], source: { apply: true, boundary: 'Partnership workspace document', format: 'JSON', read: true } },
  slides: { directHttpGeneration: ['template'], exports: [{ action: 'slides.export.png', format: 'PNG', route: 'browser-action' }, { format: 'SVG', route: 'http' }], source: { apply: true, boundary: 'Slide workspace document', format: 'JSON', read: true } },
  terminal: { directHttpGeneration: [], exports: [{ action: 'terminal.export.png', format: 'PNG', route: 'browser-action' }], source: { apply: true, boundary: 'Terminal card workspace document', format: 'JSON', read: true } },
  typography: { directHttpGeneration: [], exports: [], source: { apply: true, boundary: 'Identity typography preview workspace', format: 'JSON', read: true } },
} as const satisfies Record<NavigableStudioToolId, StudioAgentCapability>;

export function studioToolActionContracts(toolId: StudioToolId): Record<string, StudioActionContract> {
  return STUDIO_TOOL_ACTION_CONTRACTS[toolId as keyof typeof STUDIO_TOOL_ACTION_CONTRACTS] ?? {};
}

export function studioToolActionNames(toolId: StudioToolId): string[] {
  return Object.keys(studioToolActionContracts(toolId));
}

export function studioAgentCapability(toolId: StudioToolId): StudioAgentCapability | undefined {
  return STUDIO_AGENT_CAPABILITIES[toolId as NavigableStudioToolId];
}
