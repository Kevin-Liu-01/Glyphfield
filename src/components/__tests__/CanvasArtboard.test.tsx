import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import CanvasArtboard from '@/components/CanvasArtboard';
import TemplateCanvasPreview from '@/components/TemplateCanvasPreview';
import { buildTemplateSvg } from '@/lib/templateSvg';

const layerGeometries = {
  brand: { baseHeight: 145, baseWidth: 1032, baseX: 84, baseY: 54 },
  content: { baseHeight: 340, baseWidth: 1032, baseX: 84, baseY: 165 },
  footer: { baseHeight: 50, baseWidth: 1032, baseX: 84, baseY: 496 },
};

const layerTransforms = {
  brand: { scale: 1, x: 0, y: 0 },
  content: { scale: 1, x: 0, y: 0 },
  footer: { scale: 1, x: 0, y: 0 },
};

describe('CanvasArtboard', () => {
  it('invariant_artboard_frame_owns_geometry_independently_of_children', () => {
    const markup = renderToStaticMarkup(
      <CanvasArtboard height={600} width={1200}>
        <div style={{ height: 12 }}>Short child</div>
      </CanvasArtboard>
    );

    expect(markup).toContain('class="canvas-artboard-frame ');
    expect(markup).toContain('data-canvas-height="600"');
    expect(markup).toContain('data-canvas-width="1200"');
    expect(markup).toMatch(/aspect-ratio:1200\s*\/\s*600/);
    expect(markup).toContain('class="canvas-artboard-plane ');
  });

  it('rejects dimensions that cannot define a canvas', () => {
    expect(() => renderToStaticMarkup(
      <CanvasArtboard height={600} width={0}>Invalid</CanvasArtboard>
    )).toThrow(/positive finite numbers/i);
  });
});

describe('TemplateCanvasPreview', () => {
  it('invariant_expression_preview_renders_the_export_svg_with_interaction_overlays', () => {
    const svg = buildTemplateSvg({
      background: '#FFFFFF',
      brandLogo: 'data:image/svg+xml;base64,BRAND',
      foreground: '#181818',
      height: 600,
      identityName: 'Brand',
      kind: 'partnership',
      partnerLogo: 'data:image/svg+xml;base64,PARTNER',
      texture: 'white',
      title: 'Built better, together.',
      website: 'brand.test',
      width: 1200,
    });
    const markup = renderToStaticMarkup(
      <TemplateCanvasPreview
        ariaLabel='Partnership canvas'
        background='#FFFFFF'
        borderRadius={0}
        height={600}
        kind='partnership'
        layerGeometries={layerGeometries}
        layerOrder={['brand', 'content', 'footer']}
        layerTransforms={layerTransforms}
        onChange={() => undefined}
        onDeselect={() => undefined}
        onSelect={() => undefined}
        selectedLayer={null}
        svg={svg}
        width={1200}
      />
    );

    expect(markup).toContain(encodeURIComponent(svg));
    expect(markup).not.toContain('dangerouslySetInnerHTML');
    expect(markup.match(/template-canvas-hit-layer/g)).toHaveLength(3);
  });
});
