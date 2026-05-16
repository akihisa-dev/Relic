import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent, ReactElement } from "react";

import type { GanttChartDateKind, GanttChartEntry, GanttChartEntryEditKind, GanttChartSource, UpdateGanttChartEntryInput, WorkspaceGanttChart } from "../../shared/ipc";
import { fixedStatusValues } from "../../shared/status";
import { useT, type Translator } from "../i18n";
import { useUiStore } from "../store/uiStore";

interface GanttChartViewProps {
  chart?: WorkspaceGanttChart | null;
  charts?: WorkspaceGanttChart[];
  onOpenFile: (path: string) => void;
  onUpdateEntry?: (input: UpdateGanttChartEntryInput) => Promise<void> | void;
}

const ROW_HEIGHT = 38;
const CHRONICLE_NAME_COLUMN_WIDTH = 300;
const DATE_NAME_COLUMN_WIDTH = 430;
const TICK_WIDTH = 72;
const DATE_TICK_WIDTH = 52;
const LABEL_HORIZONTAL_PADDING = 14;
const CHRONICLE_FINE_DRAG_SPEED = 0.18;
const CHRONICLE_FAST_DRAG_SPEED = 1.4;
const CHRONICLE_FINE_DRAG_MULTIPLIER = 0.65;
const CHRONICLE_FAST_DRAG_MULTIPLIER = 1.35;
const SCALE_OPTIONS: Record<GanttChartSource, readonly number[]> = {
  chronicle: [1, 10, 100],
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

interface DateOffscreenIndicator {
  count: number;
  targetValue: number;
}

interface MinimapItem {
  key: string;
  leftPercent: number;
  widthPercent: number;
}

type ChronicleSortKey = "start-asc" | "start-desc" | "name-asc" | "name-desc";

export function GanttChartView({ chart = null, charts = [], onOpenFile, onUpdateEntry }: GanttChartViewProps): ReactElement {
  const t = useT();
  const availableCharts = useMemo(() => chartsForView(chart, charts), [chart, charts]);
  const selectedGanttChartId = useUiStore((state) => state.selectedGanttChartId);
  const setSelectedGanttChartId = useUiStore((state) => state.setSelectedGanttChartId);
  const initialChart = chart ?? availableCharts.find((candidate) => candidate.id === selectedGanttChartId) ?? availableCharts[0] ?? null;
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<ChronicleSortKey>("start-asc");
  const [statusFilter, setStatusFilter] = useState("");
  const [scaleIndex, setScaleIndex] = useState(() => defaultScaleIndex(initialChart?.source ?? "chronicle"));
  const [scrollLeft, setScrollLeft] = useState(0);
  const [chartViewportWidth, setChartViewportWidth] = useState(720);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const chartRef = useRef<HTMLDivElement | null>(null);
  const minimapRef = useRef<HTMLDivElement | null>(null);
  const previousAxisStartRef = useRef<number | null>(null);
  const initialDateScrollKeyRef = useRef<string | null>(null);
  const initialChronicleScrollKeyRef = useRef<string | null>(null);
  const activeChart = chart ?? availableCharts.find((candidate) => candidate.id === selectedGanttChartId) ?? availableCharts[0] ?? null;
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
  const nameColumnWidth = activeSource === "date" ? DATE_NAME_COLUMN_WIDTH : CHRONICLE_NAME_COLUMN_WIDTH;
  const timelineWidth = Math.max(720, axisSpan * unitWidth);
  const viewportTimelineWidth = Math.max(1, chartViewportWidth - nameColumnWidth);
  const visibleStartValue = axisStart + scrollLeft / unitWidth;
  const visibleEndValue = axisStart + (scrollLeft + viewportTimelineWidth) / unitWidth;
  const ticks = useMemo(
    () => buildTicks(axisStart, axisEnd, tickInterval, activeSource, dateScale),
    [activeSource, axisEnd, axisStart, dateScale, tickInterval]
  );
  const guideTicks = useMemo(
    () => buildGuideTicks(axisStart, axisEnd, ticks, tickInterval, activeSource, dateScale),
    [activeSource, axisEnd, axisStart, dateScale, tickInterval, ticks]
  );
  const dateAxisHeight = activeSource === "date" ? dateAxisHeightForScale(dateScale) : 34;
  const dateOffscreenIndicators = activeSource === "date"
    ? dateOffscreenBarIndicators(entries, visibleStartValue, visibleEndValue)
    : { left: null, right: null };
  const chronicleOffscreenIndicators = activeSource === "chronicle"
    ? timelineOffscreenBarIndicators(entries, visibleStartValue, visibleEndValue)
    : { left: null, right: null };
  const minimapItems = useMemo(
    () => activeSource === "chronicle" ? minimapItemsForEntries(entries, axisStart, axisEnd) : [],
    [activeSource, axisEnd, axisStart, entries]
  );
  const minimapViewport = activeSource === "chronicle"
    ? minimapViewportRange(axisStart, axisEnd, visibleStartValue, visibleEndValue)
    : { leftPercent: 0, widthPercent: 0 };

  const updateChartViewportWidth = useCallback((): void => {
    const chartElement = chartRef.current;
    if (!chartElement) return;

    const nextWidth = chartElement.clientWidth || chartElement.getBoundingClientRect().width || 720;
    setChartViewportWidth(nextWidth);
  }, []);

  const scrollToTimelineValue = useCallback((value: number): void => {
    const chartElement = chartRef.current;
    if (!chartElement) return;

    const currentViewportTimelineWidth = Math.max(1, (chartElement.clientWidth || chartViewportWidth) - nameColumnWidth);
    const maxScrollLeft = Math.max(0, chartElement.scrollWidth - (chartElement.clientWidth || chartViewportWidth));
    const targetScrollLeft = clamp(
      (value - axisStart + 0.5) * unitWidth - currentViewportTimelineWidth / 2,
      0,
      maxScrollLeft
    );

    chartElement.scrollLeft = targetScrollLeft;
    setScrollLeft(targetScrollLeft);
  }, [axisStart, chartViewportWidth, nameColumnWidth, unitWidth]);

  const scrollToToday = useCallback((): void => {
    scrollToTimelineValue(dateNavigationTarget(entries, axisStart, axisEnd));
  }, [axisEnd, axisStart, entries, scrollToTimelineValue]);

  const scrollToChronicleFocus = useCallback((): void => {
    const target = chronicleNavigationTarget(entries, axisStart, axisEnd);
    if (target !== null) scrollToTimelineValue(target);
  }, [axisEnd, axisStart, entries, scrollToTimelineValue]);

  const fitChronicleOverview = useCallback((): void => {
    const overviewScaleIndex = SCALE_OPTIONS.chronicle.length - 1;

    if (scaleIndex === overviewScaleIndex) {
      scrollToChronicleFocus();
      return;
    }

    setScaleIndex(overviewScaleIndex);
  }, [scaleIndex, scrollToChronicleFocus]);

  useLayoutEffect(() => {
    updateChartViewportWidth();

    const chartElement = chartRef.current;
    if (!chartElement) return;

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(updateChartViewportWidth);
      observer.observe(chartElement);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", updateChartViewportWidth);
    return () => window.removeEventListener("resize", updateChartViewportWidth);
  }, [activeChart?.id, updateChartViewportWidth]);

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

  useLayoutEffect(() => {
    if (activeSource !== "date" || !activeChart) return;

    const key = activeChart.id;
    if (initialDateScrollKeyRef.current === key) return;

    initialDateScrollKeyRef.current = key;
    scrollToToday();
  }, [activeChart, activeSource, scrollToToday]);

  useLayoutEffect(() => {
    if (activeSource !== "chronicle" || !activeChart) return;

    const key = `${activeChart.id}:${tickInterval}`;
    if (initialChronicleScrollKeyRef.current === key) return;

    initialChronicleScrollKeyRef.current = key;
    scrollToChronicleFocus();
  }, [activeChart, activeSource, scrollToChronicleFocus, tickInterval]);

  useEffect(() => {
    if (chart) return;

    const fallbackId = availableCharts[0]?.id ?? null;
    if (selectedGanttChartId && availableCharts.some((candidate) => candidate.id === selectedGanttChartId)) return;
    if (selectedGanttChartId === fallbackId) return;

    setSelectedGanttChartId(fallbackId);
  }, [availableCharts, chart, selectedGanttChartId, setSelectedGanttChartId]);

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
    const dragDelta = activeSource === "chronicle"
      ? createAdaptiveChroniclePointerDelta(startClientX, unitWidth, event.timeStamp)
      : createStablePointerDelta(startClientX, unitWidth);
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
      const delta = dragDelta(moveEvent.clientX, moveEvent.timeStamp);
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
      const delta = dragDelta(stopEvent.clientX, stopEvent.timeStamp);
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
    if (event.target instanceof Element && event.target.closest(".chronicle-fill, .chronicle-file-name, .chronicle-offscreen-jump")) return;

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

  const handleMinimapPointer = (event: PointerEvent<HTMLDivElement>): void => {
    if (activeSource !== "chronicle" || event.button > 0) return;

    const minimapElement = minimapRef.current;
    if (!minimapElement) return;

    const scrollFromClientX = (clientX: number): void => {
      const rect = minimapElement.getBoundingClientRect();
      const ratio = rect.width > 0 ? clamp((clientX - rect.left) / rect.width, 0, 1) : 0;
      const targetValue = axisStart + ratio * Math.max(1, axisEnd - axisStart + 1);
      scrollToTimelineValue(targetValue);
    };

    event.preventDefault();
    scrollFromClientX(event.clientX);

    if (minimapElement.setPointerCapture) {
      minimapElement.setPointerCapture(event.pointerId);
    }

    const move = (moveEvent: globalThis.PointerEvent): void => scrollFromClientX(moveEvent.clientX);
    const stop = (): void => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);

      if (minimapElement.hasPointerCapture?.(event.pointerId)) {
        minimapElement.releasePointerCapture(event.pointerId);
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
                setSelectedGanttChartId(candidate.id);
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
          {activeSource === "date" ? (
            <button
              className="chronicle-today-button"
              onClick={scrollToToday}
              type="button"
            >
              {t("chronicle.today")}
            </button>
          ) : activeSource === "chronicle" ? (
            <button
              className="chronicle-today-button"
              onClick={fitChronicleOverview}
              type="button"
            >
              {t("chronicle.fitAll")}
            </button>
          ) : null}
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
      {activeChart && activeSource === "chronicle" && minimapItems.length > 0 ? (
        <div className="chronicle-minimap-panel">
          <span className="chronicle-minimap-label">{t("chronicle.overview")}</span>
          <div
            aria-label={t("chronicle.minimap")}
            className="chronicle-minimap"
            onPointerDown={handleMinimapPointer}
            ref={minimapRef}
            role="slider"
          >
            {minimapItems.map((item) => (
              <span
                className="chronicle-minimap-item"
                key={item.key}
                style={{ left: `${item.leftPercent}%`, width: `${item.widthPercent}%` }}
              />
            ))}
            <span
              className="chronicle-minimap-window"
              style={{ left: `${minimapViewport.leftPercent}%`, width: `${minimapViewport.widthPercent}%` }}
            />
          </div>
        </div>
      ) : null}
      {!activeChart ? (
        <div className="frontmatter-field-empty">{t("chronicle.empty")}</div>
      ) : (
        <div
          className="chronicle-chart"
          onPointerDown={startChartPan}
          onScroll={(event) => setScrollLeft(event.currentTarget.scrollLeft)}
          ref={chartRef}
        >
          {activeSource === "date" ? (
            <DateOffscreenJumpButtons
              indicators={dateOffscreenIndicators}
              onJump={scrollToTimelineValue}
              t={t}
            />
          ) : activeSource === "chronicle" ? (
            <TimelineOffscreenJumpButtons
              indicators={chronicleOffscreenIndicators}
              leftOffset={nameColumnWidth}
              onJump={scrollToTimelineValue}
              t={t}
            />
          ) : null}
          <div className="chronicle-grid" style={{ width: nameColumnWidth + timelineWidth }}>
            <div className="chronicle-name-column" style={{ width: nameColumnWidth }}>
              <div className={`chronicle-name-header${activeSource === "date" ? " chronicle-name-header--date" : " chronicle-name-header--chronicle"}`} style={{ height: dateAxisHeight }}>
                {activeSource === "date" ? (
                  <>
                    <span />
                    <span>{t("chronicle.plannedDate")}</span>
                    <span>{t("chronicle.actualDate")}</span>
                  </>
                ) : (
                  <>
                    <span />
                    <span>{t("chronicle.period")}</span>
                  </>
                )}
              </div>
              {rows.length === 0 ? (
                <div className="chronicle-file-name-row chronicle-file-name-row--empty">
                  <div className="chronicle-file-name chronicle-file-name--empty">{t("chronicle.empty")}</div>
                </div>
              ) : (
                rows.map((row) => (
                  <div
                    className={`chronicle-file-name-row${activeSource === "date" ? " chronicle-file-name-row--date" : " chronicle-file-name-row--chronicle"}`}
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
                    {activeSource === "date" ? (
                      <>
                        <span className="chronicle-date-summary chronicle-date-summary--planned">
                          {dateSummaryForRow(row, "planned")}
                        </span>
                        <span className="chronicle-date-summary chronicle-date-summary--actual">
                          {dateSummaryForRow(row, "actual")}
                        </span>
                      </>
                    ) : (
                      <button
                        className="chronicle-year-summary"
                        onClick={() => scrollToTimelineValue(rowCenterValue(row))}
                        title={t("chronicle.jumpToPeriod")}
                        type="button"
                      >
                        {chronicleSummaryForRow(row)}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="chronicle-timeline" style={{ marginLeft: nameColumnWidth, width: timelineWidth }}>
              {activeSource === "date" ? (
                <DateAxis axisEnd={axisEnd} axisStart={axisStart} scale={dateScale ?? DATE_SCALES[2]} unitWidth={unitWidth} width={timelineWidth} />
              ) : (
                <ChronicleAxis
                  axisEnd={axisEnd}
                  axisStart={axisStart}
                  interval={chronicleAxisTickInterval(tickInterval)}
                  unitWidth={unitWidth}
                  width={timelineWidth}
                />
              )}
              <div
                className={`chronicle-tracks${activeSource === "date" ? " chronicle-tracks--date" : ""}`}
                style={{
                  height: Math.max(1, rows.length) * ROW_HEIGHT,
                  width: timelineWidth
                } as CSSProperties}
              >
                <ChartGuideLines
                  axisStart={axisStart}
                  dateScale={dateScale}
                  rowCount={Math.max(1, rows.length)}
                  source={activeSource}
                  ticks={guideTicks}
                  unitWidth={unitWidth}
                />
                {activeSource === "date" ? (
                  <TodayLine axisEnd={axisEnd} axisStart={axisStart} unitWidth={unitWidth} />
                ) : null}
                {rows.map((row, index) => row.entries.map((entry) => {
                    const previewEntry = previewEntryForDrag(entry, dragPreview);
                    const valueLeft = Math.max(0, (previewEntry.startValue - axisStart) * unitWidth);
                    const isSingleValue = previewEntry.startValue === previewEntry.endValue;
                    const rangeLabel = formatRange(previewEntry, activeSource, dateScale);
                    const labelWidth = labelWidthForText(rangeLabel);
                    const naturalWidth = isSingleValue ? unitWidth : (previewEntry.endValue - previewEntry.startValue + 1) * unitWidth;
                    const width = Math.max(4, naturalWidth);
                    const left = activeSource === "chronicle" && isSingleValue
                      ? Math.max(0, valueLeft + (naturalWidth - width) / 2)
                      : valueLeft;
                    const maxLabelLeft = Math.max(0, width - labelWidth);
                    const labelLeft = isSingleValue
                      ? (width - labelWidth) / 2
                      : Math.max(7, Math.min(maxLabelLeft, scrollLeft - left + 7));
                    const top = activeSource === "date"
                      ? index * ROW_HEIGHT + dateFillOffset()
                      : index * ROW_HEIGHT;
                    const dateKind = entry.dateKind ?? "planned";
                    const statusLabel = activeSource === "date" && dateKind === "actual"
                      ? statusLabelForEntry(entry)
                      : "";
                    const statusLabelWidth = statusLabel ? labelWidthForText(statusLabel) : 0;
                    const statusBadgeWidth = statusLabel ? statusLabelWidth + 2 : 0;
                    const visibleTimelineStart = Math.max(0, scrollLeft);
                    const statusLabelLeft = Math.max(
                      5,
                      Math.min(Math.max(5, width - statusBadgeWidth - 5), visibleTimelineStart - left + 5)
                    );

                    return (
                      <button
                        aria-label={`${entry.fileName} ${formatDateKindLabel(entry.dateKind, t)} ${rangeLabel}${statusLabel ? ` ${statusLabel}` : ""}`}
                        className={`chronicle-fill${activeSource === "date" ? ` chronicle-fill--date chronicle-fill--${dateKind}` : " chronicle-fill--chronicle"}${isPreviewForEntry(entry, dragPreview, activeSource) ? " chronicle-fill--dragging" : ""}`}
                        data-date-kind={entry.dateKind}
                        key={entryKey(entry)}
                        onPointerDown={(event) => startEntryEdit(event, entry, "move")}
                        style={{
                          height: activeSource === "date" ? dateFillHeight() : undefined,
                          left,
                          top,
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
                          <span className="chronicle-fill-status" style={{ left: statusLabelLeft, width: statusBadgeWidth }}>
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

function ChronicleAxis({
  axisEnd,
  axisStart,
  interval,
  unitWidth,
  width
}: {
  axisEnd: number;
  axisStart: number;
  interval: number;
  unitWidth: number;
  width: number;
}): ReactElement {
  const segments = buildChronicleAxisSegments(axisStart, axisEnd, interval);

  return (
    <div className="chronicle-axis chronicle-axis--chronicle" style={{ width }}>
      <div className="chronicle-axis-row chronicle-axis-row--chronicle">
        {segments.map((segment) => (
          <span
            className="chronicle-axis-cell"
            key={`${segment.label}-${segment.startValue}`}
            style={{
              left: (segment.startValue - axisStart) * unitWidth,
              width: Math.max(1, (segment.endValue - segment.startValue + 1) * unitWidth)
            }}
          >
            {segment.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function ChartGuideLines({
  axisStart,
  dateScale,
  rowCount,
  source,
  ticks,
  unitWidth
}: {
  axisStart: number;
  dateScale: DateScale | null;
  rowCount: number;
  source: GanttChartSource;
  ticks: ChartGuideTick[];
  unitWidth: number;
}): ReactElement {
  const rowLines = Array.from({ length: rowCount + 1 }, (_value, index) => index * ROW_HEIGHT);
  const sourceClassName = source === "date"
    ? `chronicle-guide-lines--date chronicle-guide-lines--date-${dateScale?.unit ?? "month"}`
    : "chronicle-guide-lines--chronicle";

  return (
    <div aria-hidden="true" className={`chronicle-guide-lines ${sourceClassName}`}>
      {ticks.map((tick) => (
        <span
          className={`chronicle-guide-line chronicle-guide-line--${tick.isMajor ? "major" : "minor"}`}
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
  const today = currentDateDay();

  if (today < axisStart || today > axisEnd) return null;

  return (
    <span
      aria-hidden="true"
      className="chronicle-today-line"
      style={{ left: (today - axisStart + 0.5) * unitWidth }}
    />
  );
}

function DateOffscreenJumpButtons({
  indicators,
  onJump,
  t
}: {
  indicators: { left: DateOffscreenIndicator | null; right: DateOffscreenIndicator | null };
  onJump: (value: number) => void;
  t: Translator;
}): ReactElement | null {
  if (!indicators.left && !indicators.right) return null;

  return (
    <div className="chronicle-offscreen-jumps">
      {indicators.left ? (
        <button
          aria-label={t("chronicle.offscreenLeft", { count: indicators.left.count })}
          className="chronicle-offscreen-jump chronicle-offscreen-jump--left"
          onClick={() => onJump(indicators.left?.targetValue ?? 0)}
          title={t("chronicle.offscreenLeft", { count: indicators.left.count })}
          type="button"
        >
          ← {indicators.left.count}
        </button>
      ) : null}
      {indicators.right ? (
        <button
          aria-label={t("chronicle.offscreenRight", { count: indicators.right.count })}
          className="chronicle-offscreen-jump chronicle-offscreen-jump--right"
          onClick={() => onJump(indicators.right?.targetValue ?? 0)}
          title={t("chronicle.offscreenRight", { count: indicators.right.count })}
          type="button"
        >
          {indicators.right.count} →
        </button>
      ) : null}
    </div>
  );
}

function TimelineOffscreenJumpButtons({
  indicators,
  leftOffset,
  onJump,
  t
}: {
  indicators: { left: DateOffscreenIndicator | null; right: DateOffscreenIndicator | null };
  leftOffset: number;
  onJump: (value: number) => void;
  t: Translator;
}): ReactElement | null {
  if (!indicators.left && !indicators.right) return null;

  return (
    <div className="chronicle-offscreen-jumps">
      {indicators.left ? (
        <button
          aria-label={t("chronicle.offscreenPast", { count: indicators.left.count })}
          className="chronicle-offscreen-jump chronicle-offscreen-jump--left"
          onClick={() => onJump(indicators.left?.targetValue ?? 0)}
          style={{ left: leftOffset + 10 }}
          title={t("chronicle.offscreenPast", { count: indicators.left.count })}
          type="button"
        >
          ← {indicators.left.count}
        </button>
      ) : null}
      {indicators.right ? (
        <button
          aria-label={t("chronicle.offscreenFuture", { count: indicators.right.count })}
          className="chronicle-offscreen-jump chronicle-offscreen-jump--right"
          onClick={() => onJump(indicators.right?.targetValue ?? 0)}
          title={t("chronicle.offscreenFuture", { count: indicators.right.count })}
          type="button"
        >
          {indicators.right.count} →
        </button>
      ) : null}
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

function rowCenterValue(row: ChartRow): number {
  return (rowStartValue(row) + rowEndValue(row)) / 2;
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
    .filter((status) => status.trim() !== "")
    .join(" / ");
}

function dateSummaryForRow(row: ChartRow, kind: GanttChartDateKind): string {
  const entry = row.entries.find((candidate) => (candidate.dateKind ?? "planned") === kind);
  if (!entry) return "";

  const sameYear = entry.startLabel.slice(0, 4) === entry.endLabel.slice(0, 4);
  const start = formatDateSummaryLabel(entry.startLabel, sameYear);
  const end = formatDateSummaryLabel(entry.endLabel, sameYear);
  return start === end ? start : `${start}-${end}`;
}

function chronicleSummaryForRow(row: ChartRow): string {
  const start = Math.min(...row.entries.map((entry) => entry.startValue));
  const end = Math.max(...row.entries.map((entry) => entry.endValue));
  const startLabel = formatAxisValue(start, "chronicle");
  const endLabel = formatAxisValue(end, "chronicle");

  return startLabel === endLabel ? startLabel : `${startLabel}-${endLabel}`;
}

function formatDateSummaryLabel(value: string, omitYear: boolean): string {
  const normalized = value.replace(/-/g, "/");
  return omitYear ? normalized.slice(5) : normalized;
}

function timelineOffscreenBarIndicators(
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

function minimapItemsForEntries(entries: GanttChartEntry[], axisStart: number, axisEnd: number): MinimapItem[] {
  const span = Math.max(1, axisEnd - axisStart + 1);

  return entries.map((entry) => ({
    key: entryKey(entry),
    leftPercent: clamp(((entry.startValue - axisStart) / span) * 100, 0, 100),
    widthPercent: clamp(((entry.endValue - entry.startValue + 1) / span) * 100, 0.8, 100)
  }));
}

function minimapViewportRange(
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

function chronicleNavigationTarget(entries: GanttChartEntry[], axisStart: number, axisEnd: number): number | null {
  if (entries.length === 0) return null;

  const sortedMidpoints = entries
    .map((entry) => (entry.startValue + entry.endValue) / 2)
    .sort((a, b) => a - b);
  const midpoint = sortedMidpoints[Math.floor(sortedMidpoints.length / 2)] ?? (axisStart + axisEnd) / 2;

  return clamp(midpoint, axisStart, axisEnd);
}

function dateOffscreenBarIndicators(
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

function dateNavigationTarget(entries: GanttChartEntry[], axisStart: number, axisEnd: number): number {
  const today = currentDateDay();
  if (today >= axisStart && today <= axisEnd) return today;
  if (entries.length === 0) return clamp(today, axisStart, axisEnd);

  return entries.reduce((nearest, entry) => {
    const nearestDistance = Math.min(Math.abs(nearest.startValue - today), Math.abs(nearest.endValue - today));
    const entryDistance = Math.min(Math.abs(entry.startValue - today), Math.abs(entry.endValue - today));
    return entryDistance < nearestDistance ? entry : nearest;
  }, entries[0]).startValue;
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

function chronicleMajorGuideInterval(interval: number): number {
  return interval === 1 ? 10 : 100;
}

function chronicleMinorGuideInterval(interval: number): number {
  return interval === 100 ? 10 : interval;
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

function currentDateDay(): number {
  return dateToDay(new Date().toISOString().slice(0, 10));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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

function buildChronicleAxisSegments(axisStart: number, axisEnd: number, interval: number): DateAxisSegment[] {
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

function formatChronicleAxisSegmentLabel(year: number): string {
  return year < 0 ? `−${Math.abs(year)}` : String(year);
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
  return Math.max(0, SCALE_OPTIONS.chronicle.indexOf(10));
}

function createStablePointerDelta(startClientX: number, unitWidth: number): (clientX: number, _timeStamp?: number) => number {
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

function createAdaptiveChroniclePointerDelta(
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

function chronicleDragSpeedMultiplier(speed: number): number {
  if (!Number.isFinite(speed)) return 1;
  if (speed <= CHRONICLE_FINE_DRAG_SPEED) return CHRONICLE_FINE_DRAG_MULTIPLIER;
  if (speed >= CHRONICLE_FAST_DRAG_SPEED) return CHRONICLE_FAST_DRAG_MULTIPLIER;

  const progress = (speed - CHRONICLE_FINE_DRAG_SPEED) / (CHRONICLE_FAST_DRAG_SPEED - CHRONICLE_FINE_DRAG_SPEED);

  return CHRONICLE_FINE_DRAG_MULTIPLIER + progress * (CHRONICLE_FAST_DRAG_MULTIPLIER - CHRONICLE_FINE_DRAG_MULTIPLIER);
}
