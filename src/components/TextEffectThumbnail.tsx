'use client';

import { textEffectCssStyle, type TextEffectSettings } from '@/lib/textEffects';

export default function TextEffectThumbnail({ settings }: { settings: TextEffectSettings }) {
  return (
    <span aria-hidden='true' className='text-effect-thumbnail' data-effect-kind={settings.kind}>
      <span style={textEffectCssStyle(settings, '#F3F3EF')}>Ag</span>
    </span>
  );
}
