'use client';

import { brandFontFaceCss, type BrandIdentity } from '@/lib/brandIdentity';

export default function BrandFontFaces({ identity }: { identity: BrandIdentity }) {
  return <style data-brand-fonts={identity.id}>{brandFontFaceCss(identity)}</style>;
}
