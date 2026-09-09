// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';

import { paintDesignLabTextLayer } from '@/components/ShaderLabStudio';
import { createBrandIdentity } from '@/lib/brandIdentity';
import { DEFAULT_TEXT_EFFECT } from '@/lib/textEffects';

describe('Design Lab export text geometry', () => {
  function paint(boxHeight: number, gradient = false) {
    const context = {
      clearRect: vi.fn(),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn((text: string) => ({
        width: text.length * 55,
        fontBoundingBoxAscent: 80,
        fontBoundingBoxDescent: 20,
      })),
      restore: vi.fn(),
      save: vi.fn(),
      scale: vi.fn(),
      setTransform: vi.fn(),
      letterSpacing: '0px',
    } as unknown as CanvasRenderingContext2D;
    paintDesignLabTextLayer({
      box: { x: 500, y: 300, width: 40, height: boxHeight },
      canvasHeight: 900,
      canvasWidth: 1600,
      context,
      height: 900,
      identity: createBrandIdentity('Export test'),
      layer: {
        id: 'text-parity', name: 'Overflowing text', value: 'AB\nCD', visible: true,
        align: 'center', lineHeight: 1.2, tracking: 0, weight: 500, wrap: 'nowrap',
        transform: { x: 0, y: 0, scale: 0.6 },
        ...(gradient ? { textEffect: { ...DEFAULT_TEXT_EFFECT, kind: 'gradient', backgroundColor: '#FFFFFF' } } : {}),
      },
      paintShaderApplication: vi.fn(),
      textEffectScratch: {
        fill: { getContext: () => context } as unknown as HTMLCanvasElement,
        mask: { getContext: () => context } as unknown as HTMLCanvasElement,
        shadow: { getContext: () => context } as unknown as HTMLCanvasElement,
      },
      width: 1600,
    });
    return context;
  }

  it.each([10, 400])('centers the intrinsic line block when the selection height is %s', (height) => {
    const context = paint(height);
    const lineHeight = 900 * 0.17 * 0.6 * 1.2;
    const lineBaseline = (lineHeight - 80 - 20) / 2 + 80;
    const firstBaseline = 300 + (Math.max(height, 900 * 0.17 * 0.6) - lineHeight * 2) / 2 + lineBaseline;
    expect(context.fillText).toHaveBeenNthCalledWith(1, 'AB', 465, firstBaseline);
    expect(context.fillText).toHaveBeenNthCalledWith(2, 'CD', 465, firstBaseline + lineHeight);
    expect(context.scale).not.toHaveBeenCalled();
  });

  it('fills the intrinsic text height for an effect overflowing a tiny selection', () => {
    const context = paint(10, true);
    const fontSize = 900 * 0.17 * 0.6;
    const textHeight = fontSize * 1.2 * 2;
    expect(context.fillRect).toHaveBeenCalledWith(500, 300 + (fontSize - textHeight) / 2, 40, textHeight);
    expect(context.fillRect).not.toHaveBeenCalledWith(500, 300, 40, 10);
  });
});
