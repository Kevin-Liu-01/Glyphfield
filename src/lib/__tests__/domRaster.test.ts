// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';

import { domToSvg } from '@/lib/domRaster';

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
