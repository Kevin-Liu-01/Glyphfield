'use client';

import Link from 'next/link';

import type { ComponentProps } from 'react';

let studioIntentPreload: Promise<unknown> | null = null;

export function preloadStudioFromIntent() {
  studioIntentPreload ??= Promise.all([
    import('@/components/StudioApp'),
    import('@/components/ShaderLabStudio'),
  ]).catch((error) => {
    studioIntentPreload = null;
    throw error;
  });
  return studioIntentPreload;
}

export default function MarketingStudioLink({
  children,
  onFocus,
  onPointerEnter,
  onTouchStart,
  ...props
}: Omit<ComponentProps<typeof Link>, 'href'>) {
  const preload = () => {
    void preloadStudioFromIntent().catch(() => {});
  };

  return (
    <Link
      {...props}
      href='/studio'
      onFocus={(event) => {
        preload();
        onFocus?.(event);
      }}
      onPointerEnter={(event) => {
        preload();
        onPointerEnter?.(event);
      }}
      onTouchStart={(event) => {
        preload();
        onTouchStart?.(event);
      }}
    >
      {children}
    </Link>
  );
}
