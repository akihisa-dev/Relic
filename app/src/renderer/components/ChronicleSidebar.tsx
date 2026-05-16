import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent, ReactElement } from "react";

import type { GanttChartEntry, GanttChartEntryEditKind, GanttChartSource, UpdateGanttChartEntryInput, WorkspaceGanttChart } from "../../shared/ipc";
import { useT } from "../i18n";
import {
  CHRONICLE_NAME_COLUMN_WIDTH,
  DATE_NAME_COLUMN_WIDTH,
  DATE_SCALES,
  DATE_TICK_WIDTH,
  ROW_HEIGHT,
  SCALE_OPTIONS,
  TICK_WIDTH,
  buildChartRows,
  buildGuideTicks,
  buildTicks,
  chartsForView,
  chronicleAxisTickInterval,
  chronicleNavigationTarget,
  chronicleSummaryForRow,
  chronicleUnitWidth,
  clamp,
  createAdaptiveChroniclePointerDelta,
  createStablePointerDelta,
  dateAxisHeightForScale,
  dateFillHeight,
  dateFillOffset,
  dateKindPatch,
  dateNavigationTarget,
  dateOffscreenBarIndicators,
  dateSummaryForRow,
  dateUnitWidth,
  defaultScaleIndex,
  entryKey,
  filterRows,
  formatDateKindLabel,
  formatRange,
  formatScaleValue,
  isGanttChartSource,
  isPreviewForEntry,
  labelWidthForText,
  minimapItemsForEntries,
  minimapViewportRange,
  previewEntryForDrag,
  rowCenterValue,
  sortRows,
  statusLabelForEntry,
  statusValuesForEntries,
  timelineBounds,
  timelineOffscreenBarIndicators,
  visibleEntries,
  type ChronicleSortKey,
  type DragPreview
} from "../chronicleTimeline";
import {
  ChartGuideLines,
  ChronicleAxis,
  DateAxis,
  DateOffscreenJumpButtons,
  TimelineOffscreenJumpButtons,
  TodayLine,
  useStableTimelineBounds
} from "./chronicleChartParts";
import { useUiStore } from "../store/uiStore";

interface GanttChartViewProps {
  chart?: WorkspaceGanttChart | null;
  charts?: WorkspaceGanttChart[];
  onOpenFile: (path: string) => void;
  onUpdateEntry?: (input: UpdateGanttChartEntryInput) => Promise<void> | void;
}

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
