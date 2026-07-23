export type StudioToolCategory =
  | 'Brand'
  | 'Elements'
  | 'Boards'
  | 'Motion'
  | 'Foundations'
  | 'Expressions'
  | 'Components';

export type StudioToolId =
  | 'brand-elements'
  | 'design-board'
  | 'animation'
  | 'logo-shader'
  | 'identity'
  | 'opengraph'
  | 'logo'
  | 'backgrounds'
  | 'colors'
  | 'typography'
  | 'terminal'
  | 'partnership'
  | 'blog'
  | 'slides'
  | 'buttons';

export type StudioTool = {
  category: StudioToolCategory;
  description: string;
  id: StudioToolId;
  keywords: readonly string[];
  name: string;
  shortcut: string;
};

export const STUDIO_CATEGORIES: readonly StudioToolCategory[] = [
  'Brand',
  'Elements',
  'Boards',
  'Motion',
  'Foundations',
  'Expressions',
  'Components',
];

export const STUDIO_TOOLS: readonly StudioTool[] = [
  {
    category: 'Brand',
    description: 'Edit the shared identity, asset library, font files, colors, voice, strategy, and system defaults used everywhere.',
    id: 'identity',
    keywords: ['brand settings', 'identity', 'assets', 'asset library', 'fonts', 'font upload', 'colors', 'typography', 'logos', 'strategy', 'voice', 'foundations'],
    name: 'Brand identity',
    shortcut: 'I',
  },
  {
    category: 'Elements',
    description: 'Apply the active identity across digital, developer, social, editorial, event, and physical touchpoints.',
    id: 'brand-elements',
    keywords: [
      'email',
      'cli',
      'ascii',
      'twitter',
      'x post',
      'slides',
      'deck',
      'lanyard',
      'business card',
      'web card',
      'logo background',
      'event badge',
      'sticker',
      'letterhead',
      'press kit',
    ],
    name: 'Brand elements',
    shortcut: 'E',
  },
  {
    category: 'Boards',
    description: 'Compose the identity as an application showcase or complete system board, then export a high-resolution PNG.',
    id: 'design-board',
    keywords: ['brand board', 'design board', 'moodboard', 'style tile', 'identity', 'guidelines'],
    name: 'Moodboard',
    shortcut: 'D',
  },
  {
    category: 'Motion',
    description: 'Animate text and images with deterministic packages and cubic Bézier timing.',
    id: 'animation',
    keywords: ['gif', 'morph', 'typing', 'crossfade', 'frames', 'cubic bezier'],
    name: 'Animation',
    shortcut: 'A',
  },
  {
    category: 'Motion',
    description: 'Apply editable ShaderGradient and local GLSL materials behind or inside the active logo.',
    id: 'logo-shader',
    keywords: ['shader', 'webgl', 'logo background', 'gradient', 'shadergradient', 'shaders', 'liquid glass', 'aurora', 'plasma', 'animated'],
    name: 'Logo shader',
    shortcut: 'G',
  },
  {
    category: 'Expressions',
    description: 'Compose repeatable social previews with fonts, logos, and background assets.',
    id: 'opengraph',
    keywords: ['open graph', 'og image', 'social preview', 'font upload', 'logo upload'],
    name: 'OpenGraph',
    shortcut: 'O',
  },
  {
    category: 'Foundations',
    description: 'Preview and download the active identity mark across colors, static surfaces, live shaders, and sizes.',
    id: 'logo',
    keywords: ['logomark', 'transparent', 'white', 'black', 'primary', 'secondary', 'download'],
    name: 'Logo lab',
    shortcut: 'L',
  },
  {
    category: 'Foundations',
    description: 'Build exportable gradients, grain, dithering, patterns, and live GPU logo surfaces.',
    id: 'backgrounds',
    keywords: ['background', 'dither', 'gradient', 'grain', 'noise', 'dots', 'lines', 'grid', 'texture', 'bayer'],
    name: 'Background lab',
    shortcut: 'F',
  },
  {
    category: 'Foundations',
    description: 'Inspect semantic colors in HEX and OKLCH across light and dark surfaces.',
    id: 'colors',
    keywords: ['palette', 'hex', 'oklch', 'tokens', 'primary', 'secondary', 'accent'],
    name: 'Color tokens',
    shortcut: 'C',
  },
  {
    category: 'Foundations',
    description: 'Compare primary, secondary, accent, and code faces or load a local font file.',
    id: 'typography',
    keywords: ['font selector', 'font upload', 'type scale', 'primary', 'secondary', 'accent', 'code'],
    name: 'Typography',
    shortcut: 'T',
  },
  {
    category: 'Expressions',
    description: 'Render Prism-tokenized TypeScript, Python, and Bash cards with matching PNG output.',
    id: 'terminal',
    keywords: ['code', 'syntax', 'cli', 'typescript', 'python', 'bash', 'language colors'],
    name: 'Terminal card',
    shortcut: '⌘',
  },
  {
    category: 'Expressions',
    description: 'Build an optically balanced active-brand and partner logo lockup.',
    id: 'partnership',
    keywords: ['partner', 'partnership lockup', 'co-brand', 'sponsor', 'logo upload'],
    name: 'Partnership lockup',
    shortcut: 'P',
  },
  {
    category: 'Expressions',
    description: 'Create reusable editorial covers with controlled type and texture.',
    id: 'blog',
    keywords: ['blog cover', 'article', 'editorial', 'texture', 'background image'],
    name: 'Blog cover',
    shortcut: 'B',
  },
  {
    category: 'Expressions',
    description: 'Build a complete 16:9 presentation system from multiple reusable slide layouts.',
    id: 'slides',
    keywords: ['slide templates', 'deck', 'presentation', 'keynote', 'powerpoint', 'title', 'agenda', 'quote', 'metrics', 'timeline'],
    name: 'Slide templates',
    shortcut: 'S',
  },
  {
    category: 'Components',
    description: 'Review core interface controls, navigation, forms, feedback, data, and commerce patterns.',
    id: 'buttons',
    keywords: ['component library', 'buttons', 'inputs', 'forms', 'navigation', 'modal', 'toast', 'table', 'pricing', 'cards'],
    name: 'Component library',
    shortcut: 'V',
  },
];

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function filterStudioTools(
  tools: readonly StudioTool[],
  query: string
): StudioTool[] {
  const normalizedQuery = normalize(query);

  if (!normalizedQuery) {
    return [...tools];
  }

  return tools.filter((tool) =>
    [tool.name, tool.category, tool.description, ...tool.keywords]
      .join(' ')
      .toLocaleLowerCase()
      .includes(normalizedQuery)
  );
}

export function getProjectTabDensity(tabCount: number) {
  if (tabCount >= 10) return 'scroll' as const;
  if (tabCount >= 7) return 'marks' as const;
  if (tabCount >= 4) return 'compact' as const;
  return 'full' as const;
}
