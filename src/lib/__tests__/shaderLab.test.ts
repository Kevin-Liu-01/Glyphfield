import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { DEFAULT_LIVE_MATERIAL_SETTINGS, DISCOVERABLE_LIVE_MATERIAL_OPTIONS } from '../liveMaterials';
import {
  SHADER_LAB_CATEGORIES,
  SHADER_LAB_FEATURED_IDS,
  SHADER_LAB_FEATURED_MATERIALS,
  SHADER_LIBRARY_DEFAULT_IDS,
  SHADER_LIBRARY_SCENES,
  shaderLabCategory,
  shaderLabCategoryCount,
  shaderLabMaterials,
  shaderLabSettingsFor,
  shaderMaterialPreviewStyle,
  shaderPreviewAssetPath,
} from '../shaderLab';

describe('shader lab', () => {
  it('keeps every shader discoverable while retaining a curated featured set', () => {
    expect(SHADER_LAB_FEATURED_IDS).toHaveLength(16);
    expect(SHADER_LAB_FEATURED_MATERIALS).toHaveLength(16);
    expect(shaderLabMaterials('', 'all')).toHaveLength(DISCOVERABLE_LIVE_MATERIAL_OPTIONS.length);
    expect(shaderLabMaterials('', 'all').slice(0, 8).map(({ id }) => id)).toEqual([
      'paper-gem-smoke',
      'shaders-fluid-chrome',
      'study-line-field',
      'paper-liquid-metal',
      'study-chrome-glares',
      'paper-god-rays',
      'paper-warp',
      'shadergradient-prismatic-sphere',
    ]);
    const orderedIds = shaderLabMaterials('', 'all').map(({ id }) => id);
    expect(orderedIds.indexOf('glyphfield-glyph-field')).toBe(orderedIds.indexOf('shadergradient-prismatic-sphere') + 1);
    const demotedIds = [
      'shaders-spectral-bloom',
      'study-radiant-void',
      'study-galactic-rings',
      'pavel-fluid-energy',
      'holo-cloth-silk',
    ] as const;
    demotedIds.forEach((id) => expect(orderedIds.indexOf(id)).toBeGreaterThanOrEqual(11));
    expect(shaderLabMaterials('', 'light').map(({ id }) => id)).toContain('holo-cloth-silk');
    expect(shaderLabMaterials('liquid', 'all').length).toBeGreaterThan(2);
  });

  it('keeps category counts complete and gives every shader an authentic captured preview', () => {
    expect(shaderLabCategoryCount('all')).toBe(DISCOVERABLE_LIVE_MATERIAL_OPTIONS.length);
    const groupedCount = SHADER_LAB_CATEGORIES
      .filter(({ id }) => id !== 'all')
      .reduce((total, { id }) => total + shaderLabCategoryCount(id), 0);
    expect(groupedCount).toBe(DISCOVERABLE_LIVE_MATERIAL_OPTIONS.length);

    DISCOVERABLE_LIVE_MATERIAL_OPTIONS.forEach(({ id }) => {
      const path = resolve(process.cwd(), 'public', shaderPreviewAssetPath(id).slice(1));
      expect(existsSync(path), `missing preview for ${id}`).toBe(true);
      expect(statSync(path).size, `empty preview for ${id}`).toBeGreaterThan(100);
    });
  });

  it('groups materials by their visual behavior', () => {
    expect(shaderLabCategory({ engine: 'Holo material', id: 'holo-cloth-silk', name: 'Holo Cloth' })).toBe('light');
    expect(shaderLabCategory({ engine: 'WebGL Fluid', id: 'pavel-fluid-energy', name: 'Fluid Energy' })).toBe('fluid');
    expect(shaderLabCategory({ engine: 'Shaders.com study', id: 'shaders-fluid-chrome', name: 'Architectural Chrome' })).toBe('metal');
  });

  it('provides tuned Holo Cloth defaults and a deterministic no-WebGL preview', () => {
    const settings = shaderLabSettingsFor('holo-cloth-silk', DEFAULT_LIVE_MATERIAL_SETTINGS);
    expect(settings).toMatchObject({ colorB: DEFAULT_LIVE_MATERIAL_SETTINGS.colorB, detail: 6.2, grain: 24, strength: 0.76 });
    const clothStyle = shaderMaterialPreviewStyle('holo-cloth-silk', settings);
    expect(String(clothStyle.backgroundImage)).toContain('repeating-linear-gradient');
  });

  it('owns the shared defaults and homepage scenes consumed by every shader surface', () => {
    const materialIds = new Set(DISCOVERABLE_LIVE_MATERIAL_OPTIONS.map(({ id }) => id));
    expect(SHADER_LIBRARY_DEFAULT_IDS.surface).toBe('paper-gem-smoke');
    Object.values(SHADER_LIBRARY_DEFAULT_IDS).forEach((id) => expect(materialIds.has(id)).toBe(true));
    Object.values(SHADER_LIBRARY_SCENES).forEach(({ materialId, settings }) => {
      expect(materialIds.has(materialId)).toBe(true);
      expect(settings).toMatchObject({ colorA: expect.stringMatching(/^#/), colorB: expect.stringMatching(/^#/) });
    });
  });
});
