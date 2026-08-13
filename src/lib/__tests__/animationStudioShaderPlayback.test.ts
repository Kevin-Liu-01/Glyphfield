import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const animationStudio = readFileSync(
  join(process.cwd(), 'src/components/AnimationStudio.tsx'),
  'utf8'
);

describe('Animation Studio shader playback', () => {
  it('keeps a running preview alive when a background shader is selected', () => {
    const applyLibraryBackground = animationStudio.slice(
      animationStudio.indexOf('function applyLibraryBackground('),
      animationStudio.indexOf('function resetSelectedBackgroundOverride()')
    );

    expect(applyLibraryBackground).not.toContain('changePlaying(false)');
    expect(applyLibraryBackground).toContain('updateSelectedBackground(patch)');
  });

  it('samples shader motion across holds with an explicit export clock', () => {
    expect(animationStudio).toContain('captureTimeMs={shaderCaptureTimeMs}');
    expect(animationStudio).toContain('sampleHoldFrames: shaderBackgroundsAreActive');
    expect(animationStudio).toContain('(frame) => waitForShaderCapture(frame.atMs)');
    expect(animationStudio).toContain('if (resumeAfterExport) changePlaying(true)');
  });
});
