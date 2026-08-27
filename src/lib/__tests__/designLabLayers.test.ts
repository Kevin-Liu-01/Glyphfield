import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const playground = readFileSync(join(process.cwd(), 'src/components/SurfaceLabStudio.tsx'), 'utf8');
const designLab = readFileSync(join(process.cwd(), 'src/components/ShaderLabStudio.tsx'), 'utf8');
const editableCanvasLayer = readFileSync(join(process.cwd(), 'src/components/EditableCanvasLayer.tsx'), 'utf8');
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
    expect(playground).toMatch(/function playgroundSource\(\) \{[\s\S]*?backgroundEnabled,[\s\S]*?backgroundOpacity,[\s\S]*?brandAssetId,[\s\S]*?effectLayers,[\s\S]*?liveMaterialId,[\s\S]*?stickerTexts,[\s\S]*?stickersEnabled,[\s\S]*?surfaceEnabled,[\s\S]*?surfaceOpacity/);
  });

  it('supports multiple independently editable text stickers in the shared sticker scene and export path', () => {
    expect(playground).toContain('playground-sticker-texts-v1');
    expect(playground).toContain('function addStickerText(');
    expect(playground).toContain('function updateStickerText(');
    expect(playground).toContain("mode: 'add' | 'duplicate'");
    expect(playground).toContain("className='design-lab-sticker-text-add'");
    expect(playground).toContain("ariaLabel='Sticker text font role'");
    expect(playground).toContain("label='Tracking'");
    expect(playground).toContain('stickerTexts?: PlaygroundStickerText[];');
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
    expect(designLab).toContain('const savedDesignRevision = useMemo(() =>');
    expect(designLab).toContain('const compositionSignature = `${savedDesignRevision}:frame=${boundedPreviewFrame}:paused=${paused}`;');
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

  it('shares browser-persisted save, fork, and clone controls across both creative tools', () => {
    expect(designLab).toContain("import DesignVersionControls from '@/components/DesignVersionControls'");
    expect(designLab).toContain("workspaceLabel='Design Lab'");
    expect(designLab).toContain('onOpen={applyCompositionSource}');
    expect(playground).toContain("import DesignVersionControls from '@/components/DesignVersionControls'");
    expect(playground).toContain("workspaceLabel='Playground'");
    expect(playground).toContain('onOpen={applySource}');
  });

  it('round-trips complete canvas layers, ordering, groups, shader frame history, and sequences', () => {
    expect(designLab).toContain('version: 3,');
    expect(designLab).toContain('assets: compositionAssets,');
    expect(designLab).toContain('logos: logoLayers,');
    expect(designLab).toContain('frame: boundedPreviewFrame,');
    expect(designLab).toContain('setLogoLayers(nextLogoLayers);');
    expect(designLab).toContain('setCompositionAssets(nextAssets);');
    expect(designLab).toContain('setLayerGroups(nextGroups);');
    expect(designLab).toContain('setLayerOrder(nextOrder);');
    expect(designLab).toContain('shaderSequence: normalizedShaderSequenceSettings,');
    expect(designLab).toContain('setShaderSequenceSettings({');
    expect(designLab).toContain("aria-label='Shader frame history'");
    expect(designLab).not.toContain('assets: compositionAssets.map(({ appearance, id, name, opacity, transform })');
    expect(designLab).not.toContain('logos: logoLayers.map(({ appearance, color, convertedAssetId, id, name, opacity, transform })');
  });

  it('exports authentic accelerating shader cuts as a native MP4 sequence', () => {
    expect(designLab).toContain("import {\n  buildShaderSequenceTimeline,");
    expect(designLab).toContain("title='Shader sequence'");
    expect(designLab).toContain("ariaLabel='Shader sequence background layer'");
    expect(designLab).toContain("ariaLabel='Shader sequence cut count'");
    expect(designLab).toContain("ariaLabel='Shader sequence final hold'");
    expect(designLab).toContain("onExport={() => void exportMotion('mp4', 'sequence')}");
    expect(designLab).toContain('shaderSequenceSegmentAt(shaderSequenceTimeline, frame.timeMs)');
    expect(designLab).toContain("motionMode === 'sequence' ? shaderSequenceDuration : durationMs");
    expect(designLab).toContain("motionMode === 'sequence' ? '-shader-sequence' : ''");
    expect(designLab).toContain('registerStudioAutomation({');
    expect(designLab).toContain("'design.export'");
    expect(designLab).toContain("'design.export.shader-sequence.gif'");
    expect(designLab).toContain("'design.export.shader-sequence.mp4'");
    expect(designLab).toContain("if (request.download) downloadStudioArtifact(asset);");
  });

  it('starts untouched compositions on Gem Smoke and migrates only the legacy Holo default', () => {
    expect(designLab).toContain("const DEFAULT_SHADER_MATERIAL_ID = 'paper-gem-smoke'");
    expect(designLab).toContain("const LEGACY_DEFAULT_SHADER_MATERIAL_ID = 'holo-cloth-silk'");
    expect(designLab).toContain('const untouchedLegacyDefault =');
    expect(designLab).toContain('return untouchedLegacyDefault ? { ...initialShaderLayer } : layer;');
    expect(designLab).toContain('editingShader?.materialId ?? shaderLayers.at(-1)?.materialId ?? DEFAULT_SHADER_MATERIAL_ID');
    expect(playground).toContain("const LEGACY_PLAYGROUND_SHADER_ID = 'holo-cloth-silk'");
    expect(playground).toContain('playground-gem-smoke-default-v1');
    expect(playground).toContain('const legacyShaderWasUntouched =');
    expect(playground).toContain('setLiveMaterialId(SHADER_LIBRARY_DEFAULT_IDS.surface);');
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

  it('treats dither, halftone, scan lines, and gradient as export-safe text effects', () => {
    expect(designLab).toContain("import TextEffectThumbnail from '@/components/TextEffectThumbnail'");
    expect(designLab).toContain("className='shader-lab-v2-text-effect-presets'");
    expect(designLab).toContain('TEXT_EFFECT_PRESETS.map((preset) => (');
    expect(designLab).toContain('applyTextEffectMask(');
    expect(designLab).toContain('createTextEffectGradient(');
    expect(designLab).toContain('textEffectCssStyle(');
    expect(designLab).toContain("ariaLabel='Text effect foreground color'");
    expect(designLab).toContain("ariaLabel='Text effect background color'");
    expect(designLab).toContain('textAppearance.textEffect.backgroundColor');
    expect(studioStyles).toContain('.text-effect-thumbnail {');
    expect(studioStyles).toMatch(/\.text-effect-thumbnail > span \{[\s\S]*?height: 100%;[\s\S]*?padding: 1px 0 3px;[\s\S]*?line-height: 1\.2;/);
  });

  it('uses one persisted canvas background across preview, handoff, and export', () => {
    expect(designLab).toContain("'shader-lab-v3-canvas-background'");
    expect(designLab).toContain("ariaLabel='Canvas background color'");
    expect(designLab).toContain('backgroundColor: canvasBackground');
    expect(designLab).toContain('context.fillStyle = canvasBackground');
  });

  it('supports reorderable full-composition converter layers with universal opacity', () => {
    expect(designLab).toContain("type EffectLayerId = `effect-${string}`;");
    expect(designLab).toContain("'shader-lab-v4-composition-effects'");
    expect(designLab).toContain('function addEffectLayer(');
    expect(designLab).toContain('applyCompositionEffect(context, width, height, {');
    expect(designLab).toContain("className='shader-lab-v2-composition-effect'");
    expect(designLab).toContain("data-effect-kind={effectLayer.settings.kind}");
    expect(designLab.match(/label='Layer opacity'/g)).toHaveLength(5);
    expect(designLab).toContain('effectLayers,');
    expect(playground).toContain("'playground-effect-layers-v1'");
    expect(playground).toContain('function addEffectLayer(');
    expect(playground).toContain("hidden={dock !== 'effect'}");
    expect(playground).toContain("className='design-lab-composition-effect'");
    expect(playground).toContain('effectLayers.filter(({ visible }) => visible).forEach((layer) => {');
  });

  it('renders the production converter thumbnail inside each effect layer card', () => {
    expect(designLab).toContain('<CompositionEffectThumbnail kind={effectLayer.settings.kind} />');
    expect(designLab).not.toContain("className='shader-lab-v2-effect-swatch'");
    expect(studioStyles).toContain(".shader-lab-v2-dock-layer[data-kind='converter'] .composition-effect-thumbnail {");
  });

  it('keeps live converter motion buffered and adaptive instead of throttling it to 12 FPS', () => {
    expect(designLab).toContain('const buffer = effectPreviewBufferRef.current');
    expect(designLab).toContain('let targetFrameRate = 60;');
    expect(designLab).toContain('targetFrameRate = 30;');
    expect(designLab).not.toContain('1000 / 12');
    expect(playground).toContain('const buffer = effectBufferRef.current');
    expect(playground).toContain('let targetFrameRate = 60;');
    expect(playground).toContain('frameRate={60}');
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

  it('maps ordinary vertical wheel gestures onto the horizontal layer dock', () => {
    expect(designLab).toContain('function scrollLayerDockWithWheel(');
    expect(designLab).toContain('Math.abs(event.deltaY) <= Math.abs(event.deltaX)');
    expect(designLab).toContain('dock.scrollLeft = nextScroll;');
    expect(designLab).toContain('onWheel={scrollLayerDockWithWheel}');
    expect(designLab).toContain('tabIndex={0}');
    expect(studioStyles).toContain('.shader-lab-v2-dock-stack:focus-visible {');
  });

  it('can restore and duplicate the built-in brand mark', () => {
    expect(designLab).toContain('function addBrandMarkLayer()');
    expect(designLab).toContain("name: number === 1 ? 'Brand mark' : `Brand mark ${number}`");
    expect(designLab).toContain('setLogoLayers((current) => [...current, layer])');
    expect(designLab).toContain("aria-label='Add brand mark'");
    expect(designLab).toContain('onClick={addBrandMarkLayer}');
  });

  it('pins static and shader-filled artwork to the editable layer bounds', () => {
    expect(designLab.match(/className='shader-lab-v2-appearance-preview/g)).toHaveLength(4);
    expect(studioStyles).toContain('.shader-lab-v2-appearance-preview {');
    expect(studioStyles).toMatch(/\.shader-lab-v2-appearance-preview \{[\s\S]*?position: absolute;[\s\S]*?inset: 0;/);
    expect(designLab.match(/showSource=\{false\}/g)).toHaveLength(2);
    expect(studioStyles).toMatch(/\.shader-lab-v2-appearance-stack-layer \{[\s\S]*?position: absolute;[\s\S]*?inset: 0;/);
  });

  it('applies shadows with the shaded mark instead of an overlay silhouette', () => {
    expect(designLab.match(/borderEnabled: false,/g)).toHaveLength(2);
    expect(designLab.match(/ditherEnabled: false,\s+invert: false,\s+shadowEnabled: false,/g)).toHaveLength(3);
    expect(designLab.match(/appearance\.borderEnabled \?/g)).toHaveLength(2);
    expect(designLab).not.toContain('appearance.borderEnabled || appearance.shadowEnabled');
  });
});

describe('Design Lab image import and selection chrome', () => {
  it('supports browse, drop, and paste imports with intrinsic image placement', () => {
    expect(designLab).toContain("className='shader-lab-v2-image-drop-overlay'");
    expect(designLab).toContain("document.addEventListener('paste', handlePaste)");
    expect(designLab).toContain('fitImageLayerToCanvas({');
    expect(designLab).toContain("className='shader-lab-v2-dock-add-image'");
    expect(designLab).toContain('Images keep their aspect ratio when added.');
    expect(studioStyles).toContain('.shader-lab-v2-image-drop-overlay {');
  });

  it('portals single- and multi-selection chrome above the clipped canvas viewport', () => {
    expect(editableCanvasLayer).toContain('createPortal(');
    expect(editableCanvasLayer).toContain('document.body');
    expect(designLab).toContain('<CanvasSelectionAssemblyOverlay');
    expect(designLab).toContain('document.body');
    expect(studioStyles).toMatch(/\.editable-canvas-layer-selection \{[\s\S]*?position: fixed;[\s\S]*?z-index: 2147483000;/);
    expect(studioStyles).toMatch(/\.canvas-selection-assembly \{[\s\S]*?position: fixed;[\s\S]*?z-index: 2147483000;/);
  });

  it('gives the corner resize arrow a generous invisible hit target', () => {
    expect(studioStyles).toMatch(/\.editable-canvas-layer-resize \{[\s\S]*?z-index: 30;[\s\S]*?width: 40px;[\s\S]*?height: 40px;/);
    expect(studioStyles).toMatch(/\.editable-canvas-layer-resize::before \{[\s\S]*?width: 16px;[\s\S]*?height: 16px;/);
  });

  it('previews resize frames locally and commits composition state on release', () => {
    expect(editableCanvasLayer).toContain('applyDirectInteractionPreview(nextTransform, session);');
    expect(editableCanvasLayer).toContain('applyDirectBoxResizePreview(nextTransform, session);');
    expect(editableCanvasLayer).toContain('applyDirectGroupMovePreview(nextTransform, session);');
    expect(editableCanvasLayer).toContain("element.dataset.interactionPreview = 'gpu-group';");
    expect(editableCanvasLayer).toContain('layer.style.transform = `translate3d(${translateX}%, ${translateY}%, 0) scale3d(');
    expect(editableCanvasLayer).toContain("layer.dataset.interactionPreview = 'gpu';");
    expect(editableCanvasLayer).toContain('onChange(resizePreview);');
    expect(editableCanvasLayer).not.toContain('clamp(session.startWidthScale + deltaX / baseWidth, 0.2, 3)');
    expect(studioStyles).toContain('.editable-canvas-layer {\n  position: absolute;\n  min-width: 0;\n  min-height: 0;');
    expect(studioStyles).not.toContain('.editable-canvas-layer {\n  position: absolute;\n  min-width: 24px;');
  });
});
