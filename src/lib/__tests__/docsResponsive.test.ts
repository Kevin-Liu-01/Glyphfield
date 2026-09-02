import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const docsStyles = readFileSync('src/app/globals.css', 'utf8');
const docsRouteStyles = readFileSync('src/app/docs/docs.css', 'utf8');
const docsHeader = readFileSync('src/components/DocsHeader.tsx', 'utf8');
const docsTocActions = readFileSync('src/components/DocsTocActions.tsx', 'utf8');
const githubStarButton = readFileSync('src/components/GitHubStarButton.tsx', 'utf8');

describe('documentation responsive shell', () => {
  it('loads the precompiled Fumadocs layout contract', () => {
    expect(docsRouteStyles).toContain("@import 'fumadocs-ui/style.css';");
    expect(docsRouteStyles).not.toContain("@import 'fumadocs-ui/css/preset.css';");
  });

  it('uses the full viewport without a cyclic percentage track', () => {
    expect(docsStyles).toContain('--fd-layout-width: 100vw;');
    expect(docsStyles).not.toContain('--fd-layout-width: min(100vw, 100rem);');
    expect(docsStyles).not.toContain('--fd-layout-width: 100%;');
    expect(docsStyles).toMatch(/\.glyphfield-doc-page \{[\s\S]*?min-width: 0;[\s\S]*?max-width: none;[\s\S]*?margin-inline: auto;/);
    expect(docsStyles).toMatch(/\.glyphfield-docs #nd-page \{[\s\S]*?grid-area: main;/);
    expect(docsStyles).toMatch(/\.glyphfield-docs #nd-toc \{[\s\S]*?grid-area: toc;/);
  });

  it('switches from desktop rails to mobile navigation without losing search', () => {
    expect(docsStyles).toMatch(/@media \(max-width: 767px\) \{[\s\S]*?--fd-sidebar-width: 0px !important;/);
    expect(docsStyles).toMatch(/\.glyphfield-docs-header-mobile-theme,[\s\S]*?\.glyphfield-docs-sidebar-trigger \{[\s\S]*?display: grid !important;/);
    expect(docsStyles).toContain('.glyphfield-docs [data-toc-popover] {');
    expect(docsHeader).toContain("aria-label={gt('Open documentation navigation')}");
    expect(docsHeader).toContain("className='glyphfield-docs-mobile-search'");
  });

  it('contains wide content inside its own horizontal scroller', () => {
    expect(docsStyles).toMatch(/\.glyphfield-docs-body pre \{[\s\S]*?max-width: 100%;[\s\S]*?overflow-x: auto;/);
    expect(docsStyles).toMatch(/\.glyphfield-docs-body table \{[\s\S]*?max-width: 100%;[\s\S]*?overflow-x: auto;/);
    expect(docsStyles).toMatch(/\.glyphfield-docs-body img \{[\s\S]*?max-width: 100%;[\s\S]*?height: auto;/);
  });

  it('keeps a single desktop search and an accessible GitHub utility', () => {
    expect(docsTocActions).not.toContain('SearchFull');
    expect(docsTocActions).toContain('<GitHubStarButton />');
    expect(githubStarButton).toContain("gt('View Glyphfield on GitHub')");
    expect(githubStarButton).toContain('aria-label={title}');
  });
});
