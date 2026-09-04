import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const readSource = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('Studio interaction performance contracts', () => {
  it('throttles editable-layer updates and caches gesture geometry', () => {
    const source = readSource('src/components/EditableCanvasLayer.tsx');

    expect(source).toContain('pointerFrameRef.current = window.requestAnimationFrame');
    expect(source).toContain('parentBounds,');
    expect(source).toContain('snapTargets: { x: targetX, y: targetY }');
    expect(source).toContain('const bounds = session.parentBounds;');
    expect(source).toContain("window.addEventListener('pointermove', handleWindowPointerMove)");
    expect(source).not.toContain('frame = requestAnimationFrame(measure)');
  });

  it('renders canvas panning directly and commits state once at gesture end', () => {
    const source = readSource('src/components/CanvasViewport.tsx');
    const pointerMove = source.slice(source.indexOf('onPointerMove='), source.indexOf('onPointerUp='));

    expect(source).toContain('panFrameRef.current = window.requestAnimationFrame');
    expect(source).toContain('stageRef.current.style.transform');
    expect(pointerMove).not.toContain('setPanOffset');
    expect(source).toContain('setPanOffset({ x: pan.currentX, y: pan.currentY });');
  });

  it('keeps the fixed selection overlay frame-locked to viewport transforms', () => {
    const layer = readSource('src/components/EditableCanvasLayer.tsx');
    const viewport = readSource('src/components/CanvasViewport.tsx');
    const changeZoom = viewport.slice(viewport.indexOf('function changeZoom'), viewport.indexOf('const handleCanvasWheel'));

    expect(layer).toContain('if (frame !== null) return;');
    expect(layer).toContain('new MutationObserver(measureImmediately)');
    expect(layer).toContain("overlay.style.left = `${next.left}px`;");
    expect(layer).toContain("overlay.style.top = `${next.top}px`;");
    expect(changeZoom).toContain('zoomRef.current = nextZoom;');
    expect(changeZoom).toContain('applyStageTransform(nextPan.x, nextPan.y);');
  });

  it('uses wheel gestures only for pointer-anchored zoom and reserves panning for drag gestures', () => {
    const source = readSource('src/components/CanvasViewport.tsx');
    const wheelHandler = source.slice(source.indexOf('const handleCanvasWheel'), source.indexOf('function fitCanvas'));

    expect(wheelHandler).toContain('resolveCanvasWheelZoomDelta');
    expect(wheelHandler).toContain('changeZoom(zoomRef.current - zoomSteps * 5');
    expect(wheelHandler).not.toContain('setPanOffset');
    expect(wheelHandler).not.toContain('event.ctrlKey');
    expect(wheelHandler).not.toContain('event.metaKey');
    expect(source).toContain("addEventListener('wheel', handleCanvasWheel, { passive: false })");
    expect(source).not.toContain('onWheel=');
  });

  it('keeps persistence serialization outside high-frequency React setters', () => {
    const source = readSource('src/hooks/usePersistentState.ts');
    const setter = source.slice(source.indexOf('const setPersistentValue'), source.indexOf('return [value'));

    expect(source).toContain('pendingPersistentWrites.set(storageKey, value)');
    expect(source).toContain('window.setTimeout(flushPendingPersistentWrites');
    expect(setter).toContain('schedulePersistentWrite(storageKey, resolvedValue)');
    expect(setter).not.toContain('localStorage.setItem');
    expect(setter).not.toContain('JSON.stringify');
  });

  it('drives Animation Studio preview and playhead from one demand-based clock', () => {
    const studio = readSource('src/components/AnimationStudio.tsx');
    const timeline = readSource('src/components/TimelinePanel.tsx');
    const styles = readSource('src/app/globals.css');

    expect(studio).toContain('requestPreviewFrameRef.current = requestTick;');
    expect(studio).toContain('if (isPlayingRef.current) requestTick();');
    expect(studio).toContain('publishPlayhead(playheadRef.current);');
    expect(studio).not.toContain("const previewFrameInterval = isPlayingRef.current");
    expect(timeline).toContain('subscribeToPlayhead(syncPlayheadUi)');
    expect(timeline).toContain('style.transform = `translate3d(${progress}%, 0, 0)`');
    expect(timeline).not.toContain('requestAnimationFrame(tick)');
    expect(timeline).not.toContain('style.left =');
    expect(styles).toContain('will-change: transform;');
  });

  it('keeps interactive animation work within the visible preview budget', () => {
    const studio = readSource('src/components/AnimationStudio.tsx');
    const marketingDemo = readSource('src/components/MarketingAnimationStudioLive.tsx');

    expect(studio).toContain('resolveAnimationPreviewResolution({');
    expect(studio).toContain('new ResizeObserver(updateResolution)');
    expect(studio).toContain('maxPixelCount={previewMaxPixelCount}');
    expect(studio).toContain('useState<AnimationAudioState>(createEmptyAnimationAudioState)');
    expect(studio).not.toContain('void hydrateAudioBuffers(audioState.assets).catch');
    expect(studio).toContain('if (!audioPlaybackRequestedRef.current || !isPlayingRef.current) return;');
    expect(marketingDemo).toContain('previewFrameRate={30}');
  });

  it('prewarms landing shaders without animating them outside the viewport', () => {
    const field = readSource('src/components/MarketingArcField.tsx');
    const liveMaterial = readSource('src/components/LiveMaterialCanvas.tsx');
    const landing = readSource('src/app/page.tsx');

    expect(field).toContain("const SHADER_PREWARM_MARGIN = '720px 0px';");
    expect(field).toContain("const SHADER_ACTIVE_MARGIN = '96px 0px';");
    expect(field).toContain('deferWhileScrolling: false');
    expect(field).toContain('enabled={active}');
    expect(field).toContain('paused={!active}');
    expect(liveMaterial).toContain('speed: nativeSpeed');
    expect(liveMaterial).toContain('const interval = 1000 / frameRate;');
    expect(landing).toContain('frameRate={18}');
    expect(landing).toContain('maxPixelCount={360_000}');
  });

  it('defers portable animation documents and keeps static previews out of urgent renders', () => {
    const studio = readSource('src/components/AnimationStudio.tsx');
    const preview = readSource('src/components/AnimationTimelinePreview.tsx');

    expect(studio).toContain('useSettledValue(animationDocumentInput, 180)');
    expect(studio).toContain('const sources = resolvedSources;');
    expect(studio).toContain("? 'preparing' as const");
    expect(preview).toContain("const previewSources = kind === 'transition'");
    expect(preview).toContain("{ rootMargin: '160px' }");
    expect(preview).toContain('previewSettingsMatch(first.settings, second.settings)');
  });

  it('retains expensive workspaces while pausing their hidden renderers', () => {
    const source = readSource('src/components/StudioApp.tsx');
    const designLab = readSource('src/components/ShaderLabStudio.tsx');
    const liveMaterial = readSource('src/components/LiveMaterialCanvas.tsx');
    const styles = readSource('src/app/globals.css');

    expect(source).toContain("const PERSISTENT_WORKSPACE_TOOL_IDS = ['material', 'animation', 'lottie']");
    expect(source).toContain("storedTool === 'logo-shader' || storedTool === 'surface'");
    expect(source).toContain("className='studio-workspace-layer'");
    expect(source).toContain('const StudioWorkspacePanels = memo(');
    expect(source).toContain('aria-hidden={!projectIsActive}');
    expect(source).toContain('useDeferredValue(activeToolId)');
    expect(source).toContain("toolId === 'animation'");
    expect(source).toContain("toolId === 'lottie'");
    expect(source).toContain('<AnimationStudio active={renderActive}');
    expect(source).toContain('<LottieStudio active={renderActive}');
    expect(source).toContain('const MAX_RETAINED_PROJECT_WORKSPACES = 3;');
    expect(source).toContain("className='studio-project-workspace-layer'");
    expect(source).toContain('onPointerEnter={() => warmProjectWorkspace(identity.id)}');
    expect(source).toContain('onPointerEnter={() => onWarmProject(identity.id)}');
    expect(source).toContain('startTransition(() => {\n      setWarmIdentityIds');
    expect(source).toContain('if (!tabScrollState.canScrollLeft && !tabScrollState.canScrollRight) return;');
    expect(source).toContain('<BrandFontFaces identity={identity} key={identity.id} />');
    expect(designLab).toContain('paused={!active || paused || controlledTimeMs !== null}');
    expect(designLab).toContain('projectWorkspaceActiveRef.current');
    expect(designLab).toContain('const DESIGN_LAB_PREVIEW_MAX_PIXEL_COUNT = 180_000;');
    expect(designLab).toContain('const SHADER_LIBRARY_INITIAL_CARD_COUNT = 24;');
    expect(designLab).toContain('materials.slice(0, visibleMaterialCount)');
    expect(designLab).toContain("{ root, rootMargin: '240px 0px' }");
    expect(liveMaterial).toContain('enabled && workspaceActive');
    expect(styles).toContain(".studio-project-workspace-layer[data-active='true']");
    expect(styles).toContain(".studio-workspace-layer[data-active='true']");
    expect(styles).not.toContain('@keyframes studio-workspace-enter');
  });

  it('preloads lazy Studio workspaces from pointer and keyboard intent', () => {
    const source = readSource('src/components/StudioApp.tsx');
    const lottie = readSource('src/components/LottieStudio.tsx');
    const landingLink = readSource('src/components/MarketingStudioLink.tsx');

    expect(source).toContain('function preloadStudioTool(toolId: StudioToolId)');
    expect(source).toContain('onPointerEnter={() => void preloadStudioTool(tool.id)}');
    expect(source).toContain('onFocus={() => void preloadStudioTool(tool.id)}');
    expect(lottie).toContain('lottieRuntimePreload ??= DotLottie.preload();');
    expect(landingLink).toContain("import('@/components/StudioApp')");
    expect(landingLink).toContain("import('@/components/ShaderLabStudio')");
    expect(landingLink).toContain('onPointerEnter={(event) => {');
    expect(landingLink).toContain('onFocus={(event) => {');
  });

  it('lets dragged project tabs occupy either clamped edge slot', () => {
    const source = readSource('src/components/StudioApp.tsx');

    expect(source).toContain('const movingRight = pointerOffsetX > 0;');
    expect(source).toContain('movingRight ? center <= draggedCenter : center < draggedCenter');
    expect(source).toContain('tab.style.transform = `translate3d(calc(${slotOffset} * (var(--project-tab-width) + var(--project-tab-gap))), 0, 0)`');
  });

  it('uses the accelerated Lottie renderer without live WASM buffer reallocations', () => {
    const source = readSource('src/components/LottieStudio.tsx');
    const wasm = readFileSync(join(process.cwd(), 'public/vendor/dotlottie-player-webgl-0.78.2.wasm'));
    const previewCanvasStart = source.indexOf("aria-label={gt('Lottie animation preview')}");
    const previewCanvas = source.slice(previewCanvasStart, source.indexOf('/>', previewCanvasStart));

    expect(source).toContain("from '@lottiefiles/dotlottie-web/webgl'");
    expect(source).toContain("const DOTLOTTIE_WASM_URL = '/vendor/dotlottie-player-webgl-0.78.2.wasm'");
    expect(source.indexOf('DotLottie.setWasmUrl(DOTLOTTIE_WASM_URL)'))
      .toBeLessThan(source.indexOf('const player = new DotLottie'));
    expect(wasm.subarray(0, 4).toString('hex')).toBe('0061736d');
    expect(wasm.byteLength).toBeGreaterThan(1_000_000);
    expect(source).toContain('autoResize: false');
    expect(source).toContain('devicePixelRatio: Math.min(window.devicePixelRatio, 2)');
    expect(source).toContain("if (desiredPlayingRef.current) {\n        player.setFrame(restoredStart);\n        player.play();");
    expect(previewCanvas).not.toContain('height={canvas.height}');
    expect(previewCanvas).not.toContain('width={canvas.width}');
  });

  it('invariant_lottie_exports_logical_document_dimensions_instead_of_the_preview_buffer', () => {
    const source = readSource('src/components/LottieStudio.tsx');
    const exportStart = source.indexOf('async function downloadPng()');
    const exportBody = source.slice(exportStart, source.indexOf('function resetEditor()', exportStart));

    expect(exportBody).toContain('exportCanvasDocumentStill({');
    expect(exportBody).toContain('canvasDocument: portableDocument');
    expect(exportBody).toContain('const renderedLottie = await renderLottieFrame({');
    expect(exportBody).toContain('renderedLottie,');
    expect(exportBody).not.toContain('lottieCanvas.toBlob');
    expect(exportBody).not.toContain('exportCanvas.width = canvas.width');
  });
});
