import type { ChartEntry } from "../shared/ipc";

export interface ChronicleBubbleLayoutOptions {
  height?: number;
  maxBubbleWidth?: number;
  minBubbleWidth?: number;
  padding?: number;
  rowGap?: number;
}

export interface ChronicleBubbleShape {
  category: string | null;
  entry: ChartEntry;
  height: number;
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
}

export interface ChronicleBubbleLayout {
  height: number;
  shapes: ChronicleBubbleShape[];
  width: number;
}

export function buildChronicleBubbleLayout(
  entries: ChartEntry[],
  options: ChronicleBubbleLayoutOptions = {}
): ChronicleBubbleLayout {
  const padding = options.padding ?? 32;
  const minBubbleWidth = options.minBubbleWidth ?? 132;
  const maxBubbleWidth = options.maxBubbleWidth ?? 320;
  const rowGap = options.rowGap ?? 16;
  const bubbleHeight = options.height ?? 46;
  const sortedEntries = entries.toSorted((a, b) =>
    centerValue(a) - centerValue(b) ||
      a.startValue - b.startValue ||
      a.endValue - b.endValue ||
      a.fileName.localeCompare(b.fileName, "ja") ||
      a.chronicleEntryIndex - b.chronicleEntryIndex
  );
  const durations = sortedEntries.map(durationValue);
  const minDuration = Math.min(...durations, 1);
  const maxDuration = Math.max(...durations, 1);
  const categoryRows = categoryRowIndexes(sortedEntries);
  const laneEnds: number[] = [];
  const shapes = sortedEntries.map((entry, index): ChronicleBubbleShape => {
    const width = bubbleWidth(durationValue(entry), minDuration, maxDuration, minBubbleWidth, maxBubbleWidth);
    const x = padding + index * (minBubbleWidth + rowGap);
    const category = normalizeCategory(entry.category);
    const preferredRow = categoryRows.get(category) ?? 0;
    const row = category === null
      ? availableRowForShape(laneEnds, preferredRow, x, width, rowGap)
      : preferredRow;
    laneEnds[row] = x + width;

    return {
      category,
      entry,
      height: bubbleHeight,
      id: `${entry.path}:${entry.chronicleEntryIndex}`,
      label: entry.fileName,
      x,
      y: padding + row * (bubbleHeight + rowGap),
      width
    };
  });
  const width = Math.max(
    1,
    shapes.reduce((max, shape) => Math.max(max, shape.x + shape.width + padding), 0)
  );
  const height = Math.max(
    1,
    shapes.reduce((max, shape) => Math.max(max, shape.y + shape.height + padding), 0)
  );

  return { height, shapes, width };
}

export function durationValue(entry: ChartEntry): number {
  return Math.max(1, entry.endValue - entry.startValue + 1);
}

export function centerValue(entry: ChartEntry): number {
  return (entry.startValue + entry.endValue) / 2;
}

function bubbleWidth(
  duration: number,
  minDuration: number,
  maxDuration: number,
  minBubbleWidth: number,
  maxBubbleWidth: number
): number {
  if (maxDuration <= minDuration) return minBubbleWidth;

  const normalized = Math.log1p(duration - minDuration) / Math.log1p(maxDuration - minDuration);
  return Math.round(minBubbleWidth + normalized * (maxBubbleWidth - minBubbleWidth));
}

function normalizeCategory(category: string | undefined): string | null {
  const normalized = category?.trim();
  return normalized ? normalized : null;
}

function categoryRowIndexes(entries: ChartEntry[]): Map<string | null, number> {
  const rows = new Map<string | null, number>();
  let nextRow = 0;

  for (const entry of entries) {
    const category = normalizeCategory(entry.category);
    if (category === null || rows.has(category)) continue;

    rows.set(category, nextRow);
    nextRow += 1;
  }

  return rows;
}

function availableRowForShape(
  laneEnds: number[],
  preferredRow: number,
  x: number,
  width: number,
  rowGap: number
): number {
  const candidateRows = [
    preferredRow,
    preferredRow + 1,
    Math.max(0, preferredRow - 1),
    laneEnds.length
  ];

  for (const row of candidateRows) {
    if ((laneEnds[row] ?? -Infinity) + rowGap <= x) return row;
  }

  void width;
  return laneEnds.length;
}
