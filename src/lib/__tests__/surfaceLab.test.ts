import { describe, expect, it } from 'vitest';

import { SURFACE_MATERIAL_IDS } from '../backgroundSvg';
import { OPEN_SURFACE_LIBRARY } from '../openSurfaceLibrary';
import {
  SURFACE_LAB_CLOTH_PRESETS,
  SURFACE_LAB_PRESETS,
  SURFACE_LAB_SHEET_PRESETS,
  SURFACE_LAB_SHADER_PRESETS,
  SURFACE_LAB_STICKER_PRESETS,
  surfaceLabPreset,
  surfaceLabPresets,
} from '../surfaceLab';
import { STICKER_FINISH_PRESETS } from '../surfaceSticker';
import { shaderLabMaterials } from '../shaderLab';

describe('Surface Lab preset system', () => {
  it('keeps every outcome mode populated and every preset id unique', () => {
    expect(surfaceLabPresets('sheet').length).toBeGreaterThan(10);
    expect(surfaceLabPresets('shader')).toHaveLength(shaderLabMaterials('', 'all').length);
    expect(surfaceLabPresets('cloth')).toHaveLength(3);
    expect(surfaceLabPresets('sticker')).toHaveLength(STICKER_FINISH_PRESETS.length);
    expect(new Set(SURFACE_LAB_PRESETS.map(({ id }) => id)).size).toBe(SURFACE_LAB_PRESETS.length);
  });

  it('exposes the exact Shader Lab catalog as a live Surface outcome', () => {
    expect(SURFACE_LAB_SHADER_PRESETS.map(({ liveMaterialId }) => liveMaterialId)).toEqual(
      shaderLabMaterials('', 'all').map(({ id }) => id)
    );
    expect(SURFACE_LAB_SHADER_PRESETS.every(({ mode, previewUrl }) => mode === 'shader' && previewUrl?.endsWith('.webp'))).toBe(true);
  });

  it('preserves the complete open PBR library in Material mode', () => {
    for (const asset of OPEN_SURFACE_LIBRARY) {
      expect(surfaceLabPreset(asset.id)).toMatchObject({
        mode: 'sheet',
        source: { license: 'CC0 1.0', name: asset.provider },
      });
    }
  });

  it('uses physically based thin-film iridescence as a first-class material', () => {
    expect(SURFACE_MATERIAL_IDS).toContain('iridescent-film');
    expect(SURFACE_LAB_SHEET_PRESETS[0]).toMatchObject({
      id: 'thin-film-opal',
      mode: 'sheet',
      settings: { surfaceMaterial: 'iridescent-film' },
      source: { name: 'Khronos iridescence' },
    });
  });

  it('binds Material Archiv records to renderable materials without replacing texture provenance', () => {
    expect(surfaceLabPreset('pressed-graphite')).toMatchObject({
      materialRecord: {
        family: 'Mineral · carbon',
        source: { license: 'Reference only', name: 'Material Archiv' },
      },
      settings: { surfaceMaterial: 'graphite' },
      source: { name: 'Material Archiv' },
    });
    expect(surfaceLabPreset('brushed-aluminum-v3')).toMatchObject({
      materialRecord: { family: 'Non-ferrous metal', source: { name: 'Material Archiv' } },
      source: { name: 'Glyphfield' },
    });
    expect(surfaceLabPreset('ambientcg-leather-037')).toMatchObject({
      materialRecord: { family: 'Animal material', source: { name: 'Material Archiv' } },
      source: { license: 'CC0 1.0', name: 'ambientCG' },
    });
  });

  it('maps the HoloCloth finish family to live cloth settings with MIT provenance', () => {
    expect(SURFACE_LAB_CLOTH_PRESETS.map(({ id }) => id)).toEqual([
      'cloth-holo',
      'cloth-chrome',
      'cloth-black',
    ]);
    for (const preset of SURFACE_LAB_CLOTH_PRESETS) {
      expect(preset).toMatchObject({
        mode: 'cloth',
        settings: { surfaceMaterial: 'holo-cloth' },
        source: { license: 'MIT', name: 'HoloCloth' },
      });
    }
  });

  it('exposes every production sticker finish without losing its settings', () => {
    expect(SURFACE_LAB_STICKER_PRESETS.map(({ stickerFinishId }) => stickerFinishId)).toEqual(
      STICKER_FINISH_PRESETS.map(({ id }) => id)
    );
    expect(SURFACE_LAB_STICKER_PRESETS.map(({ stickerFinish }) => stickerFinish)).toEqual(
      STICKER_FINISH_PRESETS.map(({ settings }) => settings)
    );
  });

  it('only references supported physical material identifiers', () => {
    for (const preset of [...SURFACE_LAB_SHEET_PRESETS, ...SURFACE_LAB_CLOTH_PRESETS]) {
      if (preset.settings?.surfaceMaterial) {
        expect(SURFACE_MATERIAL_IDS).toContain(preset.settings.surfaceMaterial);
      }
    }
  });
});
