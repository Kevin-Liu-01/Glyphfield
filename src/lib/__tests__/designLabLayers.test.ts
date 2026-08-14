import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const playground = readFileSync(join(process.cwd(), 'src/components/SurfaceLabStudio.tsx'), 'utf8');
const designLab = readFileSync(join(process.cwd(), 'src/components/ShaderLabStudio.tsx'), 'utf8');
const animationStudio = readFileSync(join(process.cwd(), 'src/components/AnimationStudio.tsx'), 'utf8');
const exportPreview = readFileSync(join(process.cwd(), 'src/components/ExportPreview.tsx'), 'utf8');
const rangeLabel = readFileSync(join(process.cwd(), 'src/components/StudioRangeLabel.tsx'), 'utf8');
const resizableSidebar = readFileSync(join(process.cwd(), 'src/components/ResizableSidebar.tsx'), 'utf8');
const studioSelect = readFileSync(join(process.cwd(), 'src/components/ui/StudioSelect.tsx'), 'utf8');
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
    expect(playground).toContain('stickerFinish, stickerTexts, stickersEnabled, surfaceEnabled');
  });

  it('supports multiple independently editable text stickers in the shared sticker scene and export path', () => {
    expect(playground).toContain('playground-sticker-texts-v1');
    expect(playground).toContain('function addStickerText(');
    expect(playground).toContain('function updateStickerText(');
    expect(playground).toContain("mode: 'add' | 'duplicate'");
    expect(playground).toContain("className='design-lab-sticker-text-add'");
    expect(playground).toContain("ariaLabel='Sticker text font role'");
    expect(playground).toContain("label='Tracking'");
    expect(playground).toContain('stickerTexts, stickersEnabled');
    expect(stickerScene).toContain('assets: readonly StickerSceneAsset[];');
    expect(stickerScene).toContain('duplicateSelected: (assetId?: string) => void;');
  });

  it('keeps Playground text controls and export behavior aligned with Design Lab', () => {
    expect(playground).toContain("import StudioColorControl from '@/components/ui/ColorControl'");
    expect(playground).toContain('function TextAlignmentControl(');
    expect(playground).toContain("wrap?: 'nowrap' | 'wrap';");
    expect(playground).toContain("<span><WrapText aria-hidden='true' />Wrapping</span>");
    expect(playground).toContain("className='design-lab-text-effects'");
    expect(playground).toContain('context.strokeText(');
    expect(playground).toContain('context.shadowBlur =');
    expect(playground).toContain("aria-label={gt('Playground controls')} data-canvas-selection-preserve");
    expect(playground).toContain("className='design-lab-output-overview'");
    expect(playground).toContain("<FileImage aria-hidden='true' />");
    expect(studioStyles).toContain('.design-lab .design-lab-segmented-field {');
    expect(studioStyles).toContain('.design-lab .design-lab-output-sizes {');
  });

  it('keeps the layer dock legible and resets each library to its leading item', () => {
    expect(playground).toContain("className='design-lab-dock-label'>Layer library");
    expect(playground).toContain('key={dock}');
    expect(studioStyles).toContain('grid-template-rows: 36px minmax(0, 1fr);');
    expect(studioStyles).toContain('grid-template-rows: minmax(0, 1fr) 120px;');
  });

  it('uses the Design Lab three-pane layout with contextual controls and attributed shaders', () => {
    expect(playground).toContain("className='design-lab-library-filter'");
    expect(playground).toContain("className='design-lab-shader-source'");
    expect(playground).toContain("hidden={dock !== 'shader'}");
    expect(playground).toContain("hidden={dock !== 'surface'}");
    expect(playground).toContain("hidden={dock !== 'text'}");
    expect(playground).toContain("hidden={dock !== 'sticker'}");
    expect(studioStyles).toContain('grid-template-columns: minmax(0, 1fr) var(--design-lab-inspector);');
    expect(studioStyles).toContain('padding-left: var(--playground-library);');
  });

  it('adds restrained semantic icons to shared sidebar slider labels', () => {
    expect(playground).toContain("import StudioRangeLabel from '@/components/StudioRangeLabel'");
    expect(designLab).toContain("import StudioRangeLabel from '@/components/StudioRangeLabel'");
    expect(rangeLabel).toContain('LABEL_RULES');
    expect(rangeLabel).toContain('RotateCw');
    expect(rangeLabel).toContain('MoveDiagonal2');
    expect(rangeLabel).toContain('SlidersHorizontal');
    expect(studioStyles).toContain('.studio-range-icon {');
  });

  it('keeps export dropdowns above the preview modal and supports safe custom file names', () => {
    expect(studioSelect).toContain("className='z-[260]");
    expect(exportPreview).toContain('safeExportBaseName');
    expect(exportPreview).toContain('customizedNameRef');
    expect(exportPreview).toContain('export file name`');
    expect(exportPreview).toContain('downloadBlob(asset.blob, downloadFileName)');
    expect(studioStyles).toContain('.shader-export-name-field {');
  });

  it('invalidates and refreshes an open preview when composition content changes', () => {
    expect(designLab).toContain('const compositionSignature = useMemo(() => JSON.stringify({');
    expect(designLab).toContain('refreshKey={currentExportSettingsSignature}');
    expect(exportPreview).toContain("const key = refreshKey ?? 'changed';");
    expect(exportPreview).toContain('onRefreshRef.current?.();');
    expect(exportPreview).not.toContain('Check the final framing and detail here.');
  });

  it('defaults GIF output to a verified seamless temporal overlap', () => {
    expect(designLab).toContain("gifLoop: 'seamless'");
    expect(designLab).toContain("loopMode: normalizedExportSettings.gifLoop");
    expect(designLab).toContain('onLoopReport: (report) => { loopReport = report; }');
    expect(designLab).toContain('frame overlap verified after render');
    expect(exportPreview).toContain('Pixel-perfect loop verified');
    expect(studioStyles).toContain('.shader-export-loop-proof {');
  });

  it('explains output settings with semantic labels and format-specific icons', () => {
    expect(designLab).toContain("className='shader-lab-v2-export-overview'");
    expect(designLab).toContain("<span><small>Output size</small>");
    expect(designLab).toContain("{ label: 'Standard', width: 960 }");
    expect(designLab).toContain("<span><Ruler aria-hidden='true' />Custom width</span>");
    expect(designLab).toContain("<span><CircleGauge aria-hidden='true' />Quality</span>");
    expect(designLab).toContain("<span><Clock3 aria-hidden='true' />Duration</span>");
    expect(designLab).toContain("<ImageDown aria-hidden='true' />");
    expect(designLab).toContain("<Clapperboard aria-hidden='true' />");
    expect(studioStyles).toContain('.shader-lab-v2-export-overview {');
  });

  it('uses the shared one-pixel custom scrollbar on every lab overflow rail and reusable sidebar', () => {
    expect(playground.match(/studio-scroll-area/g)?.length).toBeGreaterThanOrEqual(2);
    expect(designLab.match(/studio-scroll-area/g)?.length).toBeGreaterThanOrEqual(4);
    expect(resizableSidebar).toContain("className='resizable-sidebar-scroll studio-scroll-area'");
    expect(studioStyles).toContain(':where(.studio-scroll-area)::-webkit-scrollbar');
    expect(studioStyles).toMatch(/:where\(\.studio-scroll-area\)::-webkit-scrollbar \{\s+display: block !important;\s+width: 1px !important;\s+height: 1px !important;/);
    expect(studioStyles).toContain('scrollbar-width: auto !important;');
    expect(studioStyles).toContain('scrollbar-color: auto !important;');
    expect(studioStyles).toContain('background: var(--studio-scrollbar-thumb);');
    expect(studioStyles).not.toContain('scrollbar-gutter: stable;');
  });

  it('uses one reusable tool header without vertical dividers', () => {
    expect(designLab).toContain("import StudioToolHeader from '@/components/StudioToolHeader'");
    expect(designLab).toContain('<StudioToolHeader');
    expect(studioStyles).not.toContain('.tool-header');
    expect(animationStudio).not.toContain('items-center border-r border-border');
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

  it('renders previews and exports from the same logical text geometry', () => {
    expect(designLab).toContain('resolveBrandTypographyWeight(identity, textAppearance.fontRole, textLayer.weight)');
    expect(designLab).toContain('const box = outputLayerBox(layerId, transform, width, height);');
    expect(designLab).toContain('const fontSize = Math.max(18, height * 0.17 * transform.scale);');
    expect(designLab).not.toContain('getComputedStyle(previewElement)');
    expect(designLab).not.toContain('fitContentHeight');
    expect(designLab).toContain("justifyContent: textLayer.align === 'left'");
    expect(designLab).toContain("context.fontKerning = 'normal';");
    expect(designLab).toContain('context.letterSpacing = `${spacing}px`');
    expect(designLab.match(/await waitForCompositionFonts\(\);/g)).toHaveLength(2);
    expect(designLab).toContain('await document.fonts.load(');
  });

  it('fits the live stage without changing the selected output ratio', () => {
    expect(studioStyles).toMatch(/\.shader-lab-v2-stage-wrap \{[\s\S]*?container-type: size;/);
    expect(studioStyles).toContain('width: min(100cqw, 1180px, calc(100cqh * 16 / 9));');
    expect(studioStyles).toContain('width: min(100cqw, 900px, 100cqh);');
    expect(studioStyles).toContain('width: min(100cqw, 1180px, calc(100cqh * 1200 / 630));');
  });

  it('freezes the live shader before capturing a still preview', () => {
    expect(designLab).toContain('const resumeAfterExport = !paused;');
    expect(designLab).toContain('setPaused(true);');
    expect(designLab).toContain('if (resumeAfterExport) setPaused(false);');
  });

  it('keeps stage actions in the layer dock and inspector instead of a duplicate toolbar', () => {
    expect(designLab).not.toContain('shader-lab-v2-stage-toolbar');
    expect(studioStyles).not.toContain('.shader-lab-v2-stage-toolbar');
    expect(designLab).toContain("className='shader-lab-v2-dock-add'");
    expect(designLab).toContain("className='shader-lab-v2-composition-ratios'");
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
