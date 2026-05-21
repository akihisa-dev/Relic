import type { PointerEvent, ReactElement, RefObject, UIEvent } from "react";

import type { TimelineChartEntry, TimelineChartEntryEditKind, TimelineChartSource, CardbookTimelineChart } from "../../shared/ipc";
import {
  buildVisibleTimelineGuideTicks,
  timelineAxisTickInterval,
  timelineVisibleRange,
  type ChartGuideTick,
  type ChartRow,
  type DragPreview
} from "../timelineTimeline";
import { useT } from "../i18n";
import { TimelineNameColumn } from "./TimelineNameColumn";
import { TimelineTracks } from "./TimelineTracks";
import {
  TimelineAxis,
  TimelineOffscreenJumpButtons,
  VerticalMinimap,
  VerticalOffscreenJumpButtons
} from "./timelineChartParts";

export interface TimelineChartGridProps {
  activeChart: CardbookTimelineChart | null;
  activeSource: TimelineChartSource;
  axisEnd: number;
  axisStart: number;
  chartRef: RefObject<HTMLDivElement | null>;
  chartViewportWidth: number;
  timelineOffscreenIndicators: TimelineChartGridOffscreenIndicators;
  axisHeight: number;
  dragPreview: DragPreview | null;
  guideTicks: ChartGuideTick[];
  nameColumnWidth: number;
  onChartPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onChartScroll: (event: UIEvent<HTMLDivElement>) => void;
  onJump: (value: number) => void;
  onOpenCard: (path: string) => void;
  onStartEntryEdit: (
    event: PointerEvent<HTMLElement>,
    entry: TimelineChartEntry,
    kind: TimelineChartEntryEditKind
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

export function TimelineChartGrid({
  activeChart,
  activeSource,
  axisHeight,
  axisEnd,
  axisStart,
  chartRef,
  chartViewportWidth,
  timelineOffscreenIndicators,
  dragPreview,
  guideTicks,
  nameColumnWidth,
  onChartPointerDown,
  onChartScroll,
  onJump,
  onOpenCard,
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
}: TimelineChartGridProps): ReactElement {
  const t = useT();
  void activeSource;
  void guideTicks;

  if (!activeChart) {
    return <div className="frontmatter-field-empty">{t("timeline.empty")}</div>;
  }

  const timelineViewportWidth = Math.max(1, chartViewportWidth - nameColumnWidth);
  const visibleRange = timelineVisibleRange({
    axisEnd,
    axisStart,
    scrollLeft,
    unitWidth,
    viewportWidth: timelineViewportWidth
  });
  const visibleGuideTicks = buildVisibleTimelineGuideTicks(
    axisStart,
    axisEnd,
    timelineAxisTickInterval(tickInterval),
    visibleRange
  );

  return (
    <div className="timeline-chart-layout">
      <div
        className="timeline-chart"
        onPointerDown={onChartPointerDown}
        onScroll={onChartScroll}
        ref={chartRef}
      >
        <TimelineOffscreenJumpButtons
          indicators={timelineOffscreenIndicators}
          leftOffset={nameColumnWidth}
          onJump={onJump}
          t={t}
        />
        <div className="timeline-grid" style={{ width: nameColumnWidth + timelineWidth }}>
          <TimelineNameColumn
            activeSource={activeSource}
            axisHeight={axisHeight}
            nameColumnWidth={nameColumnWidth}
            onJump={onJump}
            onOpenCard={onOpenCard}
            rows={rows}
          />
          <div className="timeline-timeline" style={{ marginLeft: nameColumnWidth, width: timelineWidth }}>
            <TimelineAxis
              axisEnd={axisEnd}
              axisStart={axisStart}
              interval={timelineAxisTickInterval(tickInterval)}
              scrollLeft={scrollLeft}
              unitWidth={unitWidth}
              viewportWidth={timelineViewportWidth}
              width={timelineWidth}
            />
            <TimelineTracks
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
      <aside className="timeline-vertical-panel">
      <VerticalOffscreenJumpButtons
        indicators={verticalOffscreenIndicators}
        onJump={onVerticalJump}
        t={t}
      />
      <VerticalMinimap
        label={t("timeline.verticalMinimap")}
        minimapRef={verticalMinimapRef}
        onPointerDown={onVerticalMinimapPointerDown}
        viewport={verticalMinimapViewport}
      />
      </aside>
    </div>
  );
}

type TimelineChartGridOffscreenIndicators = {
  left: { count: number; targetValue: number } | null;
  right: { count: number; targetValue: number } | null;
};
