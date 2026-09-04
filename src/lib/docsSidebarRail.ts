export type DocsSidebarRailPoint = {
  bottom: number;
  top: number;
  x: number;
};

function coordinate(value: number) {
  return String(Number(value.toFixed(3)));
}

/**
 * Builds one continuous tree rail. When the indentation changes, any spare
 * vertical gap remains straight and the depth change itself stays at 45°:
 *
 *   |
 *    \
 *     |
 */
export function docsSidebarRailPath(points: readonly DocsSidebarRailPoint[], runTop: number) {
  const first = points[0];
  if (!first) return '';

  let path = `M${coordinate(first.x)} ${coordinate(first.top - runTop)}`;
  path += ` L${coordinate(first.x)} ${coordinate(first.bottom - runTop)}`;

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!;
    const point = points[index]!;
    const gapStart = previous.bottom - runTop;
    const gapEnd = point.top - runTop;
    const gap = Math.max(0, gapEnd - gapStart);
    const depthChange = Math.abs(point.x - previous.x);
    const bendHeight = Math.min(depthChange, gap);

    if (depthChange > 0 && bendHeight > 0) {
      const straightLead = (gap - bendHeight) / 2;
      const bendStart = gapStart + straightLead;
      const bendEnd = bendStart + bendHeight;
      path += ` L${coordinate(previous.x)} ${coordinate(bendStart)}`;
      path += ` L${coordinate(point.x)} ${coordinate(bendEnd)}`;
      path += ` L${coordinate(point.x)} ${coordinate(gapEnd)}`;
    } else {
      path += ` L${coordinate(point.x)} ${coordinate(gapEnd)}`;
    }

    path += ` L${coordinate(point.x)} ${coordinate(point.bottom - runTop)}`;
  }

  return path;
}
