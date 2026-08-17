'use client';

import { useLayoutEffect, useRef } from 'react';

import {
  applyCompositionEffect,
  defaultCompositionEffectSettings,
  type CompositionEffectKind,
} from '@/lib/compositionEffects';

const WIDTH = 112;
const HEIGHT = 72;

const THUMBNAIL_PALETTES: Record<CompositionEffectKind, { background: string; foreground: string }> = {
  ascii: { background: '#0D120B', foreground: '#D9FF7A' },
  bayer: { background: '#1C1210', foreground: '#FFE9D4' },
  halftone: { background: '#171114', foreground: '#FF7659' },
  posterize: { background: '#15172A', foreground: '#C6D0FF' },
};

export default function CompositionEffectThumbnail({ kind }: { kind: CompositionEffectKind }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const source = context.createImageData(WIDTH, HEIGHT);
    for (let y = 0; y < HEIGHT; y += 1) {
      for (let x = 0; x < WIDTH; x += 1) {
        const u = x / WIDTH * 2 - 1;
        const v = y / HEIGHT * 2 - 1;
        const orb = Math.max(0, 1 - Math.hypot(u * 0.9 + 0.22, v + 0.04) * 0.82);
        const ribbon = Math.max(0, 1 - Math.abs(u * 0.68 - v * 0.52 + 0.06) * 4.2);
        const aperture = Math.max(0, 1 - Math.hypot(u - 0.48, v + 0.34) * 3.1);
        const ripple = (Math.sin((u * 0.74 + v) * 13) + 1) * 0.055;
        const tone = Math.max(0, Math.min(1, 0.035 + orb * 0.6 + ribbon * 0.22 + aperture * 0.3 + ripple));
        const offset = (y * WIDTH + x) * 4;
        source.data[offset] = Math.round(tone * 255);
        source.data[offset + 1] = Math.round(tone * 255);
        source.data[offset + 2] = Math.round(tone * 255);
        source.data[offset + 3] = 255;
      }
    }
    const settings = {
      ...defaultCompositionEffectSettings(kind),
      ...THUMBNAIL_PALETTES[kind],
      cellSize: kind === 'ascii' ? 7 : kind === 'halftone' ? 9 : 3,
    };
    context.putImageData(source, 0, 0);
    applyCompositionEffect(context, WIDTH, HEIGHT, settings, 1);
  }, [kind]);

  return (
    <span aria-hidden='true' className='composition-effect-thumbnail' data-effect-kind={kind}>
      <canvas height={HEIGHT} ref={canvasRef} width={WIDTH} />
    </span>
  );
}
