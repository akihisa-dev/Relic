import type { ChartEntry, ChartEntryEditKind, ChartSource, WorkspaceChart } from "../shared/ipc";
import { monthAxisToPoint } from "../shared/chartTime";
import { formatAxisValue } from "./chronicleTimelineAxis";

export interface ChartRow {
  entries: ChartEntry[];
  fileName: string;
  key: string;
  path: string;
  statuses: string[];
}

export interface DragPreview {
  chronicleEntryIndex: number;
  endValue: number;
  editKind: ChartEntryEditKind;
  path: string;
  source: ChartSource;
  startValue: number;
}

export type ChronicleSortKey = "start-asc" | "start-desc" | "name-asc" | "name-desc";

export function visibleEntries(chart: WorkspaceChart | null): ChartEntry[] {
  if (!chart) return [];
  return chart.entries;
}

export function chartsForView(chart: WorkspaceChart | null, charts: WorkspaceChart[]): WorkspaceChart[] {
  if (chart) return [chart];
  return charts;
}

export function buildChartRows(entries: ChartEntry[], source: ChartSource): ChartRow[] {
  void source;
  return entries.map((entry) => ({
    entries: [entry],
    fileName: entry.fileName,
    key: entryKey(entry),
    path: entry.path,
    statuses: []
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

function matchesRowQuery(row: ChartRow, normalizedQuery: string): boolean {
  return (
    row.fileName.toLowerCase().includes(normalizedQuery) ||
    row.path.toLowerCase().includes(normalizedQuery) ||
    row.statuses.some((status) => status.toLowerCase().includes(normalizedQuery)) ||
    row.entries.some((entry) => (
      entry.startLabel.toLowerCase().includes(normalizedQuery) ||
      entry.endLabel.toLowerCase().includes(normalizedQuery)
    ))
  );
}

const rowCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export function sortRows(rows: ChartRow[], sortKey: ChronicleSortKey): ChartRow[] {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    if (sortKey === "name-asc") return rowCollator.compare(a.fileName, b.fileName) || rowCollator.compare(a.path, b.path);
    if (sortKey === "name-desc") return rowCollator.compare(b.fileName, a.fileName) || rowCollator.compare(b.path, a.path);

    const aStart = rowStartValue(a);
    const bStart = rowStartValue(b);
    const aEnd = rowEndValue(a);
    const bEnd = rowEndValue(b);
    const primary = sortKey === "start-desc" ? bStart - aStart : aStart - bStart;
    if (primary !== 0) return primary;
    const secondary = sortKey === "start-desc" ? bEnd - aEnd : aEnd - bEnd;
    if (secondary !== 0) return secondary;
    return rowCollator.compare(a.fileName, b.fileName) || rowCollator.compare(a.path, b.path);
  });
  return sorted;
}

function rowStartValue(row: ChartRow): number {
  return Math.min(...row.entries.map((entry) => entry.startValue));
}

function rowEndValue(row: ChartRow): number {
  return Math.max(...row.entries.map((entry) => entry.endValue));
}

export function rowCenterValue(row: ChartRow): number {
  return (rowStartValue(row) + rowEndValue(row)) / 2;
}

export function chronicleSummaryForRow(row: ChartRow): string {
  if (row.entries.length === 1) {
    const entry = row.entries[0];
    if (entry.chronicleCalendarName) {
      const calendarName = entry.chronicleCalendarName.trim();
      const start = chronicleYearLabelWithoutCalendarName(entry.startLabel, calendarName);
      const end = chronicleYearLabelWithoutCalendarName(entry.endLabel, calendarName);
      const range = start === end ? start : `${start}-${end}`;

      return calendarName ? `${calendarName} ${range}` : range;
    }
  }

  const start = Math.min(...row.entries.map((entry) => entry.startValue));
  const end = Math.max(...row.entries.map((entry) => entry.endValue));
  const startLabel = formatAxisValue(start);
  const endLabel = formatAxisValue(end);

  return startLabel === endLabel ? startLabel : `${startLabel}-${endLabel}`;
}

function chronicleYearLabelWithoutCalendarName(label: string, calendarName: string): string {
  const trimmed = label.trim();
  return calendarName && trimmed.startsWith(`${calendarName} `)
    ? trimmed.slice(calendarName.length + 1)
    : trimmed;
}

export function entryKey(entry: ChartEntry): string {
  return `${entry.path}:chronicle:${entry.chronicleEntryIndex}`;
}

export function chronicleCalendarPatch(entry: ChartEntry): Pick<ChartEntry, "chronicleEntryIndex"> {
  return {
    chronicleEntryIndex: entry.chronicleEntryIndex
  };
}

export function isPreviewForEntry(
  entry: ChartEntry,
  preview: DragPreview | null,
  source: ChartSource
): boolean {
  return Boolean(
    preview &&
      preview.path === entry.path &&
      preview.source === source &&
      preview.chronicleEntryIndex === entry.chronicleEntryIndex
  );
}

export function previewEntryForDrag(entry: ChartEntry, preview: DragPreview | null): ChartEntry {
  if (
    !preview ||
    preview.path !== entry.path ||
    preview.chronicleEntryIndex !== entry.chronicleEntryIndex
  ) return entry;

  const startLabel = formatEntryCalendarLabel(entry, preview.startValue);
  const endLabel = formatEntryCalendarLabel(entry, preview.endValue);

  return {
    ...entry,
    endLabel,
    endValue: preview.endValue,
    startLabel,
    startValue: preview.startValue
  };
}

function formatEntryCalendarLabel(entry: ChartEntry, value: number): string {
  const name = entry.chronicleCalendarName;
  const startYear = entry.chronicleCalendarStartYear ?? 1;
  const point = monthAxisToPoint(value);
  const year = point.year - startYear + 1;
  const label = year < 0 ? `−${Math.abs(year)}` : String(year);
  const labelWithMonth = `${label}-${String(point.month).padStart(2, "0")}`;

  return name ? `${name} ${labelWithMonth}` : formatAxisValue(value);
}
