import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getAllShaders } from 'shaders/registry';
import { SHADER_EFFECT_COMPONENTS, SHADER_EFFECTS, getShaderEffect, loadedShaderEffectsProps, loadShaderEffectsProps, shaderEffectInputsChanged, type ShaderEffectRenderInputs } from '../shaderEffects';
import { getShaderEffectControls, resolveShaderEffectProps, shaderEffectDefaults, shaderEffectRenderProps, validateShaderEffectProps, visibleShaderEffectControls } from '../shaderEffectsProps';
import { getLiveMaterial, DEFAULT_LIVE_MATERIAL_SETTINGS } from '../liveMaterials';
import { shaderLabSettingsFor } from '../shaderLab';
import { getShaderMotionCapabilities } from '../shaderMotionCapabilities';

const PALETTE = { colorA: '#101010', colorB: '#3355FF', colorC: '#F0F0F0' };

describe('Shaders.com native library', () => {
  it('accounts for every component in the installed upstream registry', () => {
    expect(SHADER_EFFECT_COMPONENTS.map((effect) => effect.component).sort()).toEqual(getAllShaders().map((effect) => effect.name).sort());
    expect(new Set(SHADER_EFFECT_COMPONENTS.map((effect) => effect.id)).size).toBe(SHADER_EFFECT_COMPONENTS.length);
    expect(SHADER_EFFECT_COMPONENTS.filter((effect) => effect.infrastructure).every((effect) => !!effect.infrastructure)).toBe(true);
  });
  it('keeps control metadata out of the index that the library and landing page import', async () => {
    expect(SHADER_EFFECT_COMPONENTS.every((effect) => !('props' in effect))).toBe(true);
    SHADER_EFFECTS.forEach((effect) => expect(getShaderEffectControls(effect.id), effect.id).toBeDefined());
    const loaded = await loadShaderEffectsProps();
    expect(loaded.getShaderEffectControls).toBe(getShaderEffectControls);
    expect(loadedShaderEffectsProps()).toBe(loaded);
  });
  it.each(SHADER_EFFECTS)('$component preserves validated native defaults in the shared catalog', (effect) => {
    expect(getLiveMaterial(effect.id).id).toBe(effect.id);
    const defaults = shaderEffectDefaults(effect.id);
    expect(validateShaderEffectProps(effect.id, JSON.parse(JSON.stringify(defaults)))).toEqual(defaults);
    expect(shaderLabSettingsFor(effect.id, DEFAULT_LIVE_MATERIAL_SETTINGS).effectProps).toEqual({});
    expect(getShaderMotionCapabilities(effect.id).supportsEditableSeek).toBe(!effect.stateful);
  });
  it('rejects unknown props, invalid enums, remote assets and non-finite values', () => {
    const id = 'shader-effects-aurora';
    expect(() => validateShaderEffectProps(id, { mystery: 42 })).toThrow();
    expect(() => validateShaderEffectProps(id, JSON.parse('{"__proto__":{"polluted":true}}'))).toThrow();
    expect(() => validateShaderEffectProps(id, { constructor: 'bad' })).toThrow();
    expect(() => validateShaderEffectProps(id, { intensity: Infinity })).toThrow();
    expect(() => validateShaderEffectProps(id, { colorSpace: 'bad' })).toThrow();
    expect(() => validateShaderEffectProps('shader-effects-blur', { sourceImage: 'https://example.com/image.png' })).toThrow();
    expect(() => validateShaderEffectProps(id, { center: { x: 1 } })).toThrow();
  });
  it('accepts a local source image once and rechecks a different one', () => {
    const image = `data:image/png;base64,${'A'.repeat(4096)}`;
    expect(validateShaderEffectProps('shader-effects-blur', { sourceImage: image })).toEqual({ sourceImage: image });
    expect(validateShaderEffectProps('shader-effects-blur', { sourceImage: image, intensity: 20 })).toEqual({ sourceImage: image, intensity: 20 });
    expect(() => validateShaderEffectProps('shader-effects-blur', { sourceImage: `${image}!` })).toThrow();
  });
  it('resets native props when changing materials without altering upstream defaults', () => {
    const first = shaderEffectDefaults('shader-effects-aurora');
    (first.center as Record<string, unknown>).x = 900;
    expect(getShaderEffectControls('shader-effects-aurora')!.center.default).toEqual({ x: 0.5, y: 0 });
    const changed = shaderLabSettingsFor('shader-effects-blur', { ...DEFAULT_LIVE_MATERIAL_SETTINGS, effectProps: first });
    expect(changed.effectProps).toEqual({});
  });
  it.each([0.25, 1, 4])('fits material surfaces to an aspect ratio of %s without rewriting saved shapes', (aspect) => {
    const input = shaderEffectDefaults('shader-effects-liquid-metal');
    const before = JSON.stringify(input);
    const props = shaderEffectRenderProps('shader-effects-liquid-metal', { ...PALETTE, effectProps: input }, aspect);
    const shape = JSON.parse(String(props.shape));
    expect(shape.type).toBe('roundedRectSDF');
    expect(shape.width).toBeGreaterThan(aspect / 2);
    expect(shape.height).toBeGreaterThan(0.5);
    expect(JSON.stringify(input)).toBe(before);
    expect(shaderEffectRenderProps('shader-effects-liquid-metal', { ...PALETTE, effectProps: { ...input, surface: 'shape' } }, aspect).shape).toBe(input.shape);
  });
  it.each([0.25, 1, 4])('frames edge-lit materials as one inset panel at aspect %s', (aspect) => {
    const props = shaderEffectRenderProps('shader-effects-neon', { ...PALETTE, effectProps: {} }, aspect);
    const shape = JSON.parse(String(props.shape));
    expect(props.rotation).toBe(0);
    expect(shape.width).toBeLessThan(aspect / 2);
    expect(shape.height).toBeLessThan(0.5);
    // Equal margins on both axes, scaled to the shorter side.
    expect(aspect / 2 - shape.width).toBeCloseTo(0.5 - shape.height);
    expect(0.5 - shape.height).toBeCloseTo(0.16 * Math.min(aspect / 2, 0.5));
    expect(shape.rounding).toBeGreaterThan(0);
  });
  it('upgrades previously saved demo surfaces while preserving an explicit shape choice', () => {
    const props = { shape: '{"type":"sphere3D","radius":0.35}' };
    expect(shaderEffectRenderProps('shader-effects-chrome', { ...PALETTE, effectProps: props }).shapeType).toBe('roundedRectSDF');
    expect(shaderEffectRenderProps('shader-effects-chrome', { ...PALETTE, effectProps: { ...props, surface: 'shape' } }).shape).toBe(props.shape);
    expect(shaderEffectRenderProps('shader-effects-circle', { ...PALETTE, effectProps: {} })).toEqual({ ...shaderEffectDefaults('shader-effects-circle'), color: '#3355FF', strokeColor: '#F0F0F0' });
    expect(getShaderEffect('shader-effects-circle')?.category).toBe('Shapes');
    expect(() => validateShaderEffectProps('shader-effects-chrome', { surface: 'invalid' })).toThrow();
  });
  it('seeds native colours from the shared palette until a colour is edited', () => {
    expect(resolveShaderEffectProps('shader-effects-liquid-metal', { ...PALETTE, effectProps: {} })).toMatchObject({ lightColor: '#F0F0F0', darkColor: '#101010' });
    expect(resolveShaderEffectProps('shader-effects-liquid-metal', { ...PALETTE, effectProps: { darkColor: '#222222' } })).toMatchObject({ lightColor: '#F0F0F0', darkColor: '#222222' });
    expect(resolveShaderEffectProps('shader-effects-aurora', { ...PALETTE, effectProps: {} })).toMatchObject({ colorA: '#3355FF', colorB: '#F0F0F0', colorC: '#101010' });
    expect(resolveShaderEffectProps('shader-effects-mesh-gradient', { ...PALETTE, effectProps: {} }).stops).toEqual([
      { color: '#101010', position: 0 }, { color: '#3355FF', position: 0.5 }, { color: '#F0F0F0', position: 1 },
    ]);
    // A fade to clear keeps its transparency; an explicit null gradient falls back to Color A/B.
    expect(resolveShaderEffectProps('shader-effects-falling-lines', { ...PALETTE, effectProps: {} }).colorB).toBe('#3355FF00');
    expect(resolveShaderEffectProps('shader-effects-mesh-gradient', { ...PALETTE, effectProps: { stops: null } }).stops).toBeNull();
    expect(resolveShaderEffectProps('shader-effects-gradient-map', { ...PALETTE, effectProps: {} })).toMatchObject({ palette: 'custom', colorLow: '#101010', colorMid: '#3355FF', colorHigh: '#F0F0F0' });
    expect(resolveShaderEffectProps('shader-effects-irradiance', { ...PALETTE, effectProps: {} }).lights).toEqual([
      expect.objectContaining({ color: '#3355FF' }), expect.objectContaining({ color: '#F0F0F0' }),
    ]);
    expect(shaderEffectRenderProps('shader-effects-aurora', { ...PALETTE, colorB: 'not a colour', effectProps: {} }).colorA).toBe(shaderEffectDefaults('shader-effects-aurora').colorA);
    const unseeded = SHADER_EFFECTS.flatMap(({ id }) => Object.entries(getShaderEffectControls(id)!)
      .filter(([, control]) => [control.type].flat().includes('color') && !control.palette).map(([name]) => `${id}.${name}`));
    expect(unseeded).toEqual(['shader-effects-halftone.cyanColor', 'shader-effects-halftone.magentaColor', 'shader-effects-halftone.yellowColor']);
  });
  it('has one Speed control: native speed multipliers are hidden and keep moving', () => {
    const withSpeed = SHADER_EFFECTS.filter(({ id }) => getShaderEffectControls(id)!.speed);
    expect(withSpeed.length).toBeGreaterThan(50);
    withSpeed.forEach(({ id }) => {
      expect(getShaderEffectControls(id)!.speed).toMatchObject({ hidden: true });
      expect(getShaderEffectControls(id)!.speed.default).not.toBe(0);
      expect(visibleShaderEffectControls(id, resolveShaderEffectProps(id, { ...PALETTE, effectProps: {} })).map(([name]) => name)).not.toContain('speed');
    });
  });
  it('shows only the controls whose upstream conditions hold', () => {
    const names = (id: string, effectProps = {}) => visibleShaderEffectControls(id, resolveShaderEffectProps(id, { ...PALETTE, effectProps })).map(([name]) => name);
    expect(names('shader-effects-halftone')).not.toContain('cyanColor');
    expect(names('shader-effects-halftone', { style: 'cmyk' })).toContain('cyanColor');
    expect(names('shader-effects-gradient-map')).toContain('colorLow');
    expect(names('shader-effects-gradient-map', { palette: 'rainbow' })).not.toContain('colorLow');
    expect(names('shader-effects-watercolor')).not.toContain('radius');
  });
  it('gives adjustments that are neutral upstream a visible default', () => {
    expect(shaderEffectDefaults('shader-effects-exposure')).toMatchObject({ exposure: 1.7 });
    expect(shaderEffectDefaults('shader-effects-saturation')).toMatchObject({ intensity: 1.8 });
    expect(shaderEffectDefaults('shader-effects-vibrance')).toMatchObject({ intensity: 1.2 });
    expect(shaderEffectDefaults('shader-effects-hue-shift')).toMatchObject({ shift: 120 });
    expect(shaderEffectDefaults('shader-effects-sharpness')).toMatchObject({ sharpness: 2.5 });
    expect(shaderEffectDefaults('shader-effects-flip')).toMatchObject({ flipX: true });
    expect(shaderEffectDefaults('shader-effects-brightness-contrast')).toMatchObject({ contrast: 0.45 });
    expect(shaderEffectDefaults('shader-effects-perspective')).toMatchObject({ pan: 24, tilt: 16 });
    expect(shaderEffectDefaults('shader-effects-corner-pin').topLeft).not.toEqual({ x: 0, y: 0 });
    expect(shaderEffectDefaults('shader-effects-dither').colorA).toBe('#000000');
  });
  it('ships a luminance-only filter sample so the palette decides its colours', () => {
    const svg = readFileSync(resolve(process.cwd(), 'public/shader-effects-source.svg'), 'utf8');
    const colors = [...svg.matchAll(/#([\da-f]{6})\b/gi)].map(([, hex]) => hex.toLowerCase());
    expect(colors.length).toBeGreaterThan(5);
    colors.forEach((hex) => expect(hex.slice(0, 2) === hex.slice(2, 4) && hex.slice(2, 4) === hex.slice(4, 6), hex).toBe(true));
  });
  it('redraws a surface only when a render input changes by value', () => {
    const inputs: ShaderEffectRenderInputs = { active: true, paused: false, captureTimeMs: null, frameRate: 30, patternScale: 1, settings: { ...DEFAULT_LIVE_MATERIAL_SETTINGS, effectProps: { intensity: 20, center: { x: 0.5, y: 0.5 } } } };
    // A host render rebuilds settings and effectProps objects without changing them.
    expect(shaderEffectInputsChanged(inputs, { ...inputs, settings: { ...inputs.settings, effectProps: { ...inputs.settings.effectProps } } })).toBe(false);
    expect(shaderEffectInputsChanged({ ...inputs, settings: { ...inputs.settings, effectProps: undefined } }, { ...inputs, settings: { ...inputs.settings, effectProps: {} } })).toBe(false);
    expect(shaderEffectInputsChanged(inputs, { ...inputs, settings: { ...inputs.settings, effectProps: { intensity: 21, center: { x: 0.5, y: 0.5 } } } })).toBe(true);
    expect(shaderEffectInputsChanged(inputs, { ...inputs, settings: { ...inputs.settings, colorB: '#000000' } })).toBe(true);
    expect(shaderEffectInputsChanged(inputs, { ...inputs, captureTimeMs: 1600 })).toBe(true);
    expect(shaderEffectInputsChanged(inputs, { ...inputs, patternScale: 2 })).toBe(true);
  });
});
