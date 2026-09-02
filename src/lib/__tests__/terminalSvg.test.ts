import { describe, expect, it } from 'vitest';

import { buildTerminalSvg } from '../terminalSvg';

describe('terminal SVG', () => {
  it('renders one deterministic preview/export artifact with embedded resources', () => {
    const svg = buildTerminalSvg({
      assetData: 'data:image/png;base64,YmFja2dyb3VuZA==',
      assetOpacity: 140,
      code: 'const label = "<safe>";',
      codeFontData: 'data:font/woff2;base64,Y29kZQ==',
      codeFontFamily: 'Code fallback',
      codeFontWeight: 450,
      language: 'typescript',
      title: 'Ship <safely>',
      titleFontData: 'data:font/woff2;base64,dGl0bGU=',
      titleFontFamily: 'Title fallback',
      titleFontWeight: 650,
    });

    expect(svg).toContain('width="1200" height="630"');
    expect(svg).toContain('data:image/png;base64,YmFja2dyb3VuZA==');
    expect(svg).toContain('opacity="1"');
    expect(svg).toContain("font-family:'StudioTerminalTitle'");
    expect(svg).toContain('Ship &lt;safely&gt;');
    expect(svg).toContain('&quot;&lt;safe&gt;&quot;');
    expect(svg).not.toContain('Ship <safely>');
  });

  it('uses escaped fallback families and omits absent assets', () => {
    const svg = buildTerminalSvg({
      assetOpacity: -20,
      code: '',
      codeFontFamily: 'Code & Mono',
      codeFontWeight: 400,
      language: 'bash',
      title: 'Terminal',
      titleFontFamily: 'Display & Sans',
      titleFontWeight: 500,
    });

    expect(svg).not.toContain('<image');
    expect(svg).toContain('font-family="Display &amp; Sans"');
    expect(svg).toContain('font-family="Code &amp; Mono"');
  });
});
