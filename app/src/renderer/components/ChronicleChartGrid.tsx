import type { PointerEvent, ReactElement, RefObject, UIEvent } from "react";

import type { GanttChartEntry, GanttChartEntryEditKind, GanttChartSource, WorkspaceGanttChart } from "../../shared/ipc";
import {
  DATE_SCALES,
  buildVisibleChronicleGuideTicks,
  buildVisibleDateGuideTicks,
  chronicleAxisTickInterval,
  timelineVisibleRange,
  type ChartGuideTick,
  type ChartRow,
  type DateOffscreenIndicator,
  type DateScale,
  type DragPreview
} from "../chronicleTimeline";
import { useT } from "../i18n";
import { ChronicleNameColumn } from "./ChronicleNameColumn";
import { ChronicleTracks } from "./ChronicleTracks";
import {
  ChronicleAxis,
  DateAxis,
  DateOffscreenJumpButtons,
  TimelineOffscreenJumpButtons
} from "./chronicleChartParts";

export interface ChronicleChartGridProps {
  activeChart: WorkspaceGanttChart | null;
  activeSource: GanttChartSource;
  axisEnd: number;
  axisStart: number;
  chartRef: RefObject<HTMLDivElement | null>;
  chartViewportWidth: number;
  chronicleOffscreenIndicators: { left: DateOffscreenIndicator | null; right: DateOffscreenIndicator | null };
  dateAxisHeight: number;
  dateOffscreenIndicators: { left: DateOffscreenIndicator | null; right: DateOffscreenIndicator | null };
  dateScale: DateScale | null;
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
  rows: ChartRow[];
  scrollLeft: number;
  tickInterval: number;
  timelineWidth: number;
  unitWidth: number;
}

export function ChronicleChartGrid({
  activeChart,
  activeSource,
  axisEnd,
  axisStart,
  chartRef,
  chartViewportWidth,
  chronicleOffscreenIndicators,
  dateAxisHeight,
  dateOffscreenIndicators,
  dateScale,
  dragPreview,
  guideTicks,
  nameColumnWidth,
  onChartPointerDown,
  onChartScroll,
  onJump,
  onOpenFile,
  onStartEntryEdit,
  rows,
  scrollLeft,
  tickInterval,
  timelineWidth,
  unitWidth
}: ChronicleChartGridProps): ReactElement {
  const t = useT();

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
  const visibleGuideTicks = activeSource === "date" && dateScale
    ? buildVisibleDateGuideTicks(axisStart, axisEnd, dateScale, visibleRange)
    : activeSource === "chronicle"
      ? buildVisibleChronicleGuideTicks(axisStart, axisEnd, chronicleAxisTickInterval(tickInterval), visibleRange)
      : guideTicks;

  return (
    <div
      className="chronicle-chart"
      onPointerDown={onChartPointerDown}
      onScroll={onChartScroll}
      ref={chartRef}
    >
      {activeSource === "date" ? (
        <DateOffscreenJumpButtons
          indicators={dateOffscreenIndicators}
          onJump={onJump}
          t={t}
        />
      ) : activeSource === "chronicle" ? (
        <TimelineOffscreenJumpButtons
          indicators={chronicleOffscreenIndicators}
          leftOffset={nameColumnWidth}
          onJump={onJump}
          t={t}
        />
      ) : null}
      <div className="chronicle-grid" style={{ width: nameColumnWidth + timelineWidth }}>
        <ChronicleNameColumn
          activeSource={activeSource}
          dateAxisHeight={dateAxisHeight}
          nameColumnWidth={nameColumnWidth}
          onJump={onJump}
          onOpenFile={onOpenFile}
          rows={rows}
        />
        <div className="chronicle-timeline" style={{ marginLeft: nameColumnWidth, width: timelineWidth }}>
          {activeSource === "date" ? (
            <DateAxis
              axisEnd={axisEnd}
              axisStart={axisStart}
              scale={dateScale ?? DATE_SCALES[0]}
              scrollLeft={scrollLeft}
              unitWidth={unitWidth}
              viewportWidth={timelineViewportWidth}
              width={timelineWidth}
            />
          ) : (
            <ChronicleAxis
              axisEnd={axisEnd}
              axisStart={axisStart}
              interval={chronicleAxisTickInterval(tickInterval)}
              scrollLeft={scrollLeft}
              unitWidth={unitWidth}
              viewportWidth={timelineViewportWidth}
              width={timelineWidth}
            />
          )}
          <ChronicleTracks
            activeSource={activeSource}
            axisEnd={axisEnd}
            axisStart={axisStart}
            dateScale={dateScale}
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
  );
}
