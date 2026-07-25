'use client';

import { useId, type ReactNode } from 'react';

import {
  buildLogoSvgFilter,
  logoAppearanceCssFilter,
  type LogoAppearanceSettings,
} from '@/lib/logoAppearance';

export default function LogoAppearancePreview({
  ariaLabel,
  color,
  fallback,
  logoPath,
  opacity = 1,
  settings,
}: {
  ariaLabel: string;
  color: string;
  fallback?: ReactNode;
  logoPath?: string;
  opacity?: number;
  settings: LogoAppearanceSettings;
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
      className='block size-full overflow-visible'
      preserveAspectRatio='xMidYMid meet'
      role='img'
      viewBox='0 0 100 100'
    >
      <defs dangerouslySetInnerHTML={{ __html: buildLogoSvgFilter(settings, color, filterId) }} />
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
