import type { CSSProperties } from 'react';

const BRAND_FIELD_HEIGHT = 516;

export const BRAND_FIELD_BANDS = [
  { height: 218, opacity: 0.36 },
  { height: 294, opacity: 0.48 },
  { height: 376, opacity: 0.62 },
  { height: 430, opacity: 0.76 },
  { height: 472, opacity: 0.94 },
  { height: 430, opacity: 0.8 },
  { height: 376, opacity: 0.66 },
  { height: 294, opacity: 0.5 },
  { height: 218, opacity: 0.38 },
] as const;

export default function BrandFieldBars({
  accent,
  barWidth,
  className,
  style,
}: {
  accent: string;
  barWidth?: number | string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden='true'
      className={className}
      style={{
        alignItems: 'flex-end',
        display: 'flex',
        justifyContent: 'center',
        ...style,
      }}
    >
      {BRAND_FIELD_BANDS.map((band, index) => (
        <div
          key={`${band.height}-${index}`}
          style={{
            backgroundImage: `linear-gradient(180deg, #07080b 0%, ${accent} 57%, #f7f7f4 100%)`,
            display: 'flex',
            flexShrink: 0,
            height: `${band.height / BRAND_FIELD_HEIGHT * 100}%`,
            opacity: band.opacity,
            width: barWidth ?? `${100 / BRAND_FIELD_BANDS.length}%`,
          }}
        />
      ))}
    </div>
  );
}
