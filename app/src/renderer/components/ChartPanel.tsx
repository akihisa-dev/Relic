import { useMemo } from "react";
import type { ReactElement } from "react";

import type { ChronicleCalendarSettings, UpdateChartEntryInput, WorkspaceChart } from "../../shared/ipc";
import { useT } from "../i18n";
import { buildChronicleVerticalViewportState, buildChronicleViewportState, useChronicleChartModel } from "../hooks/useChronicleChartModel";
import { useChronicleChartViewport } from "../hooks/useChronicleChartViewport";
import { useChronicleEntryDrag } from "../hooks/useChronicleEntryDrag";
import { ChronicleChartGrid } from "./ChronicleChartGrid";
import { ChronicleMinimap } from "./ChronicleMinimap";
import { ChronicleToolbar } from "./ChronicleToolbar";

interface ChartViewProps {
  chart?: WorkspaceChart | null;
  charts?: WorkspaceChart[];
  chronicleCalendars: ChronicleCalendarSettings[];
  onOpenFile: (path: string) => void;
  onUpdateEntry?: (input: UpdateChartEntryInput) => Promise<void> | void;
}

const defaultCharts: WorkspaceChart[] = [];

export function ChartView({ chart = null, charts = defaultCharts, chronicleCalendars, onOpenFile, onUpdateEntry }: ChartViewProps): ReactElement {
  const t = useT();
  const model = useChronicleChartModel({ chart, charts, chronicleCalendars });
  const viewport = useChronicleChartViewport({
    activeChart: model.activeChart,
    activeSource: model.activeSource,
    axisEnd: model.axisEnd,
    axisStart: model.axisStart,
    entries: model.entries,
    nameColumnWidth: model.nameColumnWidth,
    unitWidth: model.unitWidth
  });
  const viewportState = useMemo(() => buildChronicleViewportState({
    activeSource: model.activeSource,
    axisEnd: model.axisEnd,
    axisStart: model.axisStart,
    chartViewportWidth: viewport.chartViewportWidth,
    entries: model.entries,
    nameColumnWidth: model.nameColumnWidth,
    scrollLeft: viewport.scrollLeft,
    unitWidth: model.unitWidth
  }), [
    model.activeSource,
    model.axisEnd,
    model.axisStart,
    model.entries,
    model.nameColumnWidth,
    model.unitWidth,
    viewport.chartViewportWidth,
    viewport.scrollLeft
  ]);
  const verticalViewportState = useMemo(() => buildChronicleVerticalViewportState({
    chartViewportHeight: viewport.chartViewportHeight,
    dateAxisHeight: model.dateAxisHeight,
    rowCount: model.rows.length,
    scrollTop: viewport.scrollTop
  }), [
    model.dateAxisHeight,
    model.rows.length,
    viewport.chartViewportHeight,
    viewport.scrollTop
  ]);
  const entryDrag = useChronicleEntryDrag({
    activeSource: model.activeSource,
    onUpdateEntry,
    resetKey: model.activeChart?.id ?? null,
    unitWidth: model.unitWidth
  });

  return (
    <div className="chronicle-panel">
      <ChronicleToolbar
        activeSource={model.activeSource}
        query={model.query}
        refreshRowOrder={model.refreshRowOrder}
        scrollToToday={viewport.scrollToToday}
        setQuery={model.setQuery}
        setSortKey={model.setSortKey}
        setStatusFilter={model.setStatusFilter}
        sortKey={model.sortKey}
        statusFilter={model.statusFilter}
        statusOptions={model.statusOptions}
      />
      <ChronicleMinimap
        activeChart={model.activeChart}
        minimapItems={model.minimapItems}
        minimapRef={viewport.minimapRef}
        minimapViewport={viewportState.minimapViewport}
        onMinimapPointerDown={viewport.handleMinimapPointer}
      />
      <ChronicleChartGrid
        activeChart={model.activeChart}
        activeSource={model.activeSource}
        axisEnd={model.axisEnd}
        axisStart={model.axisStart}
        chartRef={viewport.chartRef}
        chartViewportWidth={viewport.chartViewportWidth}
        chronicleOffscreenIndicators={viewportState.chronicleOffscreenIndicators}
        chronicleCalendars={chronicleCalendars}
        dateAxisHeight={model.dateAxisHeight}
        dateOffscreenIndicators={viewportState.dateOffscreenIndicators}
        dateScale={model.dateScale}
        dragPreview={entryDrag.dragPreview}
        guideTicks={model.guideTicks}
        nameColumnWidth={model.nameColumnWidth}
        onChartPointerDown={viewport.startChartPan}
        onChartScroll={viewport.handleChartScroll}
        onVerticalJump={viewport.scrollToRowIndex}
        onVerticalMinimapPointerDown={viewport.handleVerticalMinimapPointer}
        onJump={viewport.scrollToTimelineValue}
        onOpenFile={onOpenFile}
        onStartEntryEdit={entryDrag.startEntryEdit}
        rows={model.rows}
        scrollLeft={viewport.scrollLeft}
        tickInterval={model.tickInterval}
        timelineWidth={model.timelineWidth}
        unitWidth={model.unitWidth}
        verticalMinimapRef={viewport.verticalMinimapRef}
        verticalMinimapViewport={verticalViewportState.verticalMinimapViewport}
        verticalOffscreenIndicators={verticalViewportState.verticalOffscreenIndicators}
      />
    </div>
  );
}
