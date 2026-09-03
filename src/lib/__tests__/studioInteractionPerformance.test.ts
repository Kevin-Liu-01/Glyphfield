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

  it('retains Design Lab while pausing its hidden renderer', () => {
    const source = readSource('src/components/StudioApp.tsx');
    const designLab = readSource('src/components/ShaderLabStudio.tsx');
    const styles = readSource('src/app/globals.css');

    expect(source).toContain("const PERSISTENT_LAB_TOOL_IDS = ['material']");
    expect(source).toContain("storedTool === 'logo-shader' || storedTool === 'surface'");
    expect(source).toContain("className='studio-workspace-layer'");
    expect(source).toContain('inert={!active}');
    expect(source).toContain('useDeferredValue(activeToolId)');
    expect(source).toContain("activeToolId === 'animation'");
    expect(source).toContain("activeToolId === 'lottie'");
    expect(designLab).toContain('paused={!active || paused || controlledTimeMs !== null}');
    expect(styles).toContain(".studio-workspace-layer[data-active='true']");
    expect(styles).not.toContain('@keyframes studio-workspace-enter');
  });

  it('uses the accelerated Lottie renderer without live WASM buffer reallocations', () => {
    const source = readSource('src/components/LottieStudio.tsx');
    const previewCanvasStart = source.indexOf("aria-label={gt('Lottie animation preview')}");
    const previewCanvas = source.slice(previewCanvasStart, source.indexOf('/>', previewCanvasStart));

    expect(source).toContain("from '@lottiefiles/dotlottie-web/webgl'");
    expect(source).toContain('autoResize: false');
    expect(source).toContain('devicePixelRatio: Math.min(window.devicePixelRatio, 2)');
    expect(previewCanvas).not.toContain('height={canvas.height}');
    expect(previewCanvas).not.toContain('width={canvas.width}');
  });

  it('invariant_lottie_exports_logical_document_dimensions_instead_of_the_preview_buffer', () => {
    const source = readSource('src/components/LottieStudio.tsx');
    const exportStart = source.indexOf('async function downloadPng()');
    const exportBody = source.slice(exportStart, source.indexOf('function resetEditor()', exportStart));

    expect(exportBody).toContain('exportCanvasDocumentStill({');
    expect(exportBody).toContain('canvasDocument: portableDocument');
    expect(exportBody).not.toContain('lottieCanvas.toBlob');
    expect(exportBody).not.toContain('exportCanvas.width = canvas.width');
  });
});
