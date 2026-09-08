import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { defaultCompositionEffectSettings } from '../compositionEffects';
import { assertCompositionEffectCaptureReady, resolveCompositionEffectPreview } from '../compositionEffectPreview';

const layer = { id: 'effect-one', opacity: 0.8, settings: defaultCompositionEffectSettings('bayer') };
const visibleIds = new Set([layer.id]);

describe('converter capture preview isolation', () => {
  it('allows absent and no-op preview leftovers without clearing them', () => {
    expect(() => assertCompositionEffectCaptureReady([layer], visibleIds, new Map())).not.toThrow();
    const preview = { opacity: layer.opacity, settings: { ...layer.settings } };
    const previews = new Map([[layer.id, preview]]);
    expect(() => assertCompositionEffectCaptureReady([layer], visibleIds, previews)).not.toThrow();
    expect(previews.get(layer.id)).toBe(preview);
  });

  it('rejects actual uncommitted opacity and each settings difference', () => {
    const previews = [
      { opacity: 0 },
      { settings: { cellSize: 28 } },
      { settings: { foreground: '#123456' } },
      { settings: { invert: true } },
    ];
    for (const preview of previews) {
      expect(() => assertCompositionEffectCaptureReady([layer], visibleIds, new Map([[layer.id, preview]])))
        .toThrow('Finish editing the converter control');
    }
  });

  it('does not block on a hidden or removed converter', () => {
    const previews = new Map([[layer.id, { opacity: 0 }], ['removed', { opacity: 0 }]]);
    expect(() => assertCompositionEffectCaptureReady([layer], new Set(), previews)).not.toThrow();
    expect(() => assertCompositionEffectCaptureReady([], visibleIds, previews)).not.toThrow();
  });

  it('uses previews only for live rendering and immutable committed values for capture', () => {
    const preview = { opacity: 0.1, settings: { cellSize: 28, invert: true } };
    const live = resolveCompositionEffectPreview(layer, preview);
    expect(live).toEqual({ opacity: 0.1, settings: { ...layer.settings, ...preview.settings } });
    expect(resolveCompositionEffectPreview(layer, preview, true)).toBe(layer);
    preview.settings.cellSize = 14;
    expect(resolveCompositionEffectPreview(layer, preview, true).settings.cellSize).toBe(layer.settings.cellSize);
    expect(layer.opacity).toBe(0.8);
  });

  it('wires the guard before freezing and ignores converter preview writes during capture', () => {
    const source = readFileSync(new URL('../../components/ShaderLabStudio.tsx', import.meta.url), 'utf8');
    const capture = source.slice(source.indexOf('  async function captureCompositionFrame('), source.indexOf('  async function prepareCompositionSource('));
    expect(capture.indexOf('assertCompositionEffectCaptureReady(')).toBeGreaterThan(0);
    expect(capture.indexOf('assertCompositionEffectCaptureReady(')).toBeLessThan(capture.indexOf('beginShaderFrameCapture('));
    const preview = source.slice(source.indexOf('  function previewEffectLayer('), source.indexOf('  function selectEffectPreset('));
    expect(preview.indexOf('if (frameCapturePendingRef.current) return;')).toBeGreaterThan(0);
    expect(preview.indexOf('if (frameCapturePendingRef.current) return;')).toBeLessThan(preview.indexOf('effectPreviewOverridesRef.current.set('));
    const paint = source.slice(source.indexOf('  function paintCompositionEffect('), source.indexOf('  function paintCompositionImage('));
    expect(paint).toContain('resolveCompositionEffectPreview(');
    expect(paint).toContain('Boolean(effectCaptureShaderImagesRef.current)');
  });
});
