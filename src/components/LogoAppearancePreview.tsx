'use client';

import { useId, type CSSProperties, type ReactNode } from 'react';

import {
  buildImageSvgFilter,
  buildLogoSvgFilter,
  hasLogoAppearanceEffects,
  logoAppearanceCssFilter,
  type LogoAppearanceSettings,
} from '@/lib/logoAppearance';

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
  const filterId = `content-appearance-${useId().replaceAll(':', '')}`;

  if (!hasLogoAppearanceEffects(settings)) {
    return (
      <div
        aria-label={ariaLabel}
        className={`block size-full overflow-visible ${className}`}
        role='img'
        style={{ ...style, opacity }}
      >
        <div className='relative size-full'>{children}</div>
      </div>
    );
  }

  return (
    <svg
      aria-label={ariaLabel}
      className={`block size-full overflow-visible ${className}`}
      preserveAspectRatio='none'
      role='img'
      style={{ ...style, opacity }}
      viewBox='0 0 100 100'
    >
      <defs dangerouslySetInnerHTML={{ __html: buildImageSvgFilter(settings, filterId) }} />
      <foreignObject filter={`url(#${filterId})`} height='100' width='100' x='0' y='0'>
        <div className='relative size-full'>{children}</div>
      </foreignObject>
    </svg>
  );
}

export default function LogoAppearancePreview({
  ariaLabel,
  className = '',
  color,
  fallback,
  logoPath,
  opacity = 1,
  preserveColors = false,
  settings,
  showSource = true,
}: {
  ariaLabel: string;
  className?: string;
  color: string;
  fallback?: ReactNode;
  logoPath?: string;
  opacity?: number;
  preserveColors?: boolean;
  settings: LogoAppearanceSettings;
  showSource?: boolean;
}) {
  const filterId = `logo-appearance-${useId().replaceAll(':', '')}`;

  if (!logoPath) {
    return (
      <div
        aria-label={ariaLabel}
        className='grid size-full place-items-center'
        style={{ color, filter: logoAppearanceCssFilter(settings), opacity }}
      >
        {fallback}
      </div>
    );
  }

  return (
    <svg
      aria-label={ariaLabel}
      className={`block size-full overflow-visible ${className}`}
      preserveAspectRatio='xMidYMid meet'
      role='img'
      viewBox='0 0 100 100'
    >
      <defs dangerouslySetInnerHTML={{ __html: preserveColors
        ? buildImageSvgFilter(settings, filterId)
        : buildLogoSvgFilter(settings, color, filterId, showSource) }} />
      <image
        filter={`url(#${filterId})`}
        height='100'
        href={logoPath}
        opacity={opacity}
        preserveAspectRatio='xMidYMid meet'
        width='100'
      />
    </svg>
  );
}
