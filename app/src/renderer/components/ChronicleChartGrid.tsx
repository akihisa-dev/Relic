import type { PointerEvent, ReactElement, RefObject, UIEvent } from "react";

import type { GanttChartEntry, GanttChartEntryEditKind, GanttChartSource, WorkspaceGanttChart } from "../../shared/ipc";
import {
  DATE_SCALES,
  chronicleAxisTickInterval,
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
            <DateAxis axisEnd={axisEnd} axisStart={axisStart} scale={dateScale ?? DATE_SCALES[0]} unitWidth={unitWidth} width={timelineWidth} />
          ) : (
            <ChronicleAxis
              axisEnd={axisEnd}
              axisStart={axisStart}
              interval={chronicleAxisTickInterval(tickInterval)}
              unitWidth={unitWidth}
              width={timelineWidth}
            />
          )}
          <ChronicleTracks
            activeSource={activeSource}
            axisEnd={axisEnd}
            axisStart={axisStart}
            dateScale={dateScale}
            dragPreview={dragPreview}
            guideTicks={guideTicks}
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
