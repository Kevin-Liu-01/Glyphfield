import { describe, expect, it } from 'vitest';

import { docsSidebarRailPath } from '@/lib/docsSidebarRail';

describe('documentation sidebar rail geometry', () => {
  it('connects a parent rail to an indented child with a centered 45-degree bend', () => {
    expect(docsSidebarRailPath([
      { bottom: 20, top: 0, x: 8.5 },
      { bottom: 54, top: 34, x: 20.5 },
    ], 0)).toBe('M8.5 0 L8.5 20 L8.5 21 L20.5 33 L20.5 34 L20.5 54');
  });

  it('returns from the child rail to the parent rail with the mirrored bend', () => {
    expect(docsSidebarRailPath([
      { bottom: 20, top: 0, x: 20.5 },
      { bottom: 54, top: 34, x: 8.5 },
    ], 0)).toBe('M20.5 0 L20.5 20 L20.5 21 L8.5 33 L8.5 34 L8.5 54');
  });

  it('keeps same-depth rows on one uninterrupted vertical rail', () => {
    expect(docsSidebarRailPath([
      { bottom: 20, top: 0, x: 8.5 },
      { bottom: 54, top: 34, x: 8.5 },
    ], 0)).toBe('M8.5 0 L8.5 20 L8.5 34 L8.5 54');
  });
});
