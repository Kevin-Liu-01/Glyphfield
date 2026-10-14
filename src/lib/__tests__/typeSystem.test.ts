import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { BUILT_IN_BRAND_IDENTITIES, createBrandIdentity, GT_BRAND_IDENTITY, type BrandIdentity } from '../brandIdentity';
import { fontAxis, parseFvar, readFontAxes } from '../fontAxes';
import {
  applyTypographySource,
  clampTypeScale,
  recommendedLetterSpacing,
  roleFonts,
  rolesOffTracking,
  roleTypeStep,
  trackingEm,
  typeScaleRatioName,
  typographyGuidance,
  typographySource,
  usedFontFiles,
  type TypographySpecimenSettings,
} from '../typeSystem';

const specimen: TypographySpecimenSettings = {
  align: 'left',
  measure: 64,
  previewSizes: { Accent: 32, Body: 24, Code: 18, Display: 40 },
  sampleText: 'Every language. One source.',
};

function fontBytes(path: string): ArrayBuffer {
  const buffer = readFileSync(join(process.cwd(), 'public', path));
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

/** A minimal fvar table with the given axes. */
function fvarTable(axes: { tag: string; min: number; default: number; max: number }[]): Uint8Array {
  const view = new DataView(new ArrayBuffer(16 + axes.length * 20));
  view.setUint16(0, 1);
  view.setUint16(4, 16);
  view.setUint16(8, axes.length);
  view.setUint16(10, 20);
  axes.forEach((axis, index) => {
    const offset = 16 + index * 20;
    [...axis.tag].forEach((character, position) => view.setUint8(offset + position, character.charCodeAt(0)));
    view.setInt32(offset + 4, axis.min * 65536);
    view.setInt32(offset + 8, axis.default * 65536);
    view.setInt32(offset + 12, axis.max * 65536);
  });
  return new Uint8Array(view.buffer);
}

describe('font axes', () => {
  it('reads wght and opsz from a TrueType variable font and nothing from a static one', async () => {
    const inter = await readFontAxes(fontBytes('fonts/brands/mintlify/inter-variable.ttf'));
    expect(fontAxis(inter, 'wght')).toMatchObject({ max: 900, min: 100 });
    expect(fontAxis(inter, 'opsz')).toMatchObject({ max: 32, min: 14 });
    expect(fontAxis(await readFontAxes(fontBytes('fonts/geist-mono-variable.ttf')), 'opsz')).toBeUndefined();
    expect(await readFontAxes(fontBytes('fonts/switzer-400.ttf'))).toEqual([]);
    expect(await readFontAxes(new ArrayBuffer(4))).toBeNull();
  });

  it('reads a zlib-compressed WOFF fvar table', async () => {
    const table = fvarTable([{ default: 0, max: 0, min: -10, tag: 'slnt' }]);
    const compressed = deflateSync(table);
    const view = new DataView(new ArrayBuffer(44 + 20 + compressed.byteLength));
    [...'wOFF'].forEach((character, index) => view.setUint8(index, character.charCodeAt(0)));
    view.setUint16(12, 1);
    [...'fvar'].forEach((character, index) => view.setUint8(44 + index, character.charCodeAt(0)));
    view.setUint32(48, 64);
    view.setUint32(52, compressed.byteLength);
    view.setUint32(56, table.byteLength);
    new Uint8Array(view.buffer).set(compressed, 64);
    expect(await readFontAxes(view.buffer)).toEqual([{ default: 0, max: 0, min: -10, tag: 'slnt' }]);
    expect(parseFvar(new DataView(fvarTable([]).buffer))).toEqual([]);
  });

  it('reports a WOFF2 variable font as axes or unreadable, never static', async () => {
    const sohne = await readFontAxes(fontBytes('fonts/brands/stripe/sohne-variable.woff2'));
    expect(sohne === null || sohne.some(({ tag }) => tag === 'wght')).toBe(true);
  });
});

describe('type scale', () => {
  it('names ratios, clamps values and drops default role steps', () => {
    expect(typeScaleRatioName(1.333)).toBe('Perfect fourth');
    expect(typeScaleRatioName(1.3)).toBeNull();
    expect(clampTypeScale({ basePx: 40, ratio: 1, roleSteps: { Body: 'body', Display: 'h1' } })).toEqual({ basePx: 24, ratio: 1.067, roleSteps: { Display: 'h1' } });
  });

  it('sets each role on its scale step', () => {
    expect(roleTypeStep(GT_BRAND_IDENTITY, 'Body')).toMatchObject({ name: 'body', px: 16 });
    const tuned = { ...GT_BRAND_IDENTITY, typeScale: { basePx: 18, ratio: 1.2, roleSteps: { Display: 'h2' } } };
    expect(roleTypeStep(tuned, 'Display').px).toBeCloseTo(18 * 1.2 ** 4, 1);
  });
});

describe('typography guidance', () => {
  it('flags loose display leading, positive display tracking, thin body text and long measures', () => {
    const base = createBrandIdentity('Acme', 'acme');
    const identity: BrandIdentity = {
      ...base,
      typography: base.typography.map((role) => (
        role.role === 'Display' ? { ...role, letterSpacing: 2, lineHeight: 1.4 }
          : role.role === 'Body' ? { ...role, weight: 250 } : role
      )),
    };
    const ids = typographyGuidance(identity, { measureCh: 96 }).map(({ id }) => id);
    expect(ids).toEqual(expect.arrayContaining(['Display-leading-loose', 'Display-tracking-positive', 'Body-weight-thin', 'measure-long']));
    expect(trackingEm(-2, 40)).toBe(-0.05);
  });

  it('recommends −0.02em for large display roles and 0 for text, and lists roles off the rule', () => {
    const base = createBrandIdentity('Acme', 'acme');
    const identity: BrandIdentity = {
      ...base,
      typography: base.typography.map((role) => (role.role === 'Display' ? { ...role, letterSpacing: 1 } : role.role === 'Body' ? { ...role, letterSpacing: 0.4 } : { ...role, letterSpacing: 0 })),
    };
    const displayPx = roleTypeStep(identity, 'Display').px;
    expect(recommendedLetterSpacing(identity, 'Display')).toBeCloseTo(-0.02 * displayPx, 1);
    expect(recommendedLetterSpacing(identity, 'Body')).toBe(0);
    expect(recommendedLetterSpacing(identity, 'Code')).toBe(0);
    expect(rolesOffTracking(identity)).toEqual(['Display', 'Body']);
  });

  it('keeps the built-in identities free of leading warnings for body text', () => {
    for (const identity of BUILT_IN_BRAND_IDENTITIES) {
      const ids = typographyGuidance(identity).map(({ id }) => id);
      expect(ids, identity.id).not.toContain('Body-leading-tight');
    }
  });
});

describe('fonts per role', () => {
  it('lists each role family and the unique files in use', () => {
    const fonts = roleFonts(GT_BRAND_IDENTITY);
    expect(fonts.map(({ role }) => role)).toEqual(['Display', 'Body', 'Accent', 'Code']);
    expect(fonts.every(({ asset }) => Boolean(asset))).toBe(true);
    const files = usedFontFiles(GT_BRAND_IDENTITY);
    expect(new Set(files.map(({ id }) => id)).size).toBe(files.length);
  });
});

describe('Typography source', () => {
  it('round-trips version 2 and still applies version 1 role arrays', () => {
    const source = typographySource(GT_BRAND_IDENTITY, specimen);
    expect(source).toMatchObject({ specimen, typeScale: { basePx: 16, ratio: 1.333 }, version: 2 });
    const legacy = applyTypographySource(GT_BRAND_IDENTITY, specimen, JSON.stringify({ typography: [{ letterSpacing: 0.04, role: 'Display' }] }));
    expect(legacy.identity.typography.find(({ role }) => role === 'Display')!.letterSpacing).toBe(0.04);
    expect(legacy.identity.typeScale).toEqual(GT_BRAND_IDENTITY.typeScale);
    expect(legacy.specimen).toBe(specimen);
  });

  it('applies scale, axes and specimen settings, and clears an axis with null', () => {
    const next = applyTypographySource(GT_BRAND_IDENTITY, specimen, {
      specimen: { align: 'center', measure: 200, sampleText: 'Hola' },
      typeScale: { basePx: 18, ratio: 1.25, roleSteps: { Display: 'h1' } },
      typography: [{ opticalSize: 32, role: 'Display', slant: 6 }],
      version: 2,
    });
    expect(next.identity.typeScale).toEqual({ basePx: 18, ratio: 1.25, roleSteps: { Display: 'h1' } });
    expect(next.identity.typography.find(({ role }) => role === 'Display')).toMatchObject({ opticalSize: 32, slant: 6 });
    expect(next.specimen).toMatchObject({ align: 'center', measure: 90, sampleText: 'Hola' });
    const cleared = applyTypographySource(next.identity, next.specimen, { typography: [{ opticalSize: null, role: 'Display' }] });
    expect(cleared.identity.typography.find(({ role }) => role === 'Display')!.opticalSize).toBeUndefined();
  });

  it('rejects invalid scales, steps and axis values with a field path', () => {
    expect(() => applyTypographySource(GT_BRAND_IDENTITY, specimen, { typography: 'nope' })).toThrow('typography must be an array');
    expect(() => applyTypographySource(GT_BRAND_IDENTITY, specimen, { typeScale: { ratio: 3 }, typography: [] })).toThrow('typeScale.ratio');
    expect(() => applyTypographySource(GT_BRAND_IDENTITY, specimen, { typeScale: { roleSteps: { Display: 'huge' } }, typography: [] })).toThrow('typeScale.roleSteps.Display');
    expect(() => applyTypographySource(GT_BRAND_IDENTITY, specimen, { typography: [{ opticalSize: 500, role: 'Body' }] })).toThrow('opticalSize');
  });
});
