'use client';

import { memo } from 'react';
import { brandFontFaceCss, type BrandIdentity } from '@/lib/brandIdentity';

export default memo(function BrandFontFaces({ identity }: { identity: BrandIdentity }) {
  return <style data-brand-fonts={identity.id}>{brandFontFaceCss(identity)}</style>;
});
