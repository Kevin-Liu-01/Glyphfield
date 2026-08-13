import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_LIVE_MATERIAL_SETTINGS } from '../liveMaterials';
import { DEFAULT_MATERIAL_FINISH } from '../materialFinish';
import {
  canCompositeShaderDirectly,
  hasAnimatedShaderBackgrounds,
  renderFrame,
  resolveDrawableImageSize,
  type RenderConfig,
  type StudioSource,
} from '../renderFrame';

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

const shaderBackground = {
  angle: 0,
  colorA: '#111111',
  colorB: '#555555',
  colorC: '#FFFFFF',
  materialId: 'paper-dithering-swirl' as const,
  materialSettings: DEFAULT_LIVE_MATERIAL_SETTINGS,
  style: 'shader' as const,
};

function textSource(id: string): StudioSource {
  return { background: shaderBackground, id, kind: 'text', text: id };
}

describe('direct shader compositing', () => {
  it('detects shader backgrounds that need continuously sampled hold frames', () => {
    expect(hasAnimatedShaderBackgrounds([textSource('a')])).toBe(true);
    expect(hasAnimatedShaderBackgrounds([{ id: 'plain', kind: 'text', text: 'Plain' }])).toBe(false);
  });

  it('uses the live GPU layer when adjacent frames share an unfinished sequence shader', () => {
    expect(canCompositeShaderDirectly(textSource('a'), textSource('b'), {})).toBe(true);
  });

  it('keeps 2D compositing for overrides and backdrop-dependent finishes', () => {
    expect(canCompositeShaderDirectly(textSource('a'), textSource('b'), { b: true })).toBe(false);
    expect(canCompositeShaderDirectly(
      { ...textSource('a'), finish: { ...DEFAULT_MATERIAL_FINISH, glassEnabled: true } },
      textSource('b'),
      {}
    )).toBe(false);
  });

  it('can render only foreground content over a directly composited shader', () => {
    const fillRect = vi.fn();
    const fillText = vi.fn();
    const context = {
      canvas: { height: 100, width: 200 },
      fillRect,
      fillText,
      measureText: () => ({ width: 40 }),
      restore: vi.fn(),
      rotate: vi.fn(),
      save: vi.fn(),
      scale: vi.fn(),
      translate: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    const config: RenderConfig = {
      alignX: 0,
      alignY: 0,
      background: '#111111',
      backgroundAngle: 0,
      backgroundSecondary: '#555555',
      backgroundStyle: 'shader',
      backgroundTransition: 'crossfade',
      bezier: [0.4, 0, 0.2, 1],
      blur: 8,
      fit: 'contain',
      fontSize: 24,
      fontWeight: 600,
      foreground: '#FFFFFF',
      height: 100,
      packageId: 'morph-fade',
      scale: 1,
      width: 200,
    };

    renderFrame(
      context,
      [textSource('a')],
      config,
      { elapsedMs: 0, index: 0, nextIndex: 0, phase: 'hold', progress: 0 },
      { omitBackground: true }
    );

    expect(fillRect).not.toHaveBeenCalled();
    expect(fillText).toHaveBeenCalledWith('a', 0, 0);
  });
});
