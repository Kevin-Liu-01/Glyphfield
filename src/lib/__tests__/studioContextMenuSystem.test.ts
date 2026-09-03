import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

function source(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('Studio context-menu system', () => {
  it('uses one shared menu across high-value editing surfaces', () => {
    const canvas = source('src/components/CanvasViewport.tsx');
    const designLab = source('src/components/ShaderLabStudio.tsx');
    const projects = source('src/components/StudioApp.tsx');
    const timeline = source('src/components/TimelinePanel.tsx');
    const assets = source('src/components/AssetConversionLibrary.tsx');

    expect(canvas).toContain('<StudioContextMenu');
    expect(designLab).toContain("data-studio-context-trigger='artboard'");
    expect(designLab).toContain("data-studio-context-trigger='layer'");
    expect(projects).toContain("data-studio-context-trigger='project-tab'");
    expect(timeline).toContain("data-studio-context-trigger='timeline-frame'");
    expect(timeline).toContain("data-studio-context-trigger='timeline-transition'");
    expect(assets).toContain("data-studio-context-trigger='asset'");
  });

  it('keeps keyboard invocation and text-editing browser menus available', () => {
    const canvas = source('src/components/CanvasViewport.tsx');
    const menu = source('src/components/ui/StudioContextMenu.tsx');

    expect(canvas).toContain("aria-keyshortcuts='Shift+F10'");
    expect(canvas).toContain("target.closest('button, input, textarea, select, a, [contenteditable=\"true\"]");
    expect(menu).toContain("event.key === 'Escape'");
    expect(menu).toContain("event.key === 'ArrowDown'");
    expect(menu).toContain("event.key === 'Tab'");
  });
});
