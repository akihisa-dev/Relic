import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import type { ChronicleCalendarSettings, ChartSource, WorkspaceChart } from "../../shared/ipc";
import {
  DATE_NAME_COLUMN_WIDTH,
  DATE_SCALES,
  ROW_HEIGHT,
  TICK_WIDTH,
  chronicleAxisHeightForCalendars,
  buildChartRows,
  buildGuideTicks,
  buildTicks,
  chartsForView,
  chronicleUnitWidth,
  clamp,
  dateAxisHeightForScale,
  dateOffscreenBarIndicators,
  dateUnitWidth,
  filterRows,
  isChartSource,
  minimapItemsForEntries,
  minimapViewportRange,
  sortRows,
  statusValuesForEntries,
  timelineBounds,
  timelineOffscreenBarIndicators,
  visibleEntries,
  type ChartGuideTick,
  type ChartRow,
  type ChronicleSortKey,
  type DateOffscreenIndicator,
  type DateScale,
  type MinimapItem
} from "../chronicleTimeline";
import { useUiStore } from "../store/uiStore";
import { useStableTimelineBounds } from "./useStableTimelineBounds";

interface UseChronicleChartModelInput {
  chart: WorkspaceChart | null;
  charts: WorkspaceChart[];
  chronicleCalendars: ChronicleCalendarSettings[];
}

export interface ChronicleChartModel {
  activeChart: WorkspaceChart | null;
  activeSource: ChartSource;
  availableCharts: WorkspaceChart[];
  axisEnd: number;
  axisStart: number;
  dateAxisHeight: number;
  dateScale: DateScale | null;
  entries: ReturnType<typeof visibleEntries>;
  guideTicks: ChartGuideTick[];
  minimapItems: MinimapItem[];
  nameColumnWidth: number;
  query: string;
  rows: ChartRow[];
  refreshRowOrder: () => void;
  selectChart: (chart: WorkspaceChart) => void;
  setQuery: Dispatch<SetStateAction<string>>;
  setSortKey: Dispatch<SetStateAction<ChronicleSortKey>>;
  setStatusFilter: Dispatch<SetStateAction<string>>;
  sortKey: ChronicleSortKey;
  statusFilter: string;
  statusOptions: string[];
  tickInterval: number;
  ticks: number[];
  timelineWidth: number;
  unitWidth: number;
}

export interface ChronicleViewportState {
  chronicleOffscreenIndicators: { left: DateOffscreenIndicator | null; right: DateOffscreenIndicator | null };
  dateOffscreenIndicators: { left: DateOffscreenIndicator | null; right: DateOffscreenIndicator | null };
  minimapViewport: { leftPercent: number; widthPercent: number };
  visibleEndValue: number;
  visibleStartValue: number;
  verticalMinimapViewport: { heightPercent: number; topPercent: number };
  verticalOffscreenIndicators: { bottom: { count: number; targetIndex: number } | null; top: { count: number; targetIndex: number } | null };
}

export function useChronicleChartModel({
  chart,
  charts,
  chronicleCalendars
}: UseChronicleChartModelInput): ChronicleChartModel {
  const availableCharts = useMemo(() => chartsForView(chart, charts), [chart, charts]);
  const selectedChartId = useUiStore((state) => state.selectedChartId);
  const setSelectedChartId = useUiStore((state) => state.setSelectedChartId);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<ChronicleSortKey>("start-asc");
  const [statusFilter, setStatusFilter] = useState("");
  const [rowOrderKeys, setRowOrderKeys] = useState<string[]>([]);
  const rowOrderResetKeyRef = useRef<string | null>(null);
  const activeChart = chart ?? availableCharts.find((candidate) => candidate.id === selectedChartId) ?? availableCharts[0] ?? null;
  const activeSource = activeChart && isChartSource(activeChart.source) ? activeChart.source : "chronicle";
  const allEntries = visibleEntries(activeChart);
  const statusOptions = useMemo(() => statusValuesForEntries(allEntries), [allEntries]);
  const tickInterval = 1;
  const dateScale = activeSource === "date" ? DATE_SCALES[0] : null;
  const effectiveQuery = activeSource === "date" ? query : "";
  const effectiveSortKey = activeSource === "date" ? sortKey : "start-asc";
  const effectiveStatusFilter = activeSource === "date" ? statusFilter : "";
  const filteredRows = useMemo(
    () => filterRows(buildChartRows(allEntries, activeSource), effectiveQuery, effectiveStatusFilter),
    [activeSource, allEntries, effectiveQuery, effectiveStatusFilter]
  );
  const sortedRows = useMemo(
    () => sortRows(filteredRows, effectiveSortKey),
    [effectiveSortKey, filteredRows]
  );
  const rows = useMemo(
    () => orderRowsByKeys(filteredRows, rowOrderKeys, sortedRows),
    [filteredRows, rowOrderKeys, sortedRows]
  );
  const refreshRowOrder = useCallback((): void => {
    setRowOrderKeys(sortedRows.map((row) => row.key));
  }, [sortedRows]);
  const rowOrderResetKey = `${activeChart?.id ?? "none"}:${activeSource}:${effectiveQuery}:${effectiveStatusFilter}`;

  useEffect(() => {
    if (rowOrderResetKeyRef.current === rowOrderResetKey) return;

    rowOrderResetKeyRef.current = rowOrderResetKey;
    setRowOrderKeys(sortedRows.map((row) => row.key));
  }, [rowOrderResetKey, sortedRows]);

  const entries = useMemo(() => rows.flatMap((row) => row.entries), [rows]);
  const computedBounds = timelineBounds(entries, tickInterval, activeSource, dateScale);
  const boundsKey = `${activeChart?.id ?? "none"}:${activeSource}:${effectiveQuery}`;
  const { axisEnd, axisStart } = useStableTimelineBounds(computedBounds, boundsKey);
  const axisSpan = Math.max(1, axisEnd - axisStart + 1);
  const unitWidth = activeSource === "date" ? dateUnitWidth(dateScale) : chronicleUnitWidth(tickInterval, TICK_WIDTH);
  const nameColumnWidth = activeSource === "date" ? DATE_NAME_COLUMN_WIDTH : 0;
  const timelineWidth = Math.max(720, axisSpan * unitWidth);
  const ticks = useMemo(
    () => buildTicks(axisStart, axisEnd, tickInterval, activeSource, dateScale),
    [activeSource, axisEnd, axisStart, dateScale, tickInterval]
  );
  const guideTicks = useMemo(
    () => buildGuideTicks(axisStart, axisEnd, ticks, tickInterval, activeSource, dateScale),
    [activeSource, axisEnd, axisStart, dateScale, tickInterval, ticks]
  );
  const dateAxisHeight = activeSource === "date" ? dateAxisHeightForScale(dateScale) : chronicleAxisHeightForCalendars(chronicleCalendars);
  const minimapItems = useMemo(
    () => minimapItemsForEntries(entries, axisStart, axisEnd),
    [axisEnd, axisStart, entries]
  );
  const selectChart = useCallback((nextChart: WorkspaceChart): void => {
    setSelectedChartId(nextChart.id);
  }, [setSelectedChartId]);

  useEffect(() => {
    if (chart) return;

    const fallbackId = availableCharts[0]?.id ?? null;
    if (selectedChartId && availableCharts.some((candidate) => candidate.id === selectedChartId)) return;
    if (selectedChartId === fallbackId) return;

    setSelectedChartId(fallbackId);
  }, [availableCharts, chart, selectedChartId, setSelectedChartId]);

  useEffect(() => {
    if (activeSource !== "date" || statusFilter === "" || statusOptions.includes(statusFilter)) return;
    setStatusFilter("");
  }, [activeSource, statusFilter, statusOptions]);

  return {
    activeChart,
    activeSource,
    availableCharts,
    axisEnd,
    axisStart,
    dateAxisHeight,
    dateScale,
    entries,
    guideTicks,
    minimapItems,
    nameColumnWidth,
    query,
    refreshRowOrder,
    rows,
    selectChart,
    setQuery,
    setSortKey,
    setStatusFilter,
    sortKey,
    statusFilter,
    statusOptions,
    tickInterval,
    ticks,
    timelineWidth,
    unitWidth
  };
}

function orderRowsByKeys(rows: ChartRow[], orderKeys: string[], fallbackRows: ChartRow[]): ChartRow[] {
  if (orderKeys.length === 0) return fallbackRows;

  const rowsByKey = new Map(rows.map((row) => [row.key, row]));
  const orderedRows = orderKeys.flatMap((key) => {
    const row = rowsByKey.get(key);
    return row ? [row] : [];
  });
  const orderedKeys = new Set(orderKeys);
  const newRows = fallbackRows.filter((row) => !orderedKeys.has(row.key));

  return [...orderedRows, ...newRows];
}

export function buildChronicleViewportState({
  activeSource,
  axisEnd,
  axisStart,
  chartViewportWidth,
  entries,
  nameColumnWidth,
  scrollLeft,
  unitWidth
}: {
  activeSource: ChartSource;
  axisEnd: number;
  axisStart: number;
  chartViewportWidth: number;
  entries: ReturnType<typeof visibleEntries>;
  nameColumnWidth: number;
  scrollLeft: number;
  unitWidth: number;
}): ChronicleViewportState {
  const viewportTimelineWidth = Math.max(1, chartViewportWidth - nameColumnWidth);
  const visibleStartValue = axisStart + scrollLeft / unitWidth;
  const visibleEndValue = axisStart + (scrollLeft + viewportTimelineWidth) / unitWidth;

  return {
    chronicleOffscreenIndicators: activeSource === "chronicle"
      ? timelineOffscreenBarIndicators(entries, visibleStartValue, visibleEndValue)
      : { left: null, right: null },
    dateOffscreenIndicators: activeSource === "date"
      ? dateOffscreenBarIndicators(entries, visibleStartValue, visibleEndValue)
      : { left: null, right: null },
    minimapViewport: minimapViewportRange(axisStart, axisEnd, visibleStartValue, visibleEndValue),
    visibleEndValue,
    visibleStartValue,
    verticalMinimapViewport: { heightPercent: 100, topPercent: 0 },
    verticalOffscreenIndicators: { bottom: null, top: null }
  };
}

export function buildChronicleVerticalViewportState({
  chartViewportHeight,
  dateAxisHeight,
  rowCount,
  scrollTop
}: {
  chartViewportHeight: number;
  dateAxisHeight: number;
  rowCount: number;
  scrollTop: number;
}): {
  verticalMinimapViewport: { heightPercent: number; topPercent: number };
  verticalOffscreenIndicators: { bottom: { count: number; targetIndex: number } | null; top: { count: number; targetIndex: number } | null };
} {
  if (rowCount <= 0) {
    return {
      verticalMinimapViewport: { heightPercent: 100, topPercent: 0 },
      verticalOffscreenIndicators: { bottom: null, top: null }
    };
  }

  const visibleRowAreaHeight = Math.max(1, chartViewportHeight - dateAxisHeight);
  const visibleRowCount = Math.max(1, Math.floor(visibleRowAreaHeight / ROW_HEIGHT));
  const maxStartIndex = Math.max(0, rowCount - visibleRowCount);
  const visibleStartIndex = clamp(Math.floor(scrollTop / ROW_HEIGHT), 0, maxStartIndex);
  const visibleEndIndex = Math.min(rowCount - 1, visibleStartIndex + visibleRowCount - 1);
  const hiddenTopCount = visibleStartIndex;
  const hiddenBottomCount = Math.max(0, rowCount - visibleEndIndex - 1);
  const heightPercent = clamp((visibleRowCount / rowCount) * 100, 4, 100);
  const maxTopPercent = 100 - heightPercent;
  const topPercent = maxStartIndex === 0 ? 0 : clamp((visibleStartIndex / maxStartIndex) * maxTopPercent, 0, maxTopPercent);

  return {
    verticalMinimapViewport: { heightPercent, topPercent },
    verticalOffscreenIndicators: {
      bottom: hiddenBottomCount > 0
        ? { count: hiddenBottomCount, targetIndex: Math.min(rowCount - 1, visibleEndIndex + 1) }
        : null,
      top: hiddenTopCount > 0
        ? { count: hiddenTopCount, targetIndex: Math.max(0, visibleStartIndex - visibleRowCount) }
        : null
    }
  };
}
