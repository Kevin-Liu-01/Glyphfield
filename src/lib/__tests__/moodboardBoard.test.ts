import { describe, expect, it } from 'vitest';

import { GT_BRAND_IDENTITY } from '../brandIdentity';
import { BUILT_IN_BRAND_IDENTITIES } from '../identityPresets';
import { MOODBOARD_COMPOSITIONS } from '../moodboard';
import {
  defaultMoodboardTiles,
  layoutMoodboardTiles,
  moodboardImageAssetIds,
  moodboardSourceBoards,
  parseMoodboardOverrides,
  resetMoodboardBoard,
  resetMoodboardTile,
  resolveMoodboardBoard,
  sanitizeMoodboardOverrides,
  updateMoodboardBoard,
  updateMoodboardTile,
} from '../moodboardBoard';

describe('moodboard tiles', () => {
  it.each(MOODBOARD_COMPOSITIONS)('gives every %s tile a stable unique ID and real identity copy', (composition) => {
    const tiles = defaultMoodboardTiles(GT_BRAND_IDENTITY, composition);
    expect(new Set(tiles.map(({ id }) => id)).size).toBe(tiles.length);
    for (const tile of tiles) {
      expect(tile.copy.headline.length + tile.copy.caption.length).toBeGreaterThan(0);
      expect(tile.copy.headline).not.toMatch(/lorem|ipsum|placeholder/i);
    }
  });

  it('uses a different recipe surface or palette role for each built-in identity', () => {
    const signatures = BUILT_IN_BRAND_IDENTITIES.map((identity) => JSON.stringify(defaultMoodboardTiles(identity, 'showcase').map((tile) => [tile.tone, tile.variant, tile.assetId])));
    expect(new Set(signatures).size).toBe(BUILT_IN_BRAND_IDENTITIES.length);
  });

  it('only offers original or source-native library images', () => {
    for (const identity of BUILT_IN_BRAND_IDENTITIES) {
      const ids = moodboardImageAssetIds(identity);
      expect(ids.length).toBeGreaterThan(0);
      expect(ids.every((id) => id.startsWith('library-'))).toBe(true);
    }
  });
});

describe('layoutMoodboardTiles', () => {
  const frame = { height: 800, width: 1520, x: 40, y: 60 };

  it('packs tiles into full-width 12-column rows that fill the frame exactly', () => {
    const placed = layoutMoodboardTiles(defaultMoodboardTiles(GT_BRAND_IDENTITY, 'showcase'), frame, 16);
    const rows = [...new Set(placed.map(({ rect }) => rect.y))];
    for (const y of rows) {
      const row = placed.filter(({ rect }) => rect.y === y);
      const right = Math.max(...row.map(({ rect }) => rect.x + rect.width));
      expect(Math.abs(right - (frame.x + frame.width))).toBeLessThanOrEqual(2);
    }
    const bottom = Math.max(...placed.map(({ rect }) => rect.y + rect.height));
    expect(bottom).toBe(frame.y + frame.height);
  });

  it('reflows the remaining tiles when tiles are hidden', () => {
    const tiles = defaultMoodboardTiles(GT_BRAND_IDENTITY, 'showcase').map((tile, index) => ({ ...tile, hidden: index % 2 === 1 }));
    const placed = layoutMoodboardTiles(tiles, frame, 16);
    expect(placed).toHaveLength(4);
    expect(Math.max(...placed.map(({ rect }) => rect.y + rect.height))).toBe(frame.y + frame.height);
  });
});

describe('moodboard source', () => {
  it('round-trips the resolved source without creating overrides', () => {
    const boards = moodboardSourceBoards(GT_BRAND_IDENTITY, {});
    expect(parseMoodboardOverrides(GT_BRAND_IDENTITY, boards, {})).toEqual({});
  });

  it('stores only edits that differ from the identity defaults', () => {
    const boards = moodboardSourceBoards(GT_BRAND_IDENTITY, {});
    const showcase = boards.showcase as { tiles: Array<Record<string, unknown>> };
    showcase.tiles[0] = { ...showcase.tiles[0], copy: { ...(showcase.tiles[0]!.copy as object), headline: 'New line' }, span: 12 };
    showcase.tiles.reverse();
    const overrides = parseMoodboardOverrides(GT_BRAND_IDENTITY, boards, {});
    expect(overrides.showcase?.tiles).toEqual({ cover: { copy: { headline: 'New line' }, span: 12 } });
    expect(overrides.showcase?.order?.at(-1)).toBe('cover');
    expect(overrides.system).toBeUndefined();
  });

  it('rejects unknown tiles, variants, sizes, surfaces, assets, and boards with field paths', () => {
    const tile = (patch: Record<string, unknown>) => ({ showcase: { tiles: [{ id: 'cover', ...patch }] } });
    expect(() => parseMoodboardOverrides(GT_BRAND_IDENTITY, tile({ id: 'nope' }), {})).toThrow(/tiles\.0\.id/);
    expect(() => parseMoodboardOverrides(GT_BRAND_IDENTITY, tile({ variant: 'wild' }), {})).toThrow(/variant/);
    expect(() => parseMoodboardOverrides(GT_BRAND_IDENTITY, tile({ span: 5 }), {})).toThrow(/span/);
    expect(() => parseMoodboardOverrides(GT_BRAND_IDENTITY, tile({ tone: 'neon' }), {})).toThrow(/tone/);
    expect(() => parseMoodboardOverrides(GT_BRAND_IDENTITY, tile({ assetId: 'https://remote.example/x.png' }), {})).toThrow(/assetId/);
    expect(() => parseMoodboardOverrides(GT_BRAND_IDENTITY, { poster: {} }, {})).toThrow(/unknown board/);
    expect(() => parseMoodboardOverrides(GT_BRAND_IDENTITY, tile({ copy: { headline: 'x'.repeat(601) } }), {})).toThrow(/at most/);
  });

  it('keeps settings of tiles omitted from a partial list', () => {
    const previous = updateMoodboardTile(GT_BRAND_IDENTITY, {}, 'showcase', 'voice', { hidden: true });
    const next = parseMoodboardOverrides(GT_BRAND_IDENTITY, { showcase: { tiles: [{ id: 'cover', variant: 'type' }] } }, previous);
    expect(next.showcase?.tiles).toEqual({ cover: { variant: 'type' }, voice: { hidden: true } });
  });

  it('updates, reorders, resets, and sanitizes persisted edits', () => {
    let overrides = updateMoodboardTile(GT_BRAND_IDENTITY, {}, 'system', 'logo', { tone: 'ink' });
    overrides = updateMoodboardBoard(GT_BRAND_IDENTITY, overrides, 'system', { surface: 'dark', title: 'Review' });
    const board = resolveMoodboardBoard(GT_BRAND_IDENTITY, 'system', overrides);
    expect(board.surface).toBe('dark');
    expect(board.title).toBe('Review');
    expect(board.tiles[0]!.tone).toBe('ink');
    expect(resetMoodboardTile(overrides, 'system', 'logo').system?.tiles).toBeUndefined();
    expect(resetMoodboardBoard(overrides, 'system').system).toBeUndefined();
    expect(sanitizeMoodboardOverrides(GT_BRAND_IDENTITY, { system: { tiles: { logo: { span: 7 } } }, wrong: 1 })).toEqual({});
    expect(sanitizeMoodboardOverrides(GT_BRAND_IDENTITY, overrides)).toEqual(overrides);
    expect(sanitizeMoodboardOverrides(GT_BRAND_IDENTITY, 'corrupt')).toEqual({});
  });
});
