import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent, ReactElement } from "react";

import type { GanttChartDateKind, GanttChartEntry, GanttChartEntryEditKind, GanttChartSource, UpdateGanttChartEntryInput, WorkspaceGanttChart } from "../../shared/ipc";
import { fixedStatusValues } from "../../shared/status";
import { useT, type Translator } from "../i18n";

interface GanttChartViewProps {
  chart?: WorkspaceGanttChart | null;
  charts?: WorkspaceGanttChart[];
  onOpenFile: (path: string) => void;
  onUpdateEntry?: (input: UpdateGanttChartEntryInput) => Promise<void> | void;
}

const ROW_HEIGHT = 38;
const NAME_COLUMN_WIDTH = 180;
const TICK_WIDTH = 72;
const DATE_TICK_WIDTH = 52;
const LABEL_HORIZONTAL_PADDING = 14;
const SCALE_OPTIONS: Record<GanttChartSource, readonly number[]> = {
  chronicle: [1, 25, 50, 100, 200, 500],
  date: [0, 1, 2]
};

const DATE_SCALES = [
  { label: "日", step: 1, unit: "day" },
  { label: "月", step: null, unit: "month" },
  { label: "年", step: null, unit: "year" }
] as const;

type DateScale = typeof DATE_SCALES[number];
type DateScaleUnit = DateScale["unit"];
type DateAxisSegmentUnit = DateScaleUnit | "month" | "year";

interface DateAxisSegment {
  endValue: number;
  label: string;
  startValue: number;
}

interface ChartGuideTick {
  isMajor: boolean;
  value: number;
}

interface ChartRow {
  entries: GanttChartEntry[];
  fileName: string;
  key: string;
  path: string;
  statuses: string[];
}

interface DragPreview {
  dateKind?: GanttChartDateKind;
  endValue: number;
  path: string;
  source: GanttChartSource;
  startValue: number;
}

type ChronicleSortKey = "start-asc" | "start-desc" | "name-asc" | "name-desc";

export function GanttChartView({ chart = null, charts = [], onOpenFile, onUpdateEntry }: GanttChartViewProps): ReactElement {
  const t = useT();
  const availableCharts = useMemo(() => chartsForView(chart, charts), [chart, charts]);
  const [selectedChartId, setSelectedChartId] = useState(availableCharts[0]?.id ?? "chronicle");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<ChronicleSortKey>("start-asc");
  const [statusFilter, setStatusFilter] = useState("");
  const [scaleIndex, setScaleIndex] = useState(() => defaultScaleIndex((chart ?? availableCharts[0])?.source ?? "chronicle"));
  const [scrollLeft, setScrollLeft] = useState(0);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const chartRef = useRef<HTMLDivElement | null>(null);
  const previousAxisStartRef = useRef<number | null>(null);
  const activeChart = chart ?? availableCharts.find((candidate) => candidate.id === selectedChartId) ?? availableCharts[0] ?? null;
  const activeSource = activeChart && isGanttChartSource(activeChart.source) ? activeChart.source : "chronicle";
  const allEntries = visibleEntries(activeChart);
  const statusOptions = useMemo(() => statusValuesForEntries(allEntries), [allEntries]);
  const scaleOptions = SCALE_OPTIONS[activeSource];
  const tickInterval = scaleOptions[Math.min(scaleIndex, scaleOptions.length - 1)] ?? scaleOptions[0] ?? 100;
  const dateScale = activeSource === "date" ? DATE_SCALES[tickInterval] ?? DATE_SCALES[2] : null;
  const rows = useMemo(
    () => sortRows(filterRows(buildChartRows(allEntries, activeSource), query, activeSource === "date" ? statusFilter : ""), sortKey),
    [activeSource, allEntries, query, sortKey, statusFilter]
  );
  const entries = useMemo(() => rows.flatMap((row) => row.entries), [rows]);
  const computedBounds = timelineBounds(entries, tickInterval, activeSource, dateScale);
  const boundsKey = `${activeChart?.id ?? "none"}:${activeSource}:${tickInterval}:${query}`;
  const { axisEnd, axisStart } = useStableTimelineBounds(computedBounds, boundsKey);
  const axisSpan = Math.max(1, axisEnd - axisStart + 1);
  const tickWidth = activeSource === "date" ? DATE_TICK_WIDTH : TICK_WIDTH;
  const unitWidth = activeSource === "date" ? dateUnitWidth(dateScale) : chronicleUnitWidth(tickInterval, tickWidth);
  const timelineWidth = Math.max(720, axisSpan * unitWidth);
  const ticks = useMemo(
    () => buildTicks(axisStart, axisEnd, tickInterval, activeSource, dateScale),
    [activeSource, axisEnd, axisStart, dateScale, tickInterval]
  );
  const guideTicks = useMemo(
    () => buildGuideTicks(axisStart, axisEnd, ticks, tickInterval, activeSource, dateScale),
    [activeSource, axisEnd, axisStart, dateScale, tickInterval, ticks]
  );
  const dateAxisHeight = activeSource === "date" ? dateAxisHeightForScale(dateScale) : 34;

  useLayoutEffect(() => {
    const previousAxisStart = previousAxisStartRef.current;
    previousAxisStartRef.current = axisStart;

    if (previousAxisStart === null || previousAxisStart === axisStart) return;

    const chartElement = chartRef.current;

    if (!chartElement) return;

    const delta = (previousAxisStart - axisStart) * unitWidth;

    if (delta === 0) return;

    const nextScrollLeft = Math.max(0, chartElement.scrollLeft + delta);
    chartElement.scrollLeft = nextScrollLeft;
    setScrollLeft(nextScrollLeft);
  }, [axisStart, unitWidth]);

  useEffect(() => {
    if (availableCharts.some((candidate) => candidate.id === selectedChartId)) return;
    setSelectedChartId(availableCharts[0]?.id ?? "chronicle");
  }, [availableCharts, selectedChartId]);

  useEffect(() => {
    setDragPreview(null);
  }, [activeChart?.id]);

  useEffect(() => {
    if (activeSource !== "date" || statusFilter === "" || statusOptions.includes(statusFilter)) return;
    setStatusFilter("");
  }, [activeSource, statusFilter, statusOptions]);

  const startEntryEdit = (
    event: PointerEvent<HTMLElement>,
    entry: GanttChartEntry,
    kind: GanttChartEntryEditKind
  ): void => {
    if (event.button > 0 || !onUpdateEntry) return;

    event.preventDefault();
    event.stopPropagation();

    const originalStartValue = entry.startValue;
    const originalEndValue = entry.endValue;
    const startClientX = event.clientX;
    const target = event.currentTarget;
    const snapUnit = activeSource === "chronicle" ? tickInterval : 1;
    const dragSteps = createStablePointerDelta(startClientX, unitWidth * snapUnit);
    let currentPreviewRange = { endValue: originalEndValue, startValue: originalStartValue };

    if (target.setPointerCapture) {
      target.setPointerCapture(event.pointerId);
    }

    const nextRangeForDelta = (delta: number): { endValue: number; startValue: number } => {
      if (kind === "move") {
        return {
          endValue: originalEndValue + delta,
          startValue: originalStartValue + delta
        };
      }

      if (kind === "resize-start") {
        return {
          endValue: originalEndValue,
          startValue: Math.min(originalStartValue + delta, originalEndValue)
        };
      }

      return {
        endValue: Math.max(originalStartValue, originalEndValue + delta),
        startValue: originalStartValue
      };
    };

    const move = (moveEvent: globalThis.PointerEvent): void => {
      const delta = dragSteps(moveEvent.clientX) * snapUnit;
      const nextRange = nextRangeForDelta(delta);

      if (
        currentPreviewRange.endValue === nextRange.endValue &&
        currentPreviewRange.startValue === nextRange.startValue
      ) {
        return;
      }

      currentPreviewRange = nextRange;
      setDragPreview({
        path: entry.path,
        source: activeSource,
        ...dateKindPatch(entry),
        ...nextRange
      });
    };

    const stop = (stopEvent: globalThis.PointerEvent): void => {
      const delta = dragSteps(stopEvent.clientX) * snapUnit;
      const nextRange = nextRangeForDelta(delta);

      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", cancel);

      if (target.hasPointerCapture?.(event.pointerId)) {
        target.releasePointerCapture(event.pointerId);
      }

      if (delta === 0) {
        setDragPreview(null);
        return;
      }

      void Promise.resolve(onUpdateEntry({
        endValue: nextRange.endValue,
        kind,
        originalEndValue,
        originalStartValue,
        path: entry.path,
        ...dateKindPatch(entry),
        source: activeSource,
        startValue: nextRange.startValue
      })).finally(() => setDragPreview(null));
    };

    const cancel = (): void => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", cancel);
      setDragPreview(null);
    };

    setDragPreview({
      endValue: entry.endValue,
      path: entry.path,
      source: activeSource,
      ...dateKindPatch(entry),
      startValue: entry.startValue
    });
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", cancel);
  };

  const startChartPan = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button > 0) return;
    if (event.target instanceof Element && event.target.closest(".chronicle-fill, .chronicle-file-name")) return;

    const chartElement = event.currentTarget;
    const startClientX = event.clientX;
    const startScrollLeft = chartElement.scrollLeft;

    event.preventDefault();

    if (chartElement.setPointerCapture) {
      chartElement.setPointerCapture(event.pointerId);
    }

    const move = (moveEvent: globalThis.PointerEvent): void => {
      const nextScrollLeft = Math.max(0, startScrollLeft - (moveEvent.clientX - startClientX));
      chartElement.scrollLeft = nextScrollLeft;
      setScrollLeft(nextScrollLeft);
    };

    const stop = (): void => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);

      if (chartElement.hasPointerCapture?.(event.pointerId)) {
        chartElement.releasePointerCapture(event.pointerId);
      }
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  };

  return (
    <div className="chronicle-panel">
      <div className="chronicle-toolbar">
        <div className="chronicle-source-buttons" aria-label={t("chronicle.source")}>
          {availableCharts.map((candidate) => (
            <button
              aria-pressed={candidate.id === activeChart?.id}
              className={`chronicle-source-button${candidate.id === activeChart?.id ? " active" : ""}`}
              key={candidate.id}
              onClick={() => {
                setSelectedChartId(candidate.id);
                setScaleIndex(defaultScaleIndex(candidate.source));
              }}
              type="button"
            >
              {candidate.source}
            </button>
          ))}
        </div>
        <label className="chronicle-search">
          <span>{t("chronicle.search")}</span>
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("chronicle.searchPlaceholder")}
            type="search"
            value={query}
          />
        </label>
        <label className="chronicle-search chronicle-sort">
          <span>{t("chronicle.sort")}</span>
          <select onChange={(event) => setSortKey(event.target.value as ChronicleSortKey)} value={sortKey}>
            <option value="start-asc">{t("chronicle.sortStartAsc")}</option>
            <option value="start-desc">{t("chronicle.sortStartDesc")}</option>
            <option value="name-asc">{t("chronicle.sortNameAsc")}</option>
            <option value="name-desc">{t("chronicle.sortNameDesc")}</option>
          </select>
        </label>
        {activeSource === "date" && statusOptions.length > 0 ? (
          <label className="chronicle-search chronicle-status-filter">
            <span>{t("chronicle.status")}</span>
            <select onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
              <option value="">{t("chronicle.statusAll")}</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="chronicle-scale" aria-label={t("chronicle.scale")}>
          <button
            aria-label={t("chronicle.scaleDecrease")}
            className="chronicle-scale-button"
            disabled={scaleIndex === 0}
            onClick={() => setScaleIndex((current) => Math.max(0, current - 1))}
            type="button"
          >
            -
          </button>
          <span className="chronicle-scale-value">{formatScaleValue(tickInterval, activeSource)}</span>
          <button
            aria-label={t("chronicle.scaleIncrease")}
            className="chronicle-scale-button"
            disabled={scaleIndex >= scaleOptions.length - 1}
            onClick={() => setScaleIndex((current) => Math.min(scaleOptions.length - 1, current + 1))}
            type="button"
          >
            +
          </button>
        </div>
      </div>
      {!activeChart ? (
        <div className="frontmatter-field-empty">{t("chronicle.empty")}</div>
      ) : (
        <div
          className="chronicle-chart"
          onPointerDown={startChartPan}
          onScroll={(event) => setScrollLeft(event.currentTarget.scrollLeft)}
          ref={chartRef}
        >
          <div className="chronicle-grid" style={{ width: NAME_COLUMN_WIDTH + timelineWidth }}>
            <div className="chronicle-name-column" style={{ width: NAME_COLUMN_WIDTH }}>
              <div className="chronicle-name-header" style={{ height: dateAxisHeight }} />
              {rows.length === 0 ? (
                <div className="chronicle-file-name-row chronicle-file-name-row--empty">
                  <div className="chronicle-file-name chronicle-file-name--empty">{t("chronicle.empty")}</div>
                </div>
              ) : (
                rows.map((row) => (
                  <div
                    className={`chronicle-file-name-row${activeSource === "date" ? " chronicle-file-name-row--date" : ""}`}
                    key={row.key}
                  >
                    <button
                      className="chronicle-file-name"
                      onClick={() => onOpenFile(row.path)}
                      title={row.path}
                      type="button"
                    >
                      {row.fileName}
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="chronicle-timeline" style={{ marginLeft: NAME_COLUMN_WIDTH, width: timelineWidth }}>
              {activeSource === "date" ? (
                <DateAxis axisEnd={axisEnd} axisStart={axisStart} scale={dateScale ?? DATE_SCALES[2]} unitWidth={unitWidth} width={timelineWidth} />
              ) : (
                <div className="chronicle-axis" style={{ width: timelineWidth }}>
                  {ticks.map((tick, index) => (
                    <span
                      className={`chronicle-axis-tick${index === 0 ? " chronicle-axis-tick--start" : ""}${index === ticks.length - 1 ? " chronicle-axis-tick--end" : ""}`}
                      key={tick}
                      style={{ left: (tick - axisStart) * unitWidth }}
                    >
                      {formatAxisValue(tick, activeSource)}
                    </span>
                  ))}
                </div>
              )}
              <div
                className={`chronicle-tracks${activeSource === "date" ? " chronicle-tracks--date" : ""}`}
                style={{
                  height: Math.max(1, rows.length) * ROW_HEIGHT,
                  width: timelineWidth
                } as CSSProperties}
              >
                <ChartGuideLines axisStart={axisStart} rowCount={Math.max(1, rows.length)} ticks={guideTicks} unitWidth={unitWidth} />
                {activeSource === "date" ? (
                  <TodayLine axisEnd={axisEnd} axisStart={axisStart} unitWidth={unitWidth} />
                ) : null}
                {rows.map((row, index) => row.entries.map((entry) => {
                    const previewEntry = previewEntryForDrag(entry, dragPreview);
                    const left = Math.max(0, (previewEntry.startValue - axisStart) * unitWidth);
                    const isSingleValue = previewEntry.startValue === previewEntry.endValue;
                    const rangeLabel = formatRange(previewEntry, activeSource, dateScale);
                    const labelWidth = labelWidthForText(rangeLabel);
                    const naturalWidth = isSingleValue ? unitWidth : (previewEntry.endValue - previewEntry.startValue + 1) * unitWidth;
                    const width = activeSource === "date"
                      ? Math.max(4, naturalWidth)
                      : isSingleValue
                        ? Math.max(46, naturalWidth)
                        : Math.max(28, naturalWidth);
                    const maxLabelLeft = Math.max(0, width - labelWidth);
                    const labelLeft = isSingleValue
                      ? (width - labelWidth) / 2
                      : Math.max(7, Math.min(maxLabelLeft, scrollLeft - left + 7));
                    const dateKind = entry.dateKind ?? "planned";
                    const statusLabel = activeSource === "date" && dateKind === "actual"
                      ? statusLabelForEntry(entry)
                      : "";
                    const statusLabelWidth = statusLabel ? labelWidthForText(statusLabel) : 0;
                    const visibleTimelineStart = Math.max(0, scrollLeft - NAME_COLUMN_WIDTH);
                    const statusLabelLeft = Math.max(
                      5,
                      Math.min(Math.max(5, width - statusLabelWidth - 5), visibleTimelineStart - left + 5)
                    );

                    return (
                      <button
                        aria-label={`${entry.fileName} ${formatDateKindLabel(entry.dateKind, t)} ${rangeLabel}${statusLabel ? ` ${statusLabel}` : ""}`}
                        className={`chronicle-fill${isSingleValue ? " chronicle-fill--single" : ""}${activeSource === "date" ? ` chronicle-fill--date chronicle-fill--${dateKind}` : ""}${isPreviewForEntry(entry, dragPreview, activeSource) ? " chronicle-fill--dragging" : ""}`}
                        data-date-kind={entry.dateKind}
                        key={entryKey(entry)}
                        onPointerDown={(event) => startEntryEdit(event, entry, "move")}
                        style={{
                          height: activeSource === "date" ? dateFillHeight() : undefined,
                          left,
                          top: index * ROW_HEIGHT + (activeSource === "date" ? dateFillOffset() : 0),
                          width
                        }}
                        title={`${entry.fileName}${activeSource === "date" ? ` ${formatDateKindLabel(entry.dateKind, t)}: ` : " "}${rangeLabel}`}
                        type="button"
                      >
                        <span
                          aria-label={t("chronicle.resizeStart")}
                          className="chronicle-fill-resize chronicle-fill-resize--start"
                          onPointerDown={(event) => startEntryEdit(event, entry, "resize-start")}
                          role="separator"
                        />
                        <span className="chronicle-fill-label" style={{ left: labelLeft, width: labelWidth }}>{rangeLabel}</span>
                        {statusLabel ? (
                          <span className="chronicle-fill-status" style={{ left: statusLabelLeft, maxWidth: Math.max(statusLabelWidth, width - 10) }}>
                            {statusLabel}
                          </span>
                        ) : null}
                        <span
                          aria-label={t("chronicle.resizeEnd")}
                          className="chronicle-fill-resize chronicle-fill-resize--end"
                          onPointerDown={(event) => startEntryEdit(event, entry, "resize-end")}
                          role="separator"
                        />
                      </button>
                    );
                  }))}
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="chronicle-summary">
        {activeChart ? t("chronicle.summary", { count: rows.length, source: activeChart.source }) : t("chronicle.title")}
      </div>
    </div>
  );
}

function DateAxis({
  axisEnd,
  axisStart,
  scale,
  unitWidth,
  width
}: {
  axisEnd: number;
  axisStart: number;
  scale: DateScale;
  unitWidth: number;
  width: number;
}): ReactElement {
  const years = buildDateAxisSegments(axisStart, axisEnd, "year");
  const months = buildDateAxisSegments(axisStart, axisEnd, "month");
  const units = buildDateAxisSegments(axisStart, axisEnd, scale.unit);
  const rows = scale.unit === "day"
    ? [years, months, units]
    : scale.unit === "year"
      ? [units]
      : [years, units];

  return (
    <div className="chronicle-axis chronicle-axis--date" style={{ width }}>
      {rows.map((row, rowIndex) => (
        <div
          className={`chronicle-axis-row${rowIndex < rows.length - 1 ? " chronicle-axis-row--divider" : ""}`}
          key={`date-axis-row-${rowIndex}`}
        >
          {row.map((segment) => (
            <span
              className="chronicle-axis-cell"
              key={`${rowIndex}-${segment.label}-${segment.startValue}`}
              style={{
                left: (segment.startValue - axisStart) * unitWidth,
                width: Math.max(1, (segment.endValue - segment.startValue + 1) * unitWidth)
              }}
            >
              {segment.label}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function ChartGuideLines({
  axisStart,
  rowCount,
  ticks,
  unitWidth
}: {
  axisStart: number;
  rowCount: number;
  ticks: ChartGuideTick[];
  unitWidth: number;
}): ReactElement {
  const rowLines = Array.from({ length: rowCount + 1 }, (_value, index) => index * ROW_HEIGHT);

  return (
    <div aria-hidden="true" className="chronicle-guide-lines">
      {ticks.map((tick) => (
        <span
          className={`chronicle-guide-line${tick.isMajor ? " chronicle-guide-line--major" : ""}`}
          key={`tick-${tick.value}`}
          style={{ left: (tick.value - axisStart) * unitWidth }}
        />
      ))}
      {rowLines.map((top) => (
        <span
          className="chronicle-guide-row-line"
          key={`row-${top}`}
          style={{ top }}
        />
      ))}
    </div>
  );
}

function TodayLine({
  axisEnd,
  axisStart,
  unitWidth
}: {
  axisEnd: number;
  axisStart: number;
  unitWidth: number;
}): ReactElement | null {
  const today = dateToDay(new Date().toISOString().slice(0, 10));

  if (today < axisStart || today > axisEnd) return null;

  return (
    <span
      aria-hidden="true"
      className="chronicle-today-line"
      style={{ left: (today - axisStart + 0.5) * unitWidth }}
    />
  );
}

function visibleEntries(chart: WorkspaceGanttChart | null): GanttChartEntry[] {
  if (!chart) return [];
  return chart.entries;
}

function chartsForView(chart: WorkspaceGanttChart | null, charts: WorkspaceGanttChart[]): WorkspaceGanttChart[] {
  if (chart) return [chart];
  return charts;
}

function buildChartRows(entries: GanttChartEntry[], source: GanttChartSource): ChartRow[] {
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

function filterRows(rows: ChartRow[], query: string, statusFilter: string): ChartRow[] {
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

function sortRows(rows: ChartRow[], sortKey: ChronicleSortKey): ChartRow[] {
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

function rowStartValue(row: ChartRow): number {
  return Math.min(...row.entries.map((entry) => entry.startValue));
}

function rowEndValue(row: ChartRow): number {
  return Math.max(...row.entries.map((entry) => entry.endValue));
}

function sortDateRowEntries(entries: GanttChartEntry[]): GanttChartEntry[] {
  return [...entries].sort((a, b) => dateKindOrder(a.dateKind) - dateKindOrder(b.dateKind));
}

function dateKindOrder(kind: GanttChartDateKind | undefined): number {
  return kind === "actual" ? 1 : 0;
}

function mergeStatuses(current: string[], next: string[]): string[] {
  return [...new Set([...current, ...next])];
}

function statusValuesForEntries(entries: GanttChartEntry[]): string[] {
  void entries;
  return [...fixedStatusValues];
}

function statusLabelForEntry(entry: GanttChartEntry): string {
  return (entry.statuses ?? [])
    .filter((status) => fixedStatusValues.includes(status as typeof fixedStatusValues[number]))
    .join(" / ");
}

function dateFillOffset(): number {
  return 10;
}

function dateFillHeight(): number {
  return 18;
}

function entryKey(entry: GanttChartEntry): string {
  return `${entry.path}:${entry.dateKind ?? "default"}`;
}

function dateKindPatch(entry: GanttChartEntry): { dateKind: GanttChartDateKind } | Record<string, never> {
  return entry.dateKind ? { dateKind: entry.dateKind } : {};
}

function isPreviewForEntry(
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

function useStableTimelineBounds(
  computedBounds: { axisEnd: number; axisStart: number },
  key: string
): { axisEnd: number; axisStart: number } {
  const [stable, setStable] = useState<{ bounds: { axisEnd: number; axisStart: number }; key: string } | null>(null);

  useLayoutEffect(() => {
    setStable((current) => {
      if (!current || current.key !== key) {
        return { bounds: computedBounds, key };
      }

      const nextBounds = {
        axisEnd: Math.max(current.bounds.axisEnd, computedBounds.axisEnd),
        axisStart: Math.min(current.bounds.axisStart, computedBounds.axisStart)
      };

      if (
        nextBounds.axisEnd === current.bounds.axisEnd &&
        nextBounds.axisStart === current.bounds.axisStart
      ) {
        return current;
      }

      return { bounds: nextBounds, key };
    });
  }, [computedBounds.axisEnd, computedBounds.axisStart, key]);

  if (!stable || stable.key !== key) return computedBounds;

  return stable.bounds;
}

function previewEntryForDrag(entry: GanttChartEntry, preview: DragPreview | null): GanttChartEntry {
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

function formatDateKindLabel(kind: GanttChartDateKind | undefined, t: Translator): string {
  return kind === "actual" ? t("chronicle.actualDate") : t("chronicle.plannedDate");
}

function timelineBounds(
  entries: GanttChartEntry[],
  tickInterval: number,
  source: GanttChartSource,
  dateScale: DateScale | null
): { axisEnd: number; axisStart: number } {
  if (entries.length === 0) {
    const today = source === "date" ? dateToDay(new Date().toISOString().slice(0, 10)) : 1;
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
  const min = Math.min(...starts);
  const max = Math.max(...ends);
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

function buildTicks(
  axisStart: number,
  axisEnd: number,
  interval: number,
  source: GanttChartSource,
  dateScale: DateScale | null
): number[] {
  if (source === "date") return buildDateTicks(axisStart, axisEnd, dateGuideUnit(dateScale ?? DATE_SCALES[2]));

  return buildChronicleTicks(axisStart, axisEnd, chronicleAxisTickInterval(interval));
}

function buildGuideTicks(
  axisStart: number,
  axisEnd: number,
  ticks: number[],
  interval: number,
  source: GanttChartSource,
  dateScale: DateScale | null
): ChartGuideTick[] {
  if (source !== "date") {
    const majorTicks = new Set(ticks);
    return buildChronicleTicks(axisStart, axisEnd, chronicleGuideInterval(interval))
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

function buildChronicleTicks(axisStart: number, axisEnd: number, interval: number): number[] {
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

function firstChronicleTickYear(startYear: number, interval: number): number {
  if (interval <= 1) return startYear;
  return Math.ceil(startYear / interval) * interval;
}

function chronicleAxisTickInterval(interval: number): number {
  return interval === 1 ? 10 : interval;
}

function chronicleGuideInterval(interval: number): number {
  return interval;
}

function buildDateTicks(axisStart: number, axisEnd: number, unit: DateAxisSegmentUnit): number[] {
  const ticks: number[] = [];
  let cursor = previousDateUnit(axisStart, unit);

  while (cursor <= axisEnd) {
    if (cursor >= axisStart) ticks.push(cursor);
    cursor = nextDateUnit(cursor, unit);
  }

  return ticks;
}

function dateGuideUnit(scale: DateScale): DateAxisSegmentUnit {
  if (scale.unit === "year") return "month";
  if (scale.unit === "month") return "day";
  return "day";
}

function dateMajorGuideUnit(scale: DateScale): DateAxisSegmentUnit {
  if (scale.unit === "year") return "year";
  return "month";
}

function formatRange(entry: GanttChartEntry, source: GanttChartSource, dateScale: DateScale | null): string {
  if (source !== "date" || !dateScale) {
    if (entry.startValue === entry.endValue) return entry.startLabel;
    return `${entry.startLabel} 〜 ${entry.endLabel}`;
  }

  const start = formatDateLabel(entry.startLabel, dateScale.unit);
  const end = formatDateLabel(entry.endLabel, dateScale.unit);

  if (start === end) return start;
  return `${start} 〜 ${end}`;
}

function formatAxisValue(value: number, source: GanttChartSource): string {
  const year = axisToYear(value);
  return year < 0 ? `−${Math.abs(year)}` : String(year);
}

function axisToYear(value: number): number {
  return value < 0 ? value : value + 1;
}

function yearToAxis(year: number): number {
  if (year === 0) return 0;
  return year < 0 ? year : year - 1;
}

function formatScaleValue(value: number, source: GanttChartSource): string {
  if (source === "chronicle") return String(value);
  return DATE_SCALES[value]?.label ?? "月";
}

function labelWidthForText(text: string): number {
  return text.length * 8 + LABEL_HORIZONTAL_PADDING;
}

function dayToDate(value: number): string {
  return new Date(value * 86_400_000).toISOString().slice(0, 10);
}

function dateToDay(value: string): number {
  return Math.floor(new Date(`${value}T00:00:00.000Z`).getTime() / 86_400_000);
}

function buildDateAxisSegments(
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

function startOfDateUnit(value: number, unit: DateAxisSegmentUnit): number {
  const date = new Date(value * 86_400_000);
  if (unit === "day") return value;

  const month = unit === "year"
    ? 0
    : date.getUTCMonth();

  return dateToDay(`${date.getUTCFullYear()}-${String(month + 1).padStart(2, "0")}-01`);
}

function nextDateUnit(value: number, unit: DateAxisSegmentUnit): number {
  const date = new Date(value * 86_400_000);

  if (unit === "day") return value + 1;

  if (unit === "month") {
    date.setUTCMonth(date.getUTCMonth() + 1, 1);
  } else {
    date.setUTCFullYear(date.getUTCFullYear() + 1, 0, 1);
  }

  return Math.floor(date.getTime() / 86_400_000);
}

function previousDateUnit(value: number, unit: DateAxisSegmentUnit): number {
  return startOfDateUnit(value, unit);
}

function dateUnitWidth(scale: DateScale | null): number {
  if (!scale) return DATE_TICK_WIDTH / 30;
  if (scale.unit === "day") return 22;
  if (scale.unit === "year") return 1.2;
  return (DATE_TICK_WIDTH * 3) / 30;
}

function chronicleUnitWidth(interval: number, tickWidth: number): number {
  if (interval === 1) return tickWidth / 2;
  return tickWidth / interval;
}

function dateAxisHeightForScale(scale: DateScale | null): number {
  return scale?.unit === "day" ? 69 : 46;
}

function formatDateAxisSegmentLabel(value: number, unit: DateAxisSegmentUnit): string {
  const date = new Date(value * 86_400_000);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;

  if (unit === "year") return String(year);
  if (unit === "day") return String(date.getUTCDate()).padStart(2, "0");
  return String(month).padStart(2, "0");
}

function formatDateLabel(value: string, unit: DateScaleUnit): string {
  if (unit === "day") return value.slice(8, 10);
  if (unit === "month") return value.slice(5);
  return value;
}

function isGanttChartSource(value: unknown): value is GanttChartSource {
  return value === "chronicle" || value === "date";
}

function defaultScaleIndex(source: GanttChartSource): number {
  if (source === "date") return 1;
  return Math.max(0, SCALE_OPTIONS.chronicle.indexOf(50));
}

function createStablePointerDelta(startClientX: number, unitWidth: number): (clientX: number) => number {
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
