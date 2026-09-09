/** Resolve DOM-only inspector previews against their owning active artboard. */
export function selectedCanvasLayerElement(
  stage: HTMLElement | null,
  selectedLayerCount: number
): HTMLElement | null {
  if (selectedLayerCount !== 1 || !stage?.isConnected) return null;
  if (stage.closest('[inert], [hidden], .studio-project-workspace-layer[data-active="false"]')) return null;
  return stage.querySelector<HTMLElement>('.editable-canvas-layer[aria-pressed="true"]');
}

export function previewSelectedTextStyle(
  stage: HTMLElement | null,
  selectedLayerCount: number,
  property: keyof CSSStyleDeclaration,
  value: string
) {
  const layer = selectedCanvasLayerElement(stage, selectedLayerCount);
  const text = layer?.querySelector<HTMLElement>('.shader-lab-v2-layer-text');
  if (!text) return;
  Reflect.set(text.style, property, value);
}
