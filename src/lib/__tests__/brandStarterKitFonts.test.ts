import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STARTER_KIT_FONTS, STARTER_PAIRINGS } from '../brandStarterKit';

describe('bundled fonts', () => {
  it('ships a file for every kit font', () => {
    for (const font of STARTER_KIT_FONTS) expect(existsSync(`public${font.path}`), font.path).toBe(true);
  });

  it('gives every kit font its own id', () => {
    expect(new Set(STARTER_KIT_FONTS.map((font) => font.id)).size).toBe(STARTER_KIT_FONTS.length);
  });

  it('sets every pairing role in one of the pairing\'s own fonts', () => {
    for (const pairing of STARTER_PAIRINGS) {
      for (const role of pairing.typography) {
        const font = pairing.fonts.find((candidate) => candidate.id === role.fontId);
        expect(font?.family, `${pairing.id} ${role.role}`).toBe(role.family);
      }
    }
  });

  it('ships every Katagami member with its italic and the four CJK companions', () => {
    const families = STARTER_KIT_FONTS.filter((font) => font.family.startsWith('Katagami'));
    expect(families.map((font) => `${font.family} ${font.style}`)).toEqual([
      'Katagami Sans normal', 'Katagami Sans italic',
      'Katagami Round normal', 'Katagami Round italic',
      'Katagami Text normal', 'Katagami Text italic',
      'Katagami Serif normal', 'Katagami Serif italic',
      'Katagami Mono normal', 'Katagami Mono italic',
      'Katagami CJK SC normal', 'Katagami CJK TC normal', 'Katagami CJK JP normal', 'Katagami CJK KR normal',
    ]);
  });
});
