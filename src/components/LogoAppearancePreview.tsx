'use client';

import { useId, type CSSProperties, type ReactNode } from 'react';

import {
  hasLogoAppearanceEffects,
  logoAppearanceCssFilter,
  resolveLogoSvgFilterModel,
  type LogoAppearanceSettings,
} from '@/lib/logoAppearance';

function renderAppearanceFilter({
  color,
  filterId,
  preserveColors,
  settings,
  showSource,
}: {
  color?: string;
  filterId: string;
  preserveColors: boolean;
  settings: LogoAppearanceSettings;
  showSource: boolean;
}) {
  const model = resolveLogoSvgFilterModel(settings, preserveColors);
  const includeSource = preserveColors || showSource;
  const shadowInput = includeSource ? model.outputSource : 'SourceAlpha';
  return (
    <filter colorInterpolationFilters='sRGB' height='220%' id={filterId} width='220%' x='-60%' y='-60%'>
      {!preserveColors ? <>
        <feFlood floodColor={color} result='logo-color' />
        <feComposite in='logo-color' in2='SourceAlpha' operator='in' result='colored' />
      </> : null}
      {settings.invert ? (
        <feComponentTransfer in={model.source} result='inverted'>
          <feFuncR tableValues='1 0' type='table' />
          <feFuncG tableValues='1 0' type='table' />
          <feFuncB tableValues='1 0' type='table' />
        </feComponentTransfer>
      ) : null}
      {model.ditherEnabled ? <>
        <feTurbulence
          baseFrequency={`${model.ditherFrequencyX.toFixed(4)} ${model.ditherFrequencyY.toFixed(4)}`}
          numOctaves={1}
          result='dither-noise'
          seed={23}
          stitchTiles='stitch'
          type='fractalNoise'
        />
        <feColorMatrix in='dither-noise' result='dither-alpha' type='luminanceToAlpha' />
        <feComponentTransfer in='dither-alpha' result='dither-threshold'>
          <feFuncA tableValues={model.ditherTable} type='discrete' />
        </feComponentTransfer>
        <feComposite in={model.filteredSource} in2='dither-threshold' operator='in' result='dithered' />
      </> : null}
      {settings.borderEnabled && settings.borderWidth > 0 ? <>
        <feMorphology in='SourceAlpha' operator='dilate' radius={settings.borderWidth} result='expanded' />
        <feComposite in='expanded' in2='SourceAlpha' operator='out' result='outline-alpha' />
        <feFlood floodColor={settings.borderColor} floodOpacity={settings.borderOpacity / 100} result='outline-color' />
        <feComposite in='outline-color' in2='outline-alpha' operator='in' result='outline' />
      </> : null}
      {settings.shadowEnabled ? <>
        <feGaussianBlur in={shadowInput} result='shadow-blur' stdDeviation={settings.shadowBlur / 2} />
        <feOffset dx={settings.shadowOffsetX} dy={settings.shadowOffsetY} in='shadow-blur' result='shadow-offset' />
        <feFlood floodColor={settings.shadowColor} floodOpacity={settings.shadowOpacity / 100} result='shadow-color' />
        <feComposite in='shadow-color' in2='shadow-offset' operator='in' result='shadow' />
      </> : null}
      <feMerge>
        {settings.shadowEnabled ? <feMergeNode in='shadow' /> : null}
        {settings.borderEnabled && settings.borderWidth > 0 ? <feMergeNode in='outline' /> : null}
        {includeSource ? <feMergeNode in={model.outputSource} /> : null}
      </feMerge>
    </filter>
  );
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
      role='img'
      style={{ ...style, opacity }}
    >
      <defs>{renderAppearanceFilter({ filterId, preserveColors: true, settings, showSource: true })}</defs>
      <foreignObject filter={`url(#${filterId})`} height='100%' width='100%' x='0' y='0'>
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
  fillFrame = false,
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
  fillFrame?: boolean;
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
      preserveAspectRatio={fillFrame ? 'none' : 'xMidYMid meet'}
      role='img'
      viewBox='0 0 100 100'
    >
      <defs>{renderAppearanceFilter({ color, filterId, preserveColors, settings, showSource })}</defs>
      <image
        filter={`url(#${filterId})`}
        height='100'
        href={logoPath}
        opacity={opacity}
        preserveAspectRatio={fillFrame ? 'none' : 'xMidYMid meet'}
        width='100'
      />
    </svg>
  );
}
