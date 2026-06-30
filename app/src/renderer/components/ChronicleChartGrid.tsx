import type { PointerEvent, ReactElement, RefObject, UIEvent } from "react";

import type { ChronicleCalendarSettings, ChartEntry, ChartEntryEditKind, ChartSource, WorkspaceChart } from "../../shared/ipc";
import {
  buildVisibleChronicleGuideTicks,
  chronicleAxisTickInterval,
  timelineVisibleRange,
  type ChartGuideTick,
  type ChartRow,
  type TimelineOffscreenIndicator,
  type DragPreview
} from "../chronicleTimeline";
import { useT } from "../i18n";
import { ChronicleTracks } from "./ChronicleTracks";
import {
  ChronicleAxis,
  TimelineOffscreenJumpButtons
} from "./chronicleChartParts";

export interface ChronicleChartGridProps {
  activeChart: WorkspaceChart | null;
  activeSource: ChartSource;
  axisEnd: number;
  axisStart: number;
  chartRef: RefObject<HTMLDivElement | null>;
  chartViewportHeight: number;
  chartViewportWidth: number;
  chronicleOffscreenIndicators: { left: TimelineOffscreenIndicator | null; right: TimelineOffscreenIndicator | null };
  chronicleCalendars: ChronicleCalendarSettings[];
  axisHeight: number;
  dragPreview: DragPreview | null;
  guideTicks: ChartGuideTick[];
  nameColumnWidth: number;
  onChartPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onChartScroll: (event: UIEvent<HTMLDivElement>) => void;
  onJump: (value: number) => void;
  onOpenFile: (path: string) => void;
  onStartEntryEdit: (
    event: PointerEvent<Element>,
    entry: ChartEntry,
    kind: ChartEntryEditKind
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
  chartViewportHeight,
  chartViewportWidth,
  chronicleOffscreenIndicators,
  chronicleCalendars,
  axisHeight,
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
  const visibleGuideTicks = activeSource === "chronicle"
    ? buildVisibleChronicleGuideTicks(axisStart, axisEnd, chronicleAxisTickInterval(tickInterval), visibleRange)
    : guideTicks;

  return (
    <div className={`chronicle-chart-layout${activeSource === "chronicle" ? " chronicle-chart-layout--chronicle" : ""}`}>
      <div
        className="chronicle-chart"
        id="chronicle-chart"
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
          <div className="chronicle-timeline" style={{ marginLeft: nameColumnWidth, width: timelineWidth }}>
            <ChronicleAxis
              axisEnd={axisEnd}
              axisStart={axisStart}
              calendars={chronicleCalendars}
              interval={chronicleAxisTickInterval(tickInterval)}
              scrollLeft={scrollLeft}
              unitWidth={unitWidth}
              viewportWidth={timelineViewportWidth}
              width={timelineWidth}
            />
            <ChronicleTracks
              activeSource={activeSource}
              axisStart={axisStart}
              dragPreview={dragPreview}
              guideTicks={visibleGuideTicks}
              onOpenFile={onOpenFile}
              onStartEntryEdit={onStartEntryEdit}
              rows={rows}
              scrollLeft={scrollLeft}
              trackViewportHeight={Math.max(1, chartViewportHeight - axisHeight)}
              timelineWidth={timelineWidth}
              unitWidth={unitWidth}
              visibleRange={visibleRange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
