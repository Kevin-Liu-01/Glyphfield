'use client';

import { useId, useLayoutEffect, useRef, useState } from 'react';

import LiveMaterialCanvas from '@/components/LiveMaterialCanvas';

import type { LiveMaterialSettings } from '@/lib/liveMaterials';

type ShaderWordLayout = {
  fontFamily: string;
  fontSize: number;
  fontStyle: string;
  fontWeight: string;
  letterSpacing: string;
  text: string;
  x: number;
  y: number;
};

type ShaderTextLayout = {
  height: number;
  width: number;
  words: ShaderWordLayout[];
};

export default function MarketingShaderText({
  settings,
  text,
}: {
  settings: LiveMaterialSettings;
  text: string;
}) {
  const maskId = `marketing-shader-text-${useId().replaceAll(':', '')}`;
  const rootRef = useRef<HTMLElement>(null);
  const [layout, setLayout] = useState<ShaderTextLayout | null>(null);
  const words = text.split(/\s+/).filter(Boolean);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let disposed = false;

    function syncLayout() {
      if (disposed || !root) return;
      const bounds = root.getBoundingClientRect();
      const nextLayout: ShaderTextLayout = {
        height: bounds.height,
        width: bounds.width,
        words: Array.from(root.querySelectorAll<HTMLElement>('[data-shader-word]')).map((word) => {
          const wordBounds = word.getBoundingClientRect();
          const baseline = word.querySelector<HTMLElement>('[data-shader-baseline]');
          const baselineBounds = baseline?.getBoundingClientRect();
          const style = window.getComputedStyle(word);
          return {
            fontFamily: style.fontFamily,
            fontSize: Number.parseFloat(style.fontSize),
            fontStyle: style.fontStyle,
            fontWeight: style.fontWeight,
            letterSpacing: style.letterSpacing,
            text: word.textContent ?? '',
            x: wordBounds.left - bounds.left + wordBounds.width / 2,
            y: (baselineBounds?.top ?? wordBounds.bottom) - bounds.top,
          };
        }),
      };
      setLayout((current) => JSON.stringify(current) === JSON.stringify(nextLayout) ? current : nextLayout);
    }

    syncLayout();
    const resizeObserver = new ResizeObserver(syncLayout);
    resizeObserver.observe(root);
    window.addEventListener('resize', syncLayout);
    void document.fonts?.ready.then(syncLayout);
    return () => {
      disposed = true;
      resizeObserver.disconnect();
      window.removeEventListener('resize', syncLayout);
    };
  }, [text]);

  return (
    <em
      aria-label={text}
      className='marketing-v5-shader-text'
      data-shader-ready={layout ? 'true' : 'false'}
      ref={rootRef}
    >
      <span aria-hidden='true' className='marketing-v5-shader-text-words'>
        {words.map((word, index) => (
          <span key={`${index}-${word}`}>
            {index > 0 ? ' ' : null}
            <span data-shader-word>
              {word}
              <i data-shader-baseline />
            </span>
          </span>
        ))}
      </span>
      {layout && layout.width > 0 && layout.height > 0 ? (
        <svg
          aria-hidden='true'
          className='marketing-v5-shader-text-svg'
          preserveAspectRatio='none'
          viewBox={`0 0 ${layout.width} ${layout.height}`}
        >
          <defs>
            <mask
              height={layout.height}
              id={maskId}
              maskUnits='userSpaceOnUse'
              width={layout.width}
              x='0'
              y='0'
            >
              {layout.words.map((word, index) => (
                <text
                  fill='white'
                  fontFamily={word.fontFamily}
                  fontSize={word.fontSize}
                  fontStyle={word.fontStyle}
                  fontWeight={word.fontWeight}
                  key={`${index}-${word.text}`}
                  letterSpacing={word.letterSpacing}
                  textAnchor='middle'
                  x={word.x}
                  y={word.y}
                >
                  {word.text}
                </text>
              ))}
            </mask>
          </defs>
          <foreignObject
            height={layout.height}
            mask={`url(#${maskId})`}
            width={layout.width}
            x='0'
            y='0'
          >
            <div className='marketing-v5-shader-text-material'>
              <LiveMaterialCanvas
                activeWhileMounted
                frameRate={30}
                materialId='paper-dithering-swirl'
                renderScale={0.75}
                settings={settings}
              />
            </div>
          </foreignObject>
        </svg>
      ) : null}
    </em>
  );
}
