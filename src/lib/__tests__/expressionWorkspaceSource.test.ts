import { describe, expect, it } from 'vitest';

import { DEFAULT_LOGO_APPEARANCE } from '../logoAppearance';
import {
  parseOpenGraphWorkspaceSource,
  parseTemplateWorkspaceSource,
  type OpenGraphWorkspaceDefaults,
  type TemplateWorkspaceDefaults,
} from '../expressionWorkspaceSource';
import { createStudioCanvasDocument } from '../studioCanvasDocument';

const openGraphFallback: OpenGraphWorkspaceDefaults = {
  allowedFontRoles: ['Display', 'Body'],
  background: { assetId: 'none', opacity: 100, scale: 100, x: 0, y: 0 },
  fontRole: 'Display',
  fontWeight: 600,
  logo: {
    appearance: DEFAULT_LOGO_APPEARANCE,
    assetId: 'mark-dark',
    scale: 100,
    x: 0,
    y: 0,
  },
  surface: 'light',
  title: 'Original title',
};

const templateFallback: TemplateWorkspaceDefaults = {
  allowedFontRoles: ['Display', 'Body'],
  background: {
    asset: null,
    libraryAssetId: '',
    opacity: 28,
    scale: 100,
    x: 0,
    y: 0,
  },
  body: 'Original body',
  brandLayer: { scale: 1, x: 0, y: 0 },
  brandLogo: { scale: 100, x: 0, y: 0 },
  contentLayer: { scale: 1, x: 0, y: 0 },
  fontRole: 'Display',
  fontWeight: 600,
  footerLayer: { scale: 1, x: 0, y: 0 },
  layerOrder: ['brand', 'content', 'footer'],
  partner: { asset: null, id: 'partner', opacity: 1, scale: 100, x: 0, y: 0 },
  slideLayout: 'title',
  texture: 'white',
  textureOpacity: 100,
  title: 'Original title',
};

function portableSource(
  toolId: string,
  state: object,
  layers: Parameters<typeof createStudioCanvasDocument>[0]['layers']
): string {
  return JSON.stringify(createStudioCanvasDocument({
    background: '#FFFFFF',
    brandId: 'gt',
    createdAt: '2026-09-01T12:00:00.000Z',
    height: 630,
    id: `gt:${toolId}:test`,
    layers,
    revision: 1,
    state,
    title: 'Portable test',
    toolId,
    updatedAt: '2026-09-01T12:00:00.000Z',
    width: 1200,
  }));
}

describe('expression workspace source', () => {
  it('normalizes legacy OpenGraph code and validates typed controls', () => {
    const source = JSON.stringify({
      background: {
        asset: { name: 'Legacy background', url: 'data:image/png;base64,bGVnYWN5' },
        assetId: 'field',
        opacity: 42,
        scale: 125,
        x: 7,
        y: -4,
      },
      customFont: { name: 'Legacy font', url: 'data:font/woff2;base64,bGVnYWN5' },
      fontRole: 'Body',
      fontWeight: 500,
      logo: { appearance: { borderColor: 'invalid' }, assetId: 'mark', scale: 88, x: 4, y: 5 },
      surface: 'dark',
      title: 'Updated title',
    }, null, 2).replace(/^  /gm, '\u00a0\u00a0');

    const parsed = parseOpenGraphWorkspaceSource(source, 'opengraph', openGraphFallback);
    expect(parsed).toMatchObject({
      background: { assetId: 'field', opacity: 42, scale: 125, x: 7, y: -4 },
      fontRole: 'Body',
      fontWeight: 500,
      logo: { assetId: 'mark', scale: 88, x: 4, y: 5 },
      surface: 'dark',
      title: 'Updated title',
    });
    expect(parsed.logo?.appearance.borderColor).toBe(DEFAULT_LOGO_APPEARANCE.borderColor);
    expect(parsed.background?.asset?.name).toBe('Legacy background');
    expect(parsed.customFont?.name).toBe('Legacy font');
  });

  it('restores embedded OpenGraph images and fonts instead of external paths', () => {
    const source = portableSource('opengraph', {
      background: { assetId: 'field', opacity: 100, scale: 100, x: 0, y: 0 },
      customFont: null,
      fontRole: 'Display',
      fontWeight: 600,
      logo: { appearance: DEFAULT_LOGO_APPEARANCE, assetId: 'mark', scale: 100, x: 0, y: 0 },
      surface: 'light',
      title: 'Portable title',
    }, [
      { asset: { name: 'Background', source: 'data:image/png;base64,Ymc=' }, bounds: { height: 630, rotation: 0, width: 1200, x: 0, y: 0 }, id: 'opengraph-background', kind: 'image', name: 'Background' },
      { asset: { name: 'Mark', source: 'data:image/svg+xml;base64,bG9nbw==' }, bounds: { height: 52, rotation: 0, width: 52, x: 0, y: 0 }, id: 'opengraph-logo', kind: 'logo', name: 'Mark' },
      { asset: { kind: 'font', name: 'Font', source: 'data:font/woff2;base64,Zm9udA==' }, bounds: { height: 1, rotation: 0, width: 1, x: 0, y: 0 }, hidden: true, id: 'opengraph-font', kind: 'component', name: 'Font' },
    ]);

    const parsed = parseOpenGraphWorkspaceSource(source, 'opengraph', openGraphFallback);
    expect(parsed.background?.asset?.url).toBe('data:image/png;base64,Ymc=');
    expect(parsed.logo?.asset?.url).toBe('data:image/svg+xml;base64,bG9nbw==');
    expect(parsed.customFont?.url).toBe('data:font/woff2;base64,Zm9udA==');
  });

  it('restores complete template state and embedded resources together', () => {
    const source = portableSource('blog-cover', {
      background: { libraryAssetId: 'field', opacity: 60, scale: 130, x: 8, y: 9 },
      body: 'Updated body',
      brandLogo: { scale: 80, x: 2, y: 3 },
      kind: 'blog',
      layers: {
        brand: { scale: 0.8, x: 1, y: 2 },
        content: { scale: 1.2, x: 3, y: 4 },
        footer: { scale: 0.9, x: 5, y: 6 },
        order: ['content', 'brand', 'footer'],
      },
      partner: { id: 'partner-two', scale: 77, x: 10, y: 11 },
      slideLayout: 'quote',
      texture: { opacity: 45, type: 'noise' },
      title: 'Updated title',
      typography: { role: 'Body', weight: 500 },
    }, [
      { asset: { name: 'Background', source: 'data:image/png;base64,Ymc=' }, bounds: { height: 630, rotation: 0, width: 1200, x: 0, y: 0 }, id: 'template-background', kind: 'image', name: 'Background' },
      { asset: { name: 'Brand', source: 'data:image/svg+xml;base64,YnJhbmQ=' }, bounds: { height: 100, rotation: 0, width: 100, x: 0, y: 0 }, id: 'template-brand', kind: 'logo', name: 'Brand' },
      { asset: { name: 'Partner', source: 'data:image/svg+xml;base64,cGFydG5lcg==' }, bounds: { height: 100, rotation: 0, width: 100, x: 0, y: 0 }, id: 'template-partner', kind: 'logo', name: 'Partner' },
      { asset: { kind: 'font', name: 'Font', source: 'data:font/woff2;base64,Zm9udA==' }, bounds: { height: 1, rotation: 0, width: 1, x: 0, y: 0 }, hidden: true, id: 'template-font', kind: 'component', name: 'Font' },
    ]);

    const parsed = parseTemplateWorkspaceSource(source, 'blog-cover', templateFallback);
    expect(parsed).toMatchObject({
      body: 'Updated body',
      brandLayer: { scale: 0.8, x: 1, y: 2 },
      contentLayer: { scale: 1.2, x: 3, y: 4 },
      fontRole: 'Body',
      fontWeight: 500,
      footerLayer: { scale: 0.9, x: 5, y: 6 },
      layerOrder: ['content', 'brand', 'footer'],
      slideLayout: 'quote',
      texture: 'noise',
      textureOpacity: 45,
      title: 'Updated title',
    });
    expect(parsed.background.asset?.url).toBe('data:image/png;base64,Ymc=');
    expect(parsed.brandLogoSource).toBe('data:image/svg+xml;base64,YnJhbmQ=');
    expect(parsed.partner.asset?.url).toBe('data:image/svg+xml;base64,cGFydG5lcg==');
    expect(parsed.fontSource).toBe('data:font/woff2;base64,Zm9udA==');
  });

  it('rejects invalid variants and duplicate template layers', () => {
    expect(() => parseOpenGraphWorkspaceSource(
      '{"surface":"sepia"}',
      'opengraph',
      openGraphFallback
    )).toThrow('surface must be "light" or "dark".');
    expect(() => parseOpenGraphWorkspaceSource(
      '{"fontRole":"Caption"}',
      'opengraph',
      openGraphFallback
    )).toThrow('Unknown typography role.');
    expect(() => parseTemplateWorkspaceSource(
      '{"layers":{"order":["brand","brand","footer"]}}',
      'blog-cover',
      templateFallback
    )).toThrow('exactly once');

    const legacy = parseTemplateWorkspaceSource('{}', 'blog-cover', templateFallback);
    expect(legacy.brandLogoSource).toBeNull();
    expect(legacy.fontSource).toBeNull();
  });
});
