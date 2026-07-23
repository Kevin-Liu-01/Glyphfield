import type { CSSProperties } from 'react';

export const OPEN_GRAPH_SIZE = {
  height: 630,
  width: 1200,
} as const;

type BrandOpenGraphImageProps = {
  accent: string;
  description: string;
  index: string;
  kicker: string;
  title: string;
};

const frameStyle: CSSProperties = {
  alignItems: 'center',
  border: '1px solid rgba(255,255,255,0.28)',
  display: 'flex',
  justifyContent: 'center',
  position: 'absolute',
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

function OutputStack({ accent }: { accent: string }) {
  return (
    <div
      style={{
        alignItems: 'center',
        display: 'flex',
        height: 452,
        justifyContent: 'center',
        position: 'relative',
        width: 398,
      }}
    >
      <div
        style={{
          backgroundImage: `radial-gradient(circle at 44% 42%, rgba(255,255,255,0.92) 0, ${accent} 20%, ${accent}44 48%, transparent 72%)`,
          borderRadius: 999,
          filter: 'blur(4px)',
          height: 360,
          opacity: 0.95,
          position: 'absolute',
          width: 360,
        }}
      />
      <div
        style={{
          ...frameStyle,
          background: 'rgba(12,12,14,0.5)',
          height: 250,
          left: 50,
          top: 62,
          transform: 'rotate(-8deg)',
          width: 292,
        }}
      />
      <div
        style={{
          ...frameStyle,
          background: 'rgba(255,255,255,0.08)',
          height: 250,
          left: 44,
          top: 83,
          transform: 'rotate(5deg)',
          width: 292,
        }}
      />
      <div
        style={{
          ...frameStyle,
          alignItems: 'stretch',
          background: '#f7f7f4',
          boxShadow: '0 28px 80px rgba(0,0,0,0.36)',
          flexDirection: 'column',
          height: 250,
          left: 48,
          padding: 22,
          top: 104,
          width: 292,
        }}
      >
        <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
          <GlyphfieldMark color='#18181b' size={31} />
          <div style={{ color: '#77777d', display: 'flex', fontSize: 12, letterSpacing: 2 }}>
            OUTPUT / 01
          </div>
        </div>
        <div
          style={{
            background: '#18181b',
            display: 'flex',
            height: 7,
            marginTop: 38,
            width: 175,
          }}
        />
        <div
          style={{
            background: '#18181b',
            display: 'flex',
            height: 7,
            marginTop: 10,
            opacity: 0.2,
            width: 218,
          }}
        />
        <div
          style={{
            backgroundImage: `linear-gradient(135deg, ${accent}, #f7f7f4 72%)`,
            border: '1px solid rgba(24,24,27,0.2)',
            display: 'flex',
            height: 44,
            marginTop: 'auto',
            width: '100%',
          }}
        />
      </div>
      <div
        style={{
          border: `1px solid ${accent}`,
          display: 'flex',
          height: 22,
          position: 'absolute',
          right: 26,
          top: 38,
          width: 22,
        }}
      />
      <div
        style={{
          background: accent,
          display: 'flex',
          height: 8,
          position: 'absolute',
          right: 33,
          top: 45,
          width: 8,
        }}
      />
    </div>
  );
}

export default function BrandOpenGraphImage({
  accent,
  description,
  index,
  kicker,
  title,
}: BrandOpenGraphImageProps) {
  const titleSize = title.length > 58 ? 56 : title.length > 38 ? 64 : 76;

  return (
    <div
      style={{
        background: '#111113',
        color: '#f7f7f4',
        display: 'flex',
        fontFamily: 'Inter, Arial, sans-serif',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        width: '100%',
      }}
    >
      <div
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(255,255,255,0.16) 1.2px, transparent 1.2px)',
          backgroundSize: '18px 18px',
          display: 'flex',
          inset: 0,
          maskImage: 'linear-gradient(90deg, rgba(0,0,0,0.75), transparent 72%)',
          opacity: 0.48,
          position: 'absolute',
        }}
      />
      <div
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.14)',
          display: 'flex',
          height: 92,
          left: 0,
          position: 'absolute',
          right: 0,
          top: 0,
        }}
      />
      <div
        style={{
          borderLeft: '1px solid rgba(255,255,255,0.14)',
          bottom: 0,
          display: 'flex',
          left: 812,
          position: 'absolute',
          top: 0,
        }}
      />
      <div
        style={{
          background: accent,
          bottom: 0,
          display: 'flex',
          height: 10,
          left: 0,
          position: 'absolute',
          right: 0,
        }}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          padding: '25px 0 29px 42px',
          position: 'relative',
          width: 812,
        }}
      >
        <div style={{ alignItems: 'center', display: 'flex', height: 50 }}>
          <GlyphfieldMark size={43} />
          <div
            style={{
              display: 'flex',
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: -0.6,
              marginLeft: 15,
            }}
          >
            GLYPH/FIELD
          </div>
          <div
            style={{
              color: 'rgba(255,255,255,0.5)',
              display: 'flex',
              fontSize: 13,
              letterSpacing: 2.6,
              marginLeft: 'auto',
              marginRight: 30,
            }}
          >
            BRAND STUDIO
          </div>
        </div>

        <div
          style={{
            alignItems: 'center',
            color: accent,
            display: 'flex',
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: 3.5,
            marginTop: 68,
            textTransform: 'uppercase',
          }}
        >
          <span style={{ display: 'flex' }}>{index}</span>
          <span
            style={{
              background: accent,
              display: 'flex',
              height: 1,
              margin: '0 14px',
              width: 36,
            }}
          />
          <span style={{ display: 'flex' }}>{kicker}</span>
        </div>

        <div
          style={{
            display: 'flex',
            fontSize: titleSize,
            fontWeight: 700,
            letterSpacing: -3.6,
            lineHeight: 0.98,
            marginTop: 22,
            maxWidth: 720,
          }}
        >
          {title}
        </div>
        <div
          style={{
            color: 'rgba(247,247,244,0.67)',
            display: 'flex',
            fontSize: 24,
            letterSpacing: -0.45,
            lineHeight: 1.35,
            marginTop: 23,
            maxWidth: 690,
          }}
        >
          {description}
        </div>

        <div
          style={{
            alignItems: 'center',
            color: 'rgba(255,255,255,0.46)',
            display: 'flex',
            fontSize: 13,
            letterSpacing: 2.2,
            marginTop: 'auto',
          }}
        >
          GLYPHFIELD.STUDIO
          <span style={{ display: 'flex', margin: '0 10px' }}>·</span>
          OPEN SOURCE / MIT
        </div>
      </div>

      <div
        style={{
          alignItems: 'center',
          display: 'flex',
          height: '100%',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative',
          width: 388,
        }}
      >
        <OutputStack accent={accent} />
      </div>
    </div>
  );
}
