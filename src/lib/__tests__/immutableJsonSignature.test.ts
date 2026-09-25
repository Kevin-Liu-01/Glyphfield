import { describe, expect, it } from 'vitest';
import { immutableJsonSignature } from '../immutableJsonSignature';

describe('immutable editor signatures', () => {
  it('recognizes restored history even when object key order changes', () => {
    const before = { assets: [{ id: 'photo', url: 'data:image/png;base64,' + 'a'.repeat(100_000) }], x: 12, future: { opacity: 0.5 } };
    const restored = { future: { opacity: 0.5 }, x: 12, assets: structuredClone(before.assets) };
    expect(immutableJsonSignature(before)).toBe(immutableJsonSignature(restored));
    expect(immutableJsonSignature(before).length).toBeLessThan(50);
    expect(immutableJsonSignature({ ...restored, x: 13 })).not.toBe(immutableJsonSignature(before));
    expect(immutableJsonSignature({ ...restored, future: { opacity: 0.6 } })).not.toBe(immutableJsonSignature(before));
  });

  it('detects same-size image changes, layer order, and nested text edits', () => {
    const original = { layers: [{ text: 'First', image: 'a'.repeat(2000) }, { text: 'Second' }] };
    const signature = immutableJsonSignature(original);
    for (const layers of [
      [...original.layers].reverse(),
      [{ ...original.layers[0], text: 'Other' }, original.layers[1]],
      [{ ...original.layers[0], image: 'a'.repeat(1999) + 'b' }, original.layers[1]],
    ]) expect(immutableJsonSignature({ layers })).not.toBe(signature);
    expect(immutableJsonSignature(original)).toBe(signature);
  });

  it('does not revisit unchanged branches during a layer move', () => {
    let reads = 0;
    const inactiveArtboard = { get text() { reads += 1; return 'Unchanged'; } };
    immutableJsonSignature({ inactiveArtboard, transform: { x: 0 } });
    immutableJsonSignature({ inactiveArtboard, transform: { x: 20 } });
    expect(reads).toBe(1);
  });

  it('keeps signatures stable after the bounded image cache is evicted', () => {
    const image = 'a'.repeat(1_000_000);
    const signature = immutableJsonSignature(image);
    for (let i = 0; i < 5; i += 1) immutableJsonSignature(String(i).repeat(1_000_000));
    expect(immutableJsonSignature(image)).toBe(signature);
  });
});
