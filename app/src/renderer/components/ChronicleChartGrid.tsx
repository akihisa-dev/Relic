import type { PointerEvent, ReactElement, RefObject, UIEvent } from "react";

import type { GanttChartEntry, GanttChartEntryEditKind, GanttChartSource, WorkspaceGanttChart } from "../../shared/ipc";
import {
  buildVisibleChronicleGuideTicks,
  chronicleAxisTickInterval,
  timelineVisibleRange,
  type ChartGuideTick,
  type ChartRow,
  type DragPreview
} from "../chronicleTimeline";
import { useT } from "../i18n";
import { ChronicleNameColumn } from "./ChronicleNameColumn";
import { ChronicleTracks } from "./ChronicleTracks";
import {
  ChronicleAxis,
  TimelineOffscreenJumpButtons,
  VerticalMinimap,
  VerticalOffscreenJumpButtons
} from "./chronicleChartParts";

export interface ChronicleChartGridProps {
  activeChart: WorkspaceGanttChart | null;
  activeSource: GanttChartSource;
  axisEnd: number;
  axisStart: number;
  chartRef: RefObject<HTMLDivElement | null>;
  chartViewportWidth: number;
  chronicleOffscreenIndicators: ChronicleChartGridOffscreenIndicators;
  axisHeight: number;
  dragPreview: DragPreview | null;
  guideTicks: ChartGuideTick[];
  nameColumnWidth: number;
  onChartPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onChartScroll: (event: UIEvent<HTMLDivElement>) => void;
  onJump: (value: number) => void;
  onOpenFile: (path: string) => void;
  onStartEntryEdit: (
    event: PointerEvent<HTMLElement>,
    entry: GanttChartEntry,
    kind: GanttChartEntryEditKind
  ) => void;
  onVerticalJump: (rowIndex: number) => void;
  onVerticalMinimapPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  rows: ChartRow[];
  scrollLeft: number;
  tickInterval: number;
  timelineWidth: number;
  unitWidth: number;
  verticalMinimapRef: RefObject<HTMLDivElement | null>;
  verticalMinimapViewport: { heightPercent: number; topPercent: number };
  verticalOffscreenIndicators: { bottom: { count: number; targetIndex: number } | null; top: { count: number; targetIndex: number } | null };
}

export function ChronicleChartGrid({
  activeChart,
  activeSource,
  axisHeight,
  axisEnd,
  axisStart,
  chartRef,
  chartViewportWidth,
  chronicleOffscreenIndicators,
  dragPreview,
  guideTicks,
  nameColumnWidth,
  onChartPointerDown,
  onChartScroll,
  onJump,
  onOpenFile,
  onStartEntryEdit,
  onVerticalJump,
  onVerticalMinimapPointerDown,
  rows,
  scrollLeft,
  tickInterval,
  timelineWidth,
  unitWidth,
  verticalMinimapRef,
  verticalMinimapViewport,
  verticalOffscreenIndicators
}: ChronicleChartGridProps): ReactElement {
  const t = useT();
  void activeSource;
  void guideTicks;

  if (!activeChart) {
    return <div className="frontmatter-field-empty">{t("chronicle.empty")}</div>;
  }

  const timelineViewportWidth = Math.max(1, chartViewportWidth - nameColumnWidth);
  const visibleRange = timelineVisibleRange({
    axisEnd,
    axisStart,
    scrollLeft,
    unitWidth,
    viewportWidth: timelineViewportWidth
  });
  const visibleGuideTicks = buildVisibleChronicleGuideTicks(
    axisStart,
    axisEnd,
    chronicleAxisTickInterval(tickInterval),
    visibleRange
  );

  return (
    <div className="chronicle-chart-layout">
      <div
        className="chronicle-chart"
        onPointerDown={onChartPointerDown}
        onScroll={onChartScroll}
        ref={chartRef}
      >
        <TimelineOffscreenJumpButtons
          indicators={chronicleOffscreenIndicators}
          leftOffset={nameColumnWidth}
          onJump={onJump}
          t={t}
        />
        <div className="chronicle-grid" style={{ width: nameColumnWidth + timelineWidth }}>
          <ChronicleNameColumn
            activeSource={activeSource}
            axisHeight={axisHeight}
            nameColumnWidth={nameColumnWidth}
            onJump={onJump}
            onOpenFile={onOpenFile}
            rows={rows}
          />
          <div className="chronicle-timeline" style={{ marginLeft: nameColumnWidth, width: timelineWidth }}>
            <ChronicleAxis
              axisEnd={axisEnd}
              axisStart={axisStart}
              interval={chronicleAxisTickInterval(tickInterval)}
              scrollLeft={scrollLeft}
              unitWidth={unitWidth}
              viewportWidth={timelineViewportWidth}
              width={timelineWidth}
            />
            <ChronicleTracks
              activeSource={activeSource}
              axisEnd={axisEnd}
              axisStart={axisStart}
              dragPreview={dragPreview}
              guideTicks={visibleGuideTicks}
              onStartEntryEdit={onStartEntryEdit}
              rows={rows}
              scrollLeft={scrollLeft}
              timelineWidth={timelineWidth}
              unitWidth={unitWidth}
            />
          </div>
        </div>
      </div>
      <aside className="chronicle-vertical-panel">
      <VerticalOffscreenJumpButtons
        indicators={verticalOffscreenIndicators}
        onJump={onVerticalJump}
        t={t}
      />
      <VerticalMinimap
        label={t("chronicle.verticalMinimap")}
        minimapRef={verticalMinimapRef}
        onPointerDown={onVerticalMinimapPointerDown}
        viewport={verticalMinimapViewport}
      />
      </aside>
    </div>
  );
}

type ChronicleChartGridOffscreenIndicators = {
  left: { count: number; targetValue: number } | null;
  right: { count: number; targetValue: number } | null;
};
