import type { GanttChartDateKind, GanttChartEntry, GanttChartSource, WorkspaceGanttChart } from "../shared/ipc";
import { axisToYear, dayToDate } from "../shared/chartTime";
import { fixedStatusValues } from "../shared/status";
import { formatAxisValue } from "./chronicleTimelineAxis";
import type { Translator } from "./i18n";

export interface ChartRow {
  entries: GanttChartEntry[];
  fileName: string;
  key: string;
  path: string;
  statuses: string[];
}

export interface DragPreview {
  chronicleCalendarId?: GanttChartEntry["chronicleCalendarId"];
  dateKind?: GanttChartDateKind;
  endValue: number;
  path: string;
  source: GanttChartSource;
  startValue: number;
}

export type ChronicleSortKey = "start-asc" | "start-desc" | "name-asc" | "name-desc";

export function visibleEntries(chart: WorkspaceGanttChart | null): GanttChartEntry[] {
  if (!chart) return [];
  return chart.entries;
}

export function chartsForView(chart: WorkspaceGanttChart | null, charts: WorkspaceGanttChart[]): WorkspaceGanttChart[] {
  if (chart) return [chart];
  return charts;
}

export function buildChartRows(entries: GanttChartEntry[], source: GanttChartSource): ChartRow[] {
  if (source !== "date") {
    return entries.map((entry) => ({
      entries: [entry],
      fileName: entry.fileName,
      key: entryKey(entry),
      path: entry.path,
      statuses: entry.statuses ?? []
    }));
  }

  const rows = new Map<string, ChartRow>();

  for (const entry of entries) {
    const current = rows.get(entry.path);

    if (current) {
      current.entries.push(entry);
      current.statuses = mergeStatuses(current.statuses, entry.statuses ?? []);
      continue;
    }

    rows.set(entry.path, {
      entries: [entry],
      fileName: entry.fileName,
      key: entry.path,
      path: entry.path,
      statuses: entry.statuses ?? []
    });
  }

  return Array.from(rows.values()).map((row) => ({
    ...row,
    entries: sortDateRowEntries(row.entries)
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
    row.fileName.toLowerCase().includes(normalizedQuery) ||
    row.path.toLowerCase().includes(normalizedQuery) ||
    row.statuses.some((status) => status.toLowerCase().includes(normalizedQuery)) ||
    row.entries.some((entry) => (
      entry.startLabel.toLowerCase().includes(normalizedQuery) ||
      entry.endLabel.toLowerCase().includes(normalizedQuery)
    ))
  );
}

export function sortRows(rows: ChartRow[], sortKey: ChronicleSortKey): ChartRow[] {
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
  const sorted = [...rows];
  sorted.sort((a, b) => {
    if (sortKey === "name-asc") return collator.compare(a.fileName, b.fileName) || collator.compare(a.path, b.path);
    if (sortKey === "name-desc") return collator.compare(b.fileName, a.fileName) || collator.compare(b.path, a.path);

    const aStart = rowStartValue(a);
    const bStart = rowStartValue(b);
    const aEnd = rowEndValue(a);
    const bEnd = rowEndValue(b);
    const primary = sortKey === "start-desc" ? bStart - aStart : aStart - bStart;
    if (primary !== 0) return primary;
    const secondary = sortKey === "start-desc" ? bEnd - aEnd : aEnd - bEnd;
    if (secondary !== 0) return secondary;
    return collator.compare(a.fileName, b.fileName) || collator.compare(a.path, b.path);
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

export function sortDateRowEntries(entries: GanttChartEntry[]): GanttChartEntry[] {
  return [...entries].sort((a, b) => dateKindOrder(a.dateKind) - dateKindOrder(b.dateKind));
}

export function dateKindOrder(kind: GanttChartDateKind | undefined): number {
  return kind === "actual" ? 1 : 0;
}

export function mergeStatuses(current: string[], next: string[]): string[] {
  return [...new Set([...current, ...next])];
}

export function statusValuesForEntries(entries: GanttChartEntry[]): string[] {
  void entries;
  return [...fixedStatusValues];
}

export function statusLabelForEntry(entry: GanttChartEntry): string {
  return (entry.statuses ?? [])
    .filter((status) => status.trim() !== "")
    .join(" / ");
}

export function dateSummaryForRow(row: ChartRow, kind: GanttChartDateKind): string {
  const entry = row.entries.find((candidate) => (candidate.dateKind ?? "planned") === kind);
  if (!entry) return "";

  const sameYear = entry.startLabel.slice(0, 4) === entry.endLabel.slice(0, 4);
  const start = formatDateSummaryLabel(entry.startLabel, sameYear);
  const end = formatDateSummaryLabel(entry.endLabel, sameYear);
  return start === end ? start : `${start}-${end}`;
}

export function chronicleSummaryForRow(row: ChartRow): string {
  if (row.entries.length === 1) {
    const entry = row.entries[0];
    if (entry.chronicleCalendarName) {
      return entry.startLabel === entry.endLabel ? entry.startLabel : `${entry.startLabel}-${entry.endLabel}`;
    }
  }

  const start = Math.min(...row.entries.map((entry) => entry.startValue));
  const end = Math.max(...row.entries.map((entry) => entry.endValue));
  const startLabel = formatAxisValue(start, "chronicle");
  const endLabel = formatAxisValue(end, "chronicle");

  return startLabel === endLabel ? startLabel : `${startLabel}-${endLabel}`;
}

export function formatDateSummaryLabel(value: string, omitYear: boolean): string {
  const normalized = value.replace(/-/g, "/");
  return omitYear ? normalized.slice(5) : normalized;
}

export function entryKey(entry: GanttChartEntry): string {
  return `${entry.path}:${entry.dateKind ?? "default"}`;
}

export function dateKindPatch(entry: GanttChartEntry): { dateKind: GanttChartDateKind } | Record<string, never> {
  return entry.dateKind ? { dateKind: entry.dateKind } : {};
}

export function chronicleCalendarPatch(entry: GanttChartEntry): Pick<GanttChartEntry, "chronicleCalendarId" | "chronicleCalendarStartYear"> {
  return {
    ...(entry.chronicleCalendarId ? { chronicleCalendarId: entry.chronicleCalendarId } : {}),
    ...(entry.chronicleCalendarStartYear ? { chronicleCalendarStartYear: entry.chronicleCalendarStartYear } : {})
  };
}

export function isPreviewForEntry(
  entry: GanttChartEntry,
  preview: DragPreview | null,
  source: GanttChartSource
): boolean {
  return Boolean(
    preview &&
      preview.path === entry.path &&
      preview.source === source &&
      (preview.chronicleCalendarId ?? "chronicle0") === (entry.chronicleCalendarId ?? "chronicle0") &&
      (preview.dateKind ?? "planned") === (entry.dateKind ?? "planned")
  );
}

export function previewEntryForDrag(entry: GanttChartEntry, preview: DragPreview | null): GanttChartEntry {
  if (
    !preview ||
    preview.path !== entry.path ||
    (preview.chronicleCalendarId ?? "chronicle0") !== (entry.chronicleCalendarId ?? "chronicle0") ||
    (preview.dateKind ?? "planned") !== (entry.dateKind ?? "planned")
  ) return entry;

  const startLabel = preview.source === "date"
    ? dayToDate(preview.startValue)
    : formatEntryCalendarLabel(entry, preview.startValue);
  const endLabel = preview.source === "date"
    ? dayToDate(preview.endValue)
    : formatEntryCalendarLabel(entry, preview.endValue);

  return {
    ...entry,
    endLabel,
    endValue: preview.endValue,
    startLabel,
    startValue: preview.startValue
  };
}

function formatEntryCalendarLabel(entry: GanttChartEntry, value: number): string {
  const name = entry.chronicleCalendarName;
  const startYear = entry.chronicleCalendarStartYear ?? 1;
  const year = axisToYear(value) - startYear + 1;
  const label = year < 0 ? `−${Math.abs(year)}` : String(year);

  return name ? `${name} ${label}` : formatAxisValue(value, "chronicle");
}

export function formatDateKindLabel(kind: GanttChartDateKind | undefined, t: Translator): string {
  return kind === "actual" ? t("chronicle.actualDate") : t("chronicle.plannedDate");
}
