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

  it('keeps persistence serialization outside high-frequency React setters', () => {
    const source = readSource('src/hooks/usePersistentState.ts');
    const setter = source.slice(source.indexOf('const setPersistentValue'), source.indexOf('return [value'));

    expect(source).toContain('pendingPersistentWrites.set(storageKey, value)');
    expect(source).toContain('window.setTimeout(flushPendingPersistentWrites');
    expect(setter).toContain('schedulePersistentWrite(storageKey, resolvedValue)');
    expect(setter).not.toContain('localStorage.setItem');
    expect(setter).not.toContain('JSON.stringify');
  });

  it('unmounts inactive heavy workspaces instead of running hidden render loops', () => {
    const source = readSource('src/components/StudioApp.tsx');

    expect(source).not.toContain('RETAINED_WORKSPACE_TOOL_IDS');
    expect(source).not.toContain('retainedWorkspaces');
    expect(source).not.toContain('hidden={!showAnimation}');
    expect(source).toContain("activeToolId === 'animation'");
    expect(source).toContain("activeToolId === 'lottie'");
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
