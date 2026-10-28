// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { cssUrl, imageUrlToDataUrl, resolveLocalAssetUrl, resolveSvgRasterDimensions } from '@/lib/download';

describe('SVG raster exports', () => {
  it('renders common Studio artboards at two physical pixels per logical pixel', () => {
    expect(resolveSvgRasterDimensions(1200, 630)).toEqual({
      height: 1260,
      pixelRatio: 2,
      width: 2400,
    });
    expect(resolveSvgRasterDimensions(1600, 900)).toEqual({
      height: 1800,
      pixelRatio: 2,
      width: 3200,
    });
  });

  it('does not inflate an artboard that is already at the safe raster limit', () => {
    expect(resolveSvgRasterDimensions(4800, 3200)).toEqual({
      height: 3200,
      pixelRatio: 1,
      width: 4800,
    });
  });
});

describe('resolveLocalAssetUrl', () => {
  it('resolves data: URLs, same-origin paths and this-origin blob: URLs', () => {
    expect(resolveLocalAssetUrl('data:image/png;base64,AA==')).toBe('data:image/png;base64,AA==');
    expect(resolveLocalAssetUrl('/fonts/a.woff2')).toBe('http://localhost:3000/fonts/a.woff2');
    expect(resolveLocalAssetUrl('art/../fonts/a.woff2')).toBe('http://localhost:3000/fonts/a.woff2');
    expect(resolveLocalAssetUrl(`blob:${window.location.origin}/uuid`)).toBe(`blob:${window.location.origin}/uuid`);
  });

  it('returns null for remote hosts, other schemes and URL-parsing bypasses', () => {
    expect(resolveLocalAssetUrl('https://evil.test/a.png')).toBeNull();
    expect(resolveLocalAssetUrl('//evil.test/a.png')).toBeNull();
    expect(resolveLocalAssetUrl('/\\evil.test/a.png')).toBeNull();
    expect(resolveLocalAssetUrl('/\t/evil.test')).toBeNull();
    expect(resolveLocalAssetUrl('javascript:alert(1)')).toBeNull();
    expect(resolveLocalAssetUrl('blob:https://evil.test/uuid')).toBeNull();
  });
});

describe('imageUrlToDataUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches a same-origin path once and returns its data URL', async () => {
    const fetch = vi.fn(async () => new Response(new Blob(['pixels'], { type: 'image/png' })));
    vi.stubGlobal('fetch', fetch);
    await expect(imageUrlToDataUrl('/art/a.png')).resolves.toBe('data:image/png;base64,cGl4ZWxz');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/art/a.png');
  });

  it('rejects URLs that normalize to another origin without fetching', async () => {
    const fetch = vi.fn(async () => new Response(new Blob(['x'])));
    vi.stubGlobal('fetch', fetch);
    await expect(imageUrlToDataUrl('/\\evil.test/a.png')).rejects.toThrow(/data: or same-origin/);
    await expect(imageUrlToDataUrl('https://evil.test/a.png')).rejects.toThrow(/data: or same-origin/);
    await expect(imageUrlToDataUrl('//evil.test/a.png')).rejects.toThrow(/data: or same-origin/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns a data: URL untouched and never fetches', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(imageUrlToDataUrl('data:image/png;base64,AA==')).resolves.toBe('data:image/png;base64,AA==');
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('cssUrl', () => {
  it('wraps a clean URL untouched', () => {
    expect(cssUrl('/fonts/a.woff2')).toBe('url("/fonts/a.woff2")');
    expect(cssUrl('data:image/svg+xml,%3Csvg%2F%3E')).toBe('url("data:image/svg+xml,%3Csvg%2F%3E")');
  });

  it('escapes every delimiter so the string cannot inject extra layers', () => {
    const token = cssUrl('data:image/svg+xml,x")\nurl(https://evil.test/)');
    expect(token.startsWith('url("')).toBe(true);
    expect(token.endsWith('")')).toBe(true);
    // Between the wrapping quotes nothing terminates the string early.
    for (const char of token.slice(5, -2)) {
      const code = char.codePointAt(0)!;
      expect(char === '"' || code < 0x20).toBe(false);
    }
    // Reading the value with CSS string rules still sees exactly one url( layer.
    expect(token.replace(/"([^"\\]|\\.)*"/g, 'x')).toBe('url(x)');
    expect(cssUrl('a\\b')).toBe('url("a\\5c b")');
  });
});
