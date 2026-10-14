import { describe, expect, it } from 'vitest';

import { GT_BRAND_IDENTITY } from '../brandIdentity';
import {
  colorToolSource,
  colorTokens,
  colorWorkingState,
  legacyOklchTokens,
  migrateLegacyColorDraft,
  parseColorToolSource,
  withColorWorkingState,
} from '../colorToolSource';
import { applyDemoAction, EMPTY_DEMO_STATE } from '../componentTemplates';
import { createLiveStore } from '../../hooks/useLiveStore';

const state = colorWorkingState(GT_BRAND_IDENTITY, { ink: 80 });

describe('Color tokens source', () => {
  it('writes version 2 with opacity, pairings and the colour system', () => {
    const source = colorToolSource({ ...state, colorSystem: { light: { primary: 'emphasis.300' } } });
    expect(source).toMatchObject({ version: 2 });
    expect((source.colors as { id: string; opacity: number }[])[0]).toMatchObject({ hex: '#070707', id: 'ink', opacity: 80, proportion: 26 });
    expect(source.colorPairings).toEqual(GT_BRAND_IDENTITY.colorPairings);
    expect(source.colorSystem).toEqual({ light: { primary: 'emphasis.300' } });
  });

  it('applies version 1 sources by index and keeps current pairings', () => {
    const next = parseColorToolSource(state, JSON.stringify({ colors: [{ hex: '#b85544' }, { hex: '#FFFFFF', name: 'Paper' }] }));
    expect(next.colors.map(({ hex, id }) => `${id}:${hex}`)).toEqual(['ink:#B85544', 'paper:#FFFFFF']);
    expect(next.opacity).toEqual({ ink: 80, paper: 100 });
    // Pairings that referenced removed colors are dropped.
    expect(next.colorPairings?.every(({ background, foreground }) => ['ink', 'paper'].includes(background) && ['ink', 'paper'].includes(foreground))).toBe(true);
  });

  it('validates ids, HEX, references and proportions', () => {
    expect(() => parseColorToolSource(state, { colors: [] })).toThrow('at least one');
    expect(() => parseColorToolSource(state, { colors: [{ hex: 'red', id: 'ink' }] })).toThrow('HEX');
    expect(() => parseColorToolSource(state, { colors: [{ hex: '#000000', id: 'Ink' }] })).toThrow('lowercase');
    expect(() => parseColorToolSource(state, { colors: [{ hex: '#000000', id: 'ink' }, { hex: '#FFFFFF', id: 'ink' }] })).toThrow('unique');
    expect(() => parseColorToolSource(state, { colorPairings: [{ background: 'nope', foreground: 'ink' }], colors: state.colors })).toThrow('colorPairings[0].background');
    expect(() => parseColorToolSource(state, { colorSystem: { light: { primary: 'ghost.300' } }, colors: state.colors })).toThrow('colorSystem.light.primary');
    expect(() => parseColorToolSource(state, { colorSystem: { light: { hero: 'ink' } }, colors: state.colors })).toThrow('not a semantic role');
    expect(() => parseColorToolSource(state, { colors: [{ hex: '#000000', id: 'ink', proportion: 140 }] })).toThrow('proportion');
    expect(parseColorToolSource(state, { colorSystem: null, colors: state.colors }).colorSystem).toBeUndefined();
  });

  it('returns the identity with the working palette', () => {
    const next = withColorWorkingState(GT_BRAND_IDENTITY, { colors: GT_BRAND_IDENTITY.colors.slice(0, 2), opacity: {} });
    expect(next.colors).toHaveLength(2);
    expect(next.colorPairings).toBeUndefined();
    expect(next.name).toBe(GT_BRAND_IDENTITY.name);
  });
});

describe('Color tokens output', () => {
  it('keeps the original OKLCH CSS as the default and adds brand token formats', () => {
    expect(legacyOklchTokens(state).split('\n')[0]).toBe('--color-ink: oklch(12.9% 0 0 / 80%); /* #070707 */');
    expect(colorTokens(GT_BRAND_IDENTITY, state)).toContain('oklch(');
    expect(colorTokens(GT_BRAND_IDENTITY, state, 'css')).toContain('--brand-color-ink-50:');
    expect(colorTokens(GT_BRAND_IDENTITY, state, 'css')).not.toContain('--brand-font-');
    expect(colorTokens(GT_BRAND_IDENTITY, state, 'tailwind')).toContain('--color-primary: var(--brand-primary);');
    expect(JSON.parse(colorTokens(GT_BRAND_IDENTITY, state, 'dtcg'))).toHaveProperty('semantic.dark.background');
  });
});

describe('version 1 color drafts', () => {
  it('surfaces edited drafts and ignores drafts equal to the identity', () => {
    const unchanged = GT_BRAND_IDENTITY.colors.map(({ hex, id, name, role }) => ({ hex, id, name, opacity: 100, role }));
    expect(migrateLegacyColorDraft(GT_BRAND_IDENTITY, unchanged)).toBeNull();
    expect(migrateLegacyColorDraft(GT_BRAND_IDENTITY, null)).toBeNull();
    const edited = unchanged.map((color, index) => (index === 0 ? { ...color, hex: '#222222' } : color));
    const migrated = migrateLegacyColorDraft(GT_BRAND_IDENTITY, edited);
    expect(migrated?.colors[0]).toMatchObject({ hex: '#222222', proportion: 26 });
    expect(migrateLegacyColorDraft(GT_BRAND_IDENTITY, unchanged.map((color, index) => (index === 1 ? { ...color, opacity: 40 } : color)))?.opacity.paper).toBe(40);
  });
});

describe('live interaction plumbing', () => {
  it('notifies subscribers only on real changes', () => {
    const written: number[] = [];
    const store = createLiveStore(1, (value) => written.push(value));
    let calls = 0;
    const unsubscribe = store.subscribe(() => { calls += 1; });
    store.set(1);
    store.set((value) => value + 1);
    unsubscribe();
    store.set(5);
    expect(calls).toBe(1);
    expect(written).toEqual([2, 5]);
  });

  it('applies demo actions to the shared demo state', () => {
    const selected = applyDemoAction(EMPTY_DEMO_STATE, 'select:tab:2');
    expect(selected.selected.tab).toBe(2);
    expect(applyDemoAction(selected, 'set:dialog:false').toggled.dialog).toBe(false);
    expect(applyDemoAction(selected, 'bogus')).toBe(selected);
  });
});
