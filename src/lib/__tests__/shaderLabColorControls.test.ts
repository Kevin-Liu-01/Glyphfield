import { describe, expect, it } from 'vitest';
import { readDesignLabSource } from './designLabSource';

const shaderLab = readDesignLabSource();

describe('Shader Lab color controls', () => {
  it('routes every editable color through the shared studio component', () => {
    expect(shaderLab).not.toContain("type='color'");
    expect(shaderLab).toContain("{ key: 'colorA', label: 'Base color' }");
    expect(shaderLab).toContain("{ key: 'colorB', label: 'Mid color' }");
    expect(shaderLab).toContain("{ key: 'colorC', label: 'Light color' }");
    expect(shaderLab).toContain("ariaLabel='Text outline color'");
    expect(shaderLab).toContain("ariaLabel='Text shadow color'");
    expect(shaderLab).toContain("ariaLabel='Mark color'");
  });
});
