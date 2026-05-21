import type { CSSProperties, PointerEvent, ReactElement } from "react";

import type { TimelineChartEntry, TimelineChartEntryEditKind, TimelineChartSource } from "../../shared/ipc";
import {
  ROW_HEIGHT,
  entryKey,
  formatRange,
  isPreviewForEntry,
  labelWidthForText,
  previewEntryForDrag,
  type ChartGuideTick,
  type ChartRow,
  type DragPreview
} from "../timelineTimeline";
import { useT } from "../i18n";
import { ChartGuideLines } from "./timelineChartParts";

export function TimelineTracks({
  activeSource,
  axisEnd,
  axisStart,
  dragPreview,
  guideTicks,
  onStartEntryEdit,
  rows,
  scrollLeft,
  timelineWidth,
  unitWidth
}: {
  activeSource: TimelineChartSource;
  axisEnd: number;
  axisStart: number;
  dragPreview: DragPreview | null;
  guideTicks: ChartGuideTick[];
  onStartEntryEdit: (
    event: PointerEvent<HTMLElement>,
    entry: TimelineChartEntry,
    kind: TimelineChartEntryEditKind
  ) => void;
  rows: ChartRow[];
  scrollLeft: number;
  timelineWidth: number;
  unitWidth: number;
}): ReactElement {
  return (
    <div
      className="timeline-tracks"
      style={{
        height: Math.max(1, rows.length) * ROW_HEIGHT,
        width: timelineWidth
      } as CSSProperties}
    >
      <ChartGuideLines
        axisStart={axisStart}
        rowCount={Math.max(1, rows.length)}
        ticks={guideTicks}
        unitWidth={unitWidth}
      />
      {rows.map((row, index) => row.entries.map((entry) => (
        <TimelineEntryBar
          activeSource={activeSource}
          axisStart={axisStart}
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

function TimelineEntryBar({
  activeSource,
  axisStart,
  dragPreview,
  entry,
  onStartEntryEdit,
  rowIndex,
  scrollLeft,
  unitWidth
}: {
  activeSource: TimelineChartSource;
  axisStart: number;
  dragPreview: DragPreview | null;
  entry: TimelineChartEntry;
  onStartEntryEdit: (
    event: PointerEvent<HTMLElement>,
    entry: TimelineChartEntry,
    kind: TimelineChartEntryEditKind
  ) => void;
  rowIndex: number;
  scrollLeft: number;
  unitWidth: number;
}): ReactElement {
  const t = useT();
  const previewEntry = previewEntryForDrag(entry, dragPreview);
  const valueLeft = Math.max(0, (previewEntry.startValue - axisStart) * unitWidth);
  const isSingleValue = previewEntry.startValue === previewEntry.endValue;
  const rangeLabel = formatRange(previewEntry, activeSource);
  const labelWidth = labelWidthForText(rangeLabel);
  const naturalWidth = isSingleValue ? unitWidth : (previewEntry.endValue - previewEntry.startValue + 1) * unitWidth;
  const width = Math.max(4, naturalWidth);
  const left = isSingleValue
    ? Math.max(0, valueLeft + (naturalWidth - width) / 2)
    : valueLeft;
  const maxLabelLeft = Math.max(0, width - labelWidth);
  const labelLeft = isSingleValue
    ? (width - labelWidth) / 2
    : Math.max(7, Math.min(maxLabelLeft, scrollLeft - left + 7));
  const top = rowIndex * ROW_HEIGHT;
  void scrollLeft;

  return (
    <button
      aria-label={`${entry.cardName} ${rangeLabel}`}
      className={`timeline-fill timeline-fill--timeline${isPreviewForEntry(entry, dragPreview, activeSource) ? " timeline-fill--dragging" : ""}`}
      onPointerDown={(event) => onStartEntryEdit(event, entry, "move")}
      style={{
        left,
        top,
        width
      }}
      title={`${entry.cardName} ${rangeLabel}`}
      type="button"
    >
      <span
        aria-label={t("timeline.resizeStart")}
        className="timeline-fill-resize timeline-fill-resize--start"
        onPointerDown={(event) => onStartEntryEdit(event, entry, "resize-start")}
        role="separator"
      />
      <span className="timeline-fill-label" style={{ left: labelLeft, width: labelWidth }}>{rangeLabel}</span>
      <span
        aria-label={t("timeline.resizeEnd")}
        className="timeline-fill-resize timeline-fill-resize--end"
        onPointerDown={(event) => onStartEntryEdit(event, entry, "resize-end")}
        role="separator"
      />
    </button>
  );
}
