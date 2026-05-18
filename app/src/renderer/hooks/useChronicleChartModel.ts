import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import type { GanttChartSource, WorkspaceGanttChart } from "../../shared/ipc";
import {
  CHRONICLE_NAME_COLUMN_WIDTH,
  DATE_NAME_COLUMN_WIDTH,
  DATE_SCALES,
  TICK_WIDTH,
  buildChartRows,
  buildGuideTicks,
  buildTicks,
  chartsForView,
  chronicleUnitWidth,
  dateAxisHeightForScale,
  dateOffscreenBarIndicators,
  dateUnitWidth,
  filterRows,
  isGanttChartSource,
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
  chart: WorkspaceGanttChart | null;
  charts: WorkspaceGanttChart[];
}

export interface ChronicleChartModel {
  activeChart: WorkspaceGanttChart | null;
  activeSource: GanttChartSource;
  availableCharts: WorkspaceGanttChart[];
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
  selectChart: (chart: WorkspaceGanttChart) => void;
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
}

export function useChronicleChartModel({
  chart,
  charts
}: UseChronicleChartModelInput): ChronicleChartModel {
  const availableCharts = useMemo(() => chartsForView(chart, charts), [chart, charts]);
  const selectedGanttChartId = useUiStore((state) => state.selectedGanttChartId);
  const setSelectedGanttChartId = useUiStore((state) => state.setSelectedGanttChartId);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<ChronicleSortKey>("start-asc");
  const [statusFilter, setStatusFilter] = useState("");
  const [rowOrderKeys, setRowOrderKeys] = useState<string[]>([]);
  const rowOrderResetKeyRef = useRef<string | null>(null);
  const activeChart = chart ?? availableCharts.find((candidate) => candidate.id === selectedGanttChartId) ?? availableCharts[0] ?? null;
  const activeSource = activeChart && isGanttChartSource(activeChart.source) ? activeChart.source : "chronicle";
  const allEntries = visibleEntries(activeChart);
  const statusOptions = useMemo(() => statusValuesForEntries(allEntries), [allEntries]);
  const tickInterval = 1;
  const dateScale = activeSource === "date" ? DATE_SCALES[0] : null;
  const filteredRows = useMemo(
    () => filterRows(buildChartRows(allEntries, activeSource), query, activeSource === "date" ? statusFilter : ""),
    [activeSource, allEntries, query, statusFilter]
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
  const computedBounds = timelineBounds(entries, tickInterval, activeSource, dateScale);
  const boundsKey = `${activeChart?.id ?? "none"}:${activeSource}:${query}`;
  const { axisEnd, axisStart } = useStableTimelineBounds(computedBounds, boundsKey);
  const axisSpan = Math.max(1, axisEnd - axisStart + 1);
  const unitWidth = activeSource === "date" ? dateUnitWidth(dateScale) : chronicleUnitWidth(tickInterval, TICK_WIDTH);
  const nameColumnWidth = activeSource === "date" ? DATE_NAME_COLUMN_WIDTH : CHRONICLE_NAME_COLUMN_WIDTH;
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
  const minimapItems = useMemo(
    () => minimapItemsForEntries(entries, axisStart, axisEnd),
    [axisEnd, axisStart, entries]
  );
  const selectChart = useCallback((nextChart: WorkspaceGanttChart): void => {
    setSelectedGanttChartId(nextChart.id);
  }, [setSelectedGanttChartId]);

  useEffect(() => {
    if (chart) return;

    const fallbackId = availableCharts[0]?.id ?? null;
    if (selectedGanttChartId && availableCharts.some((candidate) => candidate.id === selectedGanttChartId)) return;
    if (selectedGanttChartId === fallbackId) return;

    setSelectedGanttChartId(fallbackId);
  }, [availableCharts, chart, selectedGanttChartId, setSelectedGanttChartId]);

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
  activeSource: GanttChartSource;
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
    visibleStartValue
  };
}
