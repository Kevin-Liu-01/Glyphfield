const MAX_ACTIVE_SHADER_PREVIEWS = 4;
const SHADER_PREVIEW_RELEASE_GRACE_MS = 300;

type PendingPreview = {
  grant: () => void;
  token: symbol;
};

const activePreviews = new Set<symbol>();
const pendingPreviews: PendingPreview[] = [];

function grantNextPreview() {
  while (activePreviews.size < MAX_ACTIVE_SHADER_PREVIEWS) {
    const next = pendingPreviews.shift();
    if (!next) return;
    activePreviews.add(next.token);
    next.grant();
  }
}

/**
 * Keeps the browsing gallery from exhausting the browser's WebGL context pool.
 * Artboard shaders are intentionally outside this budget and therefore retain
 * priority over decorative card previews.
 */
export function requestShaderPreviewSlot(onGranted: () => void): () => void {
  const token = Symbol('shader-preview');
  let granted = false;
  let released = false;
  const pending: PendingPreview = {
    grant: () => {
      if (released) {
        activePreviews.delete(token);
        grantNextPreview();
        return;
      }
      granted = true;
      onGranted();
    },
    token,
  };

  pendingPreviews.push(pending);
  grantNextPreview();

  return () => {
    if (released) return;
    released = true;
    if (granted) {
      // Native renderers deliberately release their WebGL context after 250ms
      // so React Strict Mode can reuse it. Keep the budget slot occupied until
      // that release completes to avoid a short-lived old+new context spike.
      globalThis.setTimeout(() => {
        activePreviews.delete(token);
        grantNextPreview();
      }, SHADER_PREVIEW_RELEASE_GRACE_MS);
    } else {
      const pendingIndex = pendingPreviews.indexOf(pending);
      if (pendingIndex >= 0) pendingPreviews.splice(pendingIndex, 1);
    }
    if (!granted) grantNextPreview();
  };
}

export function shaderPreviewBudgetState() {
  return {
    active: activePreviews.size,
    limit: MAX_ACTIVE_SHADER_PREVIEWS,
    pending: pendingPreviews.length,
  };
}

export function resetShaderPreviewBudgetForTests() {
  activePreviews.clear();
  pendingPreviews.length = 0;
}
