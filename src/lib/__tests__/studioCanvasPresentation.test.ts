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
    const workspace = readFileSync(
      join(process.cwd(), 'src/components/StudioToolWorkspace.tsx'),
      'utf8'
    );
    const templatePreview = readFileSync(
      join(process.cwd(), 'src/components/TemplateCanvasPreview.tsx'),
      'utf8'
    );

    expect(workspace.match(/stageClassName=\{STUDIO_ARTIFACT_STAGE_CLASS\}/g)).toHaveLength(3);
    expect(workspace.match(/frameClassName=\{STUDIO_ARTIFACT_FRAME_CLASS\}/g)).toHaveLength(2);
    expect(workspace.match(/STUDIO_ARTIFACT_PLANE_CLASS/g)).toHaveLength(3);
    expect(templatePreview).toContain('frameClassName={STUDIO_ARTIFACT_FRAME_CLASS}');
    expect(templatePreview).toContain('className={`${STUDIO_ARTIFACT_PLANE_CLASS}');

    expect(STUDIO_ARTIFACT_STAGE_CLASS).toContain('p-5 md:p-8 xl:p-12');
    expect(STUDIO_ARTIFACT_FRAME_CLASS).toContain('max-w-5xl');
    expect(STUDIO_ARTIFACT_PLANE_CLASS).toContain('border border-border');
  });
});
