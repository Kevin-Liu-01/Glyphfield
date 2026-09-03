import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const docsRouteStyles = readFileSync('src/app/docs/docs.css', 'utf8');
const docsLayout = readFileSync('src/app/docs/layout.tsx', 'utf8');
const docsHeader = readFileSync('src/components/DocsHeader.tsx', 'utf8');
const docsMobileA11y = readFileSync('src/components/DocsMobileA11y.tsx', 'utf8');
const docsControls = readFileSync('src/components/DocsControls.tsx', 'utf8');
const docsPage = readFileSync('src/app/docs/[[...slug]]/page.tsx', 'utf8');
const docsPageActions = readFileSync('src/components/DocsPageActions.tsx', 'utf8');
const docsMarkdownRoute = readFileSync('src/app/api/docs/[[...slug]]/route.ts', 'utf8');
const nextConfig = readFileSync('next.config.ts', 'utf8');
const sourceConfig = readFileSync('source.config.ts', 'utf8');

describe('documentation responsive shell', () => {
  it('loads the precompiled Fumadocs layout contract', () => {
    expect(docsRouteStyles).toContain("@import 'fumadocs-ui/style.css';");
    expect(docsRouteStyles).not.toContain("@import 'fumadocs-ui/css/preset.css';");
  });

  it('uses the full viewport without a cyclic percentage track', () => {
    expect(docsRouteStyles).toContain('--fd-layout-width: 100vw;');
    expect(docsRouteStyles).not.toContain('--fd-layout-width: min(100vw, 100rem);');
    expect(docsRouteStyles).not.toContain('--fd-layout-width: 100%;');
    expect(docsRouteStyles).toMatch(/#nd-docs-layout #nd-page\.glyphfield-doc-page \{[\s\S]*?min-width: 0;[\s\S]*?max-width: none;[\s\S]*?margin: 0;/);
  });

  it('switches from desktop rails to mobile navigation without losing search', () => {
    expect(docsRouteStyles).toMatch(/@media \(max-width: 767\.98px\) \{[\s\S]*?--fd-sidebar-width: 0px !important;/);
    expect(docsRouteStyles).toMatch(/\.glyphfield-docs-mobile-search,[\s\S]*?\.glyphfield-docs-sidebar-trigger \{[\s\S]*?display: grid !important;/);
    expect(docsRouteStyles).toContain('#nd-docs-layout [data-toc-popover] {');
    expect(docsHeader).toContain("aria-label={gt('Open documentation navigation')}");
    expect(docsHeader).toContain("className='glyphfield-docs-mobile-search'");
    expect(docsMobileA11y).toContain('Close documentation navigation');
  });

  it('contains wide content inside its own horizontal scroller', () => {
    expect(docsRouteStyles).toMatch(/\.glyphfield-docs-body pre \{[\s\S]*?max-width: 100%;[\s\S]*?overflow-x: auto;/);
    expect(docsRouteStyles).toMatch(/\.glyphfield-docs-body table \{[\s\S]*?max-width: 100%;[\s\S]*?overflow-x: auto;/);
    expect(docsRouteStyles).toMatch(/\.glyphfield-docs-body img \{[\s\S]*?max-width: 100%;[\s\S]*?height: auto;/);
  });

  it('moves desktop utilities into one floating control dock', () => {
    expect(docsLayout).toContain('<DocsControls />');
    expect(docsControls).toContain("aria-label='Documentation controls'");
    expect(docsControls).toContain("className='glyphfield-docs-controls__icon'");
    expect(docsControls).toContain("className='glyphfield-docs-controls__studio'");
    expect(docsRouteStyles).toContain('top: 12px;');
    expect(docsRouteStyles).toContain('min-height: 46px;');
    expect(docsRouteStyles).toMatch(/@media \(min-width: 768px\) \{[\s\S]*?\.glyphfield-docs-controls \{[\s\S]*?display: flex;/);
  });

  it('matches the reference page hierarchy and TOC geometry', () => {
    expect(docsPage).not.toContain('glyphfield-doc-page-kicker');
    expect(docsPage).toContain("tableOfContent={{ style: 'clerk' }}");
    expect(docsRouteStyles).toMatch(/\.glyphfield-doc-title \{[\s\S]*?font-size: 32px;[\s\S]*?font-weight: 600;/);
    expect(docsRouteStyles).toMatch(/\.glyphfield-doc-description \{[\s\S]*?font-size: 16px;/);
    expect(docsRouteStyles).toMatch(/\.glyphfield-doc-page-meta \{[\s\S]*?border-bottom: 1px solid var\(--docs-line\);/);
    expect(docsRouteStyles).toContain('--fd-toc-width: 360px;');
  });

  it('draws animated nested sidebar rails instead of a decorative divider', () => {
    const sidebarMotion = readFileSync('src/components/DocsSidebarMotion.tsx', 'utf8');
    expect(sidebarMotion).toContain("rail.className = 'docs-sb-rail'");
    expect(sidebarMotion).toContain('maskImage: mask');
    expect(sidebarMotion).toContain("placeThumb('hoverThumb', row)");
    expect(docsRouteStyles).toContain('#nd-sidebar .docs-sb-thumb-hover');
  });

  it('keeps the Glyphfield identity block in the top-left sidebar', () => {
    expect(docsLayout).toContain("className='glyphfield-docs-sidebar-mobile-brand'");
    expect(docsLayout).toContain('<SidebarDitherPanel />');
    expect(docsLayout).toContain("className='glyphfield-docs-sidebar-studio-link'");
  });

  it('offers a keyboard-aware copy-page menu and agent-readable Markdown twins', () => {
    expect(docsPage).toContain('<DocsPageActions');
    expect(docsPageActions).toContain("aria-haspopup='menu'");
    expect(docsPageActions).toContain("event.key === 'ArrowDown'");
    expect(docsPageActions).toContain("event.key === 'ArrowUp'");
    expect(sourceConfig).toContain('includeProcessedMarkdown: true');
    expect(nextConfig).toContain("source: '/docs/:path*.md'");
    expect(docsMarkdownRoute).toContain("'Content-Type': 'text/markdown; charset=utf-8'");
  });
});
