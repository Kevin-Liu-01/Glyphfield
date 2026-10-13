import { describe, expect, it } from 'vitest';

import { createBrandIdentity, hydrateBrandIdentities, type BrandIdentity } from '../brandIdentity';
import {
  adjustForContrast,
  applyBrandHealthFix,
  auditBrandHealth,
  brandContrastResults,
} from '../brandHealth';
import { colorContrastRatio } from '../color';

function findingIds(identity: BrandIdentity) {
  return auditBrandHealth(identity).findings.map(({ id }) => id);
}

describe('auditBrandHealth', () => {
  it('scores a scratch identity as incomplete with concrete findings and agent prompts', () => {
    const report = auditBrandHealth(createBrandIdentity('Untitled brand', 'scratch'));
    expect(report.score).toBeLessThan(50);
    expect(report.grade).toBe('Incomplete');
    expect(report.sections).toHaveLength(11);
    expect(findingIds(createBrandIdentity('Untitled brand', 'scratch'))).toEqual(expect.arrayContaining([
      'essentials-name', 'essentials-tagline', 'strategy-concept', 'voice-examples',
      'logo-mark-dark', 'logo-wordmark', 'color-default-palette', 'color-proportion', 'type-scale', 'graphic-device',
    ]));
    const placeholderLogo = report.findings.find(({ id }) => id === 'logo-mark-dark')!;
    expect(placeholderLogo).toMatchObject({ severity: 'warning', title: 'Replace the placeholder mark for light surfaces' });
    expect(placeholderLogo.agentPrompt).toContain("identity.asset.add { file, slot: 'mark-dark' }");
    expect(placeholderLogo.agentPrompt).toContain('Do not invent claims');
    expect(report.findings[0]!.severity).toBe('error');
  });

  it('checks declared contrast pairs against WCAG AA', () => {
    const identity: BrandIdentity = {
      ...createBrandIdentity('Acme', 'acme'),
      colorPairings: [
        { background: 'paper', foreground: 'ink', usage: 'Body text' },
        { background: 'paper', foreground: 'muted', level: 'AA-large', usage: 'Captions' },
      ],
    };
    const [body, caption] = brandContrastResults(identity);
    expect(body).toMatchObject({ level: 'AA', passes: true, required: 4.5 });
    expect(caption).toMatchObject({ level: 'AA-large', passes: false, required: 3 });
    const finding = auditBrandHealth(identity).findings.find(({ id }) => id === 'contrast-muted-paper')!;
    expect(finding).toMatchObject({ fix: { id: 'contrast:muted:paper' }, severity: 'error' });
  });

  it('derives default pairs when none are declared', () => {
    const pairs = brandContrastResults(createBrandIdentity('Acme', 'acme'));
    expect(pairs.map(({ foreground, background }) => `${foreground}/${background}`)).toEqual(['ink/paper', 'ink/muted', 'ink/emphasis']);
  });

  it('flags unlicensed uploaded fonts, missing alt text and storage size', () => {
    const identity = createBrandIdentity('Acme', 'acme');
    identity.fonts = [...identity.fonts!, { family: 'Acme Sans', fileName: 'AcmeSans.woff2', format: 'woff2', id: 'acme-sans', label: 'Acme Sans', path: 'data:font/woff2;base64,AAAA', style: 'normal', weight: 400 }];
    identity.typography = identity.typography.map((role) => role.role === 'Body' ? { ...role, family: 'Acme Sans', fontId: 'acme-sans' } : role);
    identity.assets = identity.assets.map((asset) => ({ ...asset, alt: '' }));
    const report = auditBrandHealth(identity);
    expect(report.findings.find(({ id }) => id === 'type-license-acme-sans')).toMatchObject({ severity: 'warning' });
    expect(report.findings.find(({ id }) => id === 'imagery-alt-text')).toMatchObject({ fix: { id: 'alt-text' } });
  });

  it('finds no errors in any built-in and every text pair passes AA', () => {
    for (const identity of hydrateBrandIdentities(null)) {
      const report = auditBrandHealth(identity);
      expect(report.contrast.every(({ passes }) => passes), `${identity.id} contrast`).toBe(true);
      expect(report.counts.error, `${identity.id}: ${report.findings.filter(({ severity }) => severity === 'error').map(({ id }) => id).join(', ')}`).toBe(0);
    }
  });
});

describe('applyBrandHealthFix', () => {
  it('raises a failing pair to its WCAG level while keeping hue', () => {
    const identity: BrandIdentity = {
      ...createBrandIdentity('Acme', 'acme'),
      colorPairings: [{ background: 'paper', foreground: 'emphasis', usage: 'Links' }],
      colors: [
        { hex: '#FFFFFF', id: 'paper', name: 'Paper', role: 'Background' },
        { hex: '#7FB0FF', id: 'emphasis', name: 'Sky', role: 'Links' },
      ],
    };
    const fixed = applyBrandHealthFix(identity, 'contrast:emphasis:paper');
    const hex = fixed.colors.find(({ id }) => id === 'emphasis')!.hex;
    expect(colorContrastRatio(hex, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(auditBrandHealth(fixed).findings.some(({ id }) => id === 'contrast-emphasis-paper')).toBe(false);
    expect(adjustForContrast('#202020', '#FFFFFF', 4.5)).toBe('#202020');
    expect(colorContrastRatio(adjustForContrast('#555555', '#000000', 7), '#000000')).toBeGreaterThanOrEqual(7);
  });

  it('applies the deterministic fixes', () => {
    const identity = { ...createBrandIdentity('Acme', 'acme'), shortName: 'ac', socialHandle: 'acme' };
    expect(applyBrandHealthFix(identity, 'proportions').colors.reduce((sum, color) => sum + (color.proportion ?? 0), 0)).toBe(100);
    expect(applyBrandHealthFix(identity, 'type-scale').typeScale).toEqual({ basePx: 16, ratio: 1.25 });
    expect(applyBrandHealthFix(identity, 'social-handle').socialHandle).toBe('@acme');
    expect(applyBrandHealthFix(identity, 'short-name').shortName).toBe('AC');
    const swapped = { ...identity, assets: identity.assets.map((asset) => ({ ...asset, surface: 'dark' as const })) };
    expect(applyBrandHealthFix(swapped, 'logo-surfaces').assets.find(({ id }) => id === 'mark-dark')?.surface).toBe('light');
    expect(() => applyBrandHealthFix(identity, 'nope')).toThrow(RangeError);
  });
});
