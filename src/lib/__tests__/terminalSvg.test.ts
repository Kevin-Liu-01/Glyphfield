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
    expect(svg).toContain('data-code-block-base="rareui"');
    expect(svg).toContain('data-slot="code-block-header"');
    expect(svg).toContain('data-language-icon="typescript"');
    expect(svg).toContain('fill="#3178C6"');
    expect(svg).toContain('data-slot="code-block-line"');
    expect(svg).toContain('>1</text>');
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
    expect(svg).toContain('data-language-icon="bash"');
  });

  it('uses the actual theSVG Python artwork for Python cards', () => {
    const svg = buildTerminalSvg({
      assetOpacity: 0,
      code: 'print("hello")',
      codeFontFamily: 'Mono',
      codeFontWeight: 400,
      language: 'python',
      title: 'Translate with Python',
      titleFontFamily: 'Display',
      titleFontWeight: 500,
    });

    expect(svg).toContain('data-language-icon="python"');
    expect(svg).toContain('id="terminal-python-a"');
    expect(svg).toContain('stop-color="#387EB8"');
    expect(svg).toContain('stop-color="#FFE052"');
  });
});
