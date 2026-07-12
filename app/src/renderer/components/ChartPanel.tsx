import type { ReactElement } from "react";

import type { ChronicleCalendarSettings, UpdateChartEntryInput, WorkspaceChart } from "../../shared/ipc";
import { useChronicleChartModel } from "../hooks/useChronicleChartModel";
import { useChronicleChartViewport } from "../hooks/useChronicleChartViewport";
import { useChronicleEntryDrag } from "../hooks/useChronicleEntryDrag";
import { ChronicleChartGrid } from "./ChronicleChartGrid";

interface ChartViewProps {
  chart?: WorkspaceChart | null;
  charts?: WorkspaceChart[];
  chronicleCalendars: ChronicleCalendarSettings[];
  onOpenFile: (path: string) => void;
  onUpdateEntry?: (input: UpdateChartEntryInput) => Promise<void> | void;
}

const defaultCharts: WorkspaceChart[] = [];

export function ChartView({ chart = null, charts = defaultCharts, chronicleCalendars, onOpenFile, onUpdateEntry }: ChartViewProps): ReactElement {
  const model = useChronicleChartModel({ chart, charts, chronicleCalendars });
  const viewport = useChronicleChartViewport({
    activeChart: model.activeChart,
    axisEnd: model.axisEnd,
    axisStart: model.axisStart,
    entries: model.entries,
    nameColumnWidth: model.nameColumnWidth,
    unitWidth: model.unitWidth
  });
  const entryDrag = useChronicleEntryDrag({
    activeSource: model.activeSource,
    onUpdateEntry,
    resetKey: model.activeChart?.id ?? null,
    unitWidth: model.unitWidth
  });

  return (
    <div className="chronicle-panel">
      <ChronicleChartGrid
        activeChart={model.activeChart}
        activeSource={model.activeSource}
        axisEnd={model.axisEnd}
        axisStart={model.axisStart}
        chartRef={viewport.chartRef}
        chartViewportHeight={viewport.chartViewportHeight}
        chartViewportWidth={viewport.chartViewportWidth}
        chronicleCalendars={chronicleCalendars}
        axisHeight={model.axisHeight}
        dragPreview={entryDrag.dragPreview}
        guideTicks={model.guideTicks}
        nameColumnWidth={model.nameColumnWidth}
        onChartPointerDown={viewport.startChartPan}
        onChartScroll={viewport.handleChartScroll}
        onOpenFile={onOpenFile}
        onStartEntryEdit={entryDrag.startEntryEdit}
        rows={model.rows}
        scrollLeft={viewport.scrollLeft}
        tickInterval={model.tickInterval}
        timelineWidth={model.timelineWidth}
        unitWidth={model.unitWidth}
      />
    </div>
  );
}
