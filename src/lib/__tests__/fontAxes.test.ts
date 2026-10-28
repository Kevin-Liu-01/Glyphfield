// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadFontAxes } from '../fontAxes';

describe('loadFontAxes same-origin guard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves null for URLs that normalize to another origin, without fetching', async () => {
    const fetch = vi.fn(async () => new Response(new ArrayBuffer(8)));
    vi.stubGlobal('fetch', fetch);
    await expect(loadFontAxes('/\\evil.test/font.woff2')).resolves.toBeNull();
    await expect(loadFontAxes('https://evil.test/font.woff2')).resolves.toBeNull();
    await expect(loadFontAxes('//evil.test/font.woff2')).resolves.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fetches a same-origin path once and caches by the given URL', async () => {
    const fetch = vi.fn(async () => new Response(new ArrayBuffer(8)));
    vi.stubGlobal('fetch', fetch);
    await expect(loadFontAxes('/fonts/same-origin.ttf')).resolves.toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/fonts/same-origin.ttf');
    await loadFontAxes('/fonts/same-origin.ttf');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('still reads a data: URL through the fetch mock', async () => {
    const fetch = vi.fn(async () => new Response(new ArrayBuffer(8)));
    vi.stubGlobal('fetch', fetch);
    await loadFontAxes('data:font/ttf;base64,AA==');
    expect(fetch).toHaveBeenCalledWith('data:font/ttf;base64,AA==');
  });
});
