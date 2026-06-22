import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ChronicleCalendarSettings, ChartSource, WorkspaceChart } from "../../shared/ipc";
import {
  CHRONICLE_TICK_WIDTH,
  chronicleAxisHeightForCalendars,
  buildChartRows,
  buildGuideTicks,
  buildTicks,
  chartsForView,
  chronicleUnitWidth,
  filterRows,
  sortRows,
  timelineBounds,
  timelineOffscreenBarIndicators,
  visibleEntries,
  type ChartGuideTick,
  type ChartRow,
  type ChronicleSortKey,
  type TimelineOffscreenIndicator
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
  axisHeight: number;
  entries: ReturnType<typeof visibleEntries>;
  guideTicks: ChartGuideTick[];
  nameColumnWidth: number;
  rows: ChartRow[];
  refreshRowOrder: () => void;
  selectChart: (chart: WorkspaceChart) => void;
  sortKey: ChronicleSortKey;
  tickInterval: number;
  ticks: number[];
  timelineWidth: number;
  unitWidth: number;
}

export interface ChronicleViewportState {
  chronicleOffscreenIndicators: { left: TimelineOffscreenIndicator | null; right: TimelineOffscreenIndicator | null };
  visibleEndValue: number;
  visibleStartValue: number;
}

export function useChronicleChartModel({
  chart,
  charts,
  chronicleCalendars
}: UseChronicleChartModelInput): ChronicleChartModel {
  const availableCharts = useMemo(() => chartsForView(chart, charts), [chart, charts]);
  const selectedChartId = useUiStore((state) => state.selectedChartId);
  const setSelectedChartId = useUiStore((state) => state.setSelectedChartId);
  const [rowOrderKeys, setRowOrderKeys] = useState<string[]>([]);
  const rowOrderResetKeyRef = useRef<string | null>(null);
  const activeChart = chart ?? availableCharts.find((candidate) => candidate.id === selectedChartId) ?? availableCharts[0] ?? null;
  const activeSource: ChartSource = activeChart?.source === "chronicle" ? activeChart.source : "chronicle";
  const allEntries = visibleEntries(activeChart);
  const tickInterval = 1;
  const effectiveSortKey: ChronicleSortKey = "start-asc";
  const filteredRows = useMemo(
    () => filterRows(buildChartRows(allEntries, activeSource), "", ""),
    [activeSource, allEntries]
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
  const rowOrderResetKey = `${activeChart?.id ?? "none"}:${activeSource}`;

  useEffect(() => {
    if (rowOrderResetKeyRef.current === rowOrderResetKey) return;

    rowOrderResetKeyRef.current = rowOrderResetKey;
    setRowOrderKeys(sortedRows.map((row) => row.key));
  }, [rowOrderResetKey, sortedRows]);

  const entries = useMemo(() => rows.flatMap((row) => row.entries), [rows]);
  const computedBounds = timelineBounds(entries, tickInterval);
  const boundsKey = `${activeChart?.id ?? "none"}:${activeSource}`;
  const { axisEnd, axisStart } = useStableTimelineBounds(computedBounds, boundsKey);
  const axisSpan = Math.max(1, axisEnd - axisStart + 1);
  const unitWidth = chronicleUnitWidth(tickInterval, CHRONICLE_TICK_WIDTH);
  const nameColumnWidth = 0;
  const timelineWidth = Math.max(720, axisSpan * unitWidth);
  const ticks = useMemo(
    () => buildTicks(axisStart, axisEnd, tickInterval),
    [axisEnd, axisStart, tickInterval]
  );
  const guideTicks = useMemo(
    () => buildGuideTicks(axisStart, axisEnd, ticks, tickInterval),
    [axisEnd, axisStart, tickInterval, ticks]
  );
  const axisHeight = chronicleAxisHeightForCalendars(chronicleCalendars);
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

  return {
    activeChart,
    activeSource,
    availableCharts,
    axisEnd,
    axisStart,
    axisHeight,
    entries,
    guideTicks,
    nameColumnWidth,
    refreshRowOrder,
    rows,
    selectChart,
    sortKey: effectiveSortKey,
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
  axisStart,
  chartViewportWidth,
  entries,
  nameColumnWidth,
  scrollLeft,
  unitWidth
}: {
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
    chronicleOffscreenIndicators: timelineOffscreenBarIndicators(entries, visibleStartValue, visibleEndValue),
    visibleEndValue,
    visibleStartValue
  };
}
