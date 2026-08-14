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
});
