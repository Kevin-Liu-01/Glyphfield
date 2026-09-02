import { describe, expect, it } from 'vitest';

import { serializeCanvasDocument } from '@/lib/canvasDocument';
import {
  parseLottieDocument,
  parseLottieWorkspaceSource,
  type LottieCanvasState,
} from '@/lib/lottieCanvasDocument';
import {
  DEFAULT_LIVE_MATERIAL_ID,
  DEFAULT_LIVE_MATERIAL_SETTINGS,
} from '@/lib/liveMaterials';
import { createStudioCanvasDocument } from '@/lib/studioCanvasDocument';

const fallback: LottieCanvasState = {
  appearance: {
    accentColor: '#533AFD',
    artColor: '#FFFFFF',
    cornerRadius: 8,
    secondaryColor: '#73BFC4',
    strokeWidth: 2,
  },
  background: {
    color: '#111216',
    materialId: DEFAULT_LIVE_MATERIAL_ID,
    materialSettings: DEFAULT_LIVE_MATERIAL_SETTINGS,
    style: 'solid',
    transparent: false,
  },
  canvasPreset: 'landscape',
  playback: {
    fit: 'contain',
    interpolate: true,
    loop: true,
    mode: 'forward',
    segmentEnd: 239,
    segmentStart: 0,
    speed: 1,
  },
  source: {
    category: 'Product',
    data: { fr: 60, layers: [] },
    description: 'Fallback animation',
    fileName: 'fallback.json',
    format: 'json',
    id: 'fallback',
    name: 'Fallback',
    provenance: 'Glyphfield example',
  },
};

function portableSource(
  state: LottieCanvasState,
  binarySource?: string
): string {
  return serializeCanvasDocument(createStudioCanvasDocument({
    background: state.background.color,
    brandId: 'gt',
    createdAt: '2026-09-01T00:00:00.000Z',
    height: 750,
    id: 'gt:lottie:test',
    layers: [{
      ...(binarySource ? {
        asset: { kind: 'binary' as const, name: 'motion.lottie', source: binarySource },
      } : {}),
      bounds: { height: 750, rotation: 0, width: 1200, x: 0, y: 0 },
      id: 'lottie-animation',
      kind: 'component',
      name: 'Animation',
    }],
    revision: 4,
    state,
    title: 'Lottie test',
    toolId: 'lottie',
    updatedAt: '2026-09-01T00:00:00.000Z',
    width: 1200,
  }));
}

describe('Lottie portable canvas source', () => {
  it('invariant_portable_json_restores_visual_playback_and_source_state_together', () => {
    const sourceState: LottieCanvasState = {
      ...fallback,
      appearance: { ...fallback.appearance, artColor: '#FF810A', cornerRadius: 24 },
      background: {
        ...fallback.background,
        materialSettings: { ...fallback.background.materialSettings, speed: 0.72 },
        style: 'shader',
      },
      canvasPreset: 'square',
      playback: { ...fallback.playback, segmentEnd: 170, segmentStart: 12, speed: 1.4 },
      source: {
        ...fallback.source,
        data: { fr: 30, layers: [{ nm: 'Hero' }] },
        id: 'portable-json',
        name: 'Portable JSON',
      },
    };

    const parsed = parseLottieWorkspaceSource(portableSource(sourceState), fallback);

    expect(parsed.legacy).toBe(false);
    expect(parsed.binarySource).toBeNull();
    expect(parsed.state).toEqual(sourceState);
  });

  it('invariant_binary_bundle_remains_embedded_in_the_shareable_document', () => {
    const binarySource = 'data:application/zip+dotlottie;base64,UEsDBAoAAAAA';
    const binaryState: LottieCanvasState = {
      ...fallback,
      source: {
        ...fallback.source,
        data: null,
        fileName: 'motion.lottie',
        format: 'dotlottie',
        id: 'portable-binary',
      },
    };

    const parsed = parseLottieWorkspaceSource(
      portableSource(binaryState, binarySource),
      fallback
    );

    expect(parsed.state.source.data).toBeNull();
    expect(parsed.binarySource).toBe(binarySource);
  });

  it('design_legacy_raw_lottie_json_is_upgraded_without_losing_animation_data', () => {
    const parsed = parseLottieWorkspaceSource(
      JSON.stringify({ fr: 24, layers: [{ nm: 'Legacy' }] }),
      fallback
    );

    expect(parsed.legacy).toBe(true);
    expect(parsed.state.source.format).toBe('json');
    expect(parsed.state.source.provenance).toBe('Local import');
    expect(parsed.state.source.data).toEqual({ fr: 24, layers: [{ nm: 'Legacy' }] });
  });

  it('invariant_binary_documents_without_embedded_bytes_are_rejected', () => {
    const binaryState: LottieCanvasState = {
      ...fallback,
      source: { ...fallback.source, data: null, format: 'dotlottie' },
    };

    expect(() => parseLottieWorkspaceSource(portableSource(binaryState), fallback))
      .toThrow('embedded .lottie bundle is missing');
  });

  it('rejects structurally invalid Lottie JSON and normalizes portable provenance', () => {
    expect(() => parseLottieDocument({ layers: [] })).toThrow('numeric frame rate');
    const sourceState: LottieCanvasState = {
      ...fallback,
      source: {
        ...fallback.source,
        provenance: 'Local import',
      },
    };

    const parsed = parseLottieWorkspaceSource(portableSource(sourceState), fallback);
    expect(parsed.state.source.provenance).toBe('Local import');
  });
});
