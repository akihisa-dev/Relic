import { useMemo, useState, type CSSProperties, type PointerEvent, type ReactElement } from "react";

import type { ChartEntry, ChartEntryEditKind, ChartSource } from "../../shared/ipc";
import { useT } from "../i18n";
import {
  entryKey,
  formatRange,
  isPreviewForEntry,
  labelWidthForText,
  previewEntryForDrag,
  type ChartGuideTick,
  type ChartRow,
  type DragPreview,
  type TimelineVisibleRange
} from "../chronicleTimeline";
import { IconFiles } from "./RailNavigationIcons";
import { ChartGuideLines } from "./chronicleChartParts";

const CHRONICLE_MIN_SEGMENT_HEIGHT = 72;
const CHRONICLE_LABEL_HEIGHT = 18;
const CHRONICLE_LABEL_PADDING_X = 7;
const CHRONICLE_VIEWPORT_LABEL_MARGIN = 8;
const CHRONICLE_NODE_RADIUS = 6;

interface OrderedChronicleEntry {
  displayEntry: ChartEntry;
  entry: ChartEntry;
  laneIndex: number;
  order: number;
}

interface ChronicleEntryShape {
  displayEntry: ChartEntry;
  entry: ChartEntry;
  fileNameLabelWidth: number;
  fileNameLabelX: number;
  fileNameLabelY: number;
  height: number;
  key: string;
  labelX: number;
  labelY: number;
  labelWidth: number;
  width: number;
  x: number;
  y: number;
}

export function ChronicleTracks({
  activeSource,
  axisStart,
  dragPreview,
  guideTicks,
  onStartEntryEdit,
  onOpenFile,
  rows,
  scrollLeft,
  trackViewportHeight,
  timelineViewportWidth,
  timelineWidth,
  unitWidth,
  visibleRange
}: {
  activeSource: ChartSource;
  axisStart: number;
  dragPreview: DragPreview | null;
  guideTicks: ChartGuideTick[];
  onStartEntryEdit: (
    event: PointerEvent<Element>,
    entry: ChartEntry,
    kind: ChartEntryEditKind
  ) => void;
  onOpenFile: (path: string) => void;
  rows: ChartRow[];
  scrollLeft: number;
  trackViewportHeight: number;
  timelineViewportWidth: number;
  timelineWidth: number;
  unitWidth: number;
  visibleRange?: TimelineVisibleRange;
}): ReactElement {
  const t = useT();
  const [hoveredChronicleKey, setHoveredChronicleKey] = useState<string | null>(null);
  const [selectedChronicleKey, setSelectedChronicleKey] = useState<string | null>(null);
  const chronicleLaneIndexes = useMemo(
    () => activeSource === "chronicle"
      ? buildChronicleLaneIndexes(rows, dragPreview)
      : {},
    [activeSource, dragPreview, rows]
  );
  const chronicleLaneCount = activeSource === "chronicle"
    ? Math.max(1, Object.values(chronicleLaneIndexes).reduce((max, laneIndex) => Math.max(max, laneIndex + 1), 1))
    : 1;
  const chronicleLaneHeight = Math.max(
    CHRONICLE_MIN_SEGMENT_HEIGHT,
    trackViewportHeight / chronicleLaneCount
  );
  const chronicleTrackHeight = chronicleLaneCount * chronicleLaneHeight;
  const chronicleShapes = useMemo(
    () => activeSource === "chronicle"
      ? buildChronicleEntryShapes(rows, dragPreview, chronicleLaneIndexes, {
        axisStart,
        laneHeight: chronicleLaneHeight,
        scrollLeft,
        timelineViewportWidth,
        unitWidth
      })
      : [],
    [activeSource, axisStart, chronicleLaneHeight, chronicleLaneIndexes, dragPreview, rows, scrollLeft, timelineViewportWidth, unitWidth]
  );
  const hoveredChronicleShape = activeSource === "chronicle"
    ? chronicleShapes.find((shape) => shape.key === hoveredChronicleKey) ?? null
    : null;
  const selectedChronicleShape = activeSource === "chronicle"
    ? chronicleShapes.find((shape) => shape.key === selectedChronicleKey) ?? null
    : null;
  const activeChronicleShape = activeSource === "chronicle"
    ? hoveredChronicleShape ?? selectedChronicleShape
    : null;
  const visibleChronicleShapes = useMemo(
    () => activeSource === "chronicle"
      ? visibleChronicleEntryShapes(chronicleShapes, {
        activeKey: activeChronicleShape?.key ?? null,
        dragPreview,
        visibleRange
      })
      : [],
    [activeChronicleShape?.key, activeSource, chronicleShapes, dragPreview, visibleRange]
  );
  const trackHeight = chronicleTrackHeight;

  return (
    <div
      className="chronicle-tracks"
      style={{
        height: trackHeight,
        width: timelineWidth
      } as CSSProperties}
    >
      <ChartGuideLines
        axisStart={axisStart}
        rowCount={0}
        source={activeSource}
        ticks={guideTicks}
        unitWidth={unitWidth}
      />
      {activeSource === "chronicle" ? (
        <svg
          aria-label={t("chronicle.timelineAria")}
          className="chronicle-tracks-svg"
          height={trackHeight}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedChronicleKey(null);
            }
          }}
          role="group"
          viewBox={`0 0 ${timelineWidth} ${trackHeight}`}
          width={timelineWidth}
        >
          {Array.from({ length: chronicleLaneCount - 1 }, (_, index) => (
            <line
              className="chronicle-lane-divider"
              key={`lane-divider-${index}`}
              x1={0}
              x2={timelineWidth}
              y1={(index + 1) * chronicleLaneHeight}
              y2={(index + 1) * chronicleLaneHeight}
            />
          ))}
          {visibleChronicleShapes.map((shape) => (
            <ChronicleEntrySvgShape
              dragPreview={dragPreview}
              onHoverEntry={(key) => setHoveredChronicleKey(key)}
              onLeaveEntry={(key) => {
                setHoveredChronicleKey((current) => current === key ? null : current);
              }}
              onSelectEntry={(key) => setSelectedChronicleKey(key)}
              key={shape.key}
              onStartEntryEdit={onStartEntryEdit}
              shape={shape}
            />
          ))}
          {hoveredChronicleKey ? (
            <ChronicleHoverFileNameLabel
              shape={hoveredChronicleShape}
              timelineWidth={timelineWidth}
            />
          ) : null}
        </svg>
      ) : null}
      {activeChronicleShape ? (
        <ChronicleEntryCard
          onOpenFile={onOpenFile}
          shape={activeChronicleShape}
          timelineWidth={timelineWidth}
        />
      ) : null}
    </div>
  );
}

function buildChronicleEntryShapes(
  rows: ChartRow[],
  dragPreview: DragPreview | null,
  laneIndexes: Record<number, number>,
  {
    axisStart,
    laneHeight,
    scrollLeft,
    timelineViewportWidth,
    unitWidth
  }: {
    axisStart: number;
    laneHeight: number;
    scrollLeft: number;
    timelineViewportWidth: number;
    unitWidth: number;
  }
): ChronicleEntryShape[] {
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
  return entries.map((item) => {
    const laneIndex = laneIndexes[item.order] ?? 0;
    const startValue = item.displayEntry.startValue;
    const endValue = item.displayEntry.endValue;
    const valueLeft = Math.max(0, (startValue - axisStart + 0.5) * unitWidth);
    const isSingleValue = startValue === endValue;
    const rangeLabel = formatRange(item.displayEntry);
    const fileNameLabelWidth = labelWidthForText(item.entry.fileName);
    const labelWidth = labelWidthForText(rangeLabel);
    const naturalWidth = isSingleValue ? 0 : (endValue - startValue) * unitWidth;
    const width = Math.max(isSingleValue ? 0 : 18, naturalWidth);
    const x = valueLeft;
    const height = laneHeight;
    const y = laneIndex * laneHeight;
    const lineCenter = x + width / 2;
    const fileNameLabelX = clampLabelX(
      lineCenter - fileNameLabelWidth / 2,
      fileNameLabelWidth,
      scrollLeft,
      timelineViewportWidth
    );
    const fileNameLabelY = y + height / 2 - 15;
    const labelX = clampLabelX(
      lineCenter - labelWidth / 2,
      labelWidth,
      scrollLeft,
      timelineViewportWidth
    );
    const labelY = y + height / 2 + 25;
    return {
      displayEntry: item.displayEntry,
      entry: item.entry,
      fileNameLabelWidth,
      fileNameLabelX,
      fileNameLabelY,
      height,
      key: entryKey(item.entry),
      labelWidth,
      labelX,
      labelY,
      width,
      x,
      y
    };
  });
}

function visibleChronicleEntryShapes(
  shapes: ChronicleEntryShape[],
  {
    activeKey,
    dragPreview,
    visibleRange
  }: {
    activeKey: string | null;
    dragPreview: DragPreview | null;
    visibleRange?: TimelineVisibleRange;
  }
): ChronicleEntryShape[] {
  if (!visibleRange) return shapes;

  const buffer = Math.max(1, Math.floor((visibleRange.visibleEnd - visibleRange.visibleStart + 1) * 0.25));
  const startValue = visibleRange.visibleStart - buffer;
  const endValue = visibleRange.visibleEnd + buffer;

  return shapes.filter((shape) => (
    shape.key === activeKey ||
    isPreviewForEntry(shape.entry, dragPreview, "chronicle") ||
    rangesOverlap(shape.displayEntry.startValue, shape.displayEntry.endValue, startValue, endValue)
  ));
}

function rangesOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA <= endB && endA >= startB;
}

function clampLabelX(
  preferredX: number,
  labelWidth: number,
  scrollLeft: number,
  timelineViewportWidth: number
): number {
  const visibleLeft = scrollLeft + CHRONICLE_VIEWPORT_LABEL_MARGIN;
  const visibleRight = scrollLeft + Math.max(CHRONICLE_VIEWPORT_LABEL_MARGIN, timelineViewportWidth - CHRONICLE_VIEWPORT_LABEL_MARGIN);
  const maxLabelX = Math.max(visibleLeft, visibleRight - labelWidth);

  return Math.max(visibleLeft, Math.min(maxLabelX, preferredX));
}

function buildChronicleLaneIndexes(rows: ChartRow[], dragPreview: DragPreview | null): Record<number, number> {
  let order = 0;
  const entries = rows.flatMap((row) =>
    row.entries.map((entry) => {
      const currentOrder = order;
      order += 1;
      const shouldFreezeLane = dragPreview?.source === "chronicle";
      return {
        displayEntry: shouldFreezeLane ? entry : previewEntryForDrag(entry, dragPreview),
        entry,
        order: currentOrder
      };
    })
  );

  return assignChronicleLaneIndexes(entries);
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
      : findAvailableLaneIndex(laneEndValues, item.displayEntry.startValue);
    const nextLaneIndex = laneIndex === -1 ? laneEndValues.length : laneIndex;

    laneEndValues[nextLaneIndex] = item.displayEntry.endValue;
    preferredLaneByFile.set(fileKey, nextLaneIndex);
    laneIndexes[item.order] = nextLaneIndex;
  }

  return laneIndexes;
}

function findAvailableLaneIndex(laneEndValues: number[], startValue: number): number {
  for (let index = 0; index < laneEndValues.length; index += 1) {
    if (laneEndValues[index] < startValue) return index;
  }

  return -1;
}

function ChronicleEntrySvgShape({
  dragPreview,
  onHoverEntry,
  onLeaveEntry,
  onSelectEntry,
  onStartEntryEdit,
  shape
}: {
  dragPreview: DragPreview | null;
  onHoverEntry: (key: string) => void;
  onLeaveEntry: (key: string) => void;
  onSelectEntry: (key: string) => void;
  onStartEntryEdit: (
    event: PointerEvent<Element>,
    entry: ChartEntry,
    kind: ChartEntryEditKind
  ) => void;
  shape: ChronicleEntryShape;
}): ReactElement {
  const { entry } = shape;
  const rangeLabel = formatRange(shape.displayEntry);
  const isDragging = isPreviewForEntry(entry, dragPreview, "chronicle");

  return (
    <g
      aria-label={`${entry.fileName} ${rangeLabel}`}
      className={`chronicle-fill chronicle-fill--chronicle${isDragging ? " chronicle-fill--dragging" : ""}`}
      onPointerDown={(event) => {
        onSelectEntry(shape.key);
        onStartEntryEdit(event, entry, "move");
      }}
      onPointerEnter={() => onHoverEntry(shape.key)}
      onPointerLeave={() => onLeaveEntry(shape.key)}
      role="button"
      tabIndex={0}
    >
      <title>{`${entry.fileName} ${rangeLabel}`}</title>
      <line
        className="chronicle-fill-shape"
        x1={shape.x}
        x2={shape.x + shape.width}
        y1={shape.y + shape.height / 2}
        y2={shape.y + shape.height / 2}
      />
      <line
        className="chronicle-fill-hit"
        x1={shape.x}
        x2={shape.x + Math.max(shape.width, CHRONICLE_NODE_RADIUS * 2)}
        y1={shape.y + shape.height / 2}
        y2={shape.y + shape.height / 2}
      />
      <circle
        className="chronicle-fill-node chronicle-fill-node--start"
        cx={shape.x}
        cy={shape.y + shape.height / 2}
        r={CHRONICLE_NODE_RADIUS}
      />
      {shape.width > 0 ? (
        <circle
          className="chronicle-fill-node chronicle-fill-node--end"
          cx={shape.x + shape.width}
          cy={shape.y + shape.height / 2}
          r={CHRONICLE_NODE_RADIUS}
        />
      ) : null}
      <rect
        className="chronicle-fill-label-bg chronicle-fill-label-bg--file"
        height={CHRONICLE_LABEL_HEIGHT}
        rx={4}
        ry={4}
        width={shape.fileNameLabelWidth}
        x={shape.fileNameLabelX}
        y={shape.fileNameLabelY - 14}
      />
      <text
        className="chronicle-fill-label chronicle-fill-file-label"
        dominantBaseline="middle"
        x={shape.fileNameLabelX + CHRONICLE_LABEL_PADDING_X}
        y={shape.fileNameLabelY - 5}
      >
        {entry.fileName}
      </text>
      {shape.labelWidth > 0 ? (
        <>
          <rect
            className="chronicle-fill-label-bg chronicle-fill-label-bg--range"
            height={CHRONICLE_LABEL_HEIGHT}
            rx={4}
            ry={4}
            width={shape.labelWidth}
            x={shape.labelX}
            y={shape.labelY - 14}
          />
          <text
            className="chronicle-fill-label chronicle-fill-range-label"
            dominantBaseline="middle"
            x={shape.labelX + CHRONICLE_LABEL_PADDING_X}
            y={shape.labelY - 5}
          >
            {rangeLabel}
          </text>
        </>
      ) : null}
      <rect
        aria-hidden="true"
        className="chronicle-fill-resize chronicle-fill-resize--start"
        height={24}
        onPointerDown={(event) => onStartEntryEdit(event, entry, "resize-start")}
        width={14}
        x={shape.x - 7}
        y={shape.y + shape.height / 2 - 12}
      />
      <rect
        aria-hidden="true"
        className="chronicle-fill-resize chronicle-fill-resize--end"
        height={24}
        onPointerDown={(event) => onStartEntryEdit(event, entry, "resize-end")}
        width={14}
        x={shape.x + shape.width - 7}
        y={shape.y + shape.height / 2 - 12}
      />
    </g>
  );
}

function ChronicleHoverFileNameLabel({
  shape,
  timelineWidth
}: {
  shape: ChronicleEntryShape | null;
  timelineWidth: number;
}): ReactElement | null {
  if (!shape) return null;

  const labelWidth = labelWidthForText(shape.entry.fileName);
  const labelX = Math.max(0, Math.min(Math.max(0, timelineWidth - labelWidth), shape.fileNameLabelX));
  const labelY = shape.fileNameLabelY;

  return (
    <g className="chronicle-hover-file-label">
      <rect
        className="chronicle-fill-label-bg chronicle-fill-label-bg--hover-file"
        height={CHRONICLE_LABEL_HEIGHT}
        rx={4}
        ry={4}
        width={labelWidth}
        x={labelX}
        y={labelY - 14}
      />
      <text
        className="chronicle-fill-label chronicle-fill-file-label chronicle-fill-file-label--hover"
        dominantBaseline="middle"
        x={labelX + CHRONICLE_LABEL_PADDING_X}
        y={labelY - 5}
      >
        {shape.entry.fileName}
      </text>
    </g>
  );
}

function ChronicleEntryCard({
  onOpenFile,
  shape,
  timelineWidth
}: {
  onOpenFile: (path: string) => void;
  shape: ChronicleEntryShape;
  timelineWidth: number;
}): ReactElement {
  const t = useT();
  const rangeLabel = formatRange(shape.displayEntry);
  const left = Math.max(8, Math.min(timelineWidth - 260, shape.x + 10));
  const top = shape.y + 10;

  return (
    <div
      className="chronicle-entry-card"
      onPointerDown={(event) => event.stopPropagation()}
      style={{ left, top } as CSSProperties}
    >
      <button
        aria-label={t("chronicle.openFileAria", { name: shape.entry.fileName })}
        className="chronicle-entry-card-open"
        onClick={(event) => {
          event.stopPropagation();
          onOpenFile(shape.entry.path);
        }}
        type="button"
      >
        <IconFiles />
      </button>
      <div className="chronicle-entry-card-body">
        <div className="chronicle-entry-card-file">{shape.entry.fileName}</div>
        <div className="chronicle-entry-card-range">{rangeLabel}</div>
      </div>
    </div>
  );
}
