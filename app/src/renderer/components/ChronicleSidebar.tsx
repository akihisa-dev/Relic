import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, PointerEvent, ReactElement } from "react";

import type { GanttChartEntry, GanttChartEntryEditKind, GanttChartSource, UpdateGanttChartEntryInput, WorkspaceGanttChart } from "../../shared/ipc";
import { useT } from "../i18n";

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
  chronicle: [25, 50, 100, 200, 500],
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

interface DragPreview {
  endValue: number;
  path: string;
  source: GanttChartSource;
  startValue: number;
}

export function GanttChartView({ chart = null, charts = [], onOpenFile, onUpdateEntry }: GanttChartViewProps): ReactElement {
  const t = useT();
  const availableCharts = useMemo(() => chartsForView(chart, charts), [chart, charts]);
  const [selectedChartId, setSelectedChartId] = useState(availableCharts[0]?.id ?? "chronicle");
  const [query, setQuery] = useState("");
  const [scaleIndex, setScaleIndex] = useState(1);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const activeChart = chart ?? availableCharts.find((candidate) => candidate.id === selectedChartId) ?? availableCharts[0] ?? null;
  const activeSource = activeChart && isGanttChartSource(activeChart.source) ? activeChart.source : "chronicle";
  const scaleOptions = SCALE_OPTIONS[activeSource];
  const tickInterval = scaleOptions[Math.min(scaleIndex, scaleOptions.length - 1)] ?? scaleOptions[0] ?? 100;
  const dateScale = activeSource === "date" ? DATE_SCALES[tickInterval] ?? DATE_SCALES[2] : null;
  const entries = useMemo(() => filterEntries(visibleEntries(activeChart), query), [activeChart, query]);
  const { axisEnd, axisStart } = timelineBounds(entries, tickInterval, activeSource, dateScale);
  const axisSpan = Math.max(1, axisEnd - axisStart + 1);
  const tickWidth = activeSource === "date" ? DATE_TICK_WIDTH : TICK_WIDTH;
  const unitWidth = activeSource === "date" ? dateUnitWidth(dateScale) : tickWidth / tickInterval;
  const timelineWidth = Math.max(720, axisSpan * unitWidth);
  const ticks = useMemo(
    () => buildTicks(axisStart, axisEnd, tickInterval, activeSource, dateScale),
    [activeSource, axisEnd, axisStart, dateScale, tickInterval]
  );
  const dateAxisHeight = activeSource === "date" ? dateAxisHeightForScale(dateScale) : 34;

  useEffect(() => {
    if (availableCharts.some((candidate) => candidate.id === selectedChartId)) return;
    setSelectedChartId(availableCharts[0]?.id ?? "chronicle");
  }, [availableCharts, selectedChartId]);

  useEffect(() => {
    setDragPreview(null);
  }, [activeChart?.id]);

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
      const delta = pointerDelta(moveEvent.clientX, startClientX, unitWidth);
      const nextRange = nextRangeForDelta(delta);

      setDragPreview({
        path: entry.path,
        source: activeSource,
        ...nextRange
      });
    };

    const stop = (stopEvent: globalThis.PointerEvent): void => {
      const delta = pointerDelta(stopEvent.clientX, startClientX, unitWidth);
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
      startValue: entry.startValue
    });
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", cancel);
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
                setScaleIndex(candidate.source === "date" ? 1 : 1);
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
        <div className="chronicle-chart" onScroll={(event) => setScrollLeft(event.currentTarget.scrollLeft)}>
          <div className="chronicle-grid" style={{ width: NAME_COLUMN_WIDTH + timelineWidth }}>
            <div className="chronicle-name-column" style={{ width: NAME_COLUMN_WIDTH }}>
              <div className="chronicle-name-header" style={{ height: dateAxisHeight }} />
              {entries.length === 0 ? (
                <div className="chronicle-file-name-row chronicle-file-name-row--empty">
                  <div className="chronicle-file-name chronicle-file-name--empty">{t("chronicle.empty")}</div>
                </div>
              ) : (
                entries.map((entry) => (
                  <div
                    className="chronicle-file-name-row"
                    key={entry.path}
                  >
                    <button
                      className="chronicle-file-name"
                      onClick={() => onOpenFile(entry.path)}
                      title={entry.path}
                      type="button"
                    >
                      {entry.fileName}
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
                  height: Math.max(1, entries.length) * ROW_HEIGHT,
                  width: timelineWidth
                } as CSSProperties}
              >
                <ChartGuideLines axisStart={axisStart} rowCount={Math.max(1, entries.length)} ticks={ticks} unitWidth={unitWidth} />
                {entries.map((entry, index) => {
                  const previewEntry = previewEntryForDrag(entry, dragPreview);
                  const left = Math.max(0, (previewEntry.startValue - axisStart) * unitWidth);
                  const isSingleValue = previewEntry.startValue === previewEntry.endValue;
                  const rangeLabel = formatRange(previewEntry, activeSource, dateScale);
                  const labelWidth = labelWidthForText(rangeLabel);
                  const naturalWidth = isSingleValue ? unitWidth : (previewEntry.endValue - previewEntry.startValue + 1) * unitWidth;
                  const width = activeSource === "date"
                    ? naturalWidth
                    : isSingleValue
                      ? Math.max(46, naturalWidth)
                      : Math.max(28, naturalWidth);
                  const maxLabelLeft = Math.max(0, width - labelWidth);
                  const labelLeft = isSingleValue
                    ? (width - labelWidth) / 2
                    : Math.max(7, Math.min(maxLabelLeft, scrollLeft - left + 7));

                  return (
                    <button
                      aria-label={`${entry.fileName} ${rangeLabel}`}
                      className={`chronicle-fill${isSingleValue ? " chronicle-fill--single" : ""}${dragPreview?.path === entry.path && dragPreview.source === activeSource ? " chronicle-fill--dragging" : ""}`}
                      key={entry.path}
                      onPointerDown={(event) => startEntryEdit(event, entry, "move")}
                      style={{
                        left,
                        top: index * ROW_HEIGHT,
                        width
                      }}
                      title={`${entry.fileName} ${rangeLabel}`}
                      type="button"
                    >
                      <span
                        aria-label={t("chronicle.resizeStart")}
                        className="chronicle-fill-resize chronicle-fill-resize--start"
                        onPointerDown={(event) => startEntryEdit(event, entry, "resize-start")}
                        role="separator"
                      />
                      <span className="chronicle-fill-label" style={{ left: labelLeft, width: labelWidth }}>{rangeLabel}</span>
                      <span
                        aria-label={t("chronicle.resizeEnd")}
                        className="chronicle-fill-resize chronicle-fill-resize--end"
                        onPointerDown={(event) => startEntryEdit(event, entry, "resize-end")}
                        role="separator"
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="chronicle-summary">
        {activeChart ? t("chronicle.summary", { count: entries.length, source: activeChart.source }) : t("chronicle.title")}
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
  ticks: number[];
  unitWidth: number;
}): ReactElement {
  const rowLines = Array.from({ length: rowCount + 1 }, (_value, index) => index * ROW_HEIGHT);

  return (
    <div aria-hidden="true" className="chronicle-guide-lines">
      {ticks.map((tick) => (
        <span
          className="chronicle-guide-line"
          key={`tick-${tick}`}
          style={{ left: (tick - axisStart) * unitWidth }}
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

function visibleEntries(chart: WorkspaceGanttChart | null): GanttChartEntry[] {
  if (!chart) return [];
  return chart.entries;
}

function chartsForView(chart: WorkspaceGanttChart | null, charts: WorkspaceGanttChart[]): WorkspaceGanttChart[] {
  if (chart) return [chart];
  return charts;
}

function filterEntries(entries: GanttChartEntry[], query: string): GanttChartEntry[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return entries;

  return entries.filter((entry) => (
    entry.fileName.toLowerCase().includes(normalizedQuery) ||
    entry.path.toLowerCase().includes(normalizedQuery) ||
    entry.startLabel.toLowerCase().includes(normalizedQuery) ||
    entry.endLabel.toLowerCase().includes(normalizedQuery)
  ));
}

function previewEntryForDrag(entry: GanttChartEntry, preview: DragPreview | null): GanttChartEntry {
  if (!preview || preview.path !== entry.path) return entry;

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

  return {
    axisEnd: Math.ceil(paddedEnd / tickInterval) * tickInterval + tickInterval,
    axisStart: Math.floor(paddedStart / tickInterval) * tickInterval - tickInterval
  };
}

function buildTicks(
  axisStart: number,
  axisEnd: number,
  interval: number,
  source: GanttChartSource,
  dateScale: DateScale | null
): number[] {
  if (source === "date") return buildDateTicks(axisStart, axisEnd, dateScale ?? DATE_SCALES[2]);

  const first = Math.floor(axisStart / interval) * interval;
  const ticks: number[] = [];

  for (let tick = first; tick <= axisEnd; tick += interval) {
    if (tick < axisStart) continue;
    ticks.push(tick);
  }

  return ticks;
}

function buildDateTicks(axisStart: number, axisEnd: number, scale: DateScale): number[] {
  const ticks: number[] = [];
  let cursor = previousDateUnit(axisStart, scale.unit);

  while (cursor <= axisEnd) {
    if (cursor >= axisStart) ticks.push(cursor);
    cursor = nextDateUnit(cursor, scale.unit);
  }

  return ticks;
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
  const year = value < 0 ? value : value + 1;
  return year < 0 ? `−${Math.abs(year)}` : String(year);
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

function pointerDelta(clientX: number, startClientX: number, unitWidth: number): number {
  if (!Number.isFinite(clientX) || !Number.isFinite(startClientX) || unitWidth <= 0) return 0;
  return Math.round((clientX - startClientX) / unitWidth);
}
