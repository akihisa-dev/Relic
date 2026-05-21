import type { TimelineChartEntry, TimelineChartSource, CardbookTimelineChart } from "../shared/ipc";
import { fixedStatusValues } from "../shared/status";
import { formatAxisValue } from "./timelineTimelineAxis";

export interface ChartRow {
  entries: TimelineChartEntry[];
  cardName: string;
  key: string;
  path: string;
  statuses: string[];
}

export interface DragPreview {
  endValue: number;
  path: string;
  source: TimelineChartSource;
  startValue: number;
}

export type TimelineSortKey = "start-asc" | "start-desc" | "name-asc" | "name-desc";

export function visibleEntries(chart: CardbookTimelineChart | null): TimelineChartEntry[] {
  if (!chart) return [];
  return chart.entries;
}

export function chartsForView(chart: CardbookTimelineChart | null, charts: CardbookTimelineChart[]): CardbookTimelineChart[] {
  if (chart) return [chart];
  return charts;
}

export function buildChartRows(entries: TimelineChartEntry[], source: TimelineChartSource): ChartRow[] {
  void source;
  return entries.map((entry) => ({
    entries: [entry],
    cardName: entry.cardName,
    key: entryKey(entry),
    path: entry.path,
    statuses: entry.statuses ?? []
  }));
}

export function filterRows(rows: ChartRow[], query: string, statusFilter: string): ChartRow[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery && !statusFilter) return rows;

  return rows.filter((row) => (
    (!statusFilter || row.statuses.includes(statusFilter)) &&
    (!normalizedQuery || matchesRowQuery(row, normalizedQuery))
  ));
}

export function matchesRowQuery(row: ChartRow, normalizedQuery: string): boolean {
  return (
    row.cardName.toLowerCase().includes(normalizedQuery) ||
    row.path.toLowerCase().includes(normalizedQuery) ||
    row.statuses.some((status) => status.toLowerCase().includes(normalizedQuery)) ||
    row.entries.some((entry) => (
      entry.startLabel.toLowerCase().includes(normalizedQuery) ||
      entry.endLabel.toLowerCase().includes(normalizedQuery)
    ))
  );
}

export function sortRows(rows: ChartRow[], sortKey: TimelineSortKey): ChartRow[] {
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
  const sorted = [...rows];
  sorted.sort((a, b) => {
    if (sortKey === "name-asc") return collator.compare(a.cardName, b.cardName) || collator.compare(a.path, b.path);
    if (sortKey === "name-desc") return collator.compare(b.cardName, a.cardName) || collator.compare(b.path, a.path);

    const aStart = rowStartValue(a);
    const bStart = rowStartValue(b);
    const aEnd = rowEndValue(a);
    const bEnd = rowEndValue(b);
    const primary = sortKey === "start-desc" ? bStart - aStart : aStart - bStart;
    if (primary !== 0) return primary;
    const secondary = sortKey === "start-desc" ? bEnd - aEnd : aEnd - bEnd;
    if (secondary !== 0) return secondary;
    return collator.compare(a.cardName, b.cardName) || collator.compare(a.path, b.path);
  });
  return sorted;
}

export function rowStartValue(row: ChartRow): number {
  return Math.min(...row.entries.map((entry) => entry.startValue));
}

export function rowEndValue(row: ChartRow): number {
  return Math.max(...row.entries.map((entry) => entry.endValue));
}

export function rowCenterValue(row: ChartRow): number {
  return (rowStartValue(row) + rowEndValue(row)) / 2;
}

export function mergeStatuses(current: string[], next: string[]): string[] {
  return [...new Set([...current, ...next])];
}

export function statusValuesForEntries(entries: TimelineChartEntry[]): string[] {
  void entries;
  return [...fixedStatusValues];
}

export function statusLabelForEntry(entry: TimelineChartEntry): string {
  return (entry.statuses ?? [])
    .filter((status) => status.trim() !== "")
    .join(" / ");
}

export function timelineSummaryForRow(row: ChartRow): string {
  const start = Math.min(...row.entries.map((entry) => entry.startValue));
  const end = Math.max(...row.entries.map((entry) => entry.endValue));
  const startLabel = formatAxisValue(start, "timeline");
  const endLabel = formatAxisValue(end, "timeline");

  return startLabel === endLabel ? startLabel : `${startLabel}-${endLabel}`;
}

export function entryKey(entry: TimelineChartEntry): string {
  return entry.path;
}

export function isPreviewForEntry(
  entry: TimelineChartEntry,
  preview: DragPreview | null,
  source: TimelineChartSource
): boolean {
  return Boolean(
    preview &&
      preview.path === entry.path &&
      preview.source === source
  );
}

export function previewEntryForDrag(entry: TimelineChartEntry, preview: DragPreview | null): TimelineChartEntry {
  if (!preview || preview.path !== entry.path) return entry;

  const startLabel = formatAxisValue(preview.startValue, "timeline");
  const endLabel = formatAxisValue(preview.endValue, "timeline");

  return {
    ...entry,
    endLabel,
    endValue: preview.endValue,
    startLabel,
    startValue: preview.startValue
  };
}
