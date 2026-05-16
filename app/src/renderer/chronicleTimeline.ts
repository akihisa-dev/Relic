import type { GanttChartDateKind, GanttChartEntry, GanttChartSource, WorkspaceGanttChart } from "../shared/ipc";
import { axisToYear, dateToDay, dayToDate, yearToAxis } from "../shared/chartTime";
import { fixedStatusValues } from "../shared/status";
import type { Translator } from "./i18n";

export const ROW_HEIGHT = 38;
export const CHRONICLE_NAME_COLUMN_WIDTH = 300;
export const DATE_NAME_COLUMN_WIDTH = 430;
export const TICK_WIDTH = 72;
export const DATE_TICK_WIDTH = 52;
export const LABEL_HORIZONTAL_PADDING = 14;
export const CHRONICLE_FINE_DRAG_SPEED = 0.18;
export const CHRONICLE_FAST_DRAG_SPEED = 1.4;
export const CHRONICLE_FINE_DRAG_MULTIPLIER = 0.65;
export const CHRONICLE_FAST_DRAG_MULTIPLIER = 1.35;
export const SCALE_OPTIONS: Record<GanttChartSource, readonly number[]> = {
  chronicle: [1, 10, 100],
  date: [0, 1, 2]
};

export const DATE_SCALES = [
  { label: "日", step: 1, unit: "day" },
  { label: "月", step: null, unit: "month" },
  { label: "年", step: null, unit: "year" }
] as const;

export type DateScale = typeof DATE_SCALES[number];
export type DateScaleUnit = DateScale["unit"];
export type DateAxisSegmentUnit = DateScaleUnit | "month" | "year";

export interface DateAxisSegment {
  endValue: number;
  label: string;
  startValue: number;
}

export interface ChartGuideTick {
  isMajor: boolean;
  value: number;
}

export interface ChartRow {
  entries: GanttChartEntry[];
  fileName: string;
  key: string;
  path: string;
  statuses: string[];
}

export interface DragPreview {
  dateKind?: GanttChartDateKind;
  endValue: number;
  path: string;
  source: GanttChartSource;
  startValue: number;
}

export interface DateOffscreenIndicator {
  count: number;
  targetValue: number;
}

export interface MinimapItem {
  key: string;
  leftPercent: number;
  widthPercent: number;
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

export function timelineOffscreenBarIndicators(
  entries: GanttChartEntry[],
  visibleStartValue: number,
  visibleEndValue: number
): { left: DateOffscreenIndicator | null; right: DateOffscreenIndicator | null } {
  const leftEntries = entries.filter((entry) => entry.endValue < visibleStartValue);
  const rightEntries = entries.filter((entry) => entry.startValue > visibleEndValue);
  const leftTarget = leftEntries.length > 0 ? Math.max(...leftEntries.map((entry) => entry.endValue)) : null;
  const rightTarget = rightEntries.length > 0 ? Math.min(...rightEntries.map((entry) => entry.startValue)) : null;

  return {
    left: leftTarget === null ? null : { count: leftEntries.length, targetValue: leftTarget },
    right: rightTarget === null ? null : { count: rightEntries.length, targetValue: rightTarget }
  };
}

export function minimapItemsForEntries(entries: GanttChartEntry[], axisStart: number, axisEnd: number): MinimapItem[] {
  const span = Math.max(1, axisEnd - axisStart + 1);

  return entries.map((entry) => ({
    key: entryKey(entry),
    leftPercent: clamp(((entry.startValue - axisStart) / span) * 100, 0, 100),
    widthPercent: clamp(((entry.endValue - entry.startValue + 1) / span) * 100, 0.8, 100)
  }));
}

export function minimapViewportRange(
  axisStart: number,
  axisEnd: number,
  visibleStartValue: number,
  visibleEndValue: number
): { leftPercent: number; widthPercent: number } {
  const span = Math.max(1, axisEnd - axisStart + 1);
  const leftPercent = clamp(((visibleStartValue - axisStart) / span) * 100, 0, 100);
  const widthPercent = clamp(((visibleEndValue - visibleStartValue) / span) * 100, 2, 100 - leftPercent);

  return { leftPercent, widthPercent };
}

export function chronicleNavigationTarget(entries: GanttChartEntry[], axisStart: number, axisEnd: number): number | null {
  if (entries.length === 0) return null;

  const sortedMidpoints = entries
    .map((entry) => (entry.startValue + entry.endValue) / 2)
    .sort((a, b) => a - b);
  const midpoint = sortedMidpoints[Math.floor(sortedMidpoints.length / 2)] ?? (axisStart + axisEnd) / 2;

  return clamp(midpoint, axisStart, axisEnd);
}

export function dateOffscreenBarIndicators(
  entries: GanttChartEntry[],
  visibleStartValue: number,
  visibleEndValue: number
): { left: DateOffscreenIndicator | null; right: DateOffscreenIndicator | null } {
  const leftEntries = entries.filter((entry) => entry.endValue < visibleStartValue);
  const rightEntries = entries.filter((entry) => entry.startValue > visibleEndValue);
  const leftTarget = leftEntries.length > 0 ? Math.max(...leftEntries.map((entry) => entry.endValue)) : null;
  const rightTarget = rightEntries.length > 0 ? Math.min(...rightEntries.map((entry) => entry.startValue)) : null;

  return {
    left: leftTarget === null ? null : { count: leftEntries.length, targetValue: leftTarget },
    right: rightTarget === null ? null : { count: rightEntries.length, targetValue: rightTarget }
  };
}

export function dateNavigationTarget(entries: GanttChartEntry[], axisStart: number, axisEnd: number): number {
  const today = currentDateDay();
  if (today >= axisStart && today <= axisEnd) return today;
  if (entries.length === 0) return clamp(today, axisStart, axisEnd);

  return entries.reduce((nearest, entry) => {
    const nearestDistance = Math.min(Math.abs(nearest.startValue - today), Math.abs(nearest.endValue - today));
    const entryDistance = Math.min(Math.abs(entry.startValue - today), Math.abs(entry.endValue - today));
    return entryDistance < nearestDistance ? entry : nearest;
  }, entries[0]).startValue;
}

export function dateFillOffset(): number {
  return 10;
}

export function dateFillHeight(): number {
  return 18;
}

export function entryKey(entry: GanttChartEntry): string {
  return `${entry.path}:${entry.dateKind ?? "default"}`;
}

export function dateKindPatch(entry: GanttChartEntry): { dateKind: GanttChartDateKind } | Record<string, never> {
  return entry.dateKind ? { dateKind: entry.dateKind } : {};
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
      (preview.dateKind ?? "planned") === (entry.dateKind ?? "planned")
  );
}

export function previewEntryForDrag(entry: GanttChartEntry, preview: DragPreview | null): GanttChartEntry {
  if (
    !preview ||
    preview.path !== entry.path ||
    (preview.dateKind ?? "planned") !== (entry.dateKind ?? "planned")
  ) return entry;

  const startLabel = preview.source === "date"
    ? dayToDate(preview.startValue)
    : formatAxisValue(preview.startValue, "chronicle");
  const endLabel = preview.source === "date"
    ? dayToDate(preview.endValue)
    : formatAxisValue(preview.endValue, "chronicle");

  return {
    ...entry,
    endLabel,
    endValue: preview.endValue,
    startLabel,
    startValue: preview.startValue
  };
}

export function formatDateKindLabel(kind: GanttChartDateKind | undefined, t: Translator): string {
  return kind === "actual" ? t("chronicle.actualDate") : t("chronicle.plannedDate");
}

export function timelineBounds(
  entries: GanttChartEntry[],
  tickInterval: number,
  source: GanttChartSource,
  dateScale: DateScale | null
): { axisEnd: number; axisStart: number } {
  if (entries.length === 0) {
    const today = source === "date" ? currentDateDay() : 1;
    if (source === "date" && dateScale) {
      const start = previousDateUnit(today, dateScale.unit);
      let end = start;
      for (let i = 0; i < 8; i += 1) end = nextDateUnit(end, dateScale.unit);

      return { axisEnd: end - 1, axisStart: start };
    }

    return {
      axisEnd: today + tickInterval * 4,
      axisStart: today - tickInterval
    };
  }

  const starts = entries.map((entry) => entry.startValue);
  const ends = entries.map((entry) => entry.endValue);
  const today = source === "date" ? currentDateDay() : null;
  const min = Math.min(...starts, ...(today === null ? [] : [today]));
  const max = Math.max(...ends, ...(today === null ? [] : [today]));
  const padding = source === "date"
    ? Math.max(3, Math.ceil((max - min + 1) * 0.18))
    : Math.max(1, Math.ceil((max - min + 1) * 0.06));
  const paddedStart = min - padding;
  const paddedEnd = max + padding;

  if (source === "date" && dateScale) {
    return {
      axisEnd: nextDateUnit(paddedEnd, dateScale.unit) - 1,
      axisStart: previousDateUnit(paddedStart, dateScale.unit)
    };
  }

  const boundsInterval = chronicleAxisTickInterval(tickInterval);
  const startYear = Math.floor(axisToYear(paddedStart) / boundsInterval) * boundsInterval - boundsInterval;
  const endYear = Math.ceil(axisToYear(paddedEnd) / boundsInterval) * boundsInterval + boundsInterval;

  return {
    axisEnd: yearToAxis(endYear === 0 ? boundsInterval : endYear),
    axisStart: yearToAxis(startYear === 0 ? -boundsInterval : startYear)
  };
}

export function buildTicks(
  axisStart: number,
  axisEnd: number,
  interval: number,
  source: GanttChartSource,
  dateScale: DateScale | null
): number[] {
  if (source === "date") return buildDateTicks(axisStart, axisEnd, dateGuideUnit(dateScale ?? DATE_SCALES[2]));

  return buildChronicleTicks(axisStart, axisEnd, chronicleAxisTickInterval(interval));
}

export function buildGuideTicks(
  axisStart: number,
  axisEnd: number,
  ticks: number[],
  interval: number,
  source: GanttChartSource,
  dateScale: DateScale | null
): ChartGuideTick[] {
  if (source !== "date") {
    const majorTicks = new Set(buildChronicleTicks(axisStart, axisEnd, chronicleMajorGuideInterval(interval)));
    return buildChronicleTicks(axisStart, axisEnd, chronicleMinorGuideInterval(interval))
      .map((value) => ({
        isMajor: majorTicks.has(value),
        value
      }));
  }

  if (!dateScale) return ticks.map((value) => ({ isMajor: false, value }));

  const majorTicks = new Set(buildDateTicks(axisStart, axisEnd, dateMajorGuideUnit(dateScale)));
  return ticks.map((value) => ({
    isMajor: majorTicks.has(value),
    value
  }));
}

export function buildChronicleTicks(axisStart: number, axisEnd: number, interval: number): number[] {
  const first = firstChronicleTickYear(axisToYear(axisStart), interval);
  const endYear = axisToYear(axisEnd);
  const ticks: number[] = [];

  for (let year = first; year <= endYear; year += interval) {
    if (year === 0) continue;
    const tick = yearToAxis(year);
    if (tick < axisStart || tick > axisEnd) continue;
    ticks.push(tick);
  }

  return ticks;
}

export function firstChronicleTickYear(startYear: number, interval: number): number {
  if (interval <= 1) return startYear;
  return Math.ceil(startYear / interval) * interval;
}

export function chronicleAxisTickInterval(interval: number): number {
  return interval === 1 ? 10 : interval;
}

export function chronicleMajorGuideInterval(interval: number): number {
  return interval === 1 ? 10 : 100;
}

export function chronicleMinorGuideInterval(interval: number): number {
  return interval === 100 ? 10 : interval;
}

export function buildDateTicks(axisStart: number, axisEnd: number, unit: DateAxisSegmentUnit): number[] {
  const ticks: number[] = [];
  let cursor = previousDateUnit(axisStart, unit);

  while (cursor <= axisEnd) {
    if (cursor >= axisStart) ticks.push(cursor);
    cursor = nextDateUnit(cursor, unit);
  }

  return ticks;
}

export function dateGuideUnit(scale: DateScale): DateAxisSegmentUnit {
  if (scale.unit === "year") return "month";
  if (scale.unit === "month") return "day";
  return "day";
}

export function dateMajorGuideUnit(scale: DateScale): DateAxisSegmentUnit {
  if (scale.unit === "year") return "year";
  return "month";
}

export function formatRange(entry: GanttChartEntry, source: GanttChartSource, dateScale: DateScale | null): string {
  if (source !== "date" || !dateScale) {
    if (entry.startValue === entry.endValue) return entry.startLabel;
    return `${entry.startLabel} 〜 ${entry.endLabel}`;
  }

  const start = formatDateLabel(entry.startLabel, dateScale.unit);
  const end = formatDateLabel(entry.endLabel, dateScale.unit);

  if (start === end) return start;
  return `${start} 〜 ${end}`;
}

export function formatAxisValue(value: number, source: GanttChartSource): string {
  const year = axisToYear(value);
  return year < 0 ? `−${Math.abs(year)}` : String(year);
}

export function formatScaleValue(value: number, source: GanttChartSource): string {
  if (source === "chronicle") return String(value);
  return DATE_SCALES[value]?.label ?? "月";
}

export function labelWidthForText(text: string): number {
  return text.length * 8 + LABEL_HORIZONTAL_PADDING;
}

export function currentDateDay(): number {
  return dateToDay(new Date().toISOString().slice(0, 10));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function buildDateAxisSegments(
  axisStart: number,
  axisEnd: number,
  unit: DateAxisSegmentUnit
): DateAxisSegment[] {
  const segments: DateAxisSegment[] = [];
  let cursor = startOfDateUnit(axisStart, unit);

  while (cursor <= axisEnd) {
    const next = nextDateUnit(cursor, unit);
    const startValue = Math.max(axisStart, cursor);
    const endValue = Math.min(axisEnd, next - 1);

    if (endValue >= startValue) {
      segments.push({
        endValue,
        label: formatDateAxisSegmentLabel(cursor, unit),
        startValue
      });
    }

    cursor = next;
  }

  return segments;
}

export function buildChronicleAxisSegments(axisStart: number, axisEnd: number, interval: number): DateAxisSegment[] {
  const segments: DateAxisSegment[] = [];
  const first = firstChronicleTickYear(axisToYear(axisStart), interval);
  const endYear = axisToYear(axisEnd);

  for (let year = first; year <= endYear; year += interval) {
    if (year === 0) continue;

    const nextYear = year + interval;
    const startValue = Math.max(axisStart, yearToAxis(year));
    const endValue = Math.min(axisEnd, yearToAxis(nextYear) - 1);

    if (endValue >= startValue) {
      segments.push({
        endValue,
        label: formatChronicleAxisSegmentLabel(year),
        startValue
      });
    }
  }

  return segments;
}

export function startOfDateUnit(value: number, unit: DateAxisSegmentUnit): number {
  const date = new Date(value * 86_400_000);
  if (unit === "day") return value;

  const month = unit === "year"
    ? 0
    : date.getUTCMonth();

  return dateToDay(`${date.getUTCFullYear()}-${String(month + 1).padStart(2, "0")}-01`);
}

export function nextDateUnit(value: number, unit: DateAxisSegmentUnit): number {
  const date = new Date(value * 86_400_000);

  if (unit === "day") return value + 1;

  if (unit === "month") {
    date.setUTCMonth(date.getUTCMonth() + 1, 1);
  } else {
    date.setUTCFullYear(date.getUTCFullYear() + 1, 0, 1);
  }

  return Math.floor(date.getTime() / 86_400_000);
}

export function previousDateUnit(value: number, unit: DateAxisSegmentUnit): number {
  return startOfDateUnit(value, unit);
}

export function dateUnitWidth(scale: DateScale | null): number {
  if (!scale) return DATE_TICK_WIDTH / 30;
  if (scale.unit === "day") return 22;
  if (scale.unit === "year") return 1.2;
  return (DATE_TICK_WIDTH * 3) / 30;
}

export function chronicleUnitWidth(interval: number, tickWidth: number): number {
  if (interval === 1) return tickWidth / 2;
  return tickWidth / interval;
}

export function dateAxisHeightForScale(scale: DateScale | null): number {
  return scale?.unit === "day" ? 69 : 46;
}

export function formatDateAxisSegmentLabel(value: number, unit: DateAxisSegmentUnit): string {
  const date = new Date(value * 86_400_000);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;

  if (unit === "year") return String(year);
  if (unit === "day") return String(date.getUTCDate()).padStart(2, "0");
  return String(month).padStart(2, "0");
}

export function formatChronicleAxisSegmentLabel(year: number): string {
  return year < 0 ? `−${Math.abs(year)}` : String(year);
}

export function formatDateLabel(value: string, unit: DateScaleUnit): string {
  if (unit === "day") return value.slice(8, 10);
  if (unit === "month") return value.slice(5);
  return value;
}

export function isGanttChartSource(value: unknown): value is GanttChartSource {
  return value === "chronicle" || value === "date";
}

export function defaultScaleIndex(source: GanttChartSource): number {
  if (source === "date") return 1;
  return Math.max(0, SCALE_OPTIONS.chronicle.indexOf(10));
}

export function createStablePointerDelta(startClientX: number, unitWidth: number): (clientX: number, _timeStamp?: number) => number {
  let delta = 0;

  return (clientX: number): number => {
    if (!Number.isFinite(clientX) || !Number.isFinite(startClientX) || unitWidth <= 0) return delta;

    const rawDelta = (clientX - startClientX) / unitWidth;

    if (rawDelta >= delta + 0.65) {
      delta = Math.floor(rawDelta + 0.35);
    } else if (rawDelta <= delta - 0.65) {
      delta = Math.ceil(rawDelta - 0.35);
    }

    return delta;
  };
}

export function createAdaptiveChroniclePointerDelta(
  startClientX: number,
  unitWidth: number,
  startTimeStamp: number
): (clientX: number, timeStamp?: number) => number {
  let effectiveDelta = 0;
  let lastClientX = startClientX;
  let lastTimeStamp = Number.isFinite(startTimeStamp) ? startTimeStamp : 0;

  return (clientX: number, timeStamp = lastTimeStamp + 16): number => {
    if (!Number.isFinite(clientX) || !Number.isFinite(lastClientX) || unitWidth <= 0) {
      return Math.round(effectiveDelta);
    }

    const movement = clientX - lastClientX;

    if (movement !== 0) {
      const currentTimeStamp = Number.isFinite(timeStamp) ? timeStamp : lastTimeStamp + 16;
      const elapsed = Math.max(8, currentTimeStamp - lastTimeStamp);
      const speed = Math.abs(movement) / elapsed;
      effectiveDelta += (movement / unitWidth) * chronicleDragSpeedMultiplier(speed);
      lastTimeStamp = currentTimeStamp;
      lastClientX = clientX;
    }

    return Math.round(effectiveDelta);
  };
}

export function chronicleDragSpeedMultiplier(speed: number): number {
  if (!Number.isFinite(speed)) return 1;
  if (speed <= CHRONICLE_FINE_DRAG_SPEED) return CHRONICLE_FINE_DRAG_MULTIPLIER;
  if (speed >= CHRONICLE_FAST_DRAG_SPEED) return CHRONICLE_FAST_DRAG_MULTIPLIER;

  const progress = (speed - CHRONICLE_FINE_DRAG_SPEED) / (CHRONICLE_FAST_DRAG_SPEED - CHRONICLE_FINE_DRAG_SPEED);

  return CHRONICLE_FINE_DRAG_MULTIPLIER + progress * (CHRONICLE_FAST_DRAG_MULTIPLIER - CHRONICLE_FINE_DRAG_MULTIPLIER);
}
