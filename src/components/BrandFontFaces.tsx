'use client';

import { memo } from 'react';
import { fontAssetFaceCss, selectableFontAssets, type BrandIdentity } from '@/lib/brandIdentity';

// The shipped fonts are declared too, so a text layer can pick any of them. A face downloads only when text uses it.
export default memo(function BrandFontFaces({ identity }: { identity: BrandIdentity }) {
  return <style data-brand-fonts={identity.id}>{fontAssetFaceCss(selectableFontAssets(identity))}</style>;
});
