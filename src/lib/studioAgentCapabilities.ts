import { expressionActionContracts } from './expressionActions';
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
      description: 'Render the current Animation workspace with its authentic timeline, shaders, and MP4 audio mix, or a PNG poster frame at the playhead.',
      input: "{ format: 'gif' | 'mp4' | 'png', download?: boolean }",
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
    'animation.export.png': {
      description: 'Render the frame at the playhead at full output size as a PNG poster frame.',
      input: 'No input',
      output: EXPORT_ARTIFACT,
    },
    'animation.export.project': {
      description: 'Package the complete editable animation and authorized local assets.',
      input: 'No input',
      output: EXPORT_ARTIFACT,
    },
    'animation.describe': {
      description: 'Describe scenes with their master-timeline start, hold, outgoing transition, keyframes, and text entrance, plus brand starters.',
      input: 'No input',
      output: '{ durationMs, fps, width, height, playheadMs, scenes: [{ id, index, kind, label, startMs, holdMs, transitionMs, keyframes, textAnimation }], starters }',
    },
    'animation.seek': {
      description: 'Pause and move the playhead; the inspector follows the displayed scene or transition.',
      input: '{ timeMs: non-negative number }',
      output: 'animation.describe result',
    },
    'animation.scene.update': {
      description: 'Set a scene hold or outgoing transition (null follows the sequence default), its text entrance (null removes it), or its pose at the playhead (a keyframe when the layer is keyframed).',
      input: "{ sceneId, holdMs?: number | null, transitionMs?: number | null, textAnimation?: { preset: 'none' | 'type-on' | 'word-rise' | 'line-reveal' | 'glyph-stagger' | 'tracking-in', durationMs?, staggerMs?, easing? } | null, pose?: { alignX?, alignY?, scale?, rotation?, opacity? } }",
      output: 'animation.describe result',
    },
    'animation.keyframe.set': {
      description: 'Add or update the scene layer keyframe at a time into its hold, optionally with a pose and outgoing easing.',
      input: '{ sceneId, atMs, pose?: { alignX?, alignY?, scale?, rotation?, opacity? }, easing?: [x1, y1, x2, y2] }',
      output: 'animation.describe result',
    },
    'animation.keyframe.remove': {
      description: 'Remove one keyframe; removing the last keeps its pose as the static pose.',
      input: '{ sceneId, keyframeId }',
      output: 'animation.describe result',
    },
    'animation.motion.preset': {
      description: 'Replace a scene layer keyframes with a preset built around its settled pose.',
      input: "{ sceneId, preset: 'push-in' | 'rise-in' | 'slide-in' | 'pop-in' | 'float' }",
      output: 'animation.describe result',
    },
    'animation.starter.apply': {
      description: 'Replace the active artboard with a brand starter composed in the identity art direction. Undo restores the previous sequence.',
      input: "{ starterId: 'brand-intro' | 'product-reel' | 'proof-points' }",
      output: 'animation.describe result',
    },
  },
  'brand-book': {
    'brand-book.print': {
      description: 'Open the browser print flow for every visible page of the edited brand book, one 16 × 10 in page per sheet.',
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
  buttons: {
    'components.code.copy': {
      description: 'Copy the generated code for a component to the clipboard: React + Tailwind (TSX and theme.css) or HTML + CSS (markup and components.css), built from the same settings as the preview.',
      input: "{ pattern?: component id, format?: 'react' | 'html' } (defaults to the selected pattern and code format)",
      output: 'The copied text: every file, each headed by its file name',
    },
    'components.code.read': {
      description: 'Return the generated code files for a component without touching the clipboard.',
      input: "{ pattern?: component id, format?: 'react' | 'html' }",
      output: '{ pattern, files: [{ name, language, code }] }',
    },
    'components.list': {
      description: 'List every component pattern with its family, description and the states its preview shows.',
      input: 'No input',
      output: 'Array of { id, label, family, description, states }',
    },
  },
  colors: {
    'colors.contrast.read': {
      description: 'Return the WCAG and APCA contrast of every text/background pair in the palette, the approved colorPairings, and the semantic role checks for light and dark.',
      input: 'No input',
      output: '{ matrix: [{ foreground, background, ratio, wcag, apca, apcaLevel, approved }], pairings, semantic: { light, dark } }',
    },
    'colors.pairing.toggle': {
      description: 'Approve or remove one text pairing in colorPairings. New pairs record AA (4.5:1) or AA-large (3:1); pairs below 3:1 are refused. The change is pending until identity.save or Save changes.',
      input: '{ foreground: color id, background: color id }',
      output: 'The resulting colorPairings array',
    },
    'colors.proportion.balance': {
      description: 'Apply the 60 / 30 / 10 balance to the palette: paper 60, ink 30, emphasis 10, other colors 0. Pending until saved.',
      input: 'No input',
      output: 'Array of { id, proportion }',
    },
    'colors.scale.read': {
      description: 'Return the OKLCH tint and shade scale (steps 50–950) of one palette color, or of every color.',
      input: '{ id?: color id }',
      output: 'Record of color id → [{ step, hex, oklch, anchored }]',
    },
    'colors.semantic.read': {
      description: 'Return every semantic role (background … negative) resolved for light and dark: its color ref, HEX, derived default and whether it is overridden.',
      input: 'No input',
      output: '{ light: Record<role, { ref, hex, defaultRef, overridden }>, dark: … }',
    },
    'colors.tokens.copy': {
      description: 'Copy color tokens to the clipboard. The default is the original OKLCH CSS; css, tailwind and dtcg include scales and semantic light/dark roles.',
      input: "{ format?: 'oklch-css' | 'css' | 'tailwind' | 'dtcg' } (default 'oklch-css')",
      output: 'The copied text',
    },
    'colors.tokens.read': {
      description: 'Return color tokens without accessing the clipboard. The default is the original OKLCH CSS; css, tailwind and dtcg come from the brand token serializers.',
      input: "{ format?: 'oklch-css' | 'css' | 'tailwind' | 'dtcg' } (default 'oklch-css')",
      output: 'Token text (CSS, Tailwind v4 theme, or DTCG JSON)',
    },
    'colors.vision.read': {
      description: 'Simulate the palette for a color vision deficiency (Machado 2009, full severity) and list pairs that nearly merge.',
      input: "{ mode?: 'normal' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'achromatopsia' } (default 'deuteranopia')",
      output: '{ mode, colors: [{ id, hex, simulated }], confusable: [{ first, second, distance, typicalDistance }] }',
    },
  },
  'design-board': {
    'moodboard.export.identity': {
      description: 'Export the active identity used by the moodboard as JSON.',
      input: 'No input',
      output: EXPORT_ARTIFACT,
    },
    'moodboard.export.png': {
      description: 'Render the current moodboard board, including tile edits, as PNG.',
      input: 'No input',
      output: EXPORT_ARTIFACT,
    },
    'moodboard.export.svg': {
      description: 'Package the current moodboard board as a standalone SVG with embedded fonts and images.',
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
    'identity.read': {
      description: 'Read the active BrandIdentity as an object (a copy; mutate through identity.apply).',
      input: 'No input',
      output: 'BrandIdentity object',
    },
    'identity.validate': {
      description: 'Validate a merge patch or complete identity against the BrandIdentity schema without applying it. The schema is served by GET /api/brand/validate.',
      input: "{ identity: object, mode?: 'patch' | 'full' } (default patch)",
      output: '{ ok: boolean, issues: [{ code, message, path, severity }] }',
    },
    'identity.apply': {
      description: 'Validate and merge identity source. Records merge by id (typography by role), string lists are replaced, unknown fields and project fields are kept. replace lists collections to overwrite as a whole. Throws a TypeError listing every issue.',
      input: "{ identity: object, mode?: 'merge' | 'replace', replace?: ('colors' | 'colorPairings' | 'applications' | 'assets' | 'fonts' | …)[], remove?: { assets?, colors?, fonts?, applications?, references?, motion?, proofAssets?: string[] }, save?: boolean }",
      output: '{ identity, warnings: [{ code, message, path, severity }], saved: boolean, health: { score, grade, counts } }',
    },
    'identity.asset.add': {
      description: 'Add an image asset from file bytes. A logo slot (mark-dark for light surfaces, mark-light for dark surfaces, wordmark, wordmark-light, mark-mono) replaces that slot in place.',
      input: "{ file: File, slot?: 'mark-dark' | 'mark-light' | 'wordmark' | 'wordmark-light' | 'mark-mono', id?, type?, label?, surface?, usage?, alt?, license?, sourceUrl?, sourceOwner?, redistribution?, tags?, save?: boolean }",
      output: '{ asset: BrandAsset }',
    },
    'identity.font.add': {
      description: 'Store a TTF, OTF, WOFF or WOFF2 file (2.5 MB maximum) with the identity and optionally assign it to typography roles.',
      input: "{ file: File, roles?: ('Display' | 'Body' | 'Accent' | 'Code')[], family?, label?, weight?, weightMin?, weightMax?, style?: 'normal' | 'italic', license?, sourceUrl?, id?, save?: boolean }",
      output: '{ font: BrandFontAsset }',
    },
    'identity.audit': {
      description: 'Run the brand health audit: completeness score, section scores, WCAG contrast pairs and findings with one-click fixes or agent prompts.',
      input: 'No input',
      output: '{ schemaVersion, score, grade, counts, sections, contrast, findings: [{ id, section, severity, title, detail, fix?: { id, label }, agentPrompt }] }',
    },
    'identity.fix': {
      description: 'Apply one deterministic audit fix by the fix.id of a finding.',
      input: '{ fixId: string, save?: boolean }',
      output: 'Brand health report after the fix',
    },
    'identity.save': {
      description: 'Save pending identity changes on this device so every tool and future sessions use them.',
      input: 'No input',
      output: '{ saved: true }',
    },
    'identity.export.kit': {
      description: 'Export the brand kit: a ZIP with brand.md, DTCG tokens, CSS variables, a Tailwind v4 theme, identity.json, logos and redistributable fonts, or one of those files.',
      input: "{ format?: 'zip' | 'dtcg' | 'css' | 'tailwind' | 'markdown' | 'logos', download?: boolean }",
      output: EXPORT_ARTIFACT,
    },
    'identity.setup.prompt': {
      description: 'Return the ready-to-run Set up with your agent prompt for this project.',
      input: "{ mode?: 'new' | 'improve' }",
      output: '{ mode, prompt: string }',
    },
  },
  lottie: {
    'lottie.export': {
      description: 'Export the current rendered PNG frame, the edited JSON/.lottie source, or the trimmed segment as GIF or MP4 with the composited background.',
      input: "{ format: 'png' | 'source' | 'gif' | 'mp4', download?: boolean }",
      output: EXPORT_ARTIFACT,
    },
    'lottie.export.gif': {
      description: 'Render the trimmed segment, with speed, direction, edits, and background, as GIF.',
      input: 'No input',
      output: EXPORT_ARTIFACT,
    },
    'lottie.export.mp4': {
      description: 'Render the trimmed segment, with speed, direction, edits, and background, as MP4.',
      input: 'No input',
      output: EXPORT_ARTIFACT,
    },
    'lottie.describe': {
      description: 'Describe the active document: top-level layers with keys, text layers, static colours, markers, segment, edits, and recolour mode.',
      input: 'No input',
      output: '{ format, source, totalFrames, frameRate, segment, layers, textLayers, colors, markers, edits, recolor }',
    },
    'lottie.edit': {
      description: 'Apply non-destructive JSON edits. Each listed field replaces the stored one: hidden layer keys, colour map, text by layer key, named markers, and recolour mode.',
      input: "{ hiddenLayers?: string[], colorMap?: Record<'#RRGGBB', '#RRGGBB'>, textOverrides?: Record<layerKey, string>, markers?: [{ name, frame, duration }], recolor?: 'palette' | 'source' }",
      output: 'lottie.describe result',
    },
    'lottie.colors.brand': {
      description: 'Map every document colour to the nearest active brand token: chromatic colours to accents, neutrals by lightness.',
      input: 'No input',
      output: 'lottie.describe result',
    },
    'lottie.segment.set': {
      description: 'Play a named marker segment or set the in and out frames.',
      input: '{ marker: string } | { start: number, end: number }',
      output: 'lottie.describe result',
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
    ...expressionActionContracts('blog'),
  },
  material: {
    'design.workspace.describe': {
      description: 'Describe the open canvas, loose layer IDs, artboards, and active editing surface.',
      input: 'No input', output: '{ activeSurface, canvas: { layerIds }, artboards: [{ id, name, x, y, width, height, layerIds }] }',
    },
    'design.workspace.frameSelection': {
      description: 'Create a fitted artboard around the current loose-layer selection without changing its on-canvas scale or layout.',
      input: 'No input; select canvas layers first using the layer controls', output: 'null',
    },
    'design.workspace.activate': {
      description: 'Edit the loose canvas or an existing artboard with the shared layer controls.',
      input: "{ target: 'canvas' | artboardId }", output: 'null',
    },
    'design.workspace.move': {
      description: 'Move active layers between the canvas and artboards, preserving their world-space boxes, text layout, and appearance. IDs change only to avoid a destination collision.',
      input: "{ target: 'canvas' | artboardId, layerIds: string[], placement?: 'preserve' | 'beside' }", output: 'null',
    },
    'design.export': {
      description: 'Render the selected artboard using the authentic Design Lab renderer. Loose canvas layers are not exported; select an artboard first.',
      input: "{ format: 'png' | 'jpg' | 'gif' | 'mp4', mode?: 'standard' | 'shader-sequence', download?: boolean }",
      output: EXPORT_ARTIFACT,
    },
    'design.text.format': {
      description: 'Format a non-empty range of text on the active surface without changing other characters. Ordered runs survive source, history, saved designs, and export.',
      input: "{ layerId, start, end, style: { color?, fontRole?: 'Display' | 'Body' | 'Accent' | 'Code', fontSize?, weight?, fontStyle?: 'normal' | 'italic', underline?, strikethrough?, tracking? } }; start/end are UTF-16 offsets, end exclusive; fontSize is authored pixels before layer scale",
      output: 'null',
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
    ...expressionActionContracts('opengraph'),
  },
  partnership: {
    'partnership.export.png': { description: 'Render the current partnership lockup as PNG.', input: 'No input', output: EXPORT_ARTIFACT },
    ...expressionActionContracts('partnership'),
  },
  slides: {
    'slides.export.png': { description: 'Render the active slide as PNG.', input: 'No input', output: EXPORT_ARTIFACT },
    ...expressionActionContracts('slides'),
  },
  terminal: {
    'terminal.export.png': { description: 'Render the current syntax-highlighted terminal card as PNG.', input: 'No input', output: EXPORT_ARTIFACT },
    ...expressionActionContracts('terminal'),
  },
  typography: {
    'typography.axes.read': {
      description: 'Read the variation axes (wght, opsz, slnt …) of each role’s font file. WOFF2 needs a browser that decodes Brotli; unreadable files return null.',
      input: 'No input',
      output: 'Record of role → { family, fontId, axes: [{ tag, min, default, max }] | null }',
    },
    'typography.guidance.read': {
      description: 'Return leading, tracking, measure, scale and weight warnings for every role at its scale size.',
      input: 'No input',
      output: 'Array of { id, role?, severity, message }',
    },
    'typography.scale.read': {
      description: 'Return the modular type scale: base, ratio and its name, each step in px and rem, and the step each role is set at.',
      input: 'No input',
      output: '{ basePx, ratio, ratioName, roleSteps, steps: [{ name, step, px, rem }] }',
    },
    'typography.tokens.copy': {
      description: 'Copy the type tokens (families, sizes, weights, leading, tracking, axes, scale) to the clipboard.',
      input: "{ format?: 'css' | 'tailwind' | 'dtcg' } (default 'css')",
      output: 'The copied text',
    },
    'typography.tokens.read': {
      description: 'Return the type tokens without accessing the clipboard, from the brand token serializers.',
      input: "{ format?: 'css' | 'tailwind' | 'dtcg' } (default 'css')",
      output: 'Token text',
    },
  },
} as const satisfies Partial<Record<NavigableStudioToolId, Record<string, StudioActionContract>>>;

export const STUDIO_AGENT_CAPABILITIES = {
  animation: {
    directHttpGeneration: [],
    exports: [
      { action: 'animation.export.gif', format: 'GIF', route: 'browser-action' },
      { action: 'animation.export.mp4', format: 'MP4', route: 'browser-action' },
      { action: 'animation.export.png', format: 'PNG poster frame', route: 'browser-action' },
      { action: 'animation.export.project', format: 'JSON project', route: 'browser-action' },
    ],
    source: { apply: true, boundary: 'CanvasDocument schema 2 with Animation state and portable assets', format: 'JSON', read: true },
  },
  blog: { directHttpGeneration: ['template'], exports: [{ action: 'blog.export.png', format: 'PNG', route: 'browser-action' }, { action: 'blog.export.svg', format: 'SVG', route: 'browser-action' }, { format: 'SVG', route: 'http' }], source: { apply: true, boundary: 'Expression document: CanvasDocument schema 2 with expression source version 2', format: 'JSON', read: true } },
  'brand-book': { directHttpGeneration: [], exports: [{ action: 'brand-book.print', format: 'PDF print flow', route: 'browser-action' }], source: { apply: true, boundary: 'Brand book section order and visibility, and per-page visibility, layout, surface, image, and copy', format: 'JSON', read: true } },
  'brand-elements': { directHttpGeneration: ['element-brief'], exports: [{ action: 'brand-element.export.brief', format: 'JSON brief', route: 'browser-action' }], source: { apply: true, boundary: 'Selected brand-element override', format: 'JSON', read: true } },
  buttons: { directHttpGeneration: [], exports: [{ action: 'components.code.read', format: 'React + Tailwind or HTML + CSS component code', route: 'browser-action' }, { action: 'components.code.copy', format: 'Component code via clipboard', route: 'browser-action' }], source: { apply: true, boundary: 'Component Library workspace configuration (version 2: pattern, content, system, palette, typography, theme, code format)', format: 'JSON', read: true } },
  colors: { directHttpGeneration: [], exports: [{ action: 'colors.tokens.copy', format: 'OKLCH CSS, CSS variables, Tailwind v4 or DTCG tokens via clipboard', route: 'browser-action' }, { action: 'colors.tokens.read', format: 'OKLCH CSS, CSS variables, Tailwind v4 or DTCG tokens', route: 'browser-action' }], source: { apply: true, boundary: 'Identity palette, colorPairings and colorSystem (version 2), plus per-token opacity', format: 'JSON', read: true } },
  'design-board': { directHttpGeneration: [], exports: [{ action: 'moodboard.export.png', format: 'PNG', route: 'browser-action' }, { action: 'moodboard.export.svg', format: 'SVG', route: 'browser-action' }, { action: 'moodboard.export.identity', format: 'Identity JSON', route: 'browser-action' }], source: { apply: true, boundary: 'Moodboard boards, tiles (order, visibility, layout, size, surface, image, copy), and export settings', format: 'JSON', read: true } },
  identity: { directHttpGeneration: [], exports: [{ action: 'identity.export.json', format: 'BrandIdentity JSON', route: 'browser-action' }, { action: 'identity.export.kit', format: 'Brand kit ZIP, DTCG JSON, CSS, Tailwind v4 theme, brand.md, logo ZIP', route: 'browser-action' }, { format: 'DTCG JSON, CSS, Tailwind v4 theme, brand.md via POST /api/brand/kit', route: 'http' }], source: { apply: true, boundary: 'Complete BrandIdentity', format: 'JSON', read: true } },
  lottie: { directHttpGeneration: [], exports: [{ action: 'lottie.export.frame.png', format: 'PNG frame', route: 'browser-action' }, { action: 'lottie.export.gif', format: 'GIF', route: 'browser-action' }, { action: 'lottie.export.mp4', format: 'MP4', route: 'browser-action' }, { action: 'lottie.export.source', format: 'JSON or .lottie', route: 'browser-action' }], source: { apply: true, boundary: 'Portable Lottie composition; raw animation data retained when authorized', format: 'JSON', read: true } },
  material: { directHttpGeneration: ['design-sequence'], exports: [{ action: 'design.export.png', format: 'PNG', route: 'browser-action' }, { action: 'design.export.jpg', format: 'JPG', route: 'browser-action' }, { action: 'design.export.gif', format: 'GIF', route: 'browser-action' }, { action: 'design.export.mp4', format: 'MP4', route: 'browser-action' }, { action: 'design.export.project', format: 'JSON project', route: 'browser-action' }], source: { apply: true, boundary: 'CanvasDocument schema 2 with Design Lab metadata source 4', format: 'JSON', read: true } },
  opengraph: { directHttpGeneration: ['background', 'template'], exports: [{ action: 'opengraph.export.png', format: 'PNG', route: 'browser-action' }, { action: 'opengraph.export.svg', format: 'SVG', route: 'browser-action' }, { format: 'SVG background', route: 'http' }], source: { apply: true, boundary: 'Expression document: CanvasDocument schema 2 with expression source version 2', format: 'JSON', read: true } },
  partnership: { directHttpGeneration: ['template'], exports: [{ action: 'partnership.export.png', format: 'PNG', route: 'browser-action' }, { action: 'partnership.export.svg', format: 'SVG', route: 'browser-action' }, { format: 'SVG', route: 'http' }], source: { apply: true, boundary: 'Expression document: CanvasDocument schema 2 with expression source version 2', format: 'JSON', read: true } },
  slides: { directHttpGeneration: ['template'], exports: [{ action: 'slides.export.png', format: 'PNG', route: 'browser-action' }, { action: 'slides.export.svg', format: 'SVG', route: 'browser-action' }, { action: 'slides.export.pdf', format: 'PDF deck', route: 'browser-action' }, { format: 'SVG', route: 'http' }], source: { apply: true, boundary: 'Expression document: CanvasDocument schema 2 with expression source version 2 (one page per slide)', format: 'JSON', read: true } },
  terminal: { directHttpGeneration: ['template'], exports: [{ action: 'terminal.export.png', format: 'PNG', route: 'browser-action' }, { action: 'terminal.export.svg', format: 'SVG', route: 'browser-action' }, { format: 'SVG', route: 'http' }], source: { apply: true, boundary: 'Expression document: CanvasDocument schema 2 with expression source version 2', format: 'JSON', read: true } },
  typography: { directHttpGeneration: [], exports: [{ action: 'typography.tokens.read', format: 'CSS, Tailwind v4 or DTCG type tokens', route: 'browser-action' }, { action: 'typography.tokens.copy', format: 'Type tokens via clipboard', route: 'browser-action' }], source: { apply: true, boundary: 'Identity typography roles and typeScale plus specimen settings (version 2)', format: 'JSON', read: true } },
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
