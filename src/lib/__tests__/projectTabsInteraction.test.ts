import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const studioApp = readFileSync(
  join(process.cwd(), 'src/components/StudioApp.tsx'),
  'utf8'
);
const studioStyles = readFileSync(
  join(process.cwd(), 'src/app/globals.css'),
  'utf8'
);

describe('project tab interaction', () => {
  it('drags from the tab body without a dedicated grip', () => {
    expect(studioApp).toContain("className={`project-tab relative");
    expect(studioApp).toContain('onPointerDown={(event) => handleProjectTabPointerDown(event, identity.id)}');
    expect(studioApp).toContain('onPointerMove={handleProjectTabPointerMove}');
    expect(studioApp).toContain('distance <= 5');
    expect(studioApp).toContain('setPointerCapture(event.pointerId)');
    expect(studioApp).toContain('previewOrder.splice(previewIndex, 0, pointerDrag.sourceId)');
    expect(studioApp).toContain('pointerOffsetX');
    expect(studioApp).toContain('projectTabFrameRef.current = window.requestAnimationFrame');
    expect(studioApp).toContain("tab.style.transform = `translate3d(${pointerOffsetX}px, 0, 0)`");
    expect(studioApp).toContain('ref={projectTabSelectionRef}');
    expect(studioApp).not.toContain('setProjectTabDrag');
    expect(studioStyles).toContain(".app-navbar .project-tab[data-dragging='true']");
    expect(studioStyles).toContain(".app-navbar .project-tab[data-shifting='true']");
    expect(studioStyles).toContain('transition: transform 150ms cubic-bezier');
    expect(studioApp).not.toContain('project-tab-reorder-trigger');
    expect(studioApp).not.toContain('GripVertical');
    expect(studioStyles).not.toContain('.project-tab-reorder-drag-handle');
  });

  it('keeps click, close, keyboard, and pointer alternatives independent', () => {
    expect(studioApp).toContain("aria-keyshortcuts='Alt+ArrowLeft Alt+ArrowRight Shift+F10'");
    expect(studioApp).toContain("target.closest('.project-tab-close')");
    expect(studioApp).toContain('onContextMenu={(event) => {');
    expect(studioApp).toContain("className='project-tab-close'");
    expect(studioApp).toContain('<StudioContextMenu');
    expect(studioApp).toContain("data-studio-context-trigger='project-tab'");
    expect(studioApp).toContain("label: gt('Move tab left')");
  });
});
