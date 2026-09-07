import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(join(process.cwd(), 'scripts/check-interaction-performance.mjs'), 'utf8');
const beginProbe = source.match(/const beginProbe = `([\s\S]*?)`;/)?.[1];
const entryTypes = ['longtask', 'long-animation-frame', 'layout-shift', 'event'] as const;

type Entry = {
  duration: number;
  startTime: number;
  hadRecentInput?: boolean;
  name?: string;
  processingStart?: number;
  value?: number;
};
type Probe = {
  cls: number;
  events: { duration: number }[];
  excludedPreProbeEntries: { duration: number; relativeEndTime: number; type: string }[];
  loaf: { duration: number }[];
  longTaskDetails: { duration: number }[];
  longTasks: number[];
};

function createProbe() {
  if (!beginProbe) throw new Error('The benchmark beginProbe expression was not found.');
  const callbacks = new Map<string, (list: { getEntries: () => Entry[] }) => void>();
  const window = {} as { __glyphfieldPerformanceProbe: Probe };
  runInNewContext(beginProbe, {
    PerformanceObserver: class {
      constructor(private readonly callback: (list: { getEntries: () => Entry[] }) => void) {}
      observe({ type }: { type: string }) { callbacks.set(type, this.callback); }
      disconnect() {}
    },
    document: {
      addEventListener: vi.fn(),
      hasFocus: () => true,
      removeEventListener: vi.fn(),
      visibilityState: 'visible',
    },
    performance: { now: () => 1_000 },
    requestAnimationFrame: vi.fn(),
    window,
  });
  return {
    deliver(entries: Entry[]) {
      entryTypes.forEach((type) => callbacks.get(type)!({ getEntries: () => entries }));
    },
    probe: window.__glyphfieldPerformanceProbe,
  };
}

function entry(startTime: number, duration: number): Entry {
  return { duration, hadRecentInput: false, name: 'click', processingStart: startTime + 5, startTime, value: 0.125 };
}

describe('benchmark observer interval attribution', () => {
  it.each([
    { name: 'wholly before the probe despite late delivery', start: 899.8, duration: 82.7, included: false },
    { name: 'overlapping probe start', start: 899.8, duration: 110, included: true },
    { name: 'ending exactly at probe start', start: 900, duration: 100, included: true },
    { name: 'starting exactly at probe start', start: 1_000, duration: 82.7, included: true },
    { name: 'a point entry exactly at probe start', start: 1_000, duration: 0, included: true },
    { name: 'wholly inside the probe', start: 1_020, duration: 82.7, included: true },
  ])('handles $name without clipping durations', ({ start, duration, included }) => {
    const { deliver, probe } = createProbe();
    deliver([entry(start, duration)]);
    const durations = included ? [duration] : [];
    expect(probe.longTasks).toEqual(durations);
    expect(probe.longTaskDetails.map((item) => item.duration)).toEqual(durations);
    expect(probe.loaf.map((item) => item.duration)).toEqual(durations);
    expect(probe.events.map((item) => item.duration)).toEqual(durations);
    expect(probe.cls).toBe(included ? 0.125 : 0);
    expect(probe.excludedPreProbeEntries).toHaveLength(included ? 0 : 4);
    if (!included) {
      expect(probe.excludedPreProbeEntries.map((item) => item.type)).toEqual(entryTypes);
      expect(probe.excludedPreProbeEntries.every((item) => item.relativeEndTime < 0)).toBe(true);
    }
  });

  it('filters each interval independently within one delivered observer batch', () => {
    const { deliver, probe } = createProbe();
    deliver([entry(899.8, 82.7), entry(950, 120), entry(1_010, 75)]);
    expect(probe.longTasks).toEqual([120, 75]);
    expect(probe.loaf.map((item) => item.duration)).toEqual([120, 75]);
    expect(probe.events.map((item) => item.duration)).toEqual([120, 75]);
    expect(probe.cls).toBe(0.25);
    expect(probe.excludedPreProbeEntries).toHaveLength(4);
  });
});
