import type { DashboardTreemapRect } from "./dashboardTypes";

const treemapLayoutWidth = 300;
const treemapLayoutHeight = 100;

export function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

export function percentage(value: number, max: number): number {
  if (max <= 0 || value <= 0) return 0;
  return Math.max(4, Math.round((value / max) * 100));
}

export function buildTreemapRects(entries: Array<{ count: number; label: string }>): DashboardTreemapRect[] {
  const visibleEntries = entries
    .filter((entry) => entry.count > 0)
    .map((entry) => ({ ...entry }));
  const totalCount = visibleEntries.reduce((sum, entry) => sum + entry.count, 0);
  const maxCount = Math.max(0, ...visibleEntries.map((entry) => entry.count));
  if (totalCount <= 0) return [];

  const rects: DashboardTreemapRect[] = [];
  const placeItems = (
    items: typeof visibleEntries,
    frame: { height: number; width: number; x: number; y: number }
  ): void => {
    if (items.length === 0) return;

    if (items.length === 1) {
      const [item] = items;
      const widthPercent = (frame.width / treemapLayoutWidth) * 100;
      const heightPercent = (frame.height / treemapLayoutHeight) * 100;

      rects.push({
        count: item.count,
        fill: treemapFill(item.count, maxCount),
        height: heightPercent,
        label: item.label,
        showLabel: widthPercent >= 14 && heightPercent >= 18,
        textLight: treemapIntensity(item.count, maxCount) >= 62,
        width: widthPercent,
        x: (frame.x / treemapLayoutWidth) * 100,
        y: (frame.y / treemapLayoutHeight) * 100
      });
      return;
    }

    const groupTotal = items.reduce((sum, item) => sum + item.count, 0);
    let runningTotal = 0;
    let splitIndex = 1;
    let bestDistance = Infinity;

    for (let index = 1; index < items.length; index += 1) {
      runningTotal += items[index - 1].count;
      const distance = Math.abs((groupTotal / 2) - runningTotal);
      if (distance < bestDistance) {
        bestDistance = distance;
        splitIndex = index;
      }
    }

    const firstGroup = items.slice(0, splitIndex);
    const secondGroup = items.slice(splitIndex);
    const firstTotal = firstGroup.reduce((sum, item) => sum + item.count, 0);

    if (frame.width >= frame.height) {
      const firstWidth = frame.width * (firstTotal / groupTotal);
      placeItems(firstGroup, { ...frame, width: firstWidth });
      placeItems(secondGroup, { ...frame, width: frame.width - firstWidth, x: frame.x + firstWidth });
      return;
    }

    const firstHeight = frame.height * (firstTotal / groupTotal);
    placeItems(firstGroup, { ...frame, height: firstHeight });
    placeItems(secondGroup, { ...frame, height: frame.height - firstHeight, y: frame.y + firstHeight });
  };

  placeItems(visibleEntries, {
    height: treemapLayoutHeight,
    width: treemapLayoutWidth,
    x: 0,
    y: 0
  });
  return rects;
}

export function donutGradient(entries: Array<{ color: string; count: number }>): string {
  const total = entries.reduce((sum, entry) => sum + entry.count, 0);
  if (total <= 0) return "var(--hover)";

  let cursor = 0;
  return `conic-gradient(${entries.map((entry) => {
    const start = cursor;
    cursor += (entry.count / total) * 360;
    return `${entry.color} ${start}deg ${cursor}deg`;
  }).join(", ")})`;
}

function treemapIntensity(count: number, maxCount: number): number {
  if (maxCount <= 0) return 18;
  return Math.round(18 + ((count / maxCount) * 60));
}

function treemapFill(count: number, maxCount: number): string {
  return `color-mix(in srgb, var(--accent) ${treemapIntensity(count, maxCount)}%, var(--bg))`;
}
