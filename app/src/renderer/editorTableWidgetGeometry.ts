export type LiveTableGeometryAxis = "column" | "row";

export interface LiveTableAxisSegment {
  size: number;
  start: number;
}

function axisElements(table: HTMLTableElement, axis: LiveTableGeometryAxis): HTMLElement[] {
  if (axis === "row") return Array.from(table.rows);
  const firstRow = table.rows.item(0);
  return firstRow ? Array.from(firstRow.cells) : [];
}

function axisStart(rect: DOMRect, axis: LiveTableGeometryAxis): number {
  return axis === "row" ? rect.top : rect.left;
}

function axisSize(rect: DOMRect, axis: LiveTableGeometryAxis): number {
  return axis === "row" ? rect.height : rect.width;
}

export function measureLiveTableAxisSegment(
  wrapper: HTMLElement,
  table: HTMLTableElement,
  axis: LiveTableGeometryAxis,
  index: number
): LiveTableAxisSegment | null {
  const target = axisElements(table, axis)[index];
  if (!target) return null;

  const wrapperRect = wrapper.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const wrapperSize = axisSize(wrapperRect, axis);
  const targetSize = axisSize(targetRect, axis);
  if (wrapperSize <= 0 || targetSize <= 0) return null;

  return {
    size: targetSize,
    start: axisStart(targetRect, axis) - axisStart(wrapperRect, axis)
  };
}

export function liveTableAxisIndexFromPoint(
  table: HTMLTableElement,
  axis: LiveTableGeometryAxis,
  point: number,
  minimumIndex = 0
): number | null {
  const candidates = axisElements(table, axis)
    .map((element, index) => ({ index, rect: element.getBoundingClientRect() }))
    .filter(({ index, rect }) => index >= minimumIndex && axisSize(rect, axis) > 0);
  if (candidates.length === 0) return null;

  const containing = candidates.find(({ rect }) => {
    const start = axisStart(rect, axis);
    return point >= start && point <= start + axisSize(rect, axis);
  });
  if (containing) return containing.index;

  return candidates.reduce((nearest, candidate) => {
    const candidateCenter = axisStart(candidate.rect, axis) + axisSize(candidate.rect, axis) / 2;
    const nearestCenter = axisStart(nearest.rect, axis) + axisSize(nearest.rect, axis) / 2;
    return Math.abs(point - candidateCenter) < Math.abs(point - nearestCenter) ? candidate : nearest;
  }).index;
}
