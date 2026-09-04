import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const docsRouteStyles = readFileSync('src/app/docs/docs.css', 'utf8');
const globalStyles = readFileSync('src/app/globals.css', 'utf8');
const docsLayout = readFileSync('src/app/docs/layout.tsx', 'utf8');
const docsHeader = readFileSync('src/components/DocsHeader.tsx', 'utf8');
const docsMobileA11y = readFileSync('src/components/DocsMobileA11y.tsx', 'utf8');
const docsControls = readFileSync('src/components/DocsControls.tsx', 'utf8');
const docsMdx = readFileSync('src/components/DocsMdx.tsx', 'utf8');
const docsSource = readFileSync('src/lib/docsSource.ts', 'utf8');
const docsThemeButton = readFileSync('src/components/DocsThemeButton.tsx', 'utf8');
const docsPage = readFileSync('src/app/docs/[[...slug]]/page.tsx', 'utf8');
const docsPageActions = readFileSync('src/components/DocsPageActions.tsx', 'utf8');
const docsMarkdownRoute = readFileSync('src/app/api/docs/[[...slug]]/route.ts', 'utf8');
const docsFullCorpusRoute = readFileSync('src/app/llms-full.txt/route.ts', 'utf8');
const glyphfieldBrandArtwork = readFileSync('public/brand/glyphfield-readme.svg', 'utf8').toLowerCase();
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
    expect(docsRouteStyles).toMatch(/#nd-docs-layout #nd-page\.glyphfield-doc-page \{[\s\S]*?width: min\(100%, 900px\);[\s\S]*?max-width: 900px;[\s\S]*?margin-inline: auto;/);
  });

  it('switches from desktop rails to mobile navigation without losing search', () => {
    expect(docsRouteStyles).toMatch(/@media \(max-width: 767\.98px\) \{[\s\S]*?--fd-sidebar-width: 0px !important;/);
    expect(docsRouteStyles).toMatch(/@media \(max-width: 767\.98px\) \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) !important;[\s\S]*?'header'[\s\S]*?'toc-popover'[\s\S]*?'main'/);
    expect(docsRouteStyles).toMatch(/#nd-docs-layout #nd-page\.glyphfield-doc-page \{[\s\S]*?width: 100%;[\s\S]*?grid-area: main;/);
    expect(docsRouteStyles).toMatch(/\.glyphfield-docs-mobile-search,[\s\S]*?\.glyphfield-docs-sidebar-trigger \{[\s\S]*?display: grid !important;/);
    expect(docsRouteStyles).toContain('#nd-docs-layout [data-toc-popover] {');
    expect(docsHeader).toContain("aria-label={gt('Open documentation navigation')}");
    expect(docsHeader).toContain("className='glyphfield-docs-mobile-search'");
    expect(docsMobileA11y).toContain('Close documentation navigation');
  });

  it('contains wide content inside its own horizontal scroller', () => {
    expect(docsRouteStyles).toMatch(/\.glyphfield-docs-body figure:has\(pre\) > \[role='region'\] \{[\s\S]*?max-width: 100%;[\s\S]*?overflow: auto;/);
    expect(docsRouteStyles).toMatch(/\.glyphfield-docs-body figure:has\(pre\) pre \{[\s\S]*?border: 0;[\s\S]*?border-radius: 0 !important;/);
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
    expect(sidebarMotion).toContain('docsSidebarRailPath(geometry, top)');
    expect(sidebarMotion).toContain('maskImage: mask');
    expect(sidebarMotion).toContain('for (const child of node.children) collectRows(child, rows);');
    expect(sidebarMotion).toContain("placeThumb('hoverThumb', row)");
    expect(sidebarMotion).toContain('hoveredRow?.isConnected');
    expect(sidebarMotion).toContain('new MutationObserver');
    expect(docsRouteStyles).toContain('#nd-sidebar .docs-sb-thumb-hover');
    expect(docsRouteStyles).toContain('padding-inline-start: var(--sidebar-item-offset) !important;');
    expect(globalStyles).toMatch(/@media not all \{\n\.dark \.docs-brand-mark/);
  });

  it('uses Glyphfield brand colors for documentation highlights', () => {
    expect(glyphfieldBrandArtwork).toContain('#7058ff');
    expect(glyphfieldBrandArtwork).toContain('#7bffd9');
    expect(glyphfieldBrandArtwork).toContain('#c8c0ff');
    expect(docsRouteStyles).toContain('--docs-accent: #7058ff;');
    expect(docsRouteStyles).toContain('--docs-accent-soft: #c8c0ff;');
    expect(docsRouteStyles).toContain('--docs-signal: #7bffd9;');
    expect(docsRouteStyles).toContain('linear-gradient(to bottom, var(--docs-accent), var(--docs-signal))');
    expect(docsRouteStyles).not.toContain('#5b7cff');
  });

  it('keeps overview and adjacent-page content unboxed', () => {
    expect(docsRouteStyles).toMatch(/\.docs-path-card,[\s\S]*?\.docs-system-item \{[\s\S]*?border: 0;[\s\S]*?border-radius: 0;/);
    expect(docsMdx).toContain("className='docs-card-icon'");
    expect(docsMdx).toContain("className='docs-card-arrow'");
    expect(docsRouteStyles).toMatch(/\.glyphfield-doc-footer-actions \{[\s\S]*?border: 0;[\s\S]*?background: transparent;/);
    expect(docsRouteStyles).toMatch(/#nd-page div\[class\*='pb-6'\]\[class\*='grid'\] \{[\s\S]*?border: 0;[\s\S]*?border-radius: 0;/);
  });

  it('uses semantic Phosphor icons in overview cards and the sidebar tree', () => {
    expect(docsSource).toContain('DOCS_SOLID_ICONS');
    expect(docsSource).toContain("weight: 'fill'");
    expect(docsSource).not.toContain('lucideIconsPlugin');
    expect(docsRouteStyles).toMatch(/> svg:not\(\[data-icon='true'\]\) \{[^}]*display: block;/);
    expect(docsRouteStyles).not.toMatch(/> svg:not\(\[data-icon='true'\]\) \{[^}]*display: none;/);
  });

  it('keeps the Glyphfield identity block in the top-left sidebar', () => {
    expect(docsLayout).toContain("className='glyphfield-docs-sidebar-mobile-brand'");
    expect(docsLayout).toContain('<SidebarDitherPanel');
    expect(docsLayout).toContain('icons={[<Books />, <Braces />, <Bot />, <Search />]}');
    expect(docsLayout).toContain("className='glyphfield-docs-sidebar-studio-link'");
    expect(docsLayout).toContain("<DocsSidebarFooter key='docs-sidebar-footer' />");
    expect(docsThemeButton).toContain("aria-label='Toggle color theme'");
  });

  it('uses Fumadocs page actions and agent-readable Markdown twins', () => {
    expect(docsPage).toContain('<DocsPageActions');
    expect(docsPage).toContain("'Maintained with source'");
    expect(docsPageActions).toContain('MarkdownCopyButton');
    expect(docsPageActions).toContain('ViewOptionsPopover');
    expect(docsPageActions).toContain('githubUrl={sourceUrl}');
    expect(sourceConfig).toContain('includeProcessedMarkdown: true');
    expect(nextConfig).toContain("source: '/docs/:path*.md'");
    expect(docsMarkdownRoute).toContain("'Content-Type': 'text/markdown; charset=utf-8'");
    expect(docsMarkdownRoute).toContain('...AGENT_CORS_HEADERS');
    expect(docsFullCorpusRoute).toContain('docsSource.getPages()');
    expect(docsFullCorpusRoute).toContain("page.data.getText('processed')");
    expect(docsFullCorpusRoute).toContain("'Content-Type': 'text/plain; charset=utf-8'");
    expect(docsFullCorpusRoute).toContain('...AGENT_CORS_HEADERS');
  });
});
