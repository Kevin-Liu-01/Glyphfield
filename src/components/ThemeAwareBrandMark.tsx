import Image from 'next/image';

import type { BrandAsset, BrandIdentity } from '@/lib/brandIdentity';

export default function ThemeAwareBrandMark({
  className = '',
  identity,
  inverse = false,
  surface = 'auto',
}: {
  className?: string;
  identity: BrandIdentity;
  inverse?: boolean;
  surface?: Exclude<BrandAsset['surface'], 'any'> | 'auto';
}) {
  const darkMark = identity.assets.find(({ id }) => id === 'mark-dark');
  const lightMark = identity.assets.find(({ id }) => id === 'mark-light');
  const nativeMark = darkMark ?? lightMark;

  if (!nativeMark) {
    return (
      <span
        aria-hidden='true'
        className={`theme-aware-brand-mark theme-aware-brand-mark-monogram ${className}`}
        data-brand-id={identity.id}
        data-surface={surface}
      >
        {identity.shortName.slice(0, 2)}
      </span>
    );
  }

  if (!darkMark || !lightMark || darkMark.path === lightMark.path) {
    return (
      <span
        aria-hidden='true'
        className={`theme-aware-brand-mark ${className}`}
        data-brand-id={identity.id}
        data-logo-treatment='native-color'
        data-surface={surface}
      >
        <Image alt='' fill sizes='64px' src={nativeMark.path} />
      </span>
    );
  }

  return (
    <span
      aria-hidden='true'
      className={`theme-aware-brand-mark ${className}`}
      data-brand-id={identity.id}
      data-inverse={inverse ? 'true' : 'false'}
      data-logo-treatment='contrast-variant'
      data-surface={surface}
    >
      <Image
        alt=''
        className='theme-aware-brand-mark-dark'
        fill
        sizes='64px'
        src={darkMark.path}
      />
      <Image
        alt=''
        className='theme-aware-brand-mark-light'
        fill
        sizes='64px'
        src={lightMark.path}
      />
    </span>
  );
}
