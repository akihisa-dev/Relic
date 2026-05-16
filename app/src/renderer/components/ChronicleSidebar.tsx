import { useMemo } from "react";
import type { ReactElement } from "react";

import type { UpdateGanttChartEntryInput, WorkspaceGanttChart } from "../../shared/ipc";
import { useT } from "../i18n";
import { buildChronicleViewportState, useChronicleChartModel } from "../hooks/useChronicleChartModel";
import { useChronicleChartViewport } from "../hooks/useChronicleChartViewport";
import { useChronicleEntryDrag } from "../hooks/useChronicleEntryDrag";
import { ChronicleChartGrid } from "./ChronicleChartGrid";
import { ChronicleMinimap } from "./ChronicleMinimap";
import { ChronicleToolbar } from "./ChronicleToolbar";

interface GanttChartViewProps {
  chart?: WorkspaceGanttChart | null;
  charts?: WorkspaceGanttChart[];
  onOpenFile: (path: string) => void;
  onUpdateEntry?: (input: UpdateGanttChartEntryInput) => Promise<void> | void;
}

export function GanttChartView({ chart = null, charts = [], onOpenFile, onUpdateEntry }: GanttChartViewProps): ReactElement {
  const t = useT();
  const model = useChronicleChartModel({ chart, charts });
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
  const entryDrag = useChronicleEntryDrag({
    activeSource: model.activeSource,
    onUpdateEntry,
    resetKey: model.activeChart?.id ?? null,
    unitWidth: model.unitWidth
  });

  return (
    <div className="chronicle-panel">
      <ChronicleToolbar
        activeChart={model.activeChart}
        activeSource={model.activeSource}
        availableCharts={model.availableCharts}
        query={model.query}
        scrollToToday={viewport.scrollToToday}
        selectChart={model.selectChart}
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
        chronicleOffscreenIndicators={viewportState.chronicleOffscreenIndicators}
        dateAxisHeight={model.dateAxisHeight}
        dateOffscreenIndicators={viewportState.dateOffscreenIndicators}
        dateScale={model.dateScale}
        dragPreview={entryDrag.dragPreview}
        guideTicks={model.guideTicks}
        nameColumnWidth={model.nameColumnWidth}
        onChartPointerDown={viewport.startChartPan}
        onChartScroll={viewport.handleChartScroll}
        onJump={viewport.scrollToTimelineValue}
        onOpenFile={onOpenFile}
        onStartEntryEdit={entryDrag.startEntryEdit}
        rows={model.rows}
        scrollLeft={viewport.scrollLeft}
        tickInterval={model.tickInterval}
        timelineWidth={model.timelineWidth}
        unitWidth={model.unitWidth}
      />
      <div className="chronicle-summary">
        {model.activeChart ? t("chronicle.summary", { count: model.rows.length, source: model.activeChart.source }) : t("chronicle.title")}
      </div>
    </div>
  );
}
