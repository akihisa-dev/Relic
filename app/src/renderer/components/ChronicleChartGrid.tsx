import type { CSSProperties, PointerEvent, ReactElement, RefObject, UIEvent } from "react";

import type { GanttChartEntry, GanttChartEntryEditKind, GanttChartSource, WorkspaceGanttChart } from "../../shared/ipc";
import {
  DATE_SCALES,
  ROW_HEIGHT,
  chronicleAxisTickInterval,
  chronicleSummaryForRow,
  dateFillHeight,
  dateFillOffset,
  dateSummaryForRow,
  entryKey,
  formatDateKindLabel,
  formatRange,
  isPreviewForEntry,
  labelWidthForText,
  previewEntryForDrag,
  rowCenterValue,
  statusLabelForEntry,
  type ChartGuideTick,
  type ChartRow,
  type DateOffscreenIndicator,
  type DateScale,
  type DragPreview
} from "../chronicleTimeline";
import { useT } from "../i18n";
import {
  ChartGuideLines,
  ChronicleAxis,
  DateAxis,
  DateOffscreenJumpButtons,
  TimelineOffscreenJumpButtons,
  TodayLine
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
            <DateAxis axisEnd={axisEnd} axisStart={axisStart} scale={dateScale ?? DATE_SCALES[2]} unitWidth={unitWidth} width={timelineWidth} />
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

function ChronicleNameColumn({
  activeSource,
  dateAxisHeight,
  nameColumnWidth,
  onJump,
  onOpenFile,
  rows
}: {
  activeSource: GanttChartSource;
  dateAxisHeight: number;
  nameColumnWidth: number;
  onJump: (value: number) => void;
  onOpenFile: (path: string) => void;
  rows: ChartRow[];
}): ReactElement {
  const t = useT();

  return (
    <div className="chronicle-name-column" style={{ width: nameColumnWidth }}>
      <div className={`chronicle-name-header${activeSource === "date" ? " chronicle-name-header--date" : " chronicle-name-header--chronicle"}`} style={{ height: dateAxisHeight }}>
        {activeSource === "date" ? (
          <>
            <span />
            <span>{t("chronicle.plannedDate")}</span>
            <span>{t("chronicle.actualDate")}</span>
          </>
        ) : (
          <>
            <span />
            <span>{t("chronicle.period")}</span>
          </>
        )}
      </div>
      {rows.length === 0 ? (
        <div className="chronicle-file-name-row chronicle-file-name-row--empty">
          <div className="chronicle-file-name chronicle-file-name--empty">{t("chronicle.empty")}</div>
        </div>
      ) : (
        rows.map((row) => (
          <div
            className={`chronicle-file-name-row${activeSource === "date" ? " chronicle-file-name-row--date" : " chronicle-file-name-row--chronicle"}`}
            key={row.key}
          >
            <button
              className="chronicle-file-name"
              onClick={() => onOpenFile(row.path)}
              title={row.path}
              type="button"
            >
              {row.fileName}
            </button>
            {activeSource === "date" ? (
              <>
                <span className="chronicle-date-summary chronicle-date-summary--planned">
                  {dateSummaryForRow(row, "planned")}
                </span>
                <span className="chronicle-date-summary chronicle-date-summary--actual">
                  {dateSummaryForRow(row, "actual")}
                </span>
              </>
            ) : (
              <button
                className="chronicle-year-summary"
                onClick={() => onJump(rowCenterValue(row))}
                title={t("chronicle.jumpToPeriod")}
                type="button"
              >
                {chronicleSummaryForRow(row)}
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function ChronicleTracks({
  activeSource,
  axisEnd,
  axisStart,
  dateScale,
  dragPreview,
  guideTicks,
  onStartEntryEdit,
  rows,
  scrollLeft,
  timelineWidth,
  unitWidth
}: {
  activeSource: GanttChartSource;
  axisEnd: number;
  axisStart: number;
  dateScale: DateScale | null;
  dragPreview: DragPreview | null;
  guideTicks: ChartGuideTick[];
  onStartEntryEdit: (
    event: PointerEvent<HTMLElement>,
    entry: GanttChartEntry,
    kind: GanttChartEntryEditKind
  ) => void;
  rows: ChartRow[];
  scrollLeft: number;
  timelineWidth: number;
  unitWidth: number;
}): ReactElement {
  return (
    <div
      className={`chronicle-tracks${activeSource === "date" ? " chronicle-tracks--date" : ""}`}
      style={{
        height: Math.max(1, rows.length) * ROW_HEIGHT,
        width: timelineWidth
      } as CSSProperties}
    >
      <ChartGuideLines
        axisStart={axisStart}
        dateScale={dateScale}
        rowCount={Math.max(1, rows.length)}
        source={activeSource}
        ticks={guideTicks}
        unitWidth={unitWidth}
      />
      {activeSource === "date" ? (
        <TodayLine axisEnd={axisEnd} axisStart={axisStart} unitWidth={unitWidth} />
      ) : null}
      {rows.map((row, index) => row.entries.map((entry) => (
        <ChronicleEntryBar
          activeSource={activeSource}
          axisStart={axisStart}
          dateScale={dateScale}
          dragPreview={dragPreview}
          entry={entry}
          key={entryKey(entry)}
          onStartEntryEdit={onStartEntryEdit}
          rowIndex={index}
          scrollLeft={scrollLeft}
          unitWidth={unitWidth}
        />
      )))}
    </div>
  );
}

function ChronicleEntryBar({
  activeSource,
  axisStart,
  dateScale,
  dragPreview,
  entry,
  onStartEntryEdit,
  rowIndex,
  scrollLeft,
  unitWidth
}: {
  activeSource: GanttChartSource;
  axisStart: number;
  dateScale: DateScale | null;
  dragPreview: DragPreview | null;
  entry: GanttChartEntry;
  onStartEntryEdit: (
    event: PointerEvent<HTMLElement>,
    entry: GanttChartEntry,
    kind: GanttChartEntryEditKind
  ) => void;
  rowIndex: number;
  scrollLeft: number;
  unitWidth: number;
}): ReactElement {
  const t = useT();
  const previewEntry = previewEntryForDrag(entry, dragPreview);
  const valueLeft = Math.max(0, (previewEntry.startValue - axisStart) * unitWidth);
  const isSingleValue = previewEntry.startValue === previewEntry.endValue;
  const rangeLabel = formatRange(previewEntry, activeSource, dateScale);
  const labelWidth = labelWidthForText(rangeLabel);
  const naturalWidth = isSingleValue ? unitWidth : (previewEntry.endValue - previewEntry.startValue + 1) * unitWidth;
  const width = Math.max(4, naturalWidth);
  const left = activeSource === "chronicle" && isSingleValue
    ? Math.max(0, valueLeft + (naturalWidth - width) / 2)
    : valueLeft;
  const maxLabelLeft = Math.max(0, width - labelWidth);
  const labelLeft = isSingleValue
    ? (width - labelWidth) / 2
    : Math.max(7, Math.min(maxLabelLeft, scrollLeft - left + 7));
  const top = activeSource === "date"
    ? rowIndex * ROW_HEIGHT + dateFillOffset()
    : rowIndex * ROW_HEIGHT;
  const dateKind = entry.dateKind ?? "planned";
  const statusLabel = activeSource === "date" && dateKind === "actual"
    ? statusLabelForEntry(entry)
    : "";
  const statusLabelWidth = statusLabel ? labelWidthForText(statusLabel) : 0;
  const statusBadgeWidth = statusLabel ? statusLabelWidth + 2 : 0;
  const visibleTimelineStart = Math.max(0, scrollLeft);
  const statusLabelLeft = Math.max(
    5,
    Math.min(Math.max(5, width - statusBadgeWidth - 5), visibleTimelineStart - left + 5)
  );

  return (
    <button
      aria-label={`${entry.fileName} ${formatDateKindLabel(entry.dateKind, t)} ${rangeLabel}${statusLabel ? ` ${statusLabel}` : ""}`}
      className={`chronicle-fill${activeSource === "date" ? ` chronicle-fill--date chronicle-fill--${dateKind}` : " chronicle-fill--chronicle"}${isPreviewForEntry(entry, dragPreview, activeSource) ? " chronicle-fill--dragging" : ""}`}
      data-date-kind={entry.dateKind}
      onPointerDown={(event) => onStartEntryEdit(event, entry, "move")}
      style={{
        height: activeSource === "date" ? dateFillHeight() : undefined,
        left,
        top,
        width
      }}
      title={`${entry.fileName}${activeSource === "date" ? ` ${formatDateKindLabel(entry.dateKind, t)}: ` : " "}${rangeLabel}`}
      type="button"
    >
      <span
        aria-label={t("chronicle.resizeStart")}
        className="chronicle-fill-resize chronicle-fill-resize--start"
        onPointerDown={(event) => onStartEntryEdit(event, entry, "resize-start")}
        role="separator"
      />
      <span className="chronicle-fill-label" style={{ left: labelLeft, width: labelWidth }}>{rangeLabel}</span>
      {statusLabel ? (
        <span className="chronicle-fill-status" style={{ left: statusLabelLeft, width: statusBadgeWidth }}>
          {statusLabel}
        </span>
      ) : null}
      <span
        aria-label={t("chronicle.resizeEnd")}
        className="chronicle-fill-resize chronicle-fill-resize--end"
        onPointerDown={(event) => onStartEntryEdit(event, entry, "resize-end")}
        role="separator"
      />
    </button>
  );
}
