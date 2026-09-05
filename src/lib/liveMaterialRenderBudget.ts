export type LiveMaterialPixelRatioInput = {
  cssHeight: number;
  cssWidth: number;
  devicePixelRatio: number;
  maxDevicePixelRatio: number;
  maxPixelCount?: number;
  renderScale: number;
};

export function resolveLiveMaterialPixelRatio({
  cssHeight,
  cssWidth,
  devicePixelRatio,
  maxDevicePixelRatio,
  maxPixelCount,
  renderScale,
}: LiveMaterialPixelRatioInput): number {
  const requestedRatio = Math.max(
    0.1,
    Math.min(maxDevicePixelRatio, Math.max(0.1, devicePixelRatio) * Math.max(0.1, renderScale))
  );
  if (!Number.isFinite(maxPixelCount) || (maxPixelCount ?? 0) <= 0) return requestedRatio;

  const cssPixels = Math.max(1, cssWidth) * Math.max(1, cssHeight);
  const budgetRatio = Math.sqrt(Math.max(1, maxPixelCount ?? 1) / cssPixels);
  return Math.max(0.1, Math.min(requestedRatio, budgetRatio));
}

export function liveMaterialInstancePixelBudget({
  instanceCount,
  maxPerInstance,
  minPerInstance,
  totalBudget,
}: {
  instanceCount: number;
  maxPerInstance: number;
  minPerInstance: number;
  totalBudget: number;
}): number {
  const count = Math.max(1, Math.floor(instanceCount));
  const fairShare = Math.floor(Math.max(1, totalBudget) / count);
  return Math.max(minPerInstance, Math.min(maxPerInstance, fairShare));
}
