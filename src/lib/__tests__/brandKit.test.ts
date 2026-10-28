// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBrandIdentity, hydrateBrandIdentities, type BrandIdentity } from '../brandIdentity';
import { brandAgentSetupPrompt, brandProjectUrl, brandSetupMode } from '../brandAgentSetup';
import {
  addBrandAssetFromFile,
  addBrandFontFromFile,
  createBrandKitArtifact,
  detectFontFormat,
  familyFromFontFileName,
  parseBrandApplyInput,
} from '../brandIdentityActions';
import {
  brandGuidelinesMarkdown,
  brandKitFiles,
  brandKitIncludedFonts,
  brandLogoFileName,
} from '../brandKit';
import { BrandSourceValidationError } from '../brandSource';

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';
const WOFF2 = new Uint8Array([0x77, 0x4f, 0x46, 0x32, 0, 1, 0, 0, 1, 2, 3, 4]);

afterEach(() => {
  vi.unstubAllGlobals();
});

function svgFile(name = 'mark.svg') {
  return new File([SVG], name, { type: 'image/svg+xml' });
}

async function acme(): Promise<BrandIdentity> {
  let identity = createBrandIdentity('Acme', 'acme');
  identity = (await addBrandAssetFromFile(identity, { file: svgFile(), slot: 'mark-dark' })).identity;
  identity = (await addBrandFontFromFile(identity, {
    file: new File([WOFF2], 'AcmeSans-Variable.woff2'),
    license: 'SIL Open Font License 1.1',
    roles: ['Display', 'Body'],
  })).identity;
  return identity;
}

describe('identity.asset.add', () => {
  it('replaces a logo slot in place from file bytes', async () => {
    const identity = createBrandIdentity('Acme', 'acme');
    const { asset, identity: next } = await addBrandAssetFromFile(identity, { file: svgFile(), slot: 'mark-light', sourceUrl: 'https://acme.test/brand' });
    expect(asset).toMatchObject({ id: 'mark-light', label: 'Acme mark for dark surfaces', surface: 'dark', type: 'logo' });
    expect(asset.path).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(next.assets.map(({ id }) => id)).toEqual(identity.assets.map(({ id }) => id));
    expect(next.assets.find(({ id }) => id === 'mark-light')?.label).not.toContain('Generated pixel mark');
  });

  it('adds proof assets separately and rejects paths, bad bytes and bad enums', async () => {
    const identity = createBrandIdentity('Acme', 'acme');
    const { identity: next } = await addBrandAssetFromFile(identity, { file: svgFile('customer.svg'), id: 'customer', type: 'proof' });
    expect(next.proofAssets.map(({ id }) => id)).toEqual(['customer']);
    await expect(addBrandAssetFromFile(identity, { file: '/Users/me/logo.svg' })).rejects.toThrow(/Filesystem paths and URLs are not accepted/);
    await expect(addBrandAssetFromFile(identity, { file: new File(['nope'], 'x.png') })).rejects.toThrow(/not a supported/);
    await expect(addBrandAssetFromFile(identity, { file: svgFile(), slot: 'wordmark-dark' })).rejects.toThrow(/slot must be one of/);
  });
});

describe('identity.font.add', () => {
  it('sniffs the format, infers a variable range and binds roles', async () => {
    const identity = await acme();
    const font = identity.fonts!.at(-1)!;
    expect(font).toMatchObject({ family: 'AcmeSans', format: 'woff2', license: 'SIL Open Font License 1.1', weightMax: 900, weightMin: 100 });
    expect(identity.typography.find(({ role }) => role === 'Display')).toMatchObject({ family: 'AcmeSans', fontId: font.id });
    expect(identity.typography.find(({ role }) => role === 'Code')?.fontId).toBe('geist-mono-variable');
    expect(detectFontFormat(new Uint8Array([0, 1, 0, 0]))).toBe('truetype');
    expect(familyFromFontFileName('Acme_Grotesk-SemiBold.otf')).toBe('Acme Grotesk');
    await expect(addBrandFontFromFile(identity, { file: new File(['text'], 'a.woff2') })).rejects.toThrow(/not a TTF, OTF, WOFF or WOFF2/);
  });
});

describe('identity.apply input', () => {
  it('requires a wrapped patch and rejects stray keys', () => {
    expect(() => parseBrandApplyInput({ tagline: 'x' })).toThrow(/requires \{ identity: patch \}/);
    expect(() => parseBrandApplyInput({ identity: {}, force: true })).toThrow(/does not accept force/);
    expect(parseBrandApplyInput({ identity: {}, mode: 'merge', save: true })).toMatchObject({ mode: 'merge', save: true });
  });

  it('exposes every validation issue on the thrown error', async () => {
    const { applyBrandIdentityInput } = await import('../brandIdentityActions');
    try {
      applyBrandIdentityInput(createBrandIdentity('Acme', 'acme'), { identity: { colors: [{ hex: 'red', id: 'ink' }] } });
      throw new Error('expected failure');
    } catch (error) {
      expect(error).toBeInstanceOf(BrandSourceValidationError);
      expect((error as BrandSourceValidationError).issues[0]).toMatchObject({ path: 'colors[0].hex' });
    }
  });
});

describe('brand kit', () => {
  it('packages guidelines, tokens, identity, logos and only redistributable fonts', async () => {
    const identity = await acme();
    const files = await brandKitFiles(identity, async () => new Uint8Array([1, 2, 3]));
    expect(files.map(({ name }) => name)).toEqual([
      'brand.md',
      'tokens/tokens.json',
      'tokens/brand.css',
      'tokens/tailwind.css',
      'identity.json',
      'logos/mark-dark.svg',
      'logos/mark-light.svg',
      'fonts/Inter-Variable.ttf',
      'fonts/GeistMono-Variable.ttf',
      'fonts/AcmeSans-Variable.woff2',
    ]);
    expect(brandKitIncludedFonts(identity).map(({ family }) => family)).toEqual(['Inter', 'Geist Mono', 'AcmeSans']);
    const css = new TextDecoder().decode(files[2]!.bytes);
    expect(css).toContain('src: url("../fonts/AcmeSans-Variable.woff2") format("woff2");');
    const ramp = hydrateBrandIdentities(null).find(({ id }) => id === 'ramp')!;
    // Only the open-licensed code face ships; the commercial Lausanne files never do.
    expect(brandKitIncludedFonts(ramp).map(({ family }) => family)).toEqual(['IBM Plex Mono']);
    expect(new TextDecoder().decode((await brandKitFiles(ramp, async () => new Uint8Array([1]))).find(({ name }) => name === 'tokens/brand.css')!.bytes))
      .toContain('Lausanne Book is not included: kits package only uploaded or open-licensed fonts.');
  });

  it('writes brand.md for coding agents with tokens, contrast and logo rules', () => {
    const gt = hydrateBrandIdentities(null).find(({ id }) => id === 'gt')!;
    const markdown = brandGuidelinesMarkdown(gt);
    expect(markdown).toMatch(/^# General Translation brand guidelines\n/);
    for (const heading of ['## Rules for every change', '## Voice and copy', '## Color', '## Typography', '## Logos', '## Using the brand in code', '## Before you ship']) {
      expect(markdown).toContain(heading);
    }
    expect(markdown).toContain('`--brand-color-ink`');
    expect(markdown).toContain('`logos/mark-dark.svg`');
    expect(brandLogoFileName({ id: 'mark-light', path: 'data:image/png;base64,AA' })).toBe('logos/mark-light.png');
  });

  it('tells agents the semantic roles, the type step each role uses, the typesetting rules and the no-eyebrow rule', () => {
    const gt = hydrateBrandIdentities(null).find(({ id }) => id === 'gt')!;
    const markdown = brandGuidelinesMarkdown({ ...gt, typeScale: { basePx: 16, ratio: 1.25, roleSteps: { Display: 'h1' } } });
    expect(markdown).toContain('`--brand-background`');
    expect(markdown).toContain('`--brand-primary-foreground`');
    expect(markdown).toContain('`--brand-text-h1`');
    expect(markdown).toContain('font-kerning: var(--brand-font-kerning)');
    expect(markdown).toContain('Never add positive tracking to lowercase text.');
    expect(markdown).toContain('No eyebrow text');
  });

  it('creates zip and single-file artifacts with matching names and MIME types', async () => {
    const identity = await acme();
    const load = async () => new Uint8Array([60, 115, 118, 103]);
    const zip = await createBrandKitArtifact(identity, 'zip', load);
    expect(zip).toMatchObject({ fileName: 'acme-brand-kit.zip' });
    expect(zip.blob.type).toBe('application/zip');
    const head = new Uint8Array(await zip.blob.arrayBuffer()).slice(0, 4);
    expect([...head]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const tokens = await createBrandKitArtifact(identity, 'dtcg', load);
    expect(tokens).toMatchObject({ fileName: 'acme-tokens.json' });
    expect(JSON.parse(tokens.previewText!)).toHaveProperty('color.ink.$type', 'color');
    expect((await createBrandKitArtifact(identity, 'markdown', load)).fileName).toBe('brand.md');
    expect((await createBrandKitArtifact(identity, 'tailwind', load)).blob.type).toBe('text/css');
  });
});

describe('fetchBrandKitFile same-origin guard', () => {
  it('reads a same-origin file and never fetches a URL that normalizes cross-origin', async () => {
    const { fetchBrandKitFile } = await import('../brandIdentityActions');
    const fetch = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]).buffer as ArrayBuffer));
    vi.stubGlobal('fetch', fetch);
    await expect(fetchBrandKitFile('/fonts/acme.woff2')).resolves.toEqual(new Uint8Array([1, 2, 3]));
    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/fonts/acme.woff2');
    fetch.mockClear();
    await expect(fetchBrandKitFile('/\\evil.test/acme.woff2')).rejects.toThrow(/Could not read .* for the brand kit/);
    await expect(fetchBrandKitFile('https://evil.test/acme.woff2')).rejects.toThrow(/Could not read .* for the brand kit/);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('agent setup prompt', () => {
  it('writes a self-contained prompt for a new project', () => {
    const identity = createBrandIdentity('Untitled brand', 'new-brand');
    expect(brandSetupMode(identity)).toBe('new');
    const prompt = brandAgentSetupPrompt({ identity, origin: 'http://localhost:3071' });
    expect(prompt).toContain('Set up my brand in Glyphfield');
    expect(prompt).toContain(brandProjectUrl(identity, 'http://localhost:3071'));
    for (const action of ['identity.validate', 'identity.apply', 'identity.asset.add', 'identity.font.add', 'identity.audit', 'identity.fix', 'identity.save', 'identity.export.kit']) {
      expect(prompt).toContain(action);
    }
    expect(prompt).toContain('Never invent customers, metrics, claims or slogans');
    for (const field of ['colorSystem.light', 'colorSystem.dark', 'roleSteps', 'opticalSize', 'never positive tracking on lowercase']) {
      expect(prompt).toContain(field);
    }
  });

  it('switches to improvement mode for an existing brand', () => {
    const gt = hydrateBrandIdentities(null).find(({ id }) => id === 'gt')!;
    expect(brandSetupMode(gt)).toBe('improve');
    const prompt = brandAgentSetupPrompt({ identity: gt, report: { counts: { error: 0, info: 2, warning: 1 }, score: 92 } });
    expect(prompt).toContain('the "General Translation" brand');
    expect(prompt).toContain('92/100');
    expect(prompt).toContain('run identity.read and identity.audit first');
  });
});
