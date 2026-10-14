'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import type { ComponentProps } from 'react';

/**
 * A link that prefetches its route when someone points at, focuses or touches it rather than when
 * it scrolls into view, so the landing page does not spend its first seconds downloading the
 * Studio and the docs.
 */
export default function IntentLink({ href, onFocus, onPointerEnter, onTouchStart, ...props }: ComponentProps<typeof Link>) {
  const router = useRouter();
  const prefetch = () => {
    if (typeof href === 'string') router.prefetch(href);
  };
  return (
    <Link
      {...props}
      href={href}
      onFocus={(event) => {
        prefetch();
        onFocus?.(event);
      }}
      onPointerEnter={(event) => {
        prefetch();
        onPointerEnter?.(event);
      }}
      onTouchStart={(event) => {
        prefetch();
        onTouchStart?.(event);
      }}
      prefetch={false}
    />
  );
}
