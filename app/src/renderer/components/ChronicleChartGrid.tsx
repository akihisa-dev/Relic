import type { PointerEvent, ReactElement, RefObject, UIEvent } from "react";

import type { ChartEntry, ChartEntryEditKind, ChartSource, WorkspaceChart } from "../../shared/ipc";
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
  TimelineOffscreenJumpButtons,
  VerticalMinimap,
  VerticalOffscreenJumpButtons
} from "./chronicleChartParts";

export interface ChronicleChartGridProps {
  activeChart: WorkspaceChart | null;
  activeSource: ChartSource;
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
    entry: ChartEntry,
    kind: ChartEntryEditKind
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
    <div className="chronicle-chart-layout">
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
