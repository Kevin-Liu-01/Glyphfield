// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { domToSvg, embedFontFaceCss } from '@/lib/domRaster';

const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('DOM rasterization', () => {
  it('draws images as SVG images in the same box, keeping object-fit and object-position', async () => {
    const node = document.createElement('div');
    node.innerHTML = `<img alt="" src="${PIXEL}" style="width:132px;height:132px;object-fit:cover;object-position:left top">`
      + `<img alt="" src="${PIXEL}" style="width:60px;height:20px;object-fit:contain">`
      + `<img alt="" src="${PIXEL}" style="width:10px;height:10px">`;
    document.body.append(node);
    const svg = await domToSvg(node, { height: 200, width: 200 });
    node.remove();
    expect(svg).not.toContain('<img');
    const images = [...svg.matchAll(/<image\b[^>]*>/g)].map(([markup]) => markup);
    expect(images).toHaveLength(3);
    expect(images.every((markup) => markup.includes(`href="${PIXEL}"`))).toBe(true);
    expect(images[0]).toContain('preserveAspectRatio="xMinYMin slice"');
    expect(images[1]).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(images[2]).toContain('preserveAspectRatio="none"');
  });
});

describe('embedFontFaceCss', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const FONT_DATA = 'data:font/woff2;base64,Zm9udC1ieXRlcw==';
  const fetchFont = () => vi.fn(async (_url: RequestInfo | URL) => new Response(new Blob(['font-bytes'], { type: 'font/woff2' })));

  it('embeds each same-origin url() once and leaves remote, data:, comments and strings untouched', async () => {
    const fetch = fetchFont();
    vi.stubGlobal('fetch', fetch);
    const input = [
      '@font-face{font-family:"A";src:url(/fonts/a.woff2) format("woff2");}',
      '@font-face{font-family:"B";src:url(/fonts/a.woff2), url("/fonts/b.woff2");}',
      '.y{font-family:"url(/fonts/inside-string.woff2)";content:"/* url(/fonts/also-string.woff2)";}',
      '/* url(/fonts/inside-comment.woff2) */',
      '@font-face{font-family:"C";src:url(https://evil.test/c.woff2);}',
      '@font-face{font-family:"D";src:url(data:font/woff2;base64,AA==);}',
    ].join('\n');

    const embedded = await embedFontFaceCss(input);

    const fetched = fetch.mock.calls.map((call) => String(call[0]));
    expect(fetched.sort()).toEqual([
      'http://localhost:3000/fonts/a.woff2',
      'http://localhost:3000/fonts/b.woff2',
    ]);
    // Both occurrences of the repeated URL are replaced, and the b face too.
    expect(embedded.split(FONT_DATA).length - 1).toBe(3);
    expect(embedded).toContain('url(/fonts/inside-string.woff2)');
    expect(embedded).toContain('url(/fonts/also-string.woff2)');
    expect(embedded).toContain('url(/fonts/inside-comment.woff2)');
    expect(embedded).toContain('url(https://evil.test/c.woff2)');
    expect(embedded).toContain('url(data:font/woff2;base64,AA==)');
  });

  it('does not embed url() that resolves cross-origin through parser tricks', async () => {
    const fetch = fetchFont();
    vi.stubGlobal('fetch', fetch);
    const embedded = await embedFontFaceCss('@font-face{src:url(/\\evil.test/a.woff2) url(/a%20ok.woff2)}');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/a%20ok.woff2');
    expect(embedded).toContain('url(/\\evil.test/a.woff2)');
  });

  it('leaves a missing face exactly as written', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 404 })));
    const input = '@font-face{src:url(  /fonts/gone.woff2  )}';
    expect(await embedFontFaceCss(input)).toBe(input);
  });

  it('scans megabyte adversarial stylesheets in linear time', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Blob(['b'], { type: 'font/woff2' }))));
    const inputs = [
      'url('.repeat(200_000),
      '"url('.repeat(200_000),
      `${'/*'.repeat(200_000)}`,
      'url( '.repeat(200_000),
      '@font-face{font-family:"url(x)";src:url(/y.woff2)}'.repeat(30_000),
      'x'.repeat(2_000_000),
    ];
    for (const input of inputs) {
      const started = performance.now();
      const result = await embedFontFaceCss(input);
      expect(performance.now() - started).toBeLessThan(1_000);
      expect(typeof result).toBe('string');
    }
  });
});
