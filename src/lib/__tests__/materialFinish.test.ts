import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MATERIAL_FINISH,
  finishColor,
  hasMaterialFinish,
  materialFinishPreset,
  normalizeMaterialFinish,
} from '../materialFinish';

describe('material finishes', () => {
  it('normalizes legacy drafts without losing explicit controls', () => {
    expect(normalizeMaterialFinish({ glassEnabled: true, glassOpacity: 42 })).toMatchObject({
      ...DEFAULT_MATERIAL_FINISH,
      glassEnabled: true,
      glassOpacity: 42,
    });
  });

  it('repairs malformed persisted finish settings before rendering', () => {
    expect(normalizeMaterialFinish({
      borderColor: null,
      borderOpacity: Number.POSITIVE_INFINITY,
      borderWidth: 400,
      glassPadding: -20,
      glassTint: 'not-a-color',
      presetId: 'removed-preset',
      shadowEnabled: 'yes',
    })).toMatchObject({
      borderColor: DEFAULT_MATERIAL_FINISH.borderColor,
      borderOpacity: DEFAULT_MATERIAL_FINISH.borderOpacity,
      borderWidth: 16,
      glassPadding: 0,
      glassTint: DEFAULT_MATERIAL_FINISH.glassTint,
      presetId: DEFAULT_MATERIAL_FINISH.presetId,
      shadowEnabled: DEFAULT_MATERIAL_FINISH.shadowEnabled,
    });
  });

  it('ships independently configurable reflection and liquid-glass presets', () => {
    expect(materialFinishPreset('mirror')).toMatchObject({
      presetId: 'mirror',
      reflectionEnabled: true,
    });
    expect(materialFinishPreset('liquid-glass')).toMatchObject({
      borderEnabled: true,
      glassEnabled: true,
      presetId: 'liquid-glass',
      shadowEnabled: true,
    });
  });

  it('detects active finish layers and converts colors for canvas filters', () => {
    expect(hasMaterialFinish(DEFAULT_MATERIAL_FINISH)).toBe(false);
    expect(hasMaterialFinish({ borderEnabled: true })).toBe(true);
    expect(finishColor('#73BFC4', 0.35)).toBe('rgba(115, 191, 196, 0.35)');
    expect(finishColor('invalid', 0.35)).toBe('rgba(0, 0, 0, 0.35)');
  });
});
