import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

function source(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('shared Studio control layout', () => {
  it('keeps select values on one clipped line at narrow inspector widths', () => {
    const select = source('src/components/ui/StudioSelect.tsx');

    expect(select).toContain('overflow-hidden rounded-md border');
    expect(select).toContain('text-ellipsis whitespace-nowrap');
    expect(select).toContain("text-xs whitespace-nowrap");
  });

  it('uses one shared label and value scale for range controls', () => {
    const label = source('src/components/StudioRangeLabel.tsx');
    const styles = source('src/app/globals.css');

    expect(label).toContain("className='studio-range-value'");
    expect(styles).toContain('--studio-control-label-size: 0.6875rem;');
    expect(styles).toContain('--studio-control-value-size: 0.6875rem;');
    expect(styles).toMatch(/\.studio-range-label\s*\{[\s\S]*?font-size: var\(--studio-control-label-size\);/);
    expect(styles).toMatch(/\.studio-range-value\s*\{[\s\S]*?white-space: nowrap;/);
  });

  it('reflows timing choices instead of compressing or wrapping their text', () => {
    const controls = source('src/components/StudioControls.tsx');
    const styles = source('src/app/globals.css');

    expect(controls).toContain("className='studio-choice-grid studio-choice-grid-timing'");
    expect(controls).toContain("className='studio-choice-grid studio-choice-grid-easing'");
    expect(styles).toMatch(/\.studio-choice-grid > button\s*\{[\s\S]*?text-overflow: ellipsis;[\s\S]*?white-space: nowrap;/);
    expect(styles).toContain('@container (min-width: 380px)');
  });

  it('gives Animation Studio a responsive output-artboard workflow', () => {
    const animation = source('src/components/AnimationStudio.tsx');
    const controls = source('src/components/StudioControls.tsx');
    const sizeMenu = source('src/components/ArtboardSizeMenu.tsx');
    const styles = source('src/app/globals.css');

    expect(animation).toContain("aria-label='Animation artboards'");
    expect(animation).toContain("ariaLabel='Active animation artboard'");
    expect(animation).toContain("aria-label='Add animation artboard'");
    expect(animation).toContain("aria-label='Duplicate animation artboard'");
    expect(animation).toContain("aria-label='Delete animation artboard'");
    expect(animation).toContain('<ArtboardSizeMenu');
    expect(sizeMenu).toContain("aria-label='Artboard size presets'");
    expect(sizeMenu).toContain("<legend>Custom size</legend>");
    expect(controls).not.toContain("title={<T>Active artboard</T>}");
    expect(controls).toContain("title={<T>Output</T>}");
    expect(animation).toContain("className='animation-artboard-file-controls'");
    expect(animation).toContain('workspaceControls={animationWorkspaceControls}');
    expect(animation).toContain("label: artboard.name.trim() || 'Untitled animation'");
    expect(animation).not.toContain("label: `${artboard.name.trim() || 'Untitled animation'} · ${artboard.snapshot.settings.width}×${artboard.snapshot.settings.height}`");
    expect(styles).toContain(".animation-artboard-bar[data-has-file-controls='true']");
    expect(styles).toMatch(/\.animation-artboard-bar\s*\{[\s\S]*?grid-template-columns:/);
    expect(styles).toContain(".artboard-size-preset-grid > button[aria-pressed='true']");
  });

  it('uses the same size menu in Design Lab without changing legacy square drafts', () => {
    const designLab = source('src/components/ShaderLabStudio.tsx');
    const styles = source('src/app/globals.css');

    expect(designLab).toContain("className='design-artboard-size-trigger'");
    expect(designLab).toContain("renderArtboardToolbar('sidebar')");
    expect(designLab).toContain("renderArtboardToolbar('canvas')");
    expect(designLab).toContain("if (ratio === 'square') return { height: 1200, width: 1200 };");
    expect(designLab).toContain('shader-lab-v1-canvas-dimensions');
    expect(designLab).toContain('onDimensionsChange={updateActiveArtboardDimensions}');
    expect(styles).toMatch(/@container tool-shell \(max-width: 1560px\)\s*\{[\s\S]*?\.design-artboard-toolbar-canvas\s*\{[\s\S]*?display: none;[\s\S]*?\.design-artboard-toolbar-sidebar\s*\{[\s\S]*?display: grid;/);
  });

  it('keeps the Design Lab shader search attached to its header without a divider', () => {
    const designLab = source('src/components/ShaderLabStudio.tsx');
    const styles = source('src/app/globals.css');

    expect(designLab).toContain("className='shader-lab-v2-panel-heading'");
    expect(designLab).toContain("className='shader-lab-v2-search'");
    expect(styles).toMatch(
      /\.shader-lab-v2-library \.shader-lab-v2-panel-heading\s*\{\s*border-bottom: 0;/
    );
  });

  it('models Animation Studio as one layered sequence with selectable cuts', () => {
    const controls = source('src/components/StudioControls.tsx');
    const gallery = source('src/components/AnimationPackageGallery.tsx');
    const shaderLibrary = source('src/components/ShaderLibrarySidebar.tsx');
    const styles = source('src/app/globals.css');

    expect(controls).not.toContain("type AnimationSetupSection = 'source' | 'motion' | 'background'");
    expect(controls).not.toContain("className='animation-setup-navigation'");
    expect(controls).not.toContain("className='animation-source-mode-tabs'");
    expect(controls).toContain("className='animation-layer-create'");
    expect(controls).toContain("className='animation-sequence-stack'");
    expect(controls).toContain("className='animation-sequence-scene'");
    expect(controls).toContain("className='animation-scene-background'");
    expect(controls).toContain("className='animation-sequence-transition'");
    expect(controls).not.toContain('backgroundBlendLabel');
    expect(controls).not.toContain('nextLabel');
    expect(controls).toContain("className='animation-sequence-background'");
    expect(controls).toContain("className='animation-sequence-base'");
    expect(controls).not.toContain("className='animation-background-tracks'");
    expect(controls).not.toContain("className='animation-frame-background'");
    expect(controls).toContain('<AnimationSequenceTooltipPreview');
    expect(controls).toContain('onSelectSourceBackground(source.id)');
    expect(controls).toContain('onResetBackgroundOverride(source.id)');
    expect(controls).not.toContain("className='animation-layer-lane'");
    expect(controls).toContain('<AnimationGlobalControls controls={childControls} />');
    expect(controls).toContain("title={<T>Selected transition</T>}");
    expect(controls).toContain("title={selectedEffectTarget === 'background' ? <T>Selected background</T> : animationSourceLabel(selectedSource)}");
    expect(controls).toContain("title={<T>Selected background</T>}");
    expect(controls.indexOf("className='animation-sequence-base'")).toBeLessThan(
      controls.indexOf('sources.map((source, index)')
    );
    expect(controls).toContain('shaderPreviewAssetPath(background.materialId)');
    expect(controls).toContain('animatePreviews={false}');
    expect(controls).toContain('onSelectedTransitionSettingsChange({ packageId })');
    expect(controls).toContain("backgroundTransition: backgroundTransition as StudioSettings['backgroundTransition']");
    expect(controls).toContain("ariaLabel={gt('Background blend')}");
    expect(controls).toContain("ariaLabel={gt('Default background blend')}");
    expect(controls).toContain('<T>Use sequence transition</T>');
    expect(controls).toContain("label={<T>Transition duration</T>}");
    expect(controls).not.toContain('onSelect={(packageId) => onSettingsChange({ packageId })}');
    expect(controls).not.toContain('onChange={(bezier) => onSettingsChange({ bezier })}');
    expect(controls).toContain("layout='sidebar'");
    expect(controls).toContain('limit={30}');
    expect(controls).not.toContain("className='animation-shader-controls' open");
    expect(gallery).toContain("layout?: 'grid' | 'sidebar'");
    expect(shaderLibrary).toContain('<T>Show more shaders</T>');
    expect(styles).toMatch(/\.animation-layer-create\s*\{[\s\S]*?grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/);
    expect(styles).toMatch(/\.animation-scene-background\s*\{[\s\S]*?min-height: 38px;/);
    expect(styles).toMatch(/\.animation-sequence-background\s*\{[\s\S]*?min-height: 48px;/);
    expect(styles).toMatch(/\.animation-sequence-tooltip-preview__track\s*\{[\s\S]*?height: 16px;/);
    expect(styles).toMatch(/\.animation-package-gallery-sidebar \.animation-package-card\s*\{[\s\S]*?grid-template-columns: 108px minmax\(0, 1fr\);/);
    expect(styles).toMatch(/\.shader-library-browser-compact \.shader-library-category-filter\s*\{[\s\S]*?overflow-x: auto;/);
  });

  it('uses a rendered storyboard and editable audio lane for motion output', () => {
    const animation = source('src/components/AnimationStudio.tsx');
    const timeline = source('src/components/TimelinePanel.tsx');
    const preview = source('src/components/AnimationTimelinePreview.tsx');
    const audio = source('src/components/AnimationAudioTrack.tsx');
    const styles = source('src/app/globals.css');

    expect(timeline).toContain('data-animation-storyboard');
    expect(timeline).toContain("kind='frame'");
    expect(timeline).toContain("kind='transition'");
    expect(timeline).toContain('sources.length * 224');
    expect(timeline).toMatch(/<header className='animation-timeline-toolbar'>[\s\S]*?<div className='animation-timeline-storyboard-control'>[\s\S]*?<div className='animation-timeline-scrubber'>[\s\S]*?<\/header>/);
    expect(timeline).toMatch(/<div className='animation-timeline-status'>\s*<output[\s\S]*?<label>[\s\S]*?<T>Rate<\/T>/);
    expect(timeline).not.toMatch(/<\/header>\s*<div className='animation-timeline-scrubber'>/);
    expect(timeline).toMatch(/inputRef\.current\.value = String\(currentMs\);[\s\S]*?--studio-range-progress/);
    expect(timeline).toContain("step='1'");
    expect(preview).toContain('renderFrame(');
    expect(preview).toContain('resolveTimeline(timeMs');
    expect(audio).toContain("accept='audio/*'");
    expect(audio).toContain('useState(false)');
    expect(audio).toContain('aria-expanded={expanded}');
    expect(audio).toContain("beginDrag(event, clip, 'trim-start')");
    expect(audio).toContain("beginDrag(event, clip, 'trim-end')");
    expect(audio).toContain('onSplitClip(selectedClip.id)');
    expect(animation).toContain("handleExport('mp4')");
    expect(animation).toContain('mixAnimationAudio(');
    expect(styles).toMatch(/\.animation-timeline-scroll\s*\{[\s\S]*?overflow-x: auto;/);
    expect(styles).toMatch(/\.animation-storyboard-segment\s*\{[\s\S]*?flex: 1 0 224px;/);
    expect(styles).toMatch(/\.animation-storyboard-segment\s*\{[\s\S]*?grid-template-columns: minmax\(140px, 1fr\) 84px;/);
    expect(styles).toMatch(/\.animation-storyboard-segment\s*\{[\s\S]*?padding-right: 0;/);
    expect(styles).toMatch(/\.animation-storyboard-frame,[\s\S]*?\.animation-storyboard-transition\s*\{[\s\S]*?border: 0;[\s\S]*?border-radius: 0;/);
    expect(styles).toMatch(/\.animation-storyboard-transition-caption strong\s*\{[\s\S]*?text-overflow: ellipsis;/);
    expect(styles).toMatch(/\.animation-timeline-preview-canvas\s*\{[\s\S]*?object-fit: contain;/);
    expect(styles).toMatch(/\.animation-audio-trim\s*\{[\s\S]*?cursor: ew-resize;/);
    expect(timeline).toContain('onSelectTransition(index);');
    expect(timeline).toContain('aria-pressed={selectedTransitionIndex === index}');
    expect(styles).toMatch(/@container \(max-width: 300px\)\s*\{[\s\S]*?\.animation-layer-create/);
  });

  it('opens Animation Studio with the first layer selected and a static inspector preview', () => {
    const animation = source('src/components/AnimationStudio.tsx');
    const controls = source('src/components/StudioControls.tsx');
    const styles = source('src/app/globals.css');

    expect(animation).toContain("sequenceOrder[0]");
    expect(animation).toContain("? 'brand-logo' : 'text-0'");
    expect(animation).toContain("setSelectedSourceId('text-0');");
    expect(animation).toContain('const [isPlaying, setIsPlaying] = useState(autoPlay);');
    expect(animation).toContain('initialSelectionAppliedRef.current = true;');
    expect(controls).toContain("className='animation-selected-layer-preview'");
    expect(controls).toContain("className='animation-selected-layer-preview__visual'");
    expect(controls).toContain("<AnimationTimelinePreview authenticShader index={selectedIndex} kind='frame' layout='tooltip'");
    expect(controls).toContain('style={{ aspectRatio: `${Math.max(120, settings.width)} / ${Math.max(120, settings.height)}` }}');
    expect(styles.match(/\.animation-selected-layer-preview\s*\{([\s\S]*?)\}/)?.[1]).not.toContain('box-shadow');
    expect(styles).toMatch(/\.animation-selected-layer-preview__visual \.animation-timeline-preview-canvas\s*\{[\s\S]*?object-fit: contain;/);
  });

  it('explains ordered visual sequences with shared preview tooltips', () => {
    const animation = source('src/components/TimelinePanel.tsx');
    const animationControls = source('src/components/StudioControls.tsx');
    const sequenceTooltip = source('src/components/AnimationSequenceTooltipPreview.tsx');
    const designLab = source('src/components/ShaderLabStudio.tsx');
    const tooltip = source('src/components/ui/StudioPreviewTooltip.tsx');
    const styles = source('src/app/globals.css');

    expect(animation).toContain('<StudioPreviewTooltip');
    expect(animation).not.toContain("eyebrow={`Frame ${String(index + 1).padStart(2, '0')}`}");
    expect(animation).not.toContain("eyebrow={`Transition ${String(index + 1).padStart(2, '0')}`}");
    expect(animation).not.toContain("Click to edit");
    expect(animation).not.toContain('description={packagePresentation.description}');
    expect(animation).not.toContain('<AnimationPackagePreview animate');
    expect(animation).toContain("kind='transition' layout='tooltip'");
    expect(animation).toContain("kind='frame' layout='tooltip'");
    expect(animation).toContain('<AnimationSequenceTooltipPreview');
    expect(animation).toContain("size='compact'");
    expect(animationControls).toContain('<AnimationSequenceTooltipPreview');
    expect(animationControls).not.toContain('AnimationSpanTooltipPreview');
    expect(sequenceTooltip).toContain("<T>Sequence</T>");
    const timelinePreview = source('src/components/AnimationTimelinePreview.tsx');
    expect(timelinePreview).toContain("layout?: 'timeline' | 'tooltip'");
    expect(timelinePreview).toContain('freezeShaderBackgrounds');
    expect(timelinePreview).toContain('requestShaderPreviewImage');
    expect(timelinePreview).toContain('requestShaderPreviewSlot');
    expect(timelinePreview).toContain("canvas.toDataURL('image/webp', 0.86)");
    expect(timelinePreview).toContain('capturedAnimationShaderPreviews');
    expect(timelinePreview).toContain('shaderPreviewAssetPath(materialId)');
    expect(timelinePreview).not.toContain('requestAnimationFrame');
    expect(designLab).toContain("aria-label='Shader cut sequence'");
    expect(designLab).toContain('<LayerDockTooltipPreview');
    expect(designLab).toContain('src={shaderPreviewAssetPath(appliedShader.materialId)}');
    expect(designLab).toContain("role='listitem'");
    expect(designLab).toContain("role='group'");
    expect(tooltip).toContain("role='tooltip'");
    expect(tooltip).toContain("event.pointerType !== 'touch'");
    expect(tooltip).toContain("event.key === 'Escape'");
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(styles).toMatch(/\.studio-preview-tooltip__visual > img\s*\{[\s\S]*?object-fit: contain;/);
    expect(styles).toMatch(/\.studio-preview-tooltip__visual \.animation-timeline-preview-canvas\s*\{[\s\S]*?object-fit: contain;/);
  });

  it('keeps new and saved animation controls in the canvas toolbar', () => {
    const animation = source('src/components/AnimationStudio.tsx');
    const controls = source('src/components/StudioControls.tsx');
    const versions = source('src/components/DesignVersionControls.tsx');
    const styles = source('src/components/DesignVersionControls.module.css');

    expect(animation).toContain("collectionLabel='Saved animations'");
    expect(animation).toContain("defaultName='Untitled animation'");
    expect(animation).toContain('onNew={startNewAnimation}');
    expect(animation).toContain("setTextFrames('New frame')");
    expect(animation).toContain("setIncludeBrandLogo(false)");
    expect(animation).toContain('const animationWorkspaceControls = presentationWorkspaceControls(presentationMode,');
    expect(animation).toContain("layout='toolbar'");
    expect(animation).toContain('workspaceControls={animationWorkspaceControls}');
    expect(controls).not.toContain("aria-label='Animation files'");
    expect(controls).not.toContain('<T>Your animations</T>');
    expect(versions).toContain('async function startNewDesign()');
    expect(styles).toContain(".root[data-layout='panel']");
  });

  it('keeps the marketing hero focused on the live animation workflow', () => {
    const marketingDemo = source('src/components/MarketingAnimationStudioLive.tsx');
    const animation = source('src/components/AnimationStudio.tsx');
    const timeline = source('src/components/TimelinePanel.tsx');
    const styles = source('src/app/globals.css');

    expect(marketingDemo).toContain('presentationMode');
    expect(marketingDemo).toContain('<AnimationStudio\n      autoPlay');
    expect(marketingDemo).toContain("id: 'marketing-animation-demo-dithering-swirl-v2'");
    expect(marketingDemo).toContain('opacity: 0.88');
    expect(animation).toContain('const animationWorkspaceControls = presentationWorkspaceControls(presentationMode');
    expect(animation).toContain("presentationMode ? 'animation-studio-presentation' : ''");
    expect(animation).toContain('className={animationStudioClassName({ compactControls, embedded, presentationMode })}');
    expect(animation).toContain('presentationMode={presentationMode}');
    expect(animation).toContain('style={{ opacity: directShaderComposite ? sequenceShaderOpacity : 0 }}');
    expect(animation).toContain('audioContextRef.current = null;');
    expect(animation).toContain('void closeBrowserAudioContext(context);');
    expect(timeline).toContain('presentationMode?: boolean;');
    expect(timeline).toMatch(/presentationMode \? null : \(\s*<AnimationAudioTrack/);
    expect(timeline).not.toContain('animation-timeline-footer');
    expect(styles).toMatch(/\.marketing-v5-hero-studio\s*\{[\s\S]*?border: 1px solid rgb\(255 255 255 \/ 0\.13\);/);
  });

  it('gives the hero canvas and curve handles supported accessible roles', () => {
    const canvas = source('src/components/CanvasViewport.tsx');
    const bezier = source('src/components/BezierEditor.tsx');

    expect(canvas).toMatch(/aria-label=\{gt\('Canvas viewport'\)\}[\s\S]*?role='region'/);
    expect(bezier).toContain("role='group'");
    expect(bezier).toContain('control point at ${x.toFixed(2)}, ${y.toFixed(2)}');
  });
});
