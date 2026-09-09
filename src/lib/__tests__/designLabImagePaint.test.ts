// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createContainedLayer } from '@/components/ShaderLabStudio';
import { previewContainedImageBounds } from '@/lib/imagePlacement';

describe('Design Lab image export geometry', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([[10.4, 4.6], [2.6, 1.4], [100, 40]])(
    'preserves the intrinsic logo ratio in a %s by %s selection box',
    (width, height) => {
      let scaleX = 1, scaleY = 1;
      let painted = { x: 0, y: 0, width: 0, height: 0 };
      const context = {
        scale: (x: number, y: number) => { scaleX *= x; scaleY *= y; },
        drawImage: (_source: CanvasImageSource, x: number, y: number, width: number, height: number) => {
          painted = { x: x * scaleX, y: y * scaleY, width: width * scaleX, height: height * scaleY };
        },
      };
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
      const image = { naturalWidth: 400, naturalHeight: 100 } as HTMLImageElement;
      const scratch = createContainedLayer(image, width, height);
      // The appearance compositor maps the integer backing buffer to the
      // authored box. Compare that final geometry to the actual SVG preview.
      const final = {
        x: painted.x * width / scratch.width,
        y: painted.y * height / scratch.height,
        width: painted.width * width / scratch.width,
        height: painted.height * height / scratch.height,
      };
      const expected = previewContainedImageBounds({ boxWidth: width, boxHeight: height, imageWidth: 400, imageHeight: 100 });
      expect(final.width / final.height).toBeCloseTo(4, 8);
      for (const key of ['x', 'y', 'width', 'height'] as const) expect(final[key]).toBeCloseTo(expected[key], 8);
    }
  );
});
