import { EMAIL_LIFECYCLE_TEMPLATES, getEmailLifecycleTemplate } from '@/lib/emailLifecycle';
import type { BrandIdentity } from '@/lib/brandIdentity';
import { hashSeed } from '@/lib/brandOutputKit';
import { DEFAULT_LOGO_APPEARANCE, type LogoAppearanceSettings } from '@/lib/logoAppearance';
import { actionVerb, brandElementContent, featuredPlanIndex, type BrandElementContent } from '@/lib/brandElementContent';

export type BrandElementCategory =
  | 'Digital'
  | 'Product'
  | 'Developer'
  | 'Social'
  | 'Editorial'
  | 'Event'
  | 'Physical';

type BrandElementPreview =
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
  assetId: string;
  assetOpacity: number;
  assetPlacement: 'background' | 'banner' | 'card' | 'header';
  artworkScale: number;
  artworkX: number;
  artworkY: number;
  backgroundColor: string;
  body: string;
  cta: string;
  foregroundColor: string;
  fontRole: BrandIdentity['typography'][number]['role'];
  fontWeight: number;
  headline: string;
  layout: 'split' | 'stacked' | 'centered';
  logoAppearance: LogoAppearanceSettings;
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
  ...EMAIL_LIFECYCLE_TEMPLATES.map<BrandElement>((template) => ({
    category: 'Digital',
    description: template.description,
    dimensions: '640 px / responsive',
    format: template.artworkPath ? 'HTML + GIF' : 'Plain text',
    id: template.id,
    symbol: template.symbol,
    keywords: ['email', template.group.toLocaleLowerCase(), ...template.keywords],
    name: template.name,
    preview: 'email',
  })),
  {
    category: 'Digital',
    description: 'A multi-template review board that shows an entire email program, states, cadence, and visual hierarchy at once.',
    dimensions: 'Multi-template contact sheet',
    format: 'HTML / PNG',
    id: 'email-system-sheet',
    symbol: '▦',
    keywords: ['email', 'system', 'contact sheet', 'review', 'templates', 'lifecycle'],
    name: 'Email system sheet',
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
  {
    category: 'Digital',
    description: 'A repeatable editorial email for launches, essays, and curated product news.',
    dimensions: '640 px / responsive',
    format: 'HTML',
    id: 'newsletter-email',
    symbol: 'NEWS',
    keywords: ['newsletter', 'email', 'editorial', 'campaign'],
    name: 'Newsletter',
    preview: 'email',
  },
  {
    category: 'Digital',
    description: 'A sequence of store-ready product screenshots with shared captions and framing.',
    dimensions: '1290 × 2796',
    format: 'PNG',
    id: 'app-store-gallery',
    symbol: '▥',
    keywords: ['app store', 'screenshots', 'mobile', 'gallery'],
    name: 'App store gallery',
    preview: 'social',
  },
  {
    category: 'Digital',
    description: 'A focused registration email for webinars, launches, and community events.',
    dimensions: '640 px / responsive',
    format: 'HTML',
    id: 'event-invitation-email',
    symbol: 'RSVP',
    keywords: ['email', 'event', 'invitation', 'webinar', 'rsvp'],
    name: 'Event invitation',
    preview: 'email',
  },
  {
    category: 'Product',
    description: 'A complete sign-in and account creation surface in the active identity.',
    dimensions: 'Responsive',
    format: 'HTML / React',
    id: 'auth-screen',
    symbol: '→|',
    keywords: ['auth', 'sign in', 'login', 'account', 'product ui'],
    name: 'Authentication screen',
    preview: 'component',
  },
  {
    category: 'Product',
    description: 'A persistent application rail with grouped destinations and account context.',
    dimensions: '240 px / responsive',
    format: 'HTML / React',
    id: 'sidebar-navigation',
    symbol: 'SID',
    keywords: ['sidebar', 'navigation', 'app shell', 'product ui'],
    name: 'Sidebar navigation',
    preview: 'component',
  },
  {
    category: 'Product',
    description: 'A focused universal search surface with filters, results, and keyboard actions.',
    dimensions: '720 × 560',
    format: 'HTML / React',
    id: 'search-surface',
    symbol: '⌕',
    keywords: ['search', 'results', 'filter', 'command', 'product ui'],
    name: 'Search surface',
    preview: 'component',
  },
  {
    category: 'Product',
    description: 'A progressive first-run checklist that teaches the system through useful actions.',
    dimensions: '640 × 560',
    format: 'HTML / React',
    id: 'onboarding-checklist',
    symbol: '✓✓',
    keywords: ['onboarding', 'checklist', 'setup', 'product ui'],
    name: 'Onboarding checklist',
    preview: 'component',
  },
  {
    category: 'Product',
    description: 'An upload dropzone with file state, requirements, progress, and validation.',
    dimensions: '640 × 360',
    format: 'HTML / React',
    id: 'file-uploader',
    symbol: '↑',
    keywords: ['upload', 'dropzone', 'file', 'progress', 'product ui'],
    name: 'File uploader',
    preview: 'component',
  },
  {
    category: 'Product',
    description: 'A public service-health surface with current state and incident history.',
    dimensions: 'Responsive',
    format: 'HTML / React',
    id: 'status-page',
    symbol: '●',
    keywords: ['status', 'uptime', 'incident', 'service', 'product ui'],
    name: 'Status page',
    preview: 'component',
  },
  {
    category: 'Developer',
    description: 'An API reference introduction with endpoint, request shape, and response context.',
    dimensions: '1440 × 720',
    format: 'HTML / SVG',
    id: 'api-reference-hero',
    symbol: 'API',
    keywords: ['api', 'reference', 'endpoint', 'developer', 'docs'],
    name: 'API reference hero',
    preview: 'developer',
  },
  {
    category: 'Developer',
    description: 'An interactive-looking code example for documentation and launch surfaces.',
    dimensions: '960 × 640',
    format: 'HTML / PNG',
    id: 'code-playground',
    symbol: '</>',
    keywords: ['code', 'playground', 'example', 'developer'],
    name: 'Code playground',
    preview: 'developer',
  },
  {
    category: 'Developer',
    description: 'A structured release entry with version metadata, changes, and install action.',
    dimensions: '1200 × 630',
    format: 'Markdown / PNG',
    id: 'release-notes',
    symbol: 'v+',
    keywords: ['release notes', 'changelog', 'version', 'developer'],
    name: 'Release notes',
    preview: 'developer',
  },
  {
    category: 'Social',
    description: 'A high-contrast video thumbnail with a short headline and recognizable mark.',
    dimensions: '1280 × 720',
    format: 'PNG',
    id: 'video-thumbnail',
    symbol: '▶',
    keywords: ['youtube', 'video', 'thumbnail', 'social'],
    name: 'Video thumbnail',
    preview: 'social',
  },
  {
    category: 'Social',
    description: 'A square cover system for shows, episodes, and audio series.',
    dimensions: '3000 × 3000',
    format: 'PNG',
    id: 'podcast-cover',
    symbol: '◉',
    keywords: ['podcast', 'audio', 'cover', 'social'],
    name: 'Podcast cover',
    preview: 'social',
  },
  {
    category: 'Social',
    description: 'A multi-frame social narrative for product education and campaign storytelling.',
    dimensions: '1080 × 1350',
    format: 'PNG set',
    id: 'social-carousel',
    symbol: '▤',
    keywords: ['carousel', 'campaign', 'instagram', 'social'],
    name: 'Social carousel',
    preview: 'social',
  },
  {
    category: 'Editorial',
    description: 'A customer narrative cover with outcome, company, and publication metadata.',
    dimensions: '1200 × 630',
    format: 'PDF / PNG',
    id: 'case-study-cover',
    symbol: 'CS',
    keywords: ['case study', 'customer', 'editorial', 'cover'],
    name: 'Case study cover',
    preview: 'editorial',
  },
  {
    category: 'Editorial',
    description: 'A long-form research cover with series identity and report metadata.',
    dimensions: 'A4 / US Letter',
    format: 'PDF / PNG',
    id: 'whitepaper-cover',
    symbol: 'WP',
    keywords: ['whitepaper', 'research', 'report', 'editorial'],
    name: 'Whitepaper cover',
    preview: 'editorial',
  },
  {
    category: 'Event',
    description: 'A large-format exhibit wall designed to read clearly across a venue.',
    dimensions: '10 × 8 ft',
    format: 'PDF / PNG',
    id: 'booth-wall',
    symbol: '▰',
    keywords: ['booth', 'conference', 'wall', 'event', 'large format'],
    name: 'Booth wall',
    preview: 'event',
  },
  {
    category: 'Physical',
    description: 'A restrained notebook cover using the active mark, field, and message.',
    dimensions: 'A5',
    format: 'PDF / SVG',
    id: 'notebook-cover',
    symbol: '▯',
    keywords: ['notebook', 'stationery', 'swag', 'physical'],
    name: 'Notebook cover',
    preview: 'editorial',
  },
];

type ElementCopy = {
  action0: string;
  apiHero: BrandElementOverrides;
  caseBody: string;
  checklist: string;
  checkoutBody: string;
  codeLabel: string;
  emptyBody: string;
  eventInvite: string;
  eventJoin: string;
  eventLine: string;
  eventName: string;
  eventWhere: string;
  featuredCta: string;
  featuredFeature: string;
  featuredName: string;
  featuredPrice: string;
  heroCta: string;
  install: string;
  lead: string;
  metricChange: string;
  metricValue: string;
  modalBody: string;
  modalCta: string;
  modalHeadline: string;
  navLinks: string;
  packageName: string;
  partner: string;
  partnershipBody: string;
  partnershipHeadline: string;
  personName: string;
  personRole: string;
  phrase0: string;
  phrase1: string;
  pillar0: string;
  productLine0: string;
  productLine1: string;
  productName0: string;
  productSummary0: string;
  promise: string;
  promiseOrTagline: string;
  proofHeadline: string;
  proofOrLead: string;
  proofOrPhrase: string;
  rawAction0: string;
  releaseTitle: string;
  searchHeadline: string;
  shortOrName: string;
  sidebarHeadline: string;
  sidebarItems: string;
  statusServices: string;
  tableBody: string;
  tagline: string;
  testimonialBody: string;
  toastHeadline: string;
};

/** Customer-facing copy only: positioning, product lines, proof and samples. The
 * identity description is internal guidance about the identity system and never ships. */
function productCopy(identity: BrandIdentity, content: BrandElementContent) {
  const { products } = content;
  const lead = identity.positioning || identity.mission;
  const line = (index: number) => products[index]?.summary || products[index]?.name || lead;
  return {
    lead,
    navLinks: products.slice(0, 4).map(({ name }) => name).join(' · '),
    productLine0: line(0),
    productLine1: line(1),
    productName0: products[0]?.name ?? content.tagline,
    productSummary0: products[0]?.summary || content.tagline,
    searchHeadline: products[0]?.name ?? identity.name,
    sidebarHeadline: products[0]?.name ?? 'Overview',
    sidebarItems: [...products.slice(0, 3).map(({ name }) => name), 'Settings'].join(' · '),
    statusServices: products.slice(0, 5).map(({ name }) => name).join('\n'),
    tableBody: `${products.length} products · owned by ${content.person.name}`,
  };
}

function messageCopy(identity: BrandIdentity, content: BrandElementContent) {
  const { promise, proof, story, tagline } = content;
  const phrase0 = content.phrases[0] ?? (promise || tagline);
  const lead = identity.positioning || identity.mission;
  return {
    caseBody: story ? `How ${story.customer} works with ${identity.name}.` : lead,
    phrase0,
    phrase1: content.phrases[1] ?? phrase0,
    pillar0: identity.strategy.pillars[0] ?? content.phrases[1] ?? phrase0,
    promise,
    promiseOrTagline: promise || tagline,
    proofHeadline: story?.statement ?? proof[0] ?? phrase0,
    proofOrLead: proof[0] ?? lead,
    proofOrPhrase: proof[0] ?? phrase0,
    releaseTitle: content.release.title,
    shortOrName: identity.shortName.length > 1 ? identity.shortName : identity.name,
    tagline,
    testimonialBody: story ? `${story.customer} · ${identity.name} customer` : identity.website,
  };
}

function actionCopy(content: BrandElementContent) {
  const [first, second = first] = content.actions as [string, string | undefined];
  const action0 = capitalize(first);
  return {
    action0,
    checklist: content.actions.slice(0, 4).map(capitalize).join('\n'),
    emptyBody: `${action0} to see it here.`,
    modalCta: actionVerb(second),
    modalHeadline: `${capitalize(second)}?`,
    rawAction0: first,
    toastHeadline: `${action0}: done`,
  };
}

function planCopy(identity: BrandIdentity, content: BrandElementContent) {
  const featured = content.plans[featuredPlanIndex(content.plans)];
  if (!featured) return { checkoutBody: identity.name, featuredCta: 'Get started', featuredFeature: '', featuredName: identity.name, featuredPrice: '', heroCta: 'Get started' };
  return {
    checkoutBody: `${featured.name} · ${featured.features[0] ?? identity.name}`,
    featuredCta: /contact/i.test(featured.price) ? 'Contact sales' : 'Get started',
    featuredFeature: featured.features[0] ?? '',
    featuredName: featured.name,
    featuredPrice: featured.price,
    heroCta: `Start with ${featured.name}`,
  };
}

function eventCopy(identity: BrandIdentity, content: BrandElementContent) {
  const { event, person } = content;
  const partner = content.customers[0];
  return {
    eventInvite: `${event.name} · ${event.date}, ${event.time} · ${event.location}`,
    eventJoin: `Join us at ${event.name}`,
    eventLine: `${event.name} · ${event.date}`,
    eventName: event.name,
    eventWhere: `${event.date} · ${event.location}`,
    partner: partner ?? 'Partner',
    partnershipBody: partner ? `${identity.name} and ${partner}` : identity.name,
    partnershipHeadline: `${identity.name} × ${partner ?? 'Partner'}`,
    personName: person.name,
    personRole: person.role,
  };
}

function elementCopy(identity: BrandIdentity): ElementCopy {
  const content = brandElementContent(identity);
  const products = productCopy(identity, content);
  const http = /^(?:GET|POST|PUT|PATCH|DELETE)\s/.test(content.code.label);
  return {
    ...products,
    ...messageCopy(identity, content),
    ...actionCopy(content),
    ...planCopy(identity, content),
    ...eventCopy(identity, content),
    apiHero: http
      ? { body: products.productLine0, cta: content.code.label, headline: `${identity.name} API`, pattern: 'none' }
      : { body: products.productLine0, cta: content.install, headline: content.code.label, pattern: 'none' },
    codeLabel: content.code.label,
    install: content.install,
    metricChange: content.metric.change,
    metricValue: content.metric.value,
    modalBody: `${products.productLine1} Check the details before you confirm.`,
    packageName: content.packageName,
  };
}

function contentOverrides(identity: BrandIdentity, k: ElementCopy): Partial<Record<string, BrandElementOverrides>> {
  const { lead, tagline } = k;
  return {
    'email-system-sheet': {
      body: 'Onboarding, utility, transactional, lifecycle and billing messages as one system.',
      cta: 'Review system',
      headline: `${identity.name} email system`,
      layout: 'stacked',
      pattern: 'none',
    },
    'email-signature': {
      body: identity.contactEmail || identity.website,
      headline: k.personName,
      layout: 'split',
      pattern: 'none',
    },
    'web-card': { body: k.productLine0, cta: 'Learn more', headline: k.productName0, pattern: 'none' },
    // A link preview reads at thumbnail size: the tagline and one short promise, not the positioning paragraph.
    opengraph: { body: k.promise, layout: 'split', pattern: 'none' },
    'error-page': {
      body: 'The page you asked for has moved or no longer exists.',
      cta: 'Back to home',
      headline: 'This page is not here.',
      layout: 'centered',
      pattern: 'none',
    },
    'navigation-bar': { body: k.navLinks, cta: k.action0, headline: identity.name, pattern: 'none' },
    'hero-section': { body: lead, cta: k.heroCta, layout: 'split', pattern: 'none', scale: 'bold' },
    'feature-grid': { body: lead, headline: k.promiseOrTagline, pattern: 'none' },
    'pricing-card': { body: k.featuredFeature, cta: k.featuredCta, headline: k.featuredName, layout: 'stacked', pattern: 'none' },
    'testimonial-card': {
      body: k.testimonialBody,
      headline: k.proofHeadline,
      layout: 'stacked',
      pattern: 'none',
    },
    'form-controls': { body: 'Changes apply to everyone in this workspace.', cta: 'Save changes', headline: 'Workspace details', pattern: 'none' },
    'command-menu': { body: 'Type a command or search', headline: k.rawAction0, pattern: 'none' },
    'modal-dialog': {
      body: `${k.productLine1} Check the details before you confirm.`,
      cta: k.modalCta,
      headline: k.modalHeadline,
      layout: 'centered',
      pattern: 'none',
    },
    'toast-notification': { body: k.productLine0, headline: k.toastHeadline, layout: 'stacked', pattern: 'none' },
    'data-table': { body: k.tableBody, cta: k.action0, headline: 'Products', pattern: 'none' },
    'dashboard-widget': { body: k.metricChange, headline: k.metricValue, pattern: 'none' },
    'empty-state': { body: k.emptyBody, cta: k.action0, headline: 'Nothing here yet', layout: 'centered', pattern: 'none' },
    'checkout-card': { body: k.checkoutBody, cta: 'Confirm and pay', headline: k.featuredPrice, layout: 'stacked', pattern: 'none' },
    'settings-panel': { body: 'Members, billing and integrations for this workspace.', cta: 'Save settings', headline: 'Workspace settings', pattern: 'none' },
    'cli-banner': { cta: k.install, headline: tagline, pattern: 'none' },
    'ascii-mark': {
      body: 'Copy-safe banner for terminals, README files and source headers.',
      headline: identity.shortName,
      layout: 'centered',
      pattern: 'none',
    },
    'terminal-theme': {
      body: 'Syntax and status colors tuned to the identity.',
      headline: k.codeLabel,
      pattern: 'none',
    },
    'github-readme': {
      body: lead,
      cta: k.install,
      headline: tagline,
      pattern: 'none',
      scale: 'bold',
    },
    'docs-header': {
      body: k.productLine0,
      cta: 'Read the docs',
      headline: `${identity.name} documentation`,
      pattern: 'none',
    },
    'package-card': {
      body: k.productLine0,
      cta: k.install,
      headline: k.packageName,
      pattern: 'none',
    },
    'x-post': { body: k.proofOrLead, headline: k.phrase0, layout: 'stacked', pattern: 'none' },
    'linkedin-post': {
      body: lead,
      headline: k.promiseOrTagline,
      layout: 'stacked',
      pattern: 'none',
    },
    'community-card': {
      body: k.eventLine,
      cta: 'Join the community',
      headline: `Build with ${identity.name}.`,
      pattern: 'none',
    },
    'launch-card': {
      body: k.productLine0,
      cta: 'Available now',
      headline: k.releaseTitle,
      pattern: 'none',
      scale: 'bold',
    },
    'slide-title': { body: k.promise, pattern: 'none', scale: 'bold' },
    'slide-section': {
      body: k.productLine1,
      headline: k.pillar0,
      pattern: 'none',
      scale: 'bold',
    },
    'blog-cover': {
      body: lead,
      headline: k.releaseTitle,
      pattern: 'none',
      scale: 'bold',
    },
    'report-cover': {
      body: identity.mission,
      headline: k.proofOrPhrase,
      layout: 'stacked',
      pattern: 'none',
    },
    'press-kit': {
      body: `Logos, product images, company facts and press contacts. ${identity.contactEmail}`.trim(),
      headline: 'Press and media',
      pattern: 'none',
    },
    'newsletter-email': { body: lead, cta: 'Read the update', headline: k.releaseTitle, layout: 'stacked', pattern: 'none' },
    'app-store-gallery': { body: k.productLine0, headline: k.productSummary0, pattern: 'none', scale: 'bold' },
    'event-invitation-email': { body: k.eventInvite, cta: 'Reserve your place', headline: k.eventJoin, layout: 'stacked', pattern: 'none' },
    'auth-screen': { body: `Continue to ${identity.name}.`, cta: 'Continue', headline: 'Sign in', layout: 'centered', pattern: 'none' },
    'sidebar-navigation': { body: k.sidebarItems, cta: k.action0, headline: k.sidebarHeadline, pattern: 'none' },
    'search-surface': { body: 'Search products, docs and recent activity.', cta: 'Open result', headline: k.searchHeadline, pattern: 'none' },
    'onboarding-checklist': { body: k.checklist, cta: 'Continue setup', headline: `Set up ${identity.name}`, pattern: 'none' },
    'file-uploader': { body: 'SVG, PNG, PDF or CSV up to 10 MB.', cta: 'Choose files', headline: 'Drop files to upload', layout: 'centered', pattern: 'none' },
    'status-page': { body: k.statusServices, headline: 'All systems operational', pattern: 'none' },
    'api-reference-hero': k.apiHero,
    'code-playground': { body: k.productLine0, cta: k.install, headline: k.codeLabel, pattern: 'none' },
    'release-notes': { body: lead, cta: 'Read the changelog', headline: k.releaseTitle, pattern: 'none' },
    'video-thumbnail': { headline: k.phrase0, pattern: 'none', scale: 'bold' },
    'podcast-cover': { body: identity.mission, headline: `Inside ${identity.name}`, layout: 'centered', pattern: 'none', scale: 'bold' },
    'social-carousel': { body: k.productLine0, headline: k.phrase1, pattern: 'none', scale: 'bold' },
    'case-study-cover': { body: k.caseBody, headline: k.proofHeadline, pattern: 'none', scale: 'bold' },
    'whitepaper-cover': { body: identity.mission, headline: `The ${identity.name} field guide`, layout: 'stacked', pattern: 'none' },
    'booth-wall': { body: identity.website, headline: tagline, pattern: 'none', scale: 'bold' },
    'notebook-cover': { body: k.phrase0, headline: k.shortOrName, layout: 'centered', pattern: 'none', scale: 'bold' },
    lanyard: { headline: k.personName, pattern: 'none' },
    'event-badge': { headline: k.personName, pattern: 'none' },
    'event-backdrop': {
      body: k.eventWhere,
      headline: k.eventName,
      pattern: 'none',
      scale: 'bold',
    },
    'partnership-lockup': {
      body: k.partnershipBody,
      headline: k.partnershipHeadline,
      layout: 'centered',
      pattern: 'none',
    },
    'business-card': { headline: k.personName, layout: 'stacked', pattern: 'none' },
    'sticker-sheet': {
      body: k.phrase0,
      headline: k.shortOrName,
      layout: 'centered',
      pattern: 'none',
    },
    'packaging-label': {
      body: k.productLine0,
      headline: tagline,
      pattern: 'none',
    },
    letterhead: {
      body: lead,
      headline: `A note from ${identity.name}`,
      layout: 'stacked',
      pattern: 'none',
    },
  };
}

const BASEMENT_OVERRIDES: Partial<Record<string, BrandElementOverrides>> = {
      opengraph: { body: 'Independent digital studio · Strategy, identity, experience, and code.', headline: 'Cool work that performs.' },
      'hero-section': { body: 'We partner with ambitious companies to turn one sharp idea into a complete digital system.', cta: 'See the work', headline: 'Cool work that performs.' },
      'feature-grid': { body: 'Strategy gives the idea a reason. Identity makes it recognizable. Code makes it real.', headline: 'One idea. Built all the way through.' },
      'github-readme': { body: 'A focused creative tool from Basement Lab, made to be useful before it is impressive.', headline: 'Tools for making better things.' },
      'docs-header': { body: 'Principles, systems, and implementation notes for work that needs to hold up in the real world.', cta: 'Read the system', headline: 'How the work works.' },
      'launch-card': { body: 'A complete identity and digital experience built around one ownable idea.', cta: 'View the project', headline: 'The work should earn the attention.' },
      'slide-title': { body: 'Context, problem, idea, system, application, impact.', headline: 'Make it impossible to ignore.' },
      'slide-section': { body: 'The visual move comes from the business problem—not from a folder of effects.', headline: 'The idea earns the attention.' },
      'blog-cover': { body: 'Why recognizable systems beat a pile of one-off graphics.', headline: 'Build the system, not the skin.' },
      'report-cover': { body: 'Strategy, design, code, and the decisions that connect them.', headline: 'The work behind the work.' },
      'newsletter-email': { body: 'New work, tools, process notes, and the occasional thing we cannot stop thinking about.', cta: 'Read the dispatch', headline: 'From the Basement.' },
      'case-study-cover': { body: 'A clearer story, an ownable device, and a digital system designed to perform.', headline: 'From problem to system.' },
      'event-backdrop': { body: 'basement.studio', headline: 'Serious work. Good energy.' },
      'partnership-lockup': { body: 'Two teams. One exact idea.' },
      'notebook-cover': { body: 'ONE IDEA / BUILT ALL THE WAY THROUGH', headline: 'BSMNT' },
};

export function createBrandElementSettings(
  element: BrandElement,
  identity: BrandIdentity
): BrandElementSettings {
  const ink = identity.colors.find(({ id }) => id === 'ink')?.hex ?? '#181818';
  const paper = identity.colors.find(({ id }) => id === 'paper')?.hex ?? '#FFFFFF';
  const k = elementCopy(identity);
  const defaults: BrandElementSettings = {
    accentColor: identity.colors.find(({ id }) => id === 'emphasis')?.hex ?? ink,
    assetId: '',
    assetOpacity: 12,
    assetPlacement: 'background',
    artworkScale: identity.style.logoScale,
    artworkX: 0,
    artworkY: 0,
    backgroundColor: paper,
    body: k.lead,
    cta: '',
    foregroundColor: ink,
    fontRole: 'Display',
    fontWeight: Math.min(identity.typography.find(({ role }) => role === 'Display')?.weight ?? 550, 550),
    headline: k.tagline,
    layout: 'stacked',
    logoAppearance: { ...DEFAULT_LOGO_APPEARANCE },
    partnerName: k.partner,
    pattern: 'none',
    patternOpacity: 6,
    personName: k.personName,
    personRole: k.personRole,
    scale: 'balanced',
    showLogo: true,
    showWebsite: true,
  };
  const emailTemplate = getEmailLifecycleTemplate(element.id, identity);
  const emailTemplateOverrides: BrandElementOverrides = emailTemplate
    ? {
        body: emailTemplate.body,
        cta: emailTemplate.cta,
        headline: emailTemplate.subject,
        layout: 'stacked',
        pattern: 'none',
      }
    : {};
  return {
    ...defaults,
    ...emailTemplateOverrides,
    ...contentOverrides(identity, k)[element.id],
    ...(identity.id === 'basement' ? BASEMENT_OVERRIDES[element.id] : undefined),
  };
}

function capitalize(value: string): string {
  return value ? `${value[0]!.toLocaleUpperCase()}${value.slice(1)}` : value;
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


export const BRAND_ELEMENT_SOURCE_SCHEMA = 'glyphfield.brand-element';
export const BRAND_ELEMENT_SOURCE_VERSION = 2;

type SettingReader = (value: unknown, path: string) => unknown;

function hexSetting(value: unknown, path: string): string {
  if (typeof value !== 'string' || !/^#[\da-f]{6}$/i.test(value)) throw new TypeError(`${path} must be a six-digit HEX colour.`);
  return value.toUpperCase();
}

function textSetting(maximum: number): SettingReader {
  return (value, path) => {
    if (typeof value !== 'string') throw new TypeError(`${path} must be a string.`);
    if (value.length > maximum) throw new RangeError(`${path} must be at most ${maximum} characters.`);
    return value;
  };
}

function numberSetting(minimum: number, maximum: number): SettingReader {
  return (value, path) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${path} must be a finite number.`);
    return Math.min(maximum, Math.max(minimum, value));
  };
}

function enumSetting(allowed: readonly string[]): SettingReader {
  return (value, path) => {
    if (typeof value !== 'string' || !allowed.includes(value)) throw new RangeError(`${path} must be one of ${allowed.join(', ')}.`);
    return value;
  };
}

function booleanSetting(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') throw new TypeError(`${path} must be a Boolean.`);
  return value;
}

function objectSetting(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${path} must be an object.`);
  return value as Record<string, unknown>;
}

const SETTING_READERS: Record<keyof BrandElementSettings, SettingReader> = {
  accentColor: hexSetting,
  artworkScale: numberSetting(40, 200),
  artworkX: numberSetting(-120, 120),
  artworkY: numberSetting(-120, 120),
  assetId: textSetting(200),
  assetOpacity: numberSetting(0, 100),
  assetPlacement: enumSetting(['background', 'banner', 'card', 'header']),
  backgroundColor: hexSetting,
  body: textSetting(2000),
  cta: textSetting(200),
  fontRole: enumSetting(['Accent', 'Body', 'Code', 'Display']),
  fontWeight: numberSetting(100, 900),
  foregroundColor: hexSetting,
  headline: textSetting(400),
  layout: enumSetting(['split', 'stacked', 'centered']),
  logoAppearance: objectSetting,
  partnerName: textSetting(120),
  pattern: enumSetting(['none', 'dots', 'grid', 'dither']),
  patternOpacity: numberSetting(0, 100),
  personName: textSetting(120),
  personRole: textSetting(200),
  scale: enumSetting(['compact', 'balanced', 'bold']),
  showLogo: booleanSetting,
  showWebsite: booleanSetting,
};

/**
 * Validate a brand element source document. Version 2 names its element with
 * `elementId`; version 1 documents (settings only) apply to the selected
 * element. Only values that differ from the identity defaults are stored, so
 * untouched copy keeps following identity edits. `keys` lists the settings the
 * document provided; settings it omits keep their current values. Unknown keys
 * are ignored.
 */
export function parseBrandElementSource(
  value: Record<string, unknown>,
  elements: readonly BrandElement[],
  selectedElementId: string,
  identity: BrandIdentity
): { elementId: string; keys: Array<keyof BrandElementSettings>; overrides: BrandElementOverrides } {
  if (value.version !== undefined && value.version !== 1 && value.version !== BRAND_ELEMENT_SOURCE_VERSION) {
    throw new RangeError(`Brand element source version ${String(value.version)} is not supported.`);
  }
  const elementId = value.elementId === undefined ? selectedElementId : String(value.elementId);
  const element = elements.find(({ id }) => id === elementId);
  if (!element) throw new RangeError('elementId must reference an ID returned by /api/elements.');
  const defaults = createBrandElementSettings(element, identity);
  const overrides: Record<string, unknown> = {};
  const keys: Array<keyof BrandElementSettings> = [];
  for (const [key, reader] of Object.entries(SETTING_READERS)) {
    if (value[key] === undefined) continue;
    keys.push(key as keyof BrandElementSettings);
    const parsed = reader(value[key], key);
    if (JSON.stringify(parsed) !== JSON.stringify(defaults[key as keyof BrandElementSettings])) overrides[key] = parsed;
  }
  return { elementId, keys, overrides: overrides as BrandElementOverrides };
}

/** Seed for one use of the device in one element, so elements and repeated uses draw different compositions. */
export function brandElementDeviceSeed(identityId: string, elementId: string, use: number | string): number {
  return hashSeed(`${identityId}:${elementId}:${use}`);
}
