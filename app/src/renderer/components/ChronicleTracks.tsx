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

const CHRONICLE_MIN_SEGMENT_HEIGHT = 38;
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

interface ChronicleSegmentRect extends ChronicleSegment {
  height: number;
  labelX: number;
  labelY: number;
  labelWidth: number;
  path: string;
  width: number;
  x: number;
  y: number;
}

interface ChronicleEntryShape {
  displayEntry: ChartEntry;
  entry: ChartEntry;
  key: string;
  labelSegment: ChronicleSegmentRect | null;
  path: string;
  resizeEnd: ChronicleSegmentRect | null;
  resizeStart: ChronicleSegmentRect | null;
  segments: ChronicleSegmentRect[];
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
    event: PointerEvent<Element>,
    entry: ChartEntry,
    kind: ChartEntryEditKind
  ) => void;
  rows: ChartRow[];
  scrollLeft: number;
  timelineWidth: number;
  unitWidth: number;
}): ReactElement {
  const chronicleSegments = activeSource === "chronicle"
    ? buildChronicleSegments(rows, dragPreview)
    : [];
  const chronicleTrackHeight = Math.max(
    CHRONICLE_MIN_SEGMENT_HEIGHT,
    maxChronicleOverlapCount(chronicleSegments) * CHRONICLE_MIN_SEGMENT_HEIGHT
  );
  const chronicleShapes = activeSource === "chronicle"
    ? buildChronicleEntryShapes(chronicleSegments, {
        axisStart,
        dateScale,
        scrollLeft,
        trackHeight: chronicleTrackHeight,
        unitWidth
      })
    : [];
  const trackHeight = activeSource === "date"
    ? Math.max(1, rows.length) * ROW_HEIGHT
    : chronicleTrackHeight;

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
        rowCount={activeSource === "date" ? Math.max(1, rows.length) : 0}
        source={activeSource}
        ticks={guideTicks}
        unitWidth={unitWidth}
      />
      {activeSource === "date" ? (
        <TodayLine axisEnd={axisEnd} axisStart={axisStart} unitWidth={unitWidth} />
      ) : null}
      {activeSource === "chronicle" ? (
        <svg
          aria-label="年表"
          className="chronicle-tracks-svg"
          height={trackHeight}
          role="group"
          viewBox={`0 0 ${timelineWidth} ${trackHeight}`}
          width={timelineWidth}
        >
          {chronicleShapes.map((shape) => (
            <ChronicleEntrySvgShape
              dateScale={dateScale}
              dragPreview={dragPreview}
              key={shape.key}
              onStartEntryEdit={onStartEntryEdit}
              shape={shape}
            />
          ))}
        </svg>
      ) : rows.map((row, index) => row.entries.map((entry) => (
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

function maxChronicleOverlapCount(segments: ChronicleSegment[]): number {
  return segments.reduce((max, segment) => Math.max(max, segment.overlapCount), 1);
}

function buildChronicleEntryShapes(
  segments: ChronicleSegment[],
  {
    axisStart,
    dateScale,
    scrollLeft,
    trackHeight,
    unitWidth
  }: {
    axisStart: number;
    dateScale: DateScale | null;
    scrollLeft: number;
    trackHeight: number;
    unitWidth: number;
  }
): ChronicleEntryShape[] {
  const shapeMap = new Map<string, ChronicleSegmentRect[]>();

  for (const segment of segments) {
    const rect = chronicleSegmentRect(segment, {
      axisStart,
      dateScale,
      scrollLeft,
      trackHeight,
      unitWidth
    });
    const key = entryKey(segment.entry);
    const current = shapeMap.get(key);

    if (current) {
      current.push(rect);
    } else {
      shapeMap.set(key, [rect]);
    }
  }

  return [...shapeMap.entries()].map(([key, rects]) => {
    const sortedRects = rects.toSorted((a, b) => a.segmentStartValue - b.segmentStartValue);
    const first = sortedRects[0];
    const labelSegment = sortedRects.find((rect) => !rect.continuesFromPrevious) ?? first ?? null;
    const resizeStart = sortedRects.find((rect) => rect.segmentStartValue === rect.displayEntry.startValue) ?? null;
    const resizeEnd = sortedRects.find((rect) => rect.segmentEndValue === rect.displayEntry.endValue) ?? null;

    return {
      displayEntry: first.displayEntry,
      entry: first.entry,
      key,
      labelSegment,
      path: chronicleShapePath(sortedRects),
      resizeEnd,
      resizeStart,
      segments: sortedRects
    };
  });
}

function chronicleSegmentRect(
  segment: ChronicleSegment,
  {
    axisStart,
    dateScale,
    scrollLeft,
    trackHeight,
    unitWidth
  }: {
    axisStart: number;
    dateScale: DateScale | null;
    scrollLeft: number;
    trackHeight: number;
    unitWidth: number;
  }
): ChronicleSegmentRect {
  const startValue = segment.segmentStartValue;
  const endValue = segment.segmentEndValue;
  const valueLeft = Math.max(0, (startValue - axisStart) * unitWidth);
  const isSingleValue = startValue === endValue;
  const rangeLabel = formatRange(segment.displayEntry, "chronicle", dateScale);
  const labelWidth = labelWidthForText(rangeLabel);
  const naturalWidth = isSingleValue ? unitWidth : (endValue - startValue + 1) * unitWidth;
  const width = Math.max(4, naturalWidth);
  const x = isSingleValue
    ? Math.max(0, valueLeft + (naturalWidth - width) / 2)
    : valueLeft;
  const height = trackHeight / segment.overlapCount;
  const y = height * segment.overlapIndex;
  const maxLabelLeft = Math.max(0, width - labelWidth);
  const labelLeft = isSingleValue
    ? (width - labelWidth) / 2
    : Math.max(7, Math.min(maxLabelLeft, scrollLeft - x + 7));
  const labelX = x + labelLeft;
  const labelY = y + Math.max(15, Math.min(height - 5, height / 2 + 4));
  const labelBackgroundWidth = Math.min(labelWidth, Math.max(0, width - labelLeft));

  return {
    ...segment,
    height,
    labelX,
    labelY,
    labelWidth: labelBackgroundWidth,
    path: rectPath(x, y, width, height),
    width,
    x,
    y
  };
}

function chronicleShapePath(segments: ChronicleSegmentRect[]): string {
  if (segments.length === 0) return "";

  const [first, ...rest] = segments;
  const commands = [`M ${first.x},${first.y}`];
  let previousTop = first.y;

  commands.push(`L ${first.x + first.width},${first.y}`);
  for (const segment of rest) {
    const boundaryX = segment.x;
    if (segment.y !== previousTop) {
      commands.push(`L ${boundaryX},${previousTop}`);
      commands.push(`L ${boundaryX},${segment.y}`);
    }
    commands.push(`L ${segment.x + segment.width},${segment.y}`);
    previousTop = segment.y;
  }

  const last = segments[segments.length - 1];
  let previousBottom = last.y + last.height;

  commands.push(`L ${last.x + last.width},${previousBottom}`);
  for (let index = segments.length - 2; index >= 0; index -= 1) {
    const segment = segments[index];
    const boundaryX = segments[index + 1].x;
    const bottom = segment.y + segment.height;
    if (bottom !== previousBottom) {
      commands.push(`L ${boundaryX},${previousBottom}`);
      commands.push(`L ${boundaryX},${bottom}`);
    }
    commands.push(`L ${segment.x},${bottom}`);
    previousBottom = bottom;
  }

  return `${commands.join(" ")} Z`;
}

function rectPath(x: number, y: number, width: number, height: number): string {
  return `M ${x},${y} H ${x + width} V ${y + height} H ${x} Z`;
}

function buildChronicleSegments(rows: ChartRow[], dragPreview: DragPreview | null): ChronicleSegment[] {
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
  const orderedEntries: OrderedChronicleEntry[] = entries.map((item) => ({
    ...item,
    laneIndex: laneIndexes[item.order] ?? 0
  }));
  const points = new Set<number>();

  for (const item of orderedEntries) {
    points.add(item.displayEntry.startValue);
    points.add(item.displayEntry.endValue + 1);
  }

  const sortedPoints = [...points].toSorted((a, b) => a - b);
  const segments: ChronicleSegment[] = [];

  for (let pointIndex = 0; pointIndex < sortedPoints.length - 1; pointIndex += 1) {
    const segmentStartValue = sortedPoints[pointIndex];
    const segmentEndExclusive = sortedPoints[pointIndex + 1];
    if (segmentEndExclusive <= segmentStartValue) continue;

    const activeEntries = orderedEntries
      .filter((item) => item.displayEntry.startValue < segmentEndExclusive && item.displayEntry.endValue + 1 > segmentStartValue)
      .toSorted((a, b) => a.laneIndex - b.laneIndex || a.order - b.order);

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

  return segments;
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

function ChronicleEntrySvgShape({
  dateScale,
  dragPreview,
  onStartEntryEdit,
  shape
}: {
  dateScale: DateScale | null;
  dragPreview: DragPreview | null;
  onStartEntryEdit: (
    event: PointerEvent<Element>,
    entry: ChartEntry,
    kind: ChartEntryEditKind
  ) => void;
  shape: ChronicleEntryShape;
}): ReactElement {
  const t = useT();
  const { entry } = shape;
  const rangeLabel = formatRange(shape.displayEntry, "chronicle", dateScale);
  const colorStyle = chronicleColorStyleForEntry(entry);
  const isDragging = isPreviewForEntry(entry, dragPreview, "chronicle");
  const labelSegment = shape.labelSegment;

  return (
    <g
      aria-label={`${entry.fileName} ${formatDateKindLabel(entry.dateKind, t)} ${rangeLabel}`}
      className={`chronicle-fill chronicle-fill--chronicle${isDragging ? " chronicle-fill--dragging" : ""}`}
      onPointerDown={(event) => onStartEntryEdit(event, entry, "move")}
      role="button"
      style={colorStyle}
      tabIndex={0}
    >
      <title>{`${entry.fileName} ${rangeLabel}`}</title>
      <path
        className="chronicle-fill-shape"
        d={shape.path}
      />
      {shape.segments.map((segment) => (
        <path
          className="chronicle-fill-hit"
          d={segment.path}
          key={segment.key}
        />
      ))}
      {labelSegment && labelSegment.labelWidth > 0 ? (
        <>
          <rect
            className="chronicle-fill-label-bg"
            height={18}
            rx={4}
            ry={4}
            width={labelSegment.labelWidth}
            x={labelSegment.labelX}
            y={labelSegment.labelY - 14}
          />
          <text
            className="chronicle-fill-label"
            dominantBaseline="middle"
            x={labelSegment.labelX + 7}
            y={labelSegment.labelY - 5}
          >
            {rangeLabel}
          </text>
        </>
      ) : null}
      {shape.resizeStart ? (
        <rect
          aria-hidden="true"
          className="chronicle-fill-resize chronicle-fill-resize--start"
          height={Math.max(18, shape.resizeStart.height - 8)}
          onPointerDown={(event) => onStartEntryEdit(event, entry, "resize-start")}
          width={10}
          x={shape.resizeStart.x}
          y={shape.resizeStart.y + 4}
        />
      ) : null}
      {shape.resizeEnd ? (
        <rect
          aria-hidden="true"
          className="chronicle-fill-resize chronicle-fill-resize--end"
          height={Math.max(18, shape.resizeEnd.height - 8)}
          onPointerDown={(event) => onStartEntryEdit(event, entry, "resize-end")}
          width={10}
          x={shape.resizeEnd.x + shape.resizeEnd.width - 10}
          y={shape.resizeEnd.y + 4}
        />
      ) : null}
    </g>
  );
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
    event: PointerEvent<Element>,
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
