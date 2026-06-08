import type { CSSProperties, PointerEvent, ReactElement } from "react";

import type { ChartEntry, ChartEntryEditKind, ChartSource } from "../../shared/ipc";
import {
  ROW_HEIGHT,
  dateFillHeight,
  dateFillOffset,
  entryKey,
  formatDateKindLabel,
  formatRange,
  isPreviewForEntry,
  labelWidthForText,
  previewEntryForDrag,
  statusLabelForEntry,
  type ChartGuideTick,
  type ChartRow,
  type DateScale,
  type DragPreview
} from "../chronicleTimeline";
import { useT } from "../i18n";
import { ChartGuideLines, TodayLine } from "./chronicleChartParts";

const CHRONICLE_COLOR_PALETTE = [
  { hue: 202, lightness: 43 },
  { hue: 168, lightness: 39 },
  { hue: 126, lightness: 39 },
  { hue: 82, lightness: 38 },
  { hue: 42, lightness: 42 },
  { hue: 18, lightness: 45 },
  { hue: 354, lightness: 46 },
  { hue: 322, lightness: 45 },
  { hue: 286, lightness: 45 },
  { hue: 252, lightness: 46 },
  { hue: 226, lightness: 45 },
  { hue: 190, lightness: 40 }
] as const;

interface OrderedChronicleEntry {
  displayEntry: ChartEntry;
  entry: ChartEntry;
  laneIndex: number;
  order: number;
}

interface ChronicleSegment {
  continuesFromPrevious: boolean;
  continuesToNext: boolean;
  displayEntry: ChartEntry;
  entry: ChartEntry;
  key: string;
  overlapCount: number;
  overlapIndex: number;
  segmentEndValue: number;
  segmentStartValue: number;
}

interface ChronicleLayout {
  laneCount: number;
  segments: ChronicleSegment[];
}

export function ChronicleTracks({
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
  activeSource: ChartSource;
  axisEnd: number;
  axisStart: number;
  dateScale: DateScale | null;
  dragPreview: DragPreview | null;
  guideTicks: ChartGuideTick[];
  onStartEntryEdit: (
    event: PointerEvent<HTMLElement>,
    entry: ChartEntry,
    kind: ChartEntryEditKind
  ) => void;
  rows: ChartRow[];
  scrollLeft: number;
  timelineWidth: number;
  unitWidth: number;
}): ReactElement {
  const chronicleLayout = activeSource === "chronicle"
    ? buildChronicleLayout(rows, dragPreview)
    : { laneCount: 1, segments: [] };
  const trackHeight = activeSource === "date"
    ? Math.max(1, rows.length) * ROW_HEIGHT
    : chronicleLayout.laneCount * ROW_HEIGHT;

  return (
    <div
      className={`chronicle-tracks${activeSource === "date" ? " chronicle-tracks--date" : ""}`}
      style={{
        height: trackHeight,
        width: timelineWidth
      } as CSSProperties}
    >
      <ChartGuideLines
        axisStart={axisStart}
        dateScale={dateScale}
        rowCount={activeSource === "date" ? Math.max(1, rows.length) : chronicleLayout.laneCount}
        source={activeSource}
        ticks={guideTicks}
        unitWidth={unitWidth}
      />
      {activeSource === "date" ? (
        <TodayLine axisEnd={axisEnd} axisStart={axisStart} unitWidth={unitWidth} />
      ) : null}
      {activeSource === "chronicle" ? chronicleLayout.segments.map((segment) => (
        <ChronicleEntryBar
          activeSource={activeSource}
          axisStart={axisStart}
          continuesFromPrevious={segment.continuesFromPrevious}
          continuesToNext={segment.continuesToNext}
          dateScale={dateScale}
          displayEntry={segment.displayEntry}
          dragPreview={dragPreview}
          entry={segment.entry}
          key={segment.key}
          onStartEntryEdit={onStartEntryEdit}
          overlapCount={segment.overlapCount}
          overlapIndex={segment.overlapIndex}
          scrollLeft={scrollLeft}
          segmentEndValue={segment.segmentEndValue}
          segmentStartValue={segment.segmentStartValue}
          trackHeight={trackHeight}
          unitWidth={unitWidth}
          zIndex={segment.overlapIndex + 10}
        />
      )) : rows.map((row, index) => row.entries.map((entry) => (
        <ChronicleEntryBar
          activeSource={activeSource}
          axisStart={axisStart}
          continuesFromPrevious={false}
          continuesToNext={false}
          dateScale={dateScale}
          displayEntry={entry}
          dragPreview={dragPreview}
          entry={entry}
          key={entryKey(entry)}
          onStartEntryEdit={onStartEntryEdit}
          overlapCount={1}
          overlapIndex={0}
          rowIndex={activeSource === "date" ? index : 0}
          scrollLeft={scrollLeft}
          trackHeight={trackHeight}
          unitWidth={unitWidth}
        />
      )))}
    </div>
  );
}

function buildChronicleLayout(rows: ChartRow[], dragPreview: DragPreview | null): ChronicleLayout {
  let order = 0;
  const entries = rows.flatMap((row) =>
    row.entries.map((entry) => {
      const currentOrder = order;
      order += 1;
      return {
        displayEntry: previewEntryForDrag(entry, dragPreview),
        entry,
        order: currentOrder
      };
    })
  );
  const laneIndexes = assignChronicleLaneIndexes(entries);
  const orderedEntries: OrderedChronicleEntry[] = entries.map((entryItem) => ({
    ...entryItem,
    laneIndex: laneIndexes[entryItem.order] ?? 0
  }));

  const points = new Set<number>();
  for (const item of orderedEntries) {
    points.add(item.displayEntry.startValue);
    points.add(item.displayEntry.endValue + 1);
  }

  const sortedPoints = [...points].toSorted((a, b) => a - b);
  const segments: ChronicleSegment[] = [];
  let laneCount = 1;

  for (let pointIndex = 0; pointIndex < sortedPoints.length - 1; pointIndex += 1) {
    const segmentStartValue = sortedPoints[pointIndex];
    const segmentEndExclusive = sortedPoints[pointIndex + 1];
    if (segmentEndExclusive <= segmentStartValue) continue;

    const activeEntries = orderedEntries
      .filter((item) => item.displayEntry.startValue < segmentEndExclusive && item.displayEntry.endValue + 1 > segmentStartValue)
      .toSorted((a, b) => a.laneIndex - b.laneIndex || a.order - b.order);
    laneCount = Math.max(laneCount, activeEntries.length);

    activeEntries.forEach((item, overlapIndex) => {
      segments.push({
        continuesFromPrevious: segmentStartValue > item.displayEntry.startValue,
        continuesToNext: segmentEndExclusive - 1 < item.displayEntry.endValue,
        displayEntry: item.displayEntry,
        entry: item.entry,
        key: `${entryKey(item.entry)}:${segmentStartValue}:${segmentEndExclusive}:${overlapIndex}`,
        overlapCount: activeEntries.length,
        overlapIndex,
        segmentEndValue: segmentEndExclusive - 1,
        segmentStartValue
      });
    });
  }

  return { laneCount, segments };
}

function assignChronicleLaneIndexes(
  entries: Array<Omit<OrderedChronicleEntry, "laneIndex">>
): Record<number, number> {
  const laneEndValues: number[] = [];
  const preferredLaneByFile = new Map<string, number>();
  const laneIndexes: Record<number, number> = {};

  for (const item of entries.toSorted((a, b) =>
    a.displayEntry.startValue - b.displayEntry.startValue ||
    a.displayEntry.endValue - b.displayEntry.endValue ||
    a.order - b.order
  )) {
    const fileKey = item.entry.path || item.entry.fileName;
    const preferredLane = preferredLaneByFile.get(fileKey);
    const laneIndex = preferredLane !== undefined && (laneEndValues[preferredLane] ?? -Infinity) < item.displayEntry.startValue
      ? preferredLane
      : laneEndValues.findIndex((endValue) => endValue < item.displayEntry.startValue);
    const nextLaneIndex = laneIndex === -1 ? laneEndValues.length : laneIndex;

    laneEndValues[nextLaneIndex] = item.displayEntry.endValue;
    preferredLaneByFile.set(fileKey, nextLaneIndex);
    laneIndexes[item.order] = nextLaneIndex;
  }

  return laneIndexes;
}

function ChronicleEntryBar({
  activeSource,
  axisStart,
  continuesFromPrevious,
  continuesToNext,
  dateScale,
  displayEntry,
  dragPreview,
  entry,
  onStartEntryEdit,
  overlapCount,
  overlapIndex,
  rowIndex,
  scrollLeft,
  segmentEndValue,
  segmentStartValue,
  trackHeight,
  unitWidth,
  zIndex
}: {
  activeSource: ChartSource;
  axisStart: number;
  continuesFromPrevious: boolean;
  continuesToNext: boolean;
  dateScale: DateScale | null;
  displayEntry: ChartEntry;
  dragPreview: DragPreview | null;
  entry: ChartEntry;
  onStartEntryEdit: (
    event: PointerEvent<HTMLElement>,
    entry: ChartEntry,
    kind: ChartEntryEditKind
  ) => void;
  overlapCount: number;
  overlapIndex: number;
  rowIndex?: number;
  scrollLeft: number;
  segmentEndValue?: number;
  segmentStartValue?: number;
  trackHeight: number;
  unitWidth: number;
  zIndex?: number;
}): ReactElement {
  const t = useT();
  const previewEntry = activeSource === "chronicle" ? displayEntry : previewEntryForDrag(entry, dragPreview);
  const startValue = segmentStartValue ?? previewEntry.startValue;
  const endValue = segmentEndValue ?? previewEntry.endValue;
  const valueLeft = Math.max(0, (startValue - axisStart) * unitWidth);
  const isSingleValue = startValue === endValue;
  const rangeLabel = formatRange(previewEntry, activeSource, dateScale);
  const labelWidth = labelWidthForText(rangeLabel);
  const naturalWidth = isSingleValue ? unitWidth : (endValue - startValue + 1) * unitWidth;
  const width = Math.max(4, naturalWidth);
  const left = activeSource === "chronicle" && isSingleValue
    ? Math.max(0, valueLeft + (naturalWidth - width) / 2)
    : valueLeft;
  const maxLabelLeft = Math.max(0, width - labelWidth);
  const labelLeft = isSingleValue
    ? (width - labelWidth) / 2
    : Math.max(7, Math.min(maxLabelLeft, scrollLeft - left + 7));
  const top = activeSource === "date"
    ? (rowIndex ?? 0) * ROW_HEIGHT + dateFillOffset()
    : (trackHeight / overlapCount) * overlapIndex;
  const fillHeight = activeSource === "date" ? dateFillHeight() : trackHeight / overlapCount;
  const showStartResize = activeSource === "date" || startValue === previewEntry.startValue;
  const showEndResize = activeSource === "date" || endValue === previewEntry.endValue;
  const showRangeLabel = activeSource === "date" || !continuesFromPrevious;
  const borderRadius = activeSource === "chronicle"
    ? `${continuesFromPrevious ? 0 : 3}px ${continuesToNext ? 0 : 3}px ${continuesToNext ? 0 : 3}px ${continuesFromPrevious ? 0 : 3}px`
    : undefined;
  const chronicleColorStyle = activeSource === "chronicle" ? chronicleColorStyleForEntry(entry) : {};
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
        ...chronicleColorStyle,
        height: fillHeight,
        left,
        borderRadius,
        top,
        width,
        zIndex
      }}
      title={`${entry.fileName}${activeSource === "date" ? ` ${formatDateKindLabel(entry.dateKind, t)}: ` : " "}${rangeLabel}`}
      type="button"
    >
      {showStartResize ? (
        <span
          aria-hidden="true"
          className="chronicle-fill-resize chronicle-fill-resize--start"
          onPointerDown={(event) => onStartEntryEdit(event, entry, "resize-start")}
        />
      ) : null}
      {showRangeLabel ? (
        <span className="chronicle-fill-label" style={{ left: labelLeft, width: labelWidth }}>{rangeLabel}</span>
      ) : null}
      {statusLabel ? (
        <span className="chronicle-fill-status" style={{ left: statusLabelLeft, width: statusBadgeWidth }}>
          {statusLabel}
        </span>
      ) : null}
      {showEndResize ? (
        <span
          aria-hidden="true"
          className="chronicle-fill-resize chronicle-fill-resize--end"
          onPointerDown={(event) => onStartEntryEdit(event, entry, "resize-end")}
        />
      ) : null}
    </button>
  );
}

function chronicleColorStyleForEntry(entry: ChartEntry): CSSProperties {
  const color = CHRONICLE_COLOR_PALETTE[stableColorIndex(entry.path || entry.fileName, CHRONICLE_COLOR_PALETTE.length)];

  return {
    "--chronicle-fill": `hsla(${color.hue}, 58%, ${color.lightness}%, 0.38)`,
    "--chronicle-fill-active": `hsla(${color.hue}, 58%, ${Math.max(32, color.lightness - 4)}%, 0.62)`,
    "--chronicle-fill-hover": `hsla(${color.hue}, 58%, ${Math.max(34, color.lightness - 2)}%, 0.5)`
  } as CSSProperties;
}

function stableColorIndex(value: string, modulo: number): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash % modulo;
}
