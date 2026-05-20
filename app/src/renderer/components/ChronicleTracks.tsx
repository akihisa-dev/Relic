import type { CSSProperties, PointerEvent, ReactElement } from "react";

import type { GanttChartEntry, GanttChartEntryEditKind, GanttChartSource } from "../../shared/ipc";
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
} from "../chronicleTimeline";
import { useT } from "../i18n";
import { ChartGuideLines } from "./chronicleChartParts";

export function ChronicleTracks({
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
  activeSource: GanttChartSource;
  axisEnd: number;
  axisStart: number;
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
      className="chronicle-tracks"
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
        <ChronicleEntryBar
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

function ChronicleEntryBar({
  activeSource,
  axisStart,
  dragPreview,
  entry,
  onStartEntryEdit,
  rowIndex,
  scrollLeft,
  unitWidth
}: {
  activeSource: GanttChartSource;
  axisStart: number;
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
      aria-label={`${entry.fileName} ${rangeLabel}`}
      className={`chronicle-fill chronicle-fill--chronicle${isPreviewForEntry(entry, dragPreview, activeSource) ? " chronicle-fill--dragging" : ""}`}
      onPointerDown={(event) => onStartEntryEdit(event, entry, "move")}
      style={{
        left,
        top,
        width
      }}
      title={`${entry.fileName} ${rangeLabel}`}
      type="button"
    >
      <span
        aria-label={t("chronicle.resizeStart")}
        className="chronicle-fill-resize chronicle-fill-resize--start"
        onPointerDown={(event) => onStartEntryEdit(event, entry, "resize-start")}
        role="separator"
      />
      <span className="chronicle-fill-label" style={{ left: labelLeft, width: labelWidth }}>{rangeLabel}</span>
      <span
        aria-label={t("chronicle.resizeEnd")}
        className="chronicle-fill-resize chronicle-fill-resize--end"
        onPointerDown={(event) => onStartEntryEdit(event, entry, "resize-end")}
        role="separator"
      />
    </button>
  );
}
