import { useMemo } from "react";
import type { ReactElement } from "react";

import type { UpdateTimelineChartEntryInput, CardbookTimelineChart } from "../../shared/ipc";
import { useT } from "../i18n";
import { buildTimelineVerticalViewportState, buildTimelineViewportState, useTimelineChartModel } from "../hooks/useTimelineChartModel";
import { useTimelineChartViewport } from "../hooks/useTimelineChartViewport";
import { useTimelineEntryDrag } from "../hooks/useTimelineEntryDrag";
import { TimelineChartGrid } from "./TimelineChartGrid";
import { TimelineMinimap } from "./TimelineMinimap";
import { TimelineToolbar } from "./TimelineToolbar";

interface TimelineViewProps {
  chart?: CardbookTimelineChart | null;
  charts?: CardbookTimelineChart[];
  onOpenCard: (path: string) => void;
  onUpdateEntry?: (input: UpdateTimelineChartEntryInput) => Promise<void> | void;
}

export function TimelineView({ chart = null, charts = [], onOpenCard, onUpdateEntry }: TimelineViewProps): ReactElement {
  const t = useT();
  const model = useTimelineChartModel({ chart, charts });
  const viewport = useTimelineChartViewport({
    activeChart: model.activeChart,
    activeSource: model.activeSource,
    axisEnd: model.axisEnd,
    axisStart: model.axisStart,
    entries: model.entries,
    nameColumnWidth: model.nameColumnWidth,
    unitWidth: model.unitWidth
  });
  const viewportState = useMemo(() => buildTimelineViewportState({
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
  const verticalViewportState = useMemo(() => buildTimelineVerticalViewportState({
    axisHeight: model.axisHeight,
    chartViewportHeight: viewport.chartViewportHeight,
    rowCount: model.rows.length,
    scrollTop: viewport.scrollTop
  }), [
    model.axisHeight,
    model.rows.length,
    viewport.chartViewportHeight,
    viewport.scrollTop
  ]);
  const entryDrag = useTimelineEntryDrag({
    activeSource: model.activeSource,
    onUpdateEntry,
    resetKey: model.activeChart?.id ?? null,
    unitWidth: model.unitWidth
  });

  return (
    <div className="timeline-panel">
      <TimelineToolbar
        activeChart={model.activeChart}
        activeSource={model.activeSource}
        availableCharts={model.availableCharts}
        query={model.query}
        refreshRowOrder={model.refreshRowOrder}
        scrollToToday={viewport.scrollToToday}
        selectChart={model.selectChart}
        setQuery={model.setQuery}
        setSortKey={model.setSortKey}
        setStatusFilter={model.setStatusFilter}
        sortKey={model.sortKey}
        statusFilter={model.statusFilter}
        statusOptions={model.statusOptions}
      />
      <TimelineMinimap
        activeChart={model.activeChart}
        minimapItems={model.minimapItems}
        minimapRef={viewport.minimapRef}
        minimapViewport={viewportState.minimapViewport}
        onMinimapPointerDown={viewport.handleMinimapPointer}
      />
      <TimelineChartGrid
        activeChart={model.activeChart}
        activeSource={model.activeSource}
        axisEnd={model.axisEnd}
        axisStart={model.axisStart}
        chartRef={viewport.chartRef}
        chartViewportWidth={viewport.chartViewportWidth}
        timelineOffscreenIndicators={viewportState.timelineOffscreenIndicators}
        axisHeight={model.axisHeight}
        dragPreview={entryDrag.dragPreview}
        guideTicks={model.guideTicks}
        nameColumnWidth={model.nameColumnWidth}
        onChartPointerDown={viewport.startChartPan}
        onChartScroll={viewport.handleChartScroll}
        onVerticalJump={viewport.scrollToRowIndex}
        onVerticalMinimapPointerDown={viewport.handleVerticalMinimapPointer}
        onJump={viewport.scrollToTimelineValue}
        onOpenCard={onOpenCard}
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
