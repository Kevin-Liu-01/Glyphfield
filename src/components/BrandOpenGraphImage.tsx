import type { CSSProperties } from 'react';

import BrandFieldBars from '@/components/BrandFieldBars';

export const OPEN_GRAPH_SIZE = {
  height: 630,
  width: 1200,
} as const;

type BrandOpenGraphImageProps = {
  accent: string;
  description: string;
  highlightedTitle?: string;
  title: string;
};

function GlyphfieldMark({ color = '#ffffff', size = 52 }: { color?: string; size?: number }) {
  return (
    <svg height={size} viewBox='0 0 64 64' width={size}>
      <path d='M6 6H56V16H16V48H48V58H6V6Z' fill={color} />
      <path d='M46 16H56V26H46V16Z' fill={color} />
      <path d='M28 27H46L41 32H58L40 45L45 37H27L32 32H22L28 27Z' fill={color} />
    </svg>
  );
}

function CornerTriangle({ position }: { position: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right' }) {
  const vertical = position.startsWith('top') ? { top: 0 } : { bottom: 0 };
  const horizontal = position.endsWith('left') ? { left: 0 } : { right: 0 };
  const rotation = {
    'bottom-left': 'rotate(270deg)',
    'bottom-right': 'rotate(180deg)',
    'top-left': 'rotate(0deg)',
    'top-right': 'rotate(90deg)',
  }[position];

  return (
    <div
      style={{
        ...vertical,
        ...horizontal,
        borderBottom: '9px solid transparent',
        borderLeft: '9px solid rgba(255,255,255,0.55)',
        borderTop: '9px solid transparent',
        display: 'flex',
        height: 0,
        position: 'absolute',
        transform: rotation,
        width: 0,
      }}
    />
  );
}

function GlyphField({ accent }: { accent: string }) {
  return (
    <div
      style={{
        alignItems: 'flex-end',
        background: '#07080b',
        display: 'flex',
        height: '100%',
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative',
        width: '100%',
      }}
    >
      <div
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.16) 1px, transparent 1px)',
          backgroundSize: '16px 16px',
          display: 'flex',
          inset: 0,
          opacity: 0.28,
          position: 'absolute',
        }}
      />
      <BrandFieldBars
        accent={accent}
        barWidth={44}
        style={{
          bottom: -1,
          height: 516,
          position: 'absolute',
          width: 420,
        }}
      />
      <div
        style={{
          alignItems: 'center',
          border: '1px solid rgba(255,255,255,0.42)',
          display: 'flex',
          height: 146,
          justifyContent: 'center',
          left: 137,
          position: 'absolute',
          top: 218,
          width: 146,
        }}
      >
        <GlyphfieldMark size={78} />
        <CornerTriangle position='top-left' />
        <CornerTriangle position='top-right' />
        <CornerTriangle position='bottom-left' />
        <CornerTriangle position='bottom-right' />
      </div>
    </div>
  );
}

export default function BrandOpenGraphImage({
  accent,
  description,
  highlightedTitle,
  title,
}: BrandOpenGraphImageProps) {
  const titleSize = title.length > 58 ? 55 : title.length > 38 ? 63 : 72;
  const shellStyle: CSSProperties = {
    background: '#f4f3ef',
    color: '#111113',
    display: 'flex',
    fontFamily: 'Switzer, Arial, sans-serif',
    height: '100%',
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  };

  return (
    <div style={shellStyle}>
      <div
        style={{
          borderRight: '1px solid rgba(17,17,19,0.2)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          padding: '34px 44px 30px',
          position: 'relative',
          width: 746,
        }}
      >
        <div style={{ alignItems: 'center', display: 'flex', height: 48 }}>
          <GlyphfieldMark color='#111113' size={40} />
          <div
            style={{
              display: 'flex',
              fontSize: 20,
              fontWeight: 550,
              letterSpacing: -0.45,
              marginLeft: 14,
            }}
          >
            Glyphfield
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: highlightedTitle ? 'column' : 'row',
            fontSize: titleSize,
            fontWeight: 500,
            letterSpacing: -3.4,
            lineHeight: 0.98,
            marginTop: 104,
            maxWidth: 650,
          }}
        >
          {highlightedTitle && title.startsWith(highlightedTitle) ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ color: accent, display: 'flex' }}>{highlightedTitle}</div>
              <div style={{ display: 'flex' }}>{title.slice(highlightedTitle.length).trimStart()}</div>
            </div>
          ) : title}
        </div>
        <div
          style={{
            color: 'rgba(17,17,19,0.62)',
            display: 'flex',
            fontSize: 22,
            letterSpacing: -0.35,
            lineHeight: 1.35,
            marginTop: 24,
            maxWidth: 624,
          }}
        >
          {description}
        </div>

        <div
          style={{
            alignItems: 'center',
            borderTop: '1px solid rgba(17,17,19,0.22)',
            color: 'rgba(17,17,19,0.56)',
            display: 'flex',
            fontSize: 12,
            justifyContent: 'flex-start',
            letterSpacing: 2,
            marginTop: 'auto',
            paddingTop: 20,
          }}
        >
          <span style={{ display: 'flex' }}>LOCAL-FIRST / MIT</span>
        </div>
      </div>

      <div style={{ display: 'flex', height: '100%', width: 454 }}>
        <GlyphField accent={accent} />
      </div>
    </div>
  );
}
