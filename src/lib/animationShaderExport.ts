import { freezeLiveMaterialFrame, readLiveMaterialPresentation, type LiveMaterialFrameState } from './liveMaterialPreview';
import { waitForLiveMaterialReady } from './liveMaterialReadiness';
import type { StudioSource } from './renderFrame';
import { drawShaderFramePresentation, preloadShaderFramePresentation } from './shaderFramePresentation';
import { getShaderMotionCapabilities } from './shaderMotionCapabilities';

export type AnimationShaderInstance = { key: string; root: () => HTMLElement | null };

function afterShaderPaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

/** Export buffers are owned by this clip, never stored as document frames. */
export function createAnimationShaderExport(
  sources: readonly StudioSource[],
  resolveInstance: (source: StudioSource) => AnimationShaderInstance
) {
  if (sources.some((source) => source.background?.style === 'shader'
    && getShaderMotionCapabilities(source.background.materialId).motionModel === 'stateful')) {
    throw new Error('Fluid needs a live recording, not timestamp sampling. Choose a time-addressable shader before exporting GIF or MP4.');
  }
  const instances = new Map<string, AnimationShaderInstance & { canvas: HTMLCanvasElement }>();
  const exportSources = sources.map((source): StudioSource => {
    if (source.background?.style !== 'shader') return source;
    const instance = resolveInstance(source);
    let entry = instances.get(instance.key);
    if (!entry) {
      entry = { ...instance, canvas: document.createElement('canvas') };
      instances.set(instance.key, entry);
    }
    return { ...source, background: { ...source.background, image: entry.canvas, shaderPresentation: undefined } };
  });
  let disposed = false;
  return {
    sources: exportSources,
    captureEntryPose(timeMs: number) {
      const states = new Map<string, LiveMaterialFrameState>();
      const resumes: Array<() => void> = [];
      const release = () => resumes.splice(0).forEach((resume) => resume());
      try {
        for (const entry of instances.values()) {
          // An inactive, still-loading layer has no displayed pose to preserve.
          const frozen = freezeLiveMaterialFrame(entry.root(), timeMs);
          if (!frozen) continue;
          resumes.push(frozen.resume);
          states.set(entry.key, frozen.state);
        }
        return { states, release };
      } catch (error) {
        release();
        throw error;
      }
    },
    async refresh() {
      if (disposed) throw new Error('The animation shader export has ended.');
      const roots = [...instances.values()].map((entry) => {
        const root = entry.root();
        if (!root) throw new Error('The animation shader preview is unavailable. Reopen its artboard before exporting.');
        return { entry, root };
      });
      if (!roots.length) return;
      await Promise.all(roots.map(({ root }) => waitForLiveMaterialReady(root)));
      // Readiness includes lazy imports, textures and lighting; then let the
      // controlled clock draw. A fixed number of frames alone is not readiness.
      await afterShaderPaint();
      const rendered = roots.map(({ entry, root }) => {
        const image = root.querySelector('canvas');
        if (entry.root() !== root || !image?.width || !image.height
          || root.querySelector('[data-live-material-ready="false"], [data-live-material-ready="error"]')) {
          throw new Error('An animation shader is not ready. Its gradient fallback cannot be exported as shader motion.');
        }
        return { entry, image, presentation: readLiveMaterialPresentation(root) };
      });
      await Promise.all(rendered.map(({ presentation }) => preloadShaderFramePresentation(presentation)));
      if (disposed) throw new Error('The animation shader export has ended.');
      for (const { entry, image, presentation } of rendered) {
        if (entry.root()?.querySelector('canvas') !== image) throw new Error('The animation shader changed during export. Export the updated animation again.');
        if (entry.canvas.width !== image.width) entry.canvas.width = image.width;
        if (entry.canvas.height !== image.height) entry.canvas.height = image.height;
        const context = entry.canvas.getContext('2d');
        if (!context) throw new Error('The animation shader export canvas is unavailable.');
        context.clearRect(0, 0, entry.canvas.width, entry.canvas.height);
        drawShaderFramePresentation(context, image, presentation, { x: 0, y: 0, width: entry.canvas.width, height: entry.canvas.height });
      }
    },
    dispose() {
      disposed = true;
      for (const { canvas } of instances.values()) { canvas.width = 0; canvas.height = 0; }
    },
  };
}
