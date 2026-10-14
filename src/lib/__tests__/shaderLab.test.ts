import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { DESIGN_LAB_IMAGE_EFFECTS } from '../designLabImageEffects';
import { DEFAULT_LIVE_MATERIAL_SETTINGS, DISCOVERABLE_LIVE_MATERIAL_OPTIONS } from '../liveMaterials';
import { SHADER_EFFECTS, getShaderEffect } from '../shaderEffects';
import {
  SHADER_LAB_KINDS,
  SHADER_LAB_LOADABLE_MATERIAL_IDS,
  SHADER_LIBRARY_MATERIAL_COUNT,
  isShaderLibraryMaterial,
  shaderLabKind,
  SHADER_LAB_CATEGORIES,
  SHADER_LAB_SOURCES,
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
  shaderPreviewCaptureSettings,
} from '../shaderLab';

describe('shader lab', () => {
  it('keeps every library shader discoverable while retaining a curated featured set', () => {
    expect(SHADER_LAB_FEATURED_IDS).toHaveLength(16);
    expect(SHADER_LAB_FEATURED_MATERIALS).toHaveLength(16);
    expect(shaderLabMaterials('', 'all')).toHaveLength(SHADER_LIBRARY_MATERIAL_COUNT);
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
    expect(shaderLabCategoryCount('all')).toBe(SHADER_LIBRARY_MATERIAL_COUNT);
    const groupedCount = SHADER_LAB_CATEGORIES
      .filter(({ id }) => id !== 'all')
      .reduce((total, { id }) => total + shaderLabCategoryCount(id), 0);
    expect(groupedCount).toBe(SHADER_LIBRARY_MATERIAL_COUNT);

    DISCOVERABLE_LIVE_MATERIAL_OPTIONS.forEach(({ id }) => {
      const path = resolve(process.cwd(), 'public', shaderPreviewAssetPath(id).slice(1));
      expect(existsSync(path), `missing preview for ${id}`).toBe(true);
      expect(statSync(path).size, `empty preview for ${id}`).toBeGreaterThan(100);
    });
  });

  it('filters the native Shaders.com collection apart from the original studies', () => {
    // Image effects run on Design Lab Effect layers, so the library lists the rest.
    const libraryEffects = SHADER_EFFECTS.filter(({ requiresChild }) => !requiresChild);
    const native = shaderLabMaterials('', 'all', 'Shaders.com WebGPU');
    expect(native).toHaveLength(libraryEffects.length);
    expect(native.every(({ id }) => id.startsWith('shader-effects-'))).toBe(true);
    expect(shaderLabMaterials('', 'all', 'Shaders.com study').every(({ id }) => id.startsWith('shaders-'))).toBe(true);
    expect(SHADER_LAB_SOURCES.map(({ id }) => id)).toEqual(expect.arrayContaining(['all', 'Shaders.com WebGPU', 'Shaders.com study']));
    const grouped = SHADER_LAB_CATEGORIES.filter(({ id }) => id !== 'all')
      .reduce((total, { id }) => total + shaderLabCategoryCount(id, 'Shaders.com WebGPU'), 0);
    expect(grouped).toBe(libraryEffects.length);
  });

  it('curates native effects: finished materials first, primitives and neutral adjustments last', () => {
    const order = shaderLabMaterials('', 'all', 'Shaders.com WebGPU').map(({ id }) => id);
    expect(order.slice(0, 4)).toEqual(['shader-effects-aurora', 'shader-effects-liquid-metal', 'shader-effects-chrome', 'shader-effects-holographic']);
    const rank = (name: string) => order.indexOf(`shader-effects-${name}`);
    expect(rank('godrays')).toBeGreaterThan(-1);
    expect(rank('godrays')).toBeLessThan(rank('circle'));
    // Image effects keep the same quality order in the Effect layer picker.
    const imageRank = (name: string) => DESIGN_LAB_IMAGE_EFFECTS.findIndex(({ id }) => id === `shader-effects-${name}`);
    expect(imageRank('blur')).toBeGreaterThan(-1);
    expect(imageRank('blur')).toBeLessThan(imageRank('linear-wipe'));
    expect(imageRank('linear-wipe')).toBeLessThan(imageRank('exposure'));
    expect(new Set(SHADER_EFFECTS.map(({ qualityScore }) => qualityScore)).size).toBe(SHADER_EFFECTS.length);
  });

  it('groups native effects by their upstream category', () => {
    const groupOf = (name: string) => shaderLabCategory({ engine: 'Shaders.com WebGPU', id: `shader-effects-${name}`, name });
    expect(groupOf('aurora')).toBe('light');
    expect(groupOf('liquid-metal')).toBe('metal');
    expect(groupOf('swirl')).toBe('fluid');
    expect(groupOf('mesh-gradient')).toBe('gradient');
    expect(groupOf('blur')).toBe('graphic');
    expect(groupOf('smoke')).toBe('fluid');
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

  it('uses restrained category-aware palettes for captured library previews', () => {
    expect(shaderPreviewCaptureSettings('paper-dithering-swirl')).toMatchObject({
      colorA: '#170B33',
      colorB: '#8B72FF',
      colorC: '#F3B5D8',
    });
    expect(shaderPreviewCaptureSettings('shaders-fluid-chrome')).toMatchObject({
      colorA: '#09090D',
      colorB: '#D8D4FF',
      colorC: '#765BFF',
    });
    expect(shaderPreviewCaptureSettings('holo-cloth-silk')).toMatchObject({
      grain: 10,
      strength: 0.08,
    });
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
  it('sorts every library material into one kind and filters by kind and multi-word search', () => {
    const kinds = new Set(SHADER_LAB_KINDS.map(({ id }) => id));
    const library = DISCOVERABLE_LIVE_MATERIAL_OPTIONS.filter(isShaderLibraryMaterial);
    library.forEach((material) => expect(kinds.has(shaderLabKind(material))).toBe(true));
    expect(shaderLabKind({ id: 'shader-effects-smoke-flow' })).toBe('interactive');
    expect(shaderLabKind({ id: 'shader-effects-circle' })).toBe('shapes');
    expect(shaderLabKind({ id: 'shader-effects-blur' })).toBe('image-effects');
    expect(shaderLabKind({ id: 'paper-gem-smoke' })).toBe('backgrounds');
    expect(shaderLabKind({ id: 'pavel-fluid-energy' })).toBe('interactive');
    const interactive = shaderLabMaterials('', 'all', 'all', 'interactive');
    expect(interactive.length).toBeGreaterThan(10);
    expect(interactive.every((material) => shaderLabKind(material) === 'interactive')).toBe(true);
    const total = SHADER_LAB_KINDS.filter(({ id }) => id !== 'all')
      .reduce((sum, { id }) => sum + shaderLabCategoryCount('all', 'all', id), 0);
    expect(total).toBe(library.length);
    expect(total).toBe(SHADER_LIBRARY_MATERIAL_COUNT);
    expect(shaderLabMaterials('liquid metal', 'all').some(({ name }) => /liquid metal/i.test(name))).toBe(true);
  });

  it('leaves image effects out of the libraries but keeps documents that use them loadable', () => {
    expect(SHADER_LAB_KINDS.some(({ id }) => id === 'image-effects')).toBe(false);
    const imageEffects = DISCOVERABLE_LIVE_MATERIAL_OPTIONS.filter((material) => !isShaderLibraryMaterial(material));
    expect(imageEffects.length).toBe(SHADER_EFFECTS.filter(({ requiresChild }) => requiresChild).length);
    expect(imageEffects.every(({ id }) => getShaderEffect(id)?.requiresChild)).toBe(true);
    expect(shaderLabMaterials('', 'all').some((material) => !isShaderLibraryMaterial(material))).toBe(false);
    expect(shaderLabMaterials('blur', 'all').some(({ id }) => id === 'shader-effects-blur')).toBe(false);
    expect(shaderLabCategoryCount('all')).toBe(DISCOVERABLE_LIVE_MATERIAL_OPTIONS.length - imageEffects.length);
    expect(SHADER_LAB_SOURCES.map(({ id }) => id)).toContain('Shaders.com WebGPU');
    expect(SHADER_LAB_LOADABLE_MATERIAL_IDS.has('shader-effects-blur')).toBe(true);
    expect(SHADER_LAB_LOADABLE_MATERIAL_IDS.size).toBe(DISCOVERABLE_LIVE_MATERIAL_OPTIONS.length);
  });
});
