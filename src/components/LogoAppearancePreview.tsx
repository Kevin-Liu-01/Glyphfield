'use client';

import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';

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

function DitherMask({
  children,
  className = 'relative size-full',
  settings,
}: {
  children: ReactNode;
  className?: string;
  settings: LogoAppearanceSettings;
}) {
  const mask = logoAppearanceDitherMask(settings);
  const maskImage = mask?.image;
  const maskRef = useRef<HTMLDivElement>(null);
  const style = mask ? appearanceDitherStyle(settings) : undefined;

  useLayoutEffect(() => {
    const node = maskRef.current;
    if (!node || !maskImage) return;
    let disposed = false;
    let frame = 0;
    let revision = 0;
    const repaint = () => {
      if (disposed || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (disposed) return;
        // WebKit can retain the pre-mask layer until a later remount when a
        // descendant canvas publishes pixels. Reassigning after a layout read
        // invalidates only this compositor layer, not the expensive renderer.
        node.style.webkitMaskImage = 'none';
        node.style.maskImage = 'none';
        void node.offsetWidth;
        node.style.webkitMaskImage = maskImage;
        node.style.maskImage = maskImage;
        node.dataset.appearanceDitherRevision = String(++revision);
      });
    };
    const observer = new MutationObserver(repaint);
    observer.observe(node, {
      attributes: true,
      attributeFilter: [
        'data-live-material-ready',
        'data-live-material-runtime-ready',
        'data-shader-frame-ready',
        'data-shader-frame-preview-revision',
        'data-live-material-preview-revision',
      ],
      childList: true,
      subtree: true,
    });
    node.addEventListener('load', repaint, true);
    repaint();
    return () => {
      disposed = true;
      observer.disconnect();
      node.removeEventListener('load', repaint, true);
      cancelAnimationFrame(frame);
    };
  }, [maskImage]);

  return (
    <div
      className={className}
      data-appearance-dither-mask='true'
      ref={maskRef}
      style={style}
    >{children}</div>
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
  if (!hasLogoAppearanceEffects(settings)) {
    return (
      <div
        aria-label={ariaLabel}
        className={`block size-full overflow-visible ${className}`}
        data-appearance-content='true'
        role='img'
        style={{ ...style, opacity }}
      >
        <DitherMask settings={settings}>{children}</DitherMask>
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
      <DitherMask settings={settings}>{children}</DitherMask>
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
  if (!logoPath) {
    return (
      <div
        aria-label={ariaLabel}
        className={`grid size-full place-items-center overflow-visible ${className}`}
        data-appearance-content='true'
        role='img'
        style={{ color, filter: logoAppearanceCssFilter(settings), opacity }}
      >
        <DitherMask className='grid size-full place-items-center' settings={settings}>
          {fallback}
        </DitherMask>
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
      <DitherMask settings={settings}>
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
      </DitherMask>
    </div>
  );
}
