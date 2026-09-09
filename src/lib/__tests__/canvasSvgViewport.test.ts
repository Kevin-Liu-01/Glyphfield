// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadCanvasImage } from '@/lib/canvasDrawing';
import { canvasImageViewportKey, loadCanvasImageAtViewport, svgAtCanvasViewport } from '@/lib/canvasSvgViewport';

vi.mock('@/lib/canvasDrawing', () => ({ loadCanvasImage: vi.fn() }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.mocked(loadCanvasImage).mockReset();
});

describe('SVG image viewport parity', () => {
  it('invalidates prepared image pixels when either viewport dimension changes', () => {
    const original = canvasImageViewportKey('blob:asset', 40, 80);
    expect(canvasImageViewportKey('blob:asset', 80, 80)).not.toBe(original);
    expect(canvasImageViewportKey('blob:asset', 40, 40)).not.toBe(original);
    expect(canvasImageViewportKey('blob:replacement', 40, 80)).not.toBe(original);
    expect(canvasImageViewportKey('blob:asset', 40, 80)).toBe(original);
  });

  it('changes the viewport while preserving intrinsic viewBox alignment and artwork', () => {
    const source = '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="80" viewBox="0 0 160 80" preserveAspectRatio="xMaxYMin meet" data-original="true"><defs><mask id="cut"><rect width="160" height="80" fill="white"/></mask></defs><path d="M0 0h160v80H0z" mask="url(#cut)"/></svg>';
    const result = new DOMParser().parseFromString(svgAtCanvasViewport(source, 146.88, 136.8), 'image/svg+xml');
    const root = result.documentElement;
    expect(root.getAttribute('width')).toBe('146.88');
    expect(root.getAttribute('height')).toBe('136.8');
    expect(root.getAttribute('viewBox')).toBe('0 0 160 80');
    expect(root.getAttribute('preserveAspectRatio')).toBe('xMaxYMin meet');
    expect(root.getAttribute('data-original')).toBe('true');
    expect(result.querySelector('path')?.getAttribute('mask')).toBe('url(#cut)');
    expect(result.querySelector('#cut')).not.toBeNull();
  });

  it('preserves explicitly stretched SVGs instead of imposing contain', () => {
    const result = svgAtCanvasViewport('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 80" preserveAspectRatio="none"/>', 40, 80);
    expect(result).toContain('preserveAspectRatio="none"');
  });

  it('retains the intrinsic coordinate viewport of absolute SVG artwork without a viewBox', () => {
    const source = '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="80"><path fill="white" d="M24 12h96v48H24z"/></svg>';
    const result = svgAtCanvasViewport(source, 146.88, 136.8);
    expect(result).toBe(source);
    const root = new DOMParser().parseFromString(result, 'image/svg+xml').documentElement;
    expect(root.getAttribute('width')).toBe('160');
    expect(root.getAttribute('height')).toBe('80');
    expect(root.hasAttribute('viewBox')).toBe(false);
  });

  it('rejects non-SVG documents and invalid viewport dimensions', () => {
    expect(() => svgAtCanvasViewport('<html/>', 10, 20)).toThrow(/valid SVG/);
    expect(() => svgAtCanvasViewport('<svg/>', 0, 20)).toThrow(/positive/);
  });

  it('decodes SVG artwork in its authored viewport and releases the temporary URL', async () => {
    const source = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 80"/>';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Blob([source], { type: 'image/svg+xml' }))));
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:viewport-test');
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const image = new Image();
    vi.mocked(loadCanvasImage).mockResolvedValue(image);

    await expect(loadCanvasImageAtViewport('data:image/svg+xml,test', 40, 80)).resolves.toBe(image);

    const prepared = createUrl.mock.calls[0][0] as Blob;
    expect(await prepared.text()).toContain('width="40" height="80"');
    expect(loadCanvasImage).toHaveBeenCalledWith('blob:viewport-test');
    expect(revokeUrl).toHaveBeenCalledWith('blob:viewport-test');
  });

  it('keeps raster bytes unchanged and releases the temporary URL on decode failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Blob(['original raster'], { type: 'image/png' }))));
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:failed-viewport-test');
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.mocked(loadCanvasImage).mockRejectedValue(new Error('Decode failed'));

    await expect(loadCanvasImageAtViewport('blob:raster', 40, 80)).rejects.toThrow('Decode failed');

    const prepared = createUrl.mock.calls[0][0] as Blob;
    expect(prepared.type).toBe('image/png');
    expect(await prepared.text()).toBe('original raster');
    expect(revokeUrl).toHaveBeenCalledWith('blob:failed-viewport-test');
  });
});
