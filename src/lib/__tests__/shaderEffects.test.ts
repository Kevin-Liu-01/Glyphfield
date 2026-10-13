import { describe, expect, it } from 'vitest';
import { getAllShaders } from 'shaders/registry';
import { SHADER_EFFECT_COMPONENTS, SHADER_EFFECTS, getShaderEffect, shaderEffectDefaults, shaderEffectRenderProps, validateShaderEffectProps } from '../shaderEffects';
import { getLiveMaterial, DEFAULT_LIVE_MATERIAL_SETTINGS } from '../liveMaterials';
import { shaderLabSettingsFor } from '../shaderLab';
import { getShaderMotionCapabilities } from '../shaderMotionCapabilities';

describe('Shaders.com native library', () => {
  it('accounts for every component in the installed upstream registry', () => {
    expect(SHADER_EFFECT_COMPONENTS.map((effect) => effect.component).sort()).toEqual(getAllShaders().map((effect) => effect.name).sort());
    expect(new Set(SHADER_EFFECT_COMPONENTS.map((effect) => effect.id)).size).toBe(SHADER_EFFECT_COMPONENTS.length);
    expect(SHADER_EFFECT_COMPONENTS.filter((effect) => effect.infrastructure).every((effect) => !!effect.infrastructure)).toBe(true);
  });
  it.each(SHADER_EFFECTS)('$component preserves validated native defaults in the shared catalog', (effect) => {
    expect(getLiveMaterial(effect.id).id).toBe(effect.id);
    const defaults = shaderEffectDefaults(effect.id);
    expect(validateShaderEffectProps(effect.id, JSON.parse(JSON.stringify(defaults)))).toEqual(defaults);
    expect(shaderLabSettingsFor(effect.id, DEFAULT_LIVE_MATERIAL_SETTINGS).effectProps).toEqual(defaults);
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
  it('resets native props when changing materials without altering upstream defaults', () => {
    const first = shaderEffectDefaults('shader-effects-aurora');
    (first.center as Record<string, unknown>).x = 900;
    expect(getShaderEffect('shader-effects-aurora')!.props.center.default).toEqual({ x: 0.5, y: 0 });
    const changed = shaderLabSettingsFor('shader-effects-blur', { ...DEFAULT_LIVE_MATERIAL_SETTINGS, effectProps: first });
    expect(changed.effectProps).toEqual(shaderEffectDefaults('shader-effects-blur'));
  });
  it.each([0.25, 1, 4])('fits material surfaces to an aspect ratio of %s without rewriting saved shapes', (aspect) => {
    const input = shaderEffectDefaults('shader-effects-liquid-metal');
    const before = JSON.stringify(input);
    const props = shaderEffectRenderProps('shader-effects-liquid-metal', input, aspect);
    const shape = JSON.parse(String(props.shape));
    expect(shape.type).toBe('roundedRectSDF');
    expect(shape.width).toBeGreaterThan(aspect / 2);
    expect(shape.height).toBeGreaterThan(0.5);
    expect(JSON.stringify(input)).toBe(before);
    expect(shaderEffectRenderProps('shader-effects-liquid-metal', { ...input, surface: 'shape' }, aspect).shape).toBe(input.shape);
  });
  it('upgrades previously saved demo surfaces while preserving an explicit shape choice', () => {
    const props = { shape: '{"type":"sphere3D","radius":0.35}' };
    expect(shaderEffectRenderProps('shader-effects-chrome', props).shapeType).toBe('roundedRectSDF');
    expect(shaderEffectRenderProps('shader-effects-chrome', { ...props, surface: 'shape' }).shape).toBe(props.shape);
    expect(shaderEffectRenderProps('shader-effects-circle', {})).toEqual(shaderEffectDefaults('shader-effects-circle'));
    expect(() => validateShaderEffectProps('shader-effects-chrome', { surface: 'invalid' })).toThrow();
  });
});
