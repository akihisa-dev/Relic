import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import type { TimelineChartSource, CardbookTimelineChart } from "../../shared/ipc";
import {
  TIMELINE_AXIS_HEIGHT,
  TIMELINE_NAME_COLUMN_WIDTH,
  ROW_HEIGHT,
  TICK_WIDTH,
  buildChartRows,
  buildGuideTicks,
  buildTicks,
  chartsForView,
  timelineUnitWidth,
  clamp,
  filterRows,
  isTimelineChartSource,
  minimapItemsForEntries,
  minimapViewportRange,
  sortRows,
  statusValuesForEntries,
  timelineBounds,
  timelineOffscreenBarIndicators,
  visibleEntries,
  type ChartGuideTick,
  type ChartRow,
  type TimelineSortKey,
  type TimelineOffscreenIndicator,
  type MinimapItem
} from "../timelineTimeline";
import { useUiStore } from "../store/uiStore";
import { useStableTimelineBounds } from "./useStableTimelineBounds";

interface UseTimelineChartModelInput {
  chart: CardbookTimelineChart | null;
  charts: CardbookTimelineChart[];
}

export interface TimelineChartModel {
  activeChart: CardbookTimelineChart | null;
  activeSource: TimelineChartSource;
  availableCharts: CardbookTimelineChart[];
  axisEnd: number;
  axisStart: number;
  axisHeight: number;
  entries: ReturnType<typeof visibleEntries>;
  guideTicks: ChartGuideTick[];
  minimapItems: MinimapItem[];
  nameColumnWidth: number;
  query: string;
  rows: ChartRow[];
  refreshRowOrder: () => void;
  selectChart: (chart: CardbookTimelineChart) => void;
  setQuery: Dispatch<SetStateAction<string>>;
  setSortKey: Dispatch<SetStateAction<TimelineSortKey>>;
  setStatusFilter: Dispatch<SetStateAction<string>>;
  sortKey: TimelineSortKey;
  statusFilter: string;
  statusOptions: string[];
  tickInterval: number;
  ticks: number[];
  timelineWidth: number;
  unitWidth: number;
}

export interface TimelineViewportState {
  timelineOffscreenIndicators: { left: TimelineOffscreenIndicator | null; right: TimelineOffscreenIndicator | null };
  minimapViewport: { leftPercent: number; widthPercent: number };
  visibleEndValue: number;
  visibleStartValue: number;
  verticalMinimapViewport: { heightPercent: number; topPercent: number };
  verticalOffscreenIndicators: { bottom: { count: number; targetIndex: number } | null; top: { count: number; targetIndex: number } | null };
}

export function useTimelineChartModel({
  chart,
  charts
}: UseTimelineChartModelInput): TimelineChartModel {
  const availableCharts = useMemo(() => chartsForView(chart, charts), [chart, charts]);
  const selectedTimelineChartId = useUiStore((state) => state.selectedTimelineChartId);
  const setSelectedTimelineChartId = useUiStore((state) => state.setSelectedTimelineChartId);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<TimelineSortKey>("start-asc");
  const [statusFilter, setStatusFilter] = useState("");
  const [rowOrderKeys, setRowOrderKeys] = useState<string[]>([]);
  const rowOrderResetKeyRef = useRef<string | null>(null);
  const activeChart = chart ?? availableCharts.find((candidate) => candidate.id === selectedTimelineChartId) ?? availableCharts[0] ?? null;
  const activeSource = activeChart && isTimelineChartSource(activeChart.source) ? activeChart.source : "timeline";
  const allEntries = visibleEntries(activeChart);
  const statusOptions = useMemo(() => statusValuesForEntries(allEntries), [allEntries]);
  const tickInterval = 1;
  const filteredRows = useMemo(
    () => filterRows(buildChartRows(allEntries, activeSource), query, ""),
    [activeSource, allEntries, query]
  );
  const sortedRows = useMemo(
    () => sortRows(filteredRows, sortKey),
    [filteredRows, sortKey]
  );
  const rows = useMemo(
    () => orderRowsByKeys(filteredRows, rowOrderKeys, sortedRows),
    [filteredRows, rowOrderKeys, sortedRows]
  );
  const refreshRowOrder = useCallback((): void => {
    setRowOrderKeys(sortedRows.map((row) => row.key));
  }, [sortedRows]);
  const rowOrderResetKey = `${activeChart?.id ?? "none"}:${activeSource}:${query}:${statusFilter}`;

  useEffect(() => {
    if (rowOrderResetKeyRef.current === rowOrderResetKey) return;

    rowOrderResetKeyRef.current = rowOrderResetKey;
    setRowOrderKeys(sortedRows.map((row) => row.key));
  }, [rowOrderResetKey, sortedRows]);

  const entries = useMemo(() => rows.flatMap((row) => row.entries), [rows]);
  const computedBounds = timelineBounds(entries, tickInterval);
  const boundsKey = `${activeChart?.id ?? "none"}:${activeSource}:${query}`;
  const { axisEnd, axisStart } = useStableTimelineBounds(computedBounds, boundsKey);
  const axisSpan = Math.max(1, axisEnd - axisStart + 1);
  const unitWidth = timelineUnitWidth(tickInterval, TICK_WIDTH);
  const nameColumnWidth = TIMELINE_NAME_COLUMN_WIDTH;
  const timelineWidth = Math.max(720, axisSpan * unitWidth);
  const ticks = useMemo(
    () => buildTicks(axisStart, axisEnd, tickInterval),
    [axisEnd, axisStart, tickInterval]
  );
  const guideTicks = useMemo(
    () => buildGuideTicks(axisStart, axisEnd, ticks, tickInterval),
    [axisEnd, axisStart, tickInterval, ticks]
  );
  const axisHeight = TIMELINE_AXIS_HEIGHT;
  const minimapItems = useMemo(
    () => minimapItemsForEntries(entries, axisStart, axisEnd),
    [axisEnd, axisStart, entries]
  );
  const selectChart = useCallback((nextChart: CardbookTimelineChart): void => {
    setSelectedTimelineChartId(nextChart.id);
  }, [setSelectedTimelineChartId]);

  useEffect(() => {
    if (chart) return;

    const fallbackId = availableCharts[0]?.id ?? null;
    if (selectedTimelineChartId && availableCharts.some((candidate) => candidate.id === selectedTimelineChartId)) return;
    if (selectedTimelineChartId === fallbackId) return;

    setSelectedTimelineChartId(fallbackId);
  }, [availableCharts, chart, selectedTimelineChartId, setSelectedTimelineChartId]);

  return {
    activeChart,
    activeSource,
    availableCharts,
    axisEnd,
    axisHeight,
    axisStart,
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

export function buildTimelineViewportState({
  activeSource,
  axisEnd,
  axisStart,
  chartViewportWidth,
  entries,
  nameColumnWidth,
  scrollLeft,
  unitWidth
}: {
  activeSource: TimelineChartSource;
  axisEnd: number;
  axisStart: number;
  chartViewportWidth: number;
  entries: ReturnType<typeof visibleEntries>;
  nameColumnWidth: number;
  scrollLeft: number;
  unitWidth: number;
}): TimelineViewportState {
  const viewportTimelineWidth = Math.max(1, chartViewportWidth - nameColumnWidth);
  const visibleStartValue = axisStart + scrollLeft / unitWidth;
  const visibleEndValue = axisStart + (scrollLeft + viewportTimelineWidth) / unitWidth;

  return {
    timelineOffscreenIndicators: activeSource === "timeline"
      ? timelineOffscreenBarIndicators(entries, visibleStartValue, visibleEndValue)
      : { left: null, right: null },
    minimapViewport: minimapViewportRange(axisStart, axisEnd, visibleStartValue, visibleEndValue),
    visibleEndValue,
    visibleStartValue,
    verticalMinimapViewport: { heightPercent: 100, topPercent: 0 },
    verticalOffscreenIndicators: { bottom: null, top: null }
  };
}

export function buildTimelineVerticalViewportState({
  axisHeight,
  chartViewportHeight,
  rowCount,
  scrollTop
}: {
  axisHeight: number;
  chartViewportHeight: number;
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

  const visibleRowAreaHeight = Math.max(1, chartViewportHeight - axisHeight);
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
