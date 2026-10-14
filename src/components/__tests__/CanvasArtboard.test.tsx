import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import CanvasArtboard from '@/components/CanvasArtboard';

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
