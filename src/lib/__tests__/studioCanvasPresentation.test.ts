import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  STUDIO_ARTIFACT_FRAME_CLASS,
  STUDIO_ARTIFACT_PLANE_CLASS,
  STUDIO_ARTIFACT_STAGE_CLASS,
} from '@/lib/studioCanvasPresentation';

describe('Studio artifact canvas presentation', () => {
  it('keeps every expression tool on one stage, frame, and artboard preset', () => {
    const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
    const tools = ['OpenGraphTool', 'TerminalTool', 'TemplateTool'].map((name) => read(`src/components/tools/${name}.tsx`));
    // All five expression tools render the one shared editor and canvas.
    for (const tool of tools) expect(tool).toContain('<ExpressionEditor ');
    const editor = read('src/components/expressions/ExpressionEditor.tsx');
    const canvas = read('src/components/expressions/ExpressionCanvas.tsx');

    expect(editor.match(/stageClassName=\{STUDIO_ARTIFACT_STAGE_CLASS\}/g)).toHaveLength(1);
    expect(canvas).toContain('frameClassName={STUDIO_ARTIFACT_FRAME_CLASS}');
    expect(canvas).toContain('className={`${STUDIO_ARTIFACT_PLANE_CLASS}');

    expect(STUDIO_ARTIFACT_STAGE_CLASS).toContain('p-5 md:p-8 xl:p-12');
    expect(STUDIO_ARTIFACT_FRAME_CLASS).toContain('max-w-5xl');
    expect(STUDIO_ARTIFACT_PLANE_CLASS).toContain('border border-border');
  });
});
