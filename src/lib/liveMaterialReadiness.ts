export function shouldMountLiveMaterial({
  activeWhileMounted,
  captureTimeMs,
  enabled,
  renderVisible,
  workspaceActive,
}: {
  activeWhileMounted: boolean;
  captureTimeMs: number | null;
  enabled: boolean;
  renderVisible: boolean;
  workspaceActive: boolean;
}): boolean {
  return enabled && workspaceActive
    && (captureTimeMs !== null || activeWhileMounted || renderVisible);
}

export function liveMaterialReadinessStatus(
  requiresWebGL2: boolean,
  webGL2Available: boolean | null,
  recoveryFailed: boolean
): 'error' | 'false' | undefined {
  if (recoveryFailed || (requiresWebGL2 && webGL2Available === false)) return 'error';
  return requiresWebGL2 && webGL2Available === null ? 'false' : undefined;
}

const RENDERER_UNAVAILABLE_MESSAGE = 'The shader could not render. Reload its preview or enable browser graphics acceleration, then try exporting again.';

/** Wait for asynchronous renderer assets before reading the composition pixels. */
export function waitForLiveMaterialReady(
  root: HTMLElement | null,
  timeoutMs = 15_000
): Promise<void> {
  if (!root) return Promise.reject(new Error('The shader preview is unavailable.'));
  const hasFailedSurface = () => root.matches('[data-live-material-ready="error"]')
    || root.querySelector('[data-live-material-ready="error"]') !== null;
  const hasPendingSurface = () => root.matches('[data-live-material-ready="false"]')
    || root.querySelector('[data-live-material-ready="false"]') !== null;
  if (hasFailedSurface()) return Promise.reject(new Error(RENDERER_UNAVAILABLE_MESSAGE));
  if (!hasPendingSurface()) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const observer = new MutationObserver(() => {
      if (hasFailedSurface()) {
        clearTimeout(timeout);
        observer.disconnect();
        reject(new Error(RENDERER_UNAVAILABLE_MESSAGE));
        return;
      }
      if (hasPendingSurface()) return;
      clearTimeout(timeout);
      observer.disconnect();
      resolve();
    });
    const timeout = setTimeout(() => {
      observer.disconnect();
      reject(new Error('The shader is still loading. Wait for its preview to appear, then try again.'));
    }, timeoutMs);
    observer.observe(root, {
      attributeFilter: ['data-live-material-ready'],
      attributes: true,
      childList: true,
      subtree: true,
    });
  });
}
