// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';

import { paintDesignLabTextLayer } from '@/components/ShaderLabStudio';
import { createBrandIdentity } from '@/lib/brandIdentity';
import { DEFAULT_TEXT_EFFECT } from '@/lib/textEffects';

describe('Design Lab export text geometry', () => {
  function paint(boxHeight: number, gradient = false, typography: {
    fontSize?: number;
    fontStyle?: 'normal' | 'italic';
    strikethrough?: boolean;
    underline?: boolean;
  } = {},
    dimensions = { canvasHeight: 900, canvasWidth: 1600, width: 1600 }) {
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
      canvasHeight: dimensions.canvasHeight,
      canvasWidth: dimensions.canvasWidth,
      context,
      height: 900,
      identity: createBrandIdentity('Export test'),
      layer: {
        id: 'text-parity', name: 'Overflowing text', value: 'AB\nCD', visible: true,
        align: 'center', lineHeight: 1.2, tracking: 0, weight: 500, wrap: 'nowrap',
        transform: { x: 0, y: 0, scale: 0.6 },
        ...typography,
        ...(gradient ? { textEffect: { ...DEFAULT_TEXT_EFFECT, kind: 'gradient', backgroundColor: '#FFFFFF' } } : {}),
      },
      paintShaderApplication: vi.fn(),
      textEffectScratch: {
        fill: { getContext: () => context } as unknown as HTMLCanvasElement,
        mask: { getContext: () => context } as unknown as HTMLCanvasElement,
        shadow: { getContext: () => context } as unknown as HTMLCanvasElement,
      },
      width: dimensions.width,
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

  it.each([300, 900, 1920])('keeps explicit small italic text at the same artboard size on a %spx-tall board', (canvasHeight) => {
    const context = paint(10, false, { fontSize: 20, fontStyle: 'italic' }, { canvasHeight, canvasWidth: 1000, width: 1000 });
    expect(context.font).toMatch(/^italic 500 12px /);
    expect(context.fillText).toHaveBeenCalled();
    expect(context.scale).not.toHaveBeenCalled();
  });

  it('scales the explicit italic font with export resolution, not the selection box', () => {
    const context = paint(1, true, { fontSize: 20, fontStyle: 'italic' }, { canvasHeight: 1920, canvasWidth: 1000, width: 500 });
    expect(context.font).toMatch(/^italic 500 6px /);
    expect(context.fillText).toHaveBeenCalled();
  });

  it('paints underline and strikethrough into every exported text line', () => {
    const context = paint(400, false, { fontSize: 20, strikethrough: true, underline: true });
    expect(context.fillRect).toHaveBeenCalledTimes(4);
    for (const call of vi.mocked(context.fillRect).mock.calls) {
      expect(call[0]).toBe(465);
      expect(call[2]).toBe(110);
      expect(call[3]).toBe(1);
    }
  });
});
