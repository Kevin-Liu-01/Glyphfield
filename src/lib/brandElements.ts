export type BrandElementCategory =
  | 'Digital'
  | 'Product'
  | 'Developer'
  | 'Social'
  | 'Editorial'
  | 'Event'
  | 'Physical';

export type BrandElementPreview =
  | 'email'
  | 'developer'
  | 'social'
  | 'editorial'
  | 'event'
  | 'physical'
  | 'web'
  | 'logo'
  | 'icon'
  | 'component';

export type BrandElement = {
  category: BrandElementCategory;
  description: string;
  dimensions: string;
  format: string;
  id: string;
  keywords: readonly string[];
  name: string;
  preview: BrandElementPreview;
  symbol: string;
};

export type BrandElementSettings = {
  accentColor: string;
  artworkScale: number;
  artworkX: number;
  artworkY: number;
  backgroundColor: string;
  body: string;
  cta: string;
  eyebrow: string;
  foregroundColor: string;
  headline: string;
  layout: 'split' | 'stacked' | 'centered';
  partnerName: string;
  pattern: 'none' | 'dots' | 'grid' | 'dither';
  patternOpacity: number;
  personName: string;
  personRole: string;
  scale: 'compact' | 'balanced' | 'bold';
  showLogo: boolean;
  showWebsite: boolean;
};

export type BrandElementOverrides = Partial<BrandElementSettings>;

export const BRAND_ELEMENT_CATEGORIES: readonly BrandElementCategory[] = [
  'Digital',
  'Product',
  'Developer',
  'Social',
  'Editorial',
  'Event',
  'Physical',
];

export const BRAND_ELEMENTS: readonly BrandElement[] = [
  {
    category: 'Digital',
    description: 'A complete onboarding email with motion, hierarchy, actions, and supporting modules.',
    dimensions: '640 px / responsive',
    format: 'HTML + GIF',
    id: 'welcome-email',
    symbol: '✉',
    keywords: ['email', 'welcome', 'onboarding', 'newsletter', 'motion'],
    name: 'Welcome email',
    preview: 'email',
  },
  {
    category: 'Digital',
    description: 'A concise system email for verification, receipts, alerts, and account events.',
    dimensions: '600 px / responsive',
    format: 'HTML',
    id: 'transactional-email',
    symbol: '✓',
    keywords: ['email', 'transactional', 'receipt', 'verify', 'notification'],
    name: 'Transactional email',
    preview: 'email',
  },
  {
    category: 'Digital',
    description: 'A compact identity block for outbound team email.',
    dimensions: '480 × 160',
    format: 'HTML',
    id: 'email-signature',
    symbol: '@',
    keywords: ['email', 'signature', 'contact', 'team'],
    name: 'Email signature',
    preview: 'email',
  },
  {
    category: 'Digital',
    description: 'A reusable product or marketing card for web surfaces.',
    dimensions: '720 × 480',
    format: 'HTML / PNG',
    id: 'web-card',
    symbol: '▣',
    keywords: ['web', 'card', 'feature', 'marketing', 'product'],
    name: 'Web card',
    preview: 'web',
  },
  {
    category: 'Digital',
    description: 'The identity mark composed against approved brand surfaces and textures.',
    dimensions: '1600 × 1000',
    format: 'PNG / GIF',
    id: 'logo-background',
    symbol: '◉',
    keywords: ['logo', 'background', 'shader', 'surface', 'texture'],
    name: 'Logo on background',
    preview: 'logo',
  },
  {
    category: 'Digital',
    description: 'A high-signal link preview for websites, docs, launches, and articles.',
    dimensions: '1200 × 630',
    format: 'PNG',
    id: 'opengraph',
    symbol: 'OG',
    keywords: ['open graph', 'og', 'social', 'link preview'],
    name: 'OpenGraph image',
    preview: 'web',
  },
  {
    category: 'Digital',
    description: 'A branded not-found state that keeps product voice intact.',
    dimensions: 'Responsive',
    format: 'HTML',
    id: 'error-page',
    symbol: '404',
    keywords: ['404', 'error', 'empty state', 'web'],
    name: '404 page',
    preview: 'web',
  },
  {
    category: 'Digital',
    description: 'Small-scale marks validated across browsers and operating systems.',
    dimensions: '16–512 px',
    format: 'SVG / PNG / ICO',
    id: 'favicon-set',
    symbol: '◇',
    keywords: ['favicon', 'browser', 'icon', 'app'],
    name: 'Favicon set',
    preview: 'icon',
  },
  {
    category: 'Digital',
    description: 'App and launcher icons across square, masked, and adaptive contexts.',
    dimensions: '1024 × 1024',
    format: 'PNG / SVG',
    id: 'app-icon',
    symbol: '▦',
    keywords: ['app icon', 'launcher', 'ios', 'android', 'icon'],
    name: 'App icon',
    preview: 'icon',
  },
  {
    category: 'Product',
    description: 'A compact product navigation system with identity, destinations, and a primary action.',
    dimensions: 'Responsive',
    format: 'HTML / React',
    id: 'navigation-bar',
    symbol: 'NAV',
    keywords: ['navigation', 'navbar', 'header', 'menu', 'product ui'],
    name: 'Navigation bar',
    preview: 'component',
  },
  {
    category: 'Product',
    description: 'A product-first hero with headline, supporting copy, action, and visual proof.',
    dimensions: '1440 × 760',
    format: 'HTML / React',
    id: 'hero-section',
    symbol: 'H1',
    keywords: ['hero', 'landing', 'headline', 'cta', 'product ui'],
    name: 'Hero section',
    preview: 'component',
  },
  {
    category: 'Product',
    description: 'A responsive feature collection for product capabilities and value propositions.',
    dimensions: '3–6 cards',
    format: 'HTML / React',
    id: 'feature-grid',
    symbol: '▦',
    keywords: ['features', 'bento', 'grid', 'cards', 'product ui'],
    name: 'Feature grid',
    preview: 'component',
  },
  {
    category: 'Product',
    description: 'A clear plan card with price, included features, and conversion action.',
    dimensions: '420 × 560',
    format: 'HTML / React',
    id: 'pricing-card',
    symbol: '$',
    keywords: ['pricing', 'plan', 'subscription', 'checkout', 'component'],
    name: 'Pricing card',
    preview: 'component',
  },
  {
    category: 'Product',
    description: 'A proof card combining a concise customer quote with attribution.',
    dimensions: '640 × 400',
    format: 'HTML / React',
    id: 'testimonial-card',
    symbol: '“”',
    keywords: ['testimonial', 'quote', 'customer', 'proof', 'component'],
    name: 'Testimonial card',
    preview: 'component',
  },
  {
    category: 'Product',
    description: 'Core form inputs, selects, toggles, labels, validation, and actions.',
    dimensions: 'Responsive',
    format: 'HTML / React',
    id: 'form-controls',
    symbol: '▤',
    keywords: ['form', 'input', 'select', 'checkbox', 'toggle', 'validation'],
    name: 'Form controls',
    preview: 'component',
  },
  {
    category: 'Product',
    description: 'A searchable keyboard-first command surface for product actions.',
    dimensions: '640 × 480',
    format: 'HTML / React',
    id: 'command-menu',
    symbol: '⌘K',
    keywords: ['command menu', 'command palette', 'search', 'keyboard', 'component'],
    name: 'Command menu',
    preview: 'component',
  },
  {
    category: 'Product',
    description: 'A focused overlay for confirmation, creation, and high-attention product flows.',
    dimensions: '560 × 360',
    format: 'HTML / React',
    id: 'modal-dialog',
    symbol: '◫',
    keywords: ['modal', 'dialog', 'overlay', 'confirmation', 'component'],
    name: 'Modal dialog',
    preview: 'component',
  },
  {
    category: 'Product',
    description: 'Compact feedback messages for success, progress, warning, and errors.',
    dimensions: '420 × auto',
    format: 'HTML / React',
    id: 'toast-notification',
    symbol: '!',
    keywords: ['toast', 'notification', 'alert', 'status', 'feedback'],
    name: 'Toast notification',
    preview: 'component',
  },
  {
    category: 'Product',
    description: 'A dense but readable data surface with selection, status, and row actions.',
    dimensions: 'Responsive',
    format: 'HTML / React',
    id: 'data-table',
    symbol: '≡',
    keywords: ['table', 'data', 'rows', 'dashboard', 'component'],
    name: 'Data table',
    preview: 'component',
  },
  {
    category: 'Product',
    description: 'A compact metric module with trend, comparison, and supporting context.',
    dimensions: '480 × 320',
    format: 'HTML / React',
    id: 'dashboard-widget',
    symbol: '◩',
    keywords: ['dashboard', 'metric', 'chart', 'analytics', 'component'],
    name: 'Dashboard widget',
    preview: 'component',
  },
  {
    category: 'Product',
    description: 'A useful zero-data state with a clear explanation and next action.',
    dimensions: 'Responsive',
    format: 'HTML / React',
    id: 'empty-state',
    symbol: '∅',
    keywords: ['empty state', 'zero state', 'onboarding', 'component'],
    name: 'Empty state',
    preview: 'component',
  },
  {
    category: 'Product',
    description: 'A clear order summary with line items, total, and checkout action.',
    dimensions: '480 × 600',
    format: 'HTML / React',
    id: 'checkout-card',
    symbol: '◎',
    keywords: ['checkout', 'commerce', 'cart', 'order summary', 'component'],
    name: 'Checkout card',
    preview: 'component',
  },
  {
    category: 'Product',
    description: 'A structured settings surface with grouped preferences and save state.',
    dimensions: 'Responsive',
    format: 'HTML / React',
    id: 'settings-panel',
    symbol: '⚙',
    keywords: ['settings', 'preferences', 'account', 'form', 'component'],
    name: 'Settings panel',
    preview: 'component',
  },
  {
    category: 'Developer',
    description: 'A recognizable terminal introduction with an ASCII mark and first command.',
    dimensions: '80 columns',
    format: 'Text / ANSI',
    id: 'cli-banner',
    symbol: '$',
    keywords: ['cli', 'terminal', 'ascii', 'command line', 'developer'],
    name: 'CLI brand',
    preview: 'developer',
  },
  {
    category: 'Developer',
    description: 'A copy-safe text interpretation of the mark for terminals and source files.',
    dimensions: 'Monospace grid',
    format: 'TXT',
    id: 'ascii-mark',
    symbol: '#',
    keywords: ['ascii', 'text logo', 'terminal', 'monospace'],
    name: 'ASCII mark',
    preview: 'developer',
  },
  {
    category: 'Developer',
    description: 'Syntax, status, and command colors applied to the brand’s terminal voice.',
    dimensions: 'Responsive',
    format: 'JSON / ANSI',
    id: 'terminal-theme',
    symbol: '>_',
    keywords: ['terminal', 'syntax', 'code', 'ansi', 'theme'],
    name: 'Terminal theme',
    preview: 'developer',
  },
  {
    category: 'Developer',
    description: 'A repository header that connects product identity to installation and usage.',
    dimensions: '1280 × 640',
    format: 'SVG / Markdown',
    id: 'github-readme',
    symbol: 'GH',
    keywords: ['github', 'readme', 'repository', 'developer'],
    name: 'GitHub README hero',
    preview: 'developer',
  },
  {
    category: 'Developer',
    description: 'A branded header for documentation, SDK, and API reference surfaces.',
    dimensions: '1440 × 480',
    format: 'SVG / PNG',
    id: 'docs-header',
    symbol: '//',
    keywords: ['docs', 'documentation', 'api', 'sdk', 'header'],
    name: 'Documentation header',
    preview: 'developer',
  },
  {
    category: 'Developer',
    description: 'A compact package identity for registry listings and install surfaces.',
    dimensions: '512 × 320',
    format: 'SVG / PNG',
    id: 'package-card',
    symbol: '{}',
    keywords: ['npm', 'package', 'registry', 'sdk', 'card'],
    name: 'Package card',
    preview: 'developer',
  },
  {
    category: 'Social',
    description: 'A text-led branded post for launches, updates, and product ideas.',
    dimensions: '1600 × 900',
    format: 'PNG',
    id: 'x-post',
    symbol: '𝕏',
    keywords: ['twitter', 'x', 'post', 'social', 'announcement'],
    name: 'X / Twitter post',
    preview: 'social',
  },
  {
    category: 'Social',
    description: 'A professional update card with proof, hierarchy, and restrained branding.',
    dimensions: '1200 × 1200',
    format: 'PNG',
    id: 'linkedin-post',
    symbol: 'in',
    keywords: ['linkedin', 'post', 'social', 'company update'],
    name: 'LinkedIn post',
    preview: 'social',
  },
  {
    category: 'Social',
    description: 'A community announcement for Discord, Slack, and forum channels.',
    dimensions: '1200 × 675',
    format: 'PNG',
    id: 'community-card',
    symbol: '#',
    keywords: ['discord', 'slack', 'community', 'announcement', 'social'],
    name: 'Community card',
    preview: 'social',
  },
  {
    category: 'Social',
    description: 'Avatar and profile variants that remain legible at small sizes.',
    dimensions: '400 × 400',
    format: 'PNG',
    id: 'social-avatar',
    symbol: '●',
    keywords: ['avatar', 'profile', 'social', 'icon'],
    name: 'Social avatar',
    preview: 'icon',
  },
  {
    category: 'Social',
    description: 'A launch graphic combining product message, mark, and release metadata.',
    dimensions: '1600 × 900',
    format: 'PNG / GIF',
    id: 'launch-card',
    symbol: '↗',
    keywords: ['launch', 'release', 'social', 'announcement'],
    name: 'Product launch card',
    preview: 'social',
  },
  {
    category: 'Editorial',
    description: 'A presentation opener that establishes identity before content.',
    dimensions: '16:9',
    format: 'Slides / PNG',
    id: 'slide-title',
    symbol: '▶',
    keywords: ['slide', 'deck', 'presentation', 'keynote', 'powerpoint'],
    name: 'Slide deck title',
    preview: 'editorial',
  },
  {
    category: 'Editorial',
    description: 'A reusable section divider for narrative pacing across a deck.',
    dimensions: '16:9',
    format: 'Slides / PNG',
    id: 'slide-section',
    symbol: '02',
    keywords: ['slide', 'deck', 'section', 'presentation'],
    name: 'Slide section',
    preview: 'editorial',
  },
  {
    category: 'Editorial',
    description: 'A repeatable editorial frame for engineering and company writing.',
    dimensions: '1200 × 630',
    format: 'PNG',
    id: 'blog-cover',
    symbol: 'Aa',
    keywords: ['blog', 'article', 'editorial', 'cover'],
    name: 'Blog cover',
    preview: 'editorial',
  },
  {
    category: 'Editorial',
    description: 'A structured cover for research, annual reports, and downloadable PDFs.',
    dimensions: 'A4 / US Letter',
    format: 'PDF / PNG',
    id: 'report-cover',
    symbol: '¶',
    keywords: ['report', 'pdf', 'research', 'editorial', 'cover'],
    name: 'Report cover',
    preview: 'editorial',
  },
  {
    category: 'Editorial',
    description: 'Approved identity assets and company language packaged for external use.',
    dimensions: 'Multi-format',
    format: 'ZIP / PDF',
    id: 'press-kit',
    symbol: 'PR',
    keywords: ['press', 'media kit', 'brand assets', 'editorial'],
    name: 'Press kit',
    preview: 'editorial',
  },
  {
    category: 'Event',
    description: 'An event credential that carries identity at real-world viewing distance.',
    dimensions: '90 × 140 mm',
    format: 'PDF / PNG',
    id: 'lanyard',
    symbol: '│',
    keywords: ['lanyard', 'conference', 'event', 'badge', 'credential'],
    name: 'Lanyard pass',
    preview: 'event',
  },
  {
    category: 'Event',
    description: 'A name badge system for staff, speakers, guests, and attendees.',
    dimensions: '105 × 148 mm',
    format: 'PDF / PNG',
    id: 'event-badge',
    symbol: 'ID',
    keywords: ['event', 'badge', 'name tag', 'conference'],
    name: 'Event badge',
    preview: 'event',
  },
  {
    category: 'Event',
    description: 'A stage-scale identity surface for talks, booths, and community events.',
    dimensions: '16:9 / large format',
    format: 'PDF / PNG',
    id: 'event-backdrop',
    symbol: '▰',
    keywords: ['event', 'backdrop', 'stage', 'booth', 'banner'],
    name: 'Event backdrop',
    preview: 'event',
  },
  {
    category: 'Event',
    description: 'A co-branded system for partner announcements and sponsored moments.',
    dimensions: 'Flexible lockup',
    format: 'SVG / PNG',
    id: 'partnership-lockup',
    symbol: '×',
    keywords: ['partner', 'sponsor', 'lockup', 'event', 'co-brand'],
    name: 'Partnership lockup',
    preview: 'event',
  },
  {
    category: 'Physical',
    description: 'A compact personal or company card with controlled front and back variants.',
    dimensions: '3.5 × 2 in',
    format: 'PDF / SVG',
    id: 'business-card',
    symbol: '▭',
    keywords: ['business card', 'contact', 'print', 'physical'],
    name: 'Business card',
    preview: 'physical',
  },
  {
    category: 'Physical',
    description: 'A small collection of marks, phrases, and shapes for community distribution.',
    dimensions: 'A5 sheet',
    format: 'PDF / SVG',
    id: 'sticker-sheet',
    symbol: '✦',
    keywords: ['sticker', 'merch', 'swag', 'physical', 'print'],
    name: 'Sticker sheet',
    preview: 'physical',
  },
  {
    category: 'Physical',
    description: 'A reusable branded label for packaging, mailers, and shipped materials.',
    dimensions: '4 × 6 in',
    format: 'PDF / SVG',
    id: 'packaging-label',
    symbol: '▧',
    keywords: ['packaging', 'label', 'shipping', 'physical'],
    name: 'Packaging label',
    preview: 'physical',
  },
  {
    category: 'Physical',
    description: 'Company correspondence with a restrained header, footer, and contact system.',
    dimensions: 'A4 / US Letter',
    format: 'PDF / DOCX',
    id: 'letterhead',
    symbol: 'A',
    keywords: ['letterhead', 'stationery', 'print', 'physical'],
    name: 'Letterhead',
    preview: 'physical',
  },
];

export function createBrandElementSettings(
  element: BrandElement,
  identity: BrandIdentity
): BrandElementSettings {
  const ink = identity.colors.find(({ id }) => id === 'ink')?.hex ?? '#181818';
  const paper = identity.colors.find(({ id }) => id === 'paper')?.hex ?? '#FFFFFF';
  const defaults: BrandElementSettings = {
    accentColor: ink,
    artworkScale: 100,
    artworkX: 0,
    artworkY: 0,
    backgroundColor: paper,
    body: identity.positioning || identity.description,
    cta: '',
    eyebrow: '',
    foregroundColor: ink,
    headline: identity.tagline,
    layout: 'split',
    partnerName: 'Partner',
    pattern: 'dots',
    patternOpacity: 12,
    personName: 'Alex Morgan',
    personRole: `Design Engineer · ${identity.name}`,
    scale: 'balanced',
    showLogo: true,
    showWebsite: true,
  };

  const overrides: Partial<Record<string, BrandElementOverrides>> = {
    'welcome-email': {
      cta: 'Get started',
      headline: `Welcome to ${identity.name}!`,
      layout: 'stacked',
      pattern: 'none',
    },
    'transactional-email': {
      cta: 'Open workspace',
      eyebrow: 'Account verified',
      headline: 'Your workspace is ready.',
      layout: 'stacked',
      pattern: 'none',
    },
    'email-signature': {
      body: identity.website,
      headline: 'Alex Morgan',
      layout: 'split',
      pattern: 'none',
    },
    'web-card': { cta: 'Explore', eyebrow: '', pattern: 'none' },
    opengraph: { eyebrow: identity.website, pattern: 'dither', scale: 'bold' },
    'error-page': {
      body: 'The page you requested may have moved or no longer exists.',
      cta: 'Return home',
      eyebrow: '404',
      headline: 'Nothing here—yet.',
      layout: 'centered',
      pattern: 'grid',
    },
    'navigation-bar': { body: 'Product · Docs · Customers', cta: 'Get started', headline: identity.name, pattern: 'none' },
    'hero-section': { cta: 'Start building', eyebrow: identity.website, pattern: 'dither', scale: 'bold' },
    'feature-grid': { body: identity.description, eyebrow: 'Built for the work', headline: 'Everything in one system.', pattern: 'dots' },
    'pricing-card': { body: 'Everything you need to get started, with room to scale.', cta: 'Choose plan', eyebrow: 'Pro · $49 / month', headline: 'Ship with confidence.', layout: 'stacked', pattern: 'none' },
    'testimonial-card': { body: identity.voice.phrases[0] ?? identity.positioning, eyebrow: 'Customer story', headline: '“The system finally feels like one product.”', layout: 'stacked', pattern: 'none' },
    'form-controls': { body: 'Use clear labels and explain what happens next.', cta: 'Save changes', eyebrow: 'Workspace settings', headline: 'Profile details', pattern: 'none' },
    'command-menu': { body: 'Search pages, actions, and recent work.', eyebrow: '⌘ K', headline: 'What do you want to do?', pattern: 'none' },
    'modal-dialog': { body: 'This action updates the shared identity across every generated artifact.', cta: 'Confirm changes', eyebrow: '', headline: 'Update brand settings?', layout: 'centered', pattern: 'none' },
    'toast-notification': { body: 'Your changes are now available across the Studio.', eyebrow: 'Success', headline: 'Brand updated', layout: 'stacked', pattern: 'none' },
    'data-table': { body: 'Manage active projects and their current status.', eyebrow: '12 projects', headline: 'Recent work', pattern: 'none' },
    'dashboard-widget': { body: 'Compared with the previous 30 days.', eyebrow: '+18.4%', headline: '42,851', pattern: 'grid' },
    'empty-state': { body: 'Create your first project to start generating consistent brand work.', cta: 'Create project', eyebrow: '', headline: 'No projects yet', layout: 'centered', pattern: 'dots' },
    'checkout-card': { body: 'Studio Pro · Annual billing', cta: 'Complete purchase', eyebrow: 'Order summary', headline: '$588.00', layout: 'stacked', pattern: 'none' },
    'settings-panel': { body: 'Manage identity, localization, notifications, and team preferences.', cta: 'Save settings', eyebrow: 'Preferences', headline: 'Workspace settings', pattern: 'none' },
    'cli-banner': { cta: `npx ${identity.id} init`, pattern: 'none' },
    'ascii-mark': {
      body: 'A copy-safe identity for terminals and source files.',
      headline: identity.shortName,
      layout: 'centered',
      pattern: 'none',
    },
    'terminal-theme': {
      body: 'Syntax and status colors tuned to the identity.',
      eyebrow: 'src/index.ts',
      headline: 'Code in your voice.',
      pattern: 'none',
    },
    'github-readme': {
      cta: `npm install ${identity.id}`,
      eyebrow: 'README.md',
      pattern: 'grid',
      scale: 'bold',
    },
    'docs-header': {
      body: 'Guides, concepts, API reference, and examples.',
      cta: 'Read the docs',
      eyebrow: 'Guides · API · SDK',
      headline: `${identity.name} documentation`,
      pattern: 'grid',
    },
    'package-card': {
      body: identity.description,
      cta: `pnpm add ${identity.id}`,
      eyebrow: 'v1.0.0',
      headline: `@${identity.id}/core`,
      pattern: 'dots',
    },
    'x-post': { eyebrow: `@${identity.id}`, layout: 'stacked', pattern: 'none' },
    'linkedin-post': {
      body: identity.description,
      eyebrow: identity.name,
      layout: 'stacked',
      pattern: 'none',
    },
    'community-card': {
      cta: 'Join the community',
      headline: `Build with ${identity.name}.`,
      pattern: 'grid',
    },
    'launch-card': {
      cta: 'Available now',
      eyebrow: 'Introducing',
      headline: identity.name,
      pattern: 'dither',
      scale: 'bold',
    },
    'slide-title': { eyebrow: identity.name, pattern: 'none', scale: 'bold' },
    'slide-section': {
      body: identity.description,
      eyebrow: '02',
      headline: 'A system that scales.',
      pattern: 'grid',
      scale: 'bold',
    },
    'blog-cover': {
      body: identity.positioning,
      eyebrow: identity.website,
      headline: 'How we build for every locale.',
      pattern: 'dither',
      scale: 'bold',
    },
    'report-cover': {
      body: identity.description,
      eyebrow: '2026 report',
      headline: `The state of ${identity.name}.`,
      layout: 'stacked',
      pattern: 'grid',
    },
    'press-kit': {
      body: 'Approved logos, product images, company language, and press contacts.',
      eyebrow: identity.website,
      headline: 'Press & media',
      pattern: 'grid',
    },
    lanyard: { eyebrow: 'Speaker · 0248', headline: 'Alex Morgan', pattern: 'none' },
    'event-badge': { eyebrow: 'Guest · 0248', headline: 'Alex Morgan', pattern: 'none' },
    'event-backdrop': {
      body: identity.website,
      eyebrow: 'San Francisco · 2026',
      pattern: 'dither',
      scale: 'bold',
    },
    'partnership-lockup': {
      body: 'A shared announcement built from two distinct identities.',
      headline: `${identity.name} × Partner`,
      layout: 'centered',
      pattern: 'none',
    },
    'business-card': { headline: 'Alex Morgan', layout: 'stacked', pattern: 'none' },
    'sticker-sheet': {
      body: identity.voice.phrases[0] ?? identity.tagline,
      headline: identity.shortName,
      layout: 'centered',
      pattern: 'grid',
    },
    'packaging-label': {
      body: identity.description,
      eyebrow: '01 / 2026',
      headline: `Made by ${identity.name}.`,
      pattern: 'grid',
    },
    letterhead: {
      body: identity.positioning,
      eyebrow: identity.website,
      headline: `A note from ${identity.name}.`,
      layout: 'stacked',
      pattern: 'none',
    },
  };

  return { ...defaults, ...overrides[element.id] };
}

export function filterBrandElements(
  elements: readonly BrandElement[],
  query: string
): BrandElement[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return [...elements];
  return elements.filter((element) =>
    [
      element.name,
      element.category,
      element.description,
      element.dimensions,
      element.format,
      ...element.keywords,
    ]
      .join(' ')
      .toLocaleLowerCase()
      .includes(normalizedQuery)
  );
}
import type { BrandIdentity } from '@/lib/brandIdentity';
