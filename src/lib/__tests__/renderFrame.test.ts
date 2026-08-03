import { describe, expect, it } from 'vitest';

import { resolveDrawableImageSize } from '../renderFrame';

describe('resolveDrawableImageSize', () => {
  it('rejects a shader canvas until it has drawable dimensions', () => {
    const canvas = { height: 0, width: 0 } as HTMLCanvasElement;

    expect(resolveDrawableImageSize(canvas, 1_000, 300)).toBeNull();
  });

  it('returns the live canvas dimensions once the renderer has drawn', () => {
    const canvas = { height: 328, width: 1_099 } as HTMLCanvasElement;

    expect(resolveDrawableImageSize(canvas, 1_000, 300)).toEqual({ height: 328, width: 1_099 });
  });
});
