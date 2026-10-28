// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { brandAgentSetupPrompt } from '../brandAgentSetup';
import { createBrandIdentity, type BrandFontAsset, type BrandIdentity } from '../brandIdentity';
import { brandKitFontFaces } from '../brandKit';
import {
  commentText,
  cssSingleQuoted,
  cssTimingFunction,
  jsSingleQuoted,
} from '../brandOutputKit';
import { brandCssVariables, brandTailwindTheme } from '../brandTokens';
import { BRAND_ELEMENTS, createBrandElementSettings } from '../brandElements';
import { brandEmailHtml } from '../brandEmailHtml';
import { colorWorkingState, legacyOklchTokens } from '../colorToolSource';
import { componentCode } from '../componentCode';
import { defaultComponentSettings } from '../componentLibrary';
import { embedBoardImages } from '../download';
import { domToSvg } from '../domRaster';
import { activeCodeTab, elementComponent, pageElements, readCodeTabs } from '../expressionModel';
import { createExpressionDocument } from '../expressionTemplates';
import { DEFAULT_BACKGROUND_SETTINGS, buildBackgroundSvg } from '../backgroundSvg';
import { buildMoodboardSvg, moodboardFontFaceCss } from '../moodboardSvg';

const COMMENT_FREE = (markup: string) => markup.replace(/\/\*[\s\S]*?\*\//g, '');

function evilIdentity(overrides: Partial<BrandIdentity> = {}): BrandIdentity {
  return { ...createBrandIdentity('Acme', 'acme'), ...overrides };
}

describe('escaping helpers', () => {
  it('neutralizes comment terminators and control characters', () => {
    expect(commentText('a */ b')).toBe('a * / b');
    expect(commentText('x */ } body { x: 1 } /*')).not.toContain('*/');
    expect(commentText('line\nwith\ttab')).toBe('linewithtab');
  });

  it('escapes single-quoted CSS strings without dropping readable text', () => {
    expect(cssSingleQuoted("Rockwell's")).toBe("Rockwell\\'s");
    expect(cssSingleQuoted('a\\b')).toBe('a\\\\b');
    expect(cssSingleQuoted('a\nb')).toBe('a\\a b');
    expect(cssSingleQuoted('Inter')).toBe('Inter');
  });

  it('normalizes timing functions and rejects everything else', () => {
    expect(cssTimingFunction('cubic-bezier(0,0,1,1)}body{background:url(//evil.test')).toBe('cubic-bezier(0, 0, 1, 1)');
    expect(cssTimingFunction('cubic-bezier(0.2, 0.8, 0.2, 1)')).toBe('cubic-bezier(0.2, 0.8, 0.2, 1)');
    expect(cssTimingFunction('ease-in-out')).toBe('ease-in-out');
    expect(cssTimingFunction('linear')).toBe('linear');
    expect(cssTimingFunction('steps(4, end)')).toBe('steps(4, end)');
    expect(cssTimingFunction('step-start')).toBe('step-start');
    expect(cssTimingFunction('x;y{z')).toBe('ease');
    expect(cssTimingFunction('cubic-bezier(0,0,1,nope)')).toBe('ease');
  });

  it('escapes single-quoted JS strings', () => {
    expect(jsSingleQuoted(`a'; evil(); //`)).toBe(`a\\'; evil(); //`);
    expect(jsSingleQuoted('a\nb')).toBe('a\\nb');
    expect(jsSingleQuoted('back\\slash')).toBe('back\\\\slash');
    expect(jsSingleQuoted("Rockwell's")).toBe("Rockwell\\'s");
  });
});

describe('brand token serializers', () => {
  it('keeps a hostile brand name and color names inside their CSS comments', () => {
    const identity = evilIdentity({
      colors: [
        { hex: '#111111', id: 'ink', name: 'Ink', proportion: 100, role: 'Text' },
        { hex: '#C6FF3D', id: 'emphasis', name: 'Lime */ } body { x: pwn } /*', proportion: 0, role: 'Accent' },
      ],
      name: 'Acme */ } body { background: url(//evil.test) } /*',
    });
    const css = COMMENT_FREE(brandCssVariables(identity));
    const tailwind = COMMENT_FREE(brandTailwindTheme(identity));
    expect(css).not.toContain('evil.test');
    expect(css).not.toContain('x: pwn');
    expect(tailwind).not.toContain('x: pwn');
    expect(brandCssVariables(identity)).toContain('/* Acme * / } body { background: url(//evil.test) } /* — CSS custom properties.');
  });

  it('emits motion curves only as a normalized timing function', () => {
    const motion = (curve: string, id: string) => ({ curve, description: '', durationMs: 300, id, name: id, previewPath: '' });
    const identity = evilIdentity({
      motion: [
        motion('cubic-bezier(0,0,1,1)}body{background:url(//evil.test', 'drive'),
        motion('ease-in-out', 'drift'),
        motion('steps(4, end)', 'tick'),
        motion('x;y{z', 'broken'),
      ],
    });
    const css = brandCssVariables(identity);
    const tailwind = brandTailwindTheme(identity);
    expect(css).toContain('--brand-ease-drive: cubic-bezier(0, 0, 1, 1);');
    expect(css).toContain('--brand-ease-drift: ease-in-out;');
    expect(css).toContain('--brand-ease-tick: steps(4, end);');
    expect(css).toContain('--brand-ease-broken: ease;');
    expect(css).not.toContain('evil.test');
    expect(tailwind).toContain('--ease-drive: cubic-bezier(0, 0, 1, 1);');
    expect(tailwind).toContain('--ease-drift: ease-in-out;');
    expect(tailwind).toContain('--ease-tick: steps(4, end);');
    expect(tailwind).toContain('--ease-broken: ease;');
    expect(tailwind).not.toContain('evil.test');
  });
});

describe('component code generation', () => {
  it('keeps a hostile brand name inside the TSX banner comment', () => {
    const identity = evilIdentity({ name: `x */; import evil from 'evil'; /*` });
    const [tsx] = componentCode(identity, defaultComponentSettings(identity), 'buttons', 'react');
    expect(tsx!.code.match(/\*\//g)).toHaveLength(1);
    expect(tsx!.code.indexOf('*/')).toBeGreaterThan(tsx!.code.indexOf('import evil'));
  });
});

describe('moodboard SVG font faces', () => {
  const font = (family: string): BrandFontAsset => ({
    family,
    fileName: 'face.woff2',
    format: 'woff2',
    id: 'face',
    label: 'Face',
    path: '/fonts/face.woff2',
    style: 'normal',
    weight: 400,
  });

  it('escapes markup-shaped family names inside the SVG style element', () => {
    const identity = evilIdentity({ fonts: [font('a</style><script>alert(1)</script>')] });
    const css = moodboardFontFaceCss(identity, new Map([['/fonts/face.woff2', 'data:font/woff2;base64,AA==']]));
    expect(css).not.toMatch(/</);
    const svg = buildMoodboardSvg(
      { ...evilIdentity(), typography: [{ family: 'b</style><img src=x onerror=evil>', role: 'Display', usage: 'Display' }, { family: 'Inter', role: 'Body', usage: 'Body' }, { family: 'Inter', role: 'Accent', usage: 'Accent' }, { family: 'Inter', role: 'Code', usage: 'Code' }] },
      { displayFont: 'data:font/woff2;base64,AA==' },
      'system'
    );
    expect(svg).not.toContain('</style><img');
    expect(svg).not.toContain('onerror=evil>');
  });

  it('keeps apostrophes and quotes inside font stacks', () => {
    const identity = evilIdentity({ fonts: [font("Rockwell's")] });
    const css = moodboardFontFaceCss(identity, new Map([['/fonts/face.woff2', 'data:font/woff2;base64,AA==']]));
    expect(css).toContain('Rockwell\\&apos;s');
  });
});

describe('brand email HTML', () => {
  it('keeps a hostile font family inside the style attribute', () => {
    const identity = evilIdentity({
      typography: [
        { family: 'x"><img src=x onerror=evil>', role: 'Display', usage: 'Display' },
        { family: 'x"><img src=x onerror=evil>', role: 'Body', usage: 'Body' },
        { family: 'Inter', role: 'Accent', usage: 'Accent' },
        { family: 'Inter', role: 'Code', usage: 'Code' },
      ],
    });
    const element = BRAND_ELEMENTS.find((candidate) => candidate.id === 'welcome-email')!;
    const document = brandEmailHtml({
      assetOrigin: 'https://brand.example.com',
      element,
      identity,
      settings: createBrandElementSettings(element, identity),
    });
    expect(document).not.toMatch(/<img src=x onerror/);
    expect(document).toContain('&lt;img src=x onerror=evil&gt;');
  });
});

describe('moodboard export image embedding', () => {
  it('fetches only same-origin image hrefs', async () => {
    const happy = window as unknown as { happyDOM?: { setURL(url: string): void } };
    happy.happyDOM?.setURL('https://studio.glyphfield.test/');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Blob(['x'], { type: 'image/png' })));
    try {
      const svg = '<svg><image href="https://evil.test/x.png"/><image href="/safe.png"/><image href="//evil.test/y.png"/><image href="data:image/png;base64,AA"/></svg>';
      const out = await embedBoardImages(svg);
      const fetched = fetchSpy.mock.calls.map(([input]) => String(input));
      expect(fetched).toEqual(['/safe.png']);
      expect(out).toContain('href="data:image/png;base64,');
      expect(out).toContain('href="https://evil.test/x.png"');
      expect(out).toContain('href="//evil.test/y.png"');
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

describe('agent setup prompt', () => {
  it('keeps a hostile brand name inside the JS string literal', () => {
    const backslash = brandAgentSetupPrompt({ identity: evilIdentity({ name: 'acme\\' }), mode: 'new' });
    expect(backslash).toContain(`name: 'acme\\\\' })`);
    const multiline = brandAgentSetupPrompt({ identity: evilIdentity({ name: 'a\nb' }), mode: 'new' });
    const match = /name: '((?:\\.|[^'\\])*)' \}\)/.exec(multiline);
    expect(match?.[1]).toBe('a\\nb');
    const quoted = brandAgentSetupPrompt({ identity: evilIdentity({ name: `a'; evil(); //` }), mode: 'new' });
    expect(quoted).toContain(`name: 'a\\'; evil(); //' })`);
  });
});

describe('brand kit font faces', () => {
  it('keeps a hostile font label inside the CSS comment', () => {
    const font: BrandFontAsset = {
      family: 'Inter',
      fileName: 'face.woff2',
      format: 'woff2',
      id: 'face',
      label: 'Face */ } body { x: pwn } /*',
      path: '/fonts/face.woff2',
      style: 'normal',
      weight: 400,
    };
    const identity = evilIdentity({ fonts: [font], typography: [{ family: 'Inter', fontId: 'face', role: 'Display', usage: 'Display' }] });
    const faces = brandKitFontFaces(identity).join('\n');
    expect(COMMENT_FREE(faces)).not.toContain('x: pwn');
  });
});

describe('color token output', () => {
  it('strips declaration-breaking characters from legacy color token names', () => {
    const state = colorWorkingState(evilIdentity(), {});
    state.colors = [{ hex: '#111111', id: 'ink', name: 'ink;body{background:url(//evil.test', proportion: 100, role: 'Text' }];
    const css = legacyOklchTokens(state);
    expect(css).not.toContain('evil.test');
    expect(css).toMatch(/^--color-ink-body-background-url-evil-test: /);
  });
});

describe('expression code snippet', () => {
  it('keeps newlines out of the generated brand.ts snippet', () => {
    const identity = evilIdentity({ name: `x\n'; alert(1); //` });
    const document = createExpressionDocument('terminal', identity);
    const code = pageElements(document, document.pageIds[0]!).find((element) => elementComponent(element) === 'code')!;
    const tab = readCodeTabs(code).find((candidate) => candidate.name === 'brand.ts') ?? activeCodeTab(code)!;
    const nameLine = tab.code.split('\n').find((line) => line.includes('name:'));
    expect(nameLine).toBe(`  name: 'x\\n\\'; alert(1); //',`);
  });
});

describe('rasterized DOM styles', () => {
  it('escapes markup inside the embedded font-face stylesheet', async () => {
    const node = document.createElement('div');
    node.textContent = 'Sample';
    document.body.append(node);
    try {
      const svg = await domToSvg(node, {
        fontFaceCss: '@font-face{font-family:"a</style><img src=x onerror=evil>";src:url(data:font/woff2;base64,AA==)}',
        height: 100,
        width: 100,
      });
      expect(svg).not.toContain('<img');
      expect(svg).toContain('&lt;/style&gt;');
    } finally {
      node.remove();
    }
  });
});

describe('background SVG attributes', () => {
  it('escapes markup-shaped values inside image href attributes', () => {
    const svg = buildBackgroundSvg(
      { ...DEFAULT_BACKGROUND_SETTINGS, surfaceLibraryAssetId: 'x<y' },
      { logo: 'data:image/svg+xml;base64,LOGO<', name: 'GT' }
    );
    expect(svg).not.toContain('href="data:image/svg+xml;base64,LOGO<"');
    expect(svg).toContain('data-surface-library-asset="x&lt;y"');
  });
});
