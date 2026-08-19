import { describe, expect, it } from 'vitest';

import {
  buildShaderSequenceTimeline,
  normalizeShaderSequenceSettings,
  shaderSequenceDurationMs,
  shaderSequenceMaterialIds,
  shaderSequenceSegmentAt,
} from '../shaderSequence';

describe('shader sequence', () => {
  it('builds a unique ten-cut run that lands on the requested final material', () => {
    const materials = shaderSequenceMaterialIds('paper-gem-smoke', 10);
    expect(materials).toHaveLength(10);
    expect(new Set(materials)).toHaveLength(10);
    expect(materials.at(-1)).toBe('paper-gem-smoke');
  });

  it('accelerates every intro cut before a deterministic final hold', () => {
    const timeline = buildShaderSequenceTimeline(shaderSequenceMaterialIds('paper-gem-smoke', 10));
    const introDurations = timeline.slice(0, -1).map(({ durationMs }) => durationMs);
    introDurations.slice(1).forEach((duration, index) => {
      expect(duration).toBeLessThan(introDurations[index]!);
    });
    expect(timeline.at(-1)?.durationMs).toBe(5_000);
    expect(shaderSequenceDurationMs(timeline)).toBe(timeline.reduce((total, segment) => total + segment.durationMs, 0));
  });

  it('resolves exact cuts and clamps unsafe settings', () => {
    const settings = normalizeShaderSequenceSettings({ cutCount: 99, finalHoldMs: 12_000, pace: 'even' });
    expect(settings).toEqual({ cutCount: 12, finalHoldMs: 6_000, pace: 'even' });
    const timeline = buildShaderSequenceTimeline(shaderSequenceMaterialIds('paper-gem-smoke', 8), settings);
    expect(shaderSequenceSegmentAt(timeline, timeline[0]!.endMs)?.index).toBe(1);
    expect(shaderSequenceSegmentAt(timeline, Number.POSITIVE_INFINITY)?.materialId).toBe('paper-gem-smoke');
  });
});
