import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  LIVE_MATERIAL_PATTERN_SCALE_PREVIEW_EVENT,
  LIVE_MATERIAL_SETTINGS_PREVIEW_EVENT,
  LIVE_MATERIAL_TIME_PREVIEW_EVENT,
  previewLiveMaterialPatternScale,
  previewLiveMaterialSettings,
  previewLiveMaterialTime,
  type LiveMaterialPatternScalePreview,
  type LiveMaterialSettingsPreview,
  type LiveMaterialTimePreview,
} from '@/lib/liveMaterialPreview';

describe('live material local previews', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('routes each preview to its renderer channel without touching composition state', () => {
    const target = new EventTarget();
    vi.stubGlobal('window', target);
    const received: unknown[] = [];
    target.addEventListener(LIVE_MATERIAL_PATTERN_SCALE_PREVIEW_EVENT, (event) => {
      received.push((event as CustomEvent<LiveMaterialPatternScalePreview>).detail);
    });
    target.addEventListener(LIVE_MATERIAL_SETTINGS_PREVIEW_EVENT, (event) => {
      received.push((event as CustomEvent<LiveMaterialSettingsPreview>).detail);
    });
    target.addEventListener(LIVE_MATERIAL_TIME_PREVIEW_EVENT, (event) => {
      received.push((event as CustomEvent<LiveMaterialTimePreview>).detail);
    });

    previewLiveMaterialPatternScale('content-asset-1', 2.4);
    previewLiveMaterialSettings('content-asset-1', { frequency: 8, colorA: '#2F6BFF' });
    previewLiveMaterialTime('design-lab', 640);

    expect(received).toEqual([
      { channel: 'content-asset-1', value: 2.4 },
      { channel: 'content-asset-1', settings: { frequency: 8, colorA: '#2F6BFF' } },
      { group: 'design-lab', timeMs: 640 },
    ]);
  });
});
