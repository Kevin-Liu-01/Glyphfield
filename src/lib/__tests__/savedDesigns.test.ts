import { describe, expect, it } from 'vitest';

import {
  createSavedDesign,
  savedDesignRecordKey,
  uniqueDesignName,
  updateSavedDesign,
  type SavedDesign,
} from '@/lib/savedDesigns';

const saved: SavedDesign = {
  createdAt: '2026-08-17T12:00:00.000Z',
  id: 'design-1',
  name: 'Launch frame',
  origin: 'saved',
  source: '{"frame":1}',
  updatedAt: '2026-08-17T12:00:00.000Z',
};

describe('saved designs', () => {
  it('creates unique readable names without overwriting an existing design', () => {
    expect(uniqueDesignName([saved], 'Launch frame')).toBe('Launch frame 2');
    expect(uniqueDesignName([saved, { ...saved, id: 'design-2', name: 'Launch frame 2' }], 'Launch frame')).toBe('Launch frame 3');
  });

  it('records fork lineage while preserving the source recipe', () => {
    expect(createSavedDesign({
      designs: [saved],
      id: 'design-2',
      name: 'Launch frame · Fork',
      now: '2026-08-17T12:05:00.000Z',
      origin: 'fork',
      parentId: saved.id,
      revision: 'revision-2',
      source: saved.source,
    })).toMatchObject({
      id: 'design-2',
      name: 'Launch frame · Fork',
      origin: 'fork',
      parentId: saved.id,
      revision: 'revision-2',
      source: saved.source,
    });
  });

  it('updates only the active saved design', () => {
    const second = { ...saved, id: 'design-2', name: 'Second' };
    const updated = updateSavedDesign([saved, second], saved.id, {
      revision: 'revision-2',
      source: '{"frame":2}',
      updatedAt: '2026-08-17T12:10:00.000Z',
    });
    expect(updated[0]?.source).toBe('{"frame":2}');
    expect(updated[0]?.revision).toBe('revision-2');
    expect(updated[1]).toEqual(second);
  });

  it('names IndexedDB records by workspace and design without collisions', () => {
    expect(savedDesignRecordKey('glyphfield-saved-designs-v1:gt:shader-lab', 'design-1'))
      .toBe('glyphfield-saved-designs-v1:gt:shader-lab:design-1');
  });
});
