'use client';

import { type CSSProperties, type ReactNode } from 'react';

import {
  hasLogoAppearanceEffects,
  logoAppearanceDitherMask,
  logoAppearanceCssFilter,
  type LogoAppearanceSettings,
} from '@/lib/logoAppearance';

function appearanceDitherStyle(settings: LogoAppearanceSettings): CSSProperties | undefined {
  const ditherMask = logoAppearanceDitherMask(settings);
  return ditherMask ? {
    maskImage: ditherMask.image,
    maskPosition: '0 0',
    maskRepeat: 'repeat',
    maskSize: ditherMask.size,
    WebkitMaskImage: ditherMask.image,
    WebkitMaskPosition: '0 0',
    WebkitMaskRepeat: 'repeat',
    WebkitMaskSize: ditherMask.size,
  } : undefined;
}

function sourceMaskStyle(url: string, fillFrame: boolean): CSSProperties {
  const size = fillFrame ? '100% 100%' : 'contain';
  return {
    backgroundColor: 'currentColor',
    maskImage: `url("${url}")`,
    maskPosition: 'center',
    maskRepeat: 'no-repeat',
    maskSize: size,
    WebkitMaskImage: `url("${url}")`,
    WebkitMaskPosition: 'center',
    WebkitMaskRepeat: 'no-repeat',
    WebkitMaskSize: size,
  };
}

export function AppearanceFilteredContent({
  ariaLabel,
  children,
  className = '',
  opacity = 1,
  settings,
  style,
}: {
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  opacity?: number;
  settings: LogoAppearanceSettings;
  style?: CSSProperties;
}) {
  const ditherStyle = appearanceDitherStyle(settings);

  if (!hasLogoAppearanceEffects(settings)) {
    return (
      <div
        aria-label={ariaLabel}
        className={`block size-full overflow-visible ${className}`}
        data-appearance-content='true'
        role='img'
        style={{ ...style, opacity }}
      >
        <div className='relative size-full' data-appearance-dither-mask='true'>{children}</div>
      </div>
    );
  }

  return (
    <div
      aria-label={ariaLabel}
      className={`block size-full overflow-visible ${className}`}
      data-appearance-content='true'
      role='img'
      style={{ ...style, filter: logoAppearanceCssFilter(settings), opacity }}
    >
      <div
        className='relative size-full'
        data-appearance-dither-mask='true'
        style={ditherStyle}
      >{children}</div>
    </div>
  );
}

export default function LogoAppearancePreview({
  ariaLabel,
  className = '',
  color,
  fallback,
  fillFrame = false,
  logoPath,
  opacity = 1,
  preserveColors = false,
  settings,
}: {
  ariaLabel: string;
  className?: string;
  color: string;
  fallback?: ReactNode;
  fillFrame?: boolean;
  logoPath?: string;
  opacity?: number;
  preserveColors?: boolean;
  settings: LogoAppearanceSettings;
}) {
  const ditherStyle = appearanceDitherStyle(settings);

  if (!logoPath) {
    return (
      <div
        aria-label={ariaLabel}
        className={`grid size-full place-items-center overflow-visible ${className}`}
        data-appearance-content='true'
        role='img'
        style={{ color, filter: logoAppearanceCssFilter(settings), opacity }}
      >
        <div className='grid size-full place-items-center' data-appearance-dither-mask='true' style={ditherStyle}>
          {fallback}
        </div>
      </div>
    );
  }

  return (
    <div
      aria-label={ariaLabel}
      className={`block size-full overflow-visible ${className}`}
      data-appearance-content='true'
      role='img'
      style={{ color, filter: logoAppearanceCssFilter(settings), opacity }}
    >
      <div className='relative size-full' data-appearance-dither-mask='true' style={ditherStyle}>
        {preserveColors ? (
          <img
            alt=''
            className='block size-full'
            draggable={false}
            src={logoPath}
            style={{ objectFit: fillFrame ? 'fill' : 'contain' }}
          />
        ) : (
          <span aria-hidden='true' className='block size-full' style={sourceMaskStyle(logoPath, fillFrame)} />
        )}
      </div>
    </div>
  );
}
