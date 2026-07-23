import { describe, expect, it } from 'vitest';

import type { StudioSource } from '../renderFrame';
import {
  applyFrameSettings,
  createDefaultFrameSettings,
  DEFAULT_SETTINGS,
  orderStudioSources,
} from '../studio';

const textSource: StudioSource = {
  id: 'text-0',
  kind: 'text',
  text: 'Welcome',
};

const imageSource: StudioSource = {
  height: 120,
  id: 'brand-logo',
  image: {} as CanvasImageSource,
  kind: 'image',
  name: 'Brand logo',
  width: 240,
};

describe('orderStudioSources', () => {
  it('keeps explicit mixed-source order and appends sources missing from saved state', () => {
    const result = orderStudioSources(
      [imageSource, textSource],
      ['stale-source', 'text-0']
    );

    expect(result.map(({ id }) => id)).toEqual(['text-0', 'brand-logo']);
  });
});

describe('createDefaultFrameSettings', () => {
  it('inherits composition and background defaults from the studio', () => {
    const frame = createDefaultFrameSettings({
      ...DEFAULT_SETTINGS,
      alignX: 0.25,
      background: '#112233',
      backgroundSecondary: '#445566',
      backgroundStyle: 'gradient',
      scale: 1.4,
    });

    expect(frame).toMatchObject({
      alignX: 0.25,
      background: {
        colorA: '#112233',
        colorB: '#445566',
        style: 'gradient',
      },
      scale: 1.4,
    });
  });
});

describe('applyFrameSettings', () => {
  it('adds editable frame transforms and background without changing source content', () => {
    const frame = {
      ...createDefaultFrameSettings(DEFAULT_SETTINGS),
      opacity: 0.6,
      rotation: -12,
      scale: 1.25,
    };

    expect(applyFrameSettings(textSource, frame)).toMatchObject({
      id: 'text-0',
      kind: 'text',
      opacity: 0.6,
      rotation: -12,
      scale: 1.25,
      text: 'Welcome',
    });
  });
});
