// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import {
  holdLiveMaterialPreviews,
  LIVE_MATERIAL_SETTINGS_PREVIEW_EVENT,
  LIVE_MATERIAL_PATTERN_SCALE_PREVIEW_EVENT,
  LIVE_MATERIAL_TIME_PREVIEW_EVENT,
  previewLiveMaterialSettings,
  previewLiveMaterialPatternScale,
  previewLiveMaterialTime,
} from '../liveMaterialPreview';

describe('immutable capture preview hold', () => {
  it('blocks matching drag events before existing renderer listeners, then resumes routing', () => {
    const received: unknown[] = [];
    const events = [LIVE_MATERIAL_SETTINGS_PREVIEW_EVENT, LIVE_MATERIAL_PATTERN_SCALE_PREVIEW_EVENT, LIVE_MATERIAL_TIME_PREVIEW_EVENT];
    const listener = (event: Event) => received.push((event as CustomEvent).detail);
    events.forEach((event) => window.addEventListener(event, listener));
    const release = holdLiveMaterialPreviews(['canvas-one'], ['design-lab']);
    try {
      previewLiveMaterialSettings('canvas-one', { brightness: 1.5 });
      previewLiveMaterialPatternScale('canvas-one', 2);
      previewLiveMaterialTime('design-lab', 4000);
      expect(received).toEqual([]);
      previewLiveMaterialSettings('unrelated', { brightness: 0.5 });
      expect(received).toHaveLength(1);
      release();
      release();
      previewLiveMaterialSettings('canvas-one', { brightness: 1.5 });
      previewLiveMaterialPatternScale('canvas-one', 2);
      previewLiveMaterialTime('design-lab', 4000);
      expect(received).toHaveLength(4);
    } finally {
      release();
      events.forEach((event) => window.removeEventListener(event, listener));
    }
  });

  it('keeps overlapping capture holds independent', () => {
    let received = 0;
    const listener = () => { received++; };
    window.addEventListener(LIVE_MATERIAL_SETTINGS_PREVIEW_EVENT, listener);
    const first = holdLiveMaterialPreviews(['shared']);
    const second = holdLiveMaterialPreviews(['shared']);
    try {
      first();
      previewLiveMaterialSettings('shared', { speed: 2 });
      expect(received).toBe(0);
      second();
      previewLiveMaterialSettings('shared', { speed: 2 });
      expect(received).toBe(1);
    } finally {
      first(); second();
      window.removeEventListener(LIVE_MATERIAL_SETTINGS_PREVIEW_EVENT, listener);
    }
  });
});
