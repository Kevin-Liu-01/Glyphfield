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
    expect(animationStudio).toContain('beforeFrame: (frame) => beforeFrame(frame.atMs)');
    expect(animationStudio).toContain('await shaderExport.refresh()');
    expect(animationStudio).toContain('setShaderCaptureTimeMs(entryTimeMs)');
    expect(animationStudio).toContain('setShaderFrameStates(restoredFrameStates)');
    expect(animationStudio).toContain('if (playbackChanged && resumeAfterExport && isCurrentDocument() && isCurrentWorkspace()) changePlaying(true)');
    expect(animationStudio).not.toContain('remainingFrames');
  });

  it('keeps user playback requests out of the export-owned shader clock', () => {
    expect(animationStudio).toContain('onPlayChange={requestPlaybackChange}');
    expect(animationStudio).toContain('onSeek={requestPlayheadChange}');
    const playbackRequest = animationStudio.slice(
      animationStudio.indexOf('function requestPlaybackChange('),
      animationStudio.indexOf('function inspectPlayhead(')
    );
    const seekRequest = animationStudio.slice(
      animationStudio.indexOf('function requestPlayheadChange('),
      animationStudio.indexOf('async function handleExport(')
    );
    expect(playbackRequest).toMatch(/\{\s*if \(exportJobRef\.current\) return;\s*changePlaying\(playing\);/);
    expect(seekRequest).toMatch(/\{\s*if \(exportJobRef\.current\) return;\s*seek\(timeMs\);/);
    expect(animationStudio).toContain('disabled={exportProgress !== null}');
  });

  it('waits for the once-preloaded grain before clearing a composited preview', () => {
    const preview = animationStudio.slice(animationStudio.indexOf('function renderInteractiveAnimationPreview('),
      animationStudio.indexOf('function AnimationShaderLayers('));
    expect(preview.indexOf('compositedBackgroundIsAnimated && !shaderPresentationReady')).toBeGreaterThan(0);
    expect(preview.indexOf('compositedBackgroundIsAnimated && !shaderPresentationReady')).toBeLessThan(preview.indexOf('context.clearRect'));
    const attach = animationStudio.slice(animationStudio.indexOf('const attachShaderLayers = useCallback('),
      animationStudio.indexOf('useMountEffect(() => {', animationStudio.indexOf('const attachShaderLayers = useCallback(')));
    expect(attach).toContain('shaderPresentation: readLiveMaterialPresentation');
    expect(attach).not.toContain('preloadShaderFramePresentation');
    expect(attach).not.toContain('await');
  });
});
