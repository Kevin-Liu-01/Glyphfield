import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const playground = readFileSync(join(process.cwd(), 'src/components/SurfaceLabStudio.tsx'), 'utf8');
const designLab = readFileSync(join(process.cwd(), 'src/components/ShaderLabStudio.tsx'), 'utf8');
const resizableSidebar = readFileSync(join(process.cwd(), 'src/components/ResizableSidebar.tsx'), 'utf8');
const stickerScene = readFileSync(join(process.cwd(), 'src/components/StickerDeviceScene.tsx'), 'utf8');
const studioStyles = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');

describe('Playground optional layers', () => {
  it('persists independent background, surface, and sticker visibility', () => {
    expect(playground).toContain('design-lab-background-enabled-v1');
    expect(playground).toContain('design-lab-surface-enabled-v1');
    expect(playground).toContain('design-lab-stickers-enabled-v1');
    expect(playground.match(/className='design-lab-none-preset'/g)).toHaveLength(3);
  });

  it('keeps disabled layers out of rendering and PNG composition', () => {
    expect(playground).toContain('{backgroundEnabled ? (');
    expect(playground).toContain('const liveSurface = surfaceEnabled ?');
    expect(playground).toMatch(/const composed = stickersEnabled(?:\s+&&[^?]+)?\s+\?/);
    expect(stickerScene).toContain("data-enabled={enabled ? 'true' : 'false'}");
    expect(stickerScene).toContain('inert={enabled ? undefined : true}');
  });

  it('round-trips all layer states through the source recipe', () => {
    expect(playground).toContain('backgroundEnabled?: boolean;');
    expect(playground).toContain('surfaceEnabled?: boolean;');
    expect(playground).toContain('stickersEnabled?: boolean;');
    expect(playground).toContain('backgroundEnabled, liveMaterialId');
    expect(playground).toContain('stickerFinish, stickersEnabled, surfaceEnabled');
  });

  it('keeps the layer dock legible and resets each library to its leading item', () => {
    expect(playground).toContain("className='design-lab-dock-label'>Layer library");
    expect(playground).toContain('key={dock}');
    expect(studioStyles).toContain('grid-template-rows: 36px minmax(0, 1fr);');
    expect(studioStyles).toContain('grid-template-rows: minmax(0, 1fr) 120px;');
  });

  it('uses the shared minimal scrollbar on every lab overflow rail and reusable sidebar', () => {
    expect(playground.match(/studio-scroll-area/g)?.length).toBeGreaterThanOrEqual(2);
    expect(designLab.match(/studio-scroll-area/g)?.length).toBeGreaterThanOrEqual(4);
    expect(resizableSidebar).toContain("className='resizable-sidebar-scroll studio-scroll-area'");
    expect(studioStyles).toContain(':where(.studio-scroll-area)::-webkit-scrollbar');
    expect(studioStyles).toMatch(/:where\(\.studio-scroll-area\)::-webkit-scrollbar \{\s+width: 3px;\s+height: 3px;/);
    expect(studioStyles).toContain('min-height: 24px;');
    expect(studioStyles).not.toContain('scrollbar-gutter: stable;');
  });

  it('keeps content controls contextual in Design Lab', () => {
    expect(designLab).toContain("label='Text box width'");
    expect(designLab).toContain("ariaLabel='Text font role'");
    expect(designLab).toContain("<LogoAppearanceControls");
    expect(designLab).toContain("<AppearanceFilteredContent");
    expect(designLab).toContain("kind='image'");
    expect(designLab).toContain("<AssetConversionLibrary");
    expect(designLab).toContain('SVG conversion & mark library');
  });

  it('uses the shared studio color component for text color', () => {
    expect(designLab).toContain("import ColorControl from '@/components/ui/ColorControl'");
    expect(designLab).toContain('<ColorControl');
    expect(designLab).toContain("ariaLabel='Text color'");
    expect(designLab).toContain("onChange={(color) => updateTextLayer(selectedTextLayer.id, { color })}");
  });

  it('uses one persisted canvas background across preview, handoff, and export', () => {
    expect(designLab).toContain("'shader-lab-v3-canvas-background'");
    expect(designLab).toContain("ariaLabel='Canvas background color'");
    expect(designLab).toContain('backgroundColor: canvasBackground');
    expect(designLab).toContain('context.fillStyle = canvasBackground');
  });

  it('can restore and duplicate the built-in brand mark', () => {
    expect(designLab).toContain('function addBrandMarkLayer()');
    expect(designLab).toContain("name: number === 1 ? 'Brand mark' : `Brand mark ${number}`");
    expect(designLab).toContain('setLogoLayers((current) => [...current, layer])');
    expect(designLab).toContain("aria-label='Add brand mark'");
    expect(designLab).toContain('onClick={addBrandMarkLayer}');
  });

  it('pins static and shader-filled artwork to the editable layer bounds', () => {
    expect(designLab.match(/shader-lab-v2-appearance-preview/g)).toHaveLength(4);
    expect(studioStyles).toContain('.shader-lab-v2-appearance-preview {');
    expect(studioStyles).toMatch(/\.shader-lab-v2-appearance-preview \{[\s\S]*?position: absolute;[\s\S]*?inset: 0;/);
    expect(designLab.match(/showSource=\{false\}/g)).toHaveLength(2);
    expect(studioStyles).toMatch(/\.shader-lab-v2-appearance-stack-layer \{[\s\S]*?position: absolute;[\s\S]*?inset: 0;/);
  });
});
