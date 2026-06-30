import { useMemo, useState, type CSSProperties, type PointerEvent, type ReactElement } from "react";

import type { ChartEntry, ChartEntryEditKind, ChartSource } from "../../shared/ipc";
import {
  assignChronicleLaneIndexes,
  chronicleLaneEntryKey,
  entryKey,
  formatRange,
  isPreviewForEntry,
  labelWidthForText,
  moveChronicleEntryLane,
  previewEntryForDrag,
  type ChartGuideTick,
  type ChartRow,
  type ChronicleLaneEntry,
  type ChronicleLaneIndexes,
  type DragPreview,
  type TimelineVisibleRange
} from "../chronicleTimeline";
import { startWindowPointerDrag } from "../hooks/windowPointerDrag";
import { IconFiles } from "./RailNavigationIcons";
import { ChartGuideLines } from "./chronicleChartParts";

const CHRONICLE_MIN_SEGMENT_HEIGHT = 38;
const CHRONICLE_LABEL_HEIGHT = 18;
const CHRONICLE_LABEL_PADDING_X = 7;
const CHRONICLE_MIN_LABEL_WIDTH = 16;

interface ChronicleEntryShape {
  displayEntry: ChartEntry;
  entry: ChartEntry;
  fileNameClipId: string;
  fileNameLabelWidth: number;
  fileNameLabelX: number;
  fileNameLabelY: number;
  height: number;
  key: string;
  labelClipId: string;
  labelX: number;
  labelY: number;
  labelWidth: number;
  laneIndex: number;
  path: string;
  width: number;
  x: number;
  y: number;
}

interface ChronicleLaneState {
  draggingKey: string | null;
  laneIndexes: ChronicleLaneIndexes;
  resetKey: string | null;
}

export function ChronicleTracks({
  activeSource,
  axisStart,
  dragPreview,
  guideTicks,
  onStartEntryEdit,
  onOpenFile,
  laneLayoutResetKey,
  rows,
  scrollLeft,
  trackViewportHeight,
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
  laneLayoutResetKey: string | null;
  rows: ChartRow[];
  scrollLeft: number;
  trackViewportHeight: number;
  timelineWidth: number;
  unitWidth: number;
  visibleRange?: TimelineVisibleRange;
}): ReactElement {
  const [hoveredChronicleKey, setHoveredChronicleKey] = useState<string | null>(null);
  const [selectedChronicleKey, setSelectedChronicleKey] = useState<string | null>(null);
  const [laneState, setLaneState] = useState<ChronicleLaneState>(() => ({
    draggingKey: null,
    laneIndexes: {},
    resetKey: laneLayoutResetKey
  }));
  if (laneState.resetKey !== laneLayoutResetKey) {
    setLaneState({ draggingKey: null, laneIndexes: {}, resetKey: laneLayoutResetKey });
  }
  const manualLaneIndexes = laneState.resetKey === laneLayoutResetKey ? laneState.laneIndexes : {};
  const draggingLaneKey = laneState.resetKey === laneLayoutResetKey ? laneState.draggingKey : null;
  const chronicleLaneEntries = useMemo(
    () => activeSource === "chronicle"
      ? buildChronicleLaneEntries(rows, dragPreview)
      : [],
    [activeSource, dragPreview, rows]
  );
  const chronicleLaneIndexes = useMemo(
    () => activeSource === "chronicle"
      ? assignChronicleLaneIndexes(chronicleLaneEntries, manualLaneIndexes)
      : {},
    [activeSource, chronicleLaneEntries, manualLaneIndexes]
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
        unitWidth
      })
      : [],
    [activeSource, axisStart, chronicleLaneHeight, chronicleLaneIndexes, dragPreview, rows, scrollLeft, unitWidth]
  );
  const startChronicleLaneDrag = (
    event: PointerEvent<Element>,
    entry: ChartEntry,
    laneIndex: number
  ): void => {
    if (event.button > 0) return;

    event.stopPropagation();

    const key = chronicleLaneEntryKey(entry);
    const startClientY = event.clientY;
    const startLaneIndexes = { ...chronicleLaneIndexes };
    const originalLaneIndexes = manualLaneIndexes;
    const target = event.currentTarget;

    const move = (moveEvent: globalThis.PointerEvent): void => {
      const laneDelta = Math.round((moveEvent.clientY - startClientY) / chronicleLaneHeight);
      const targetLaneIndex = Math.max(0, laneIndex + laneDelta);
      const nextLaneIndexes = moveChronicleEntryLane(
        chronicleLaneEntries,
        startLaneIndexes,
        key,
        targetLaneIndex
      );

      setLaneState({
        draggingKey: key,
        laneIndexes: nextLaneIndexes,
        resetKey: laneLayoutResetKey
      });
    };

    const stop = (stopEvent: globalThis.PointerEvent): void => {
      move(stopEvent);
      setLaneState((current) => ({
        draggingKey: null,
        laneIndexes: current.resetKey === laneLayoutResetKey ? current.laneIndexes : {},
        resetKey: laneLayoutResetKey
      }));
    };

    const cancel = (): void => {
      setLaneState({
        draggingKey: null,
        laneIndexes: originalLaneIndexes,
        resetKey: laneLayoutResetKey
      });
    };

    setLaneState({
      draggingKey: key,
      laneIndexes: startLaneIndexes,
      resetKey: laneLayoutResetKey
    });
    startWindowPointerDrag({
      event,
      onCancel: cancel,
      onMove: move,
      onUp: stop,
      pointerCaptureTarget: target
    });
  };
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
          aria-label="年表"
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
          {visibleChronicleShapes.map((shape) => (
            <ChronicleEntrySvgShape
              dragPreview={dragPreview}
              draggingLaneKey={draggingLaneKey}
              onHoverEntry={(key) => setHoveredChronicleKey(key)}
              onLeaveEntry={(key) => {
                setHoveredChronicleKey((current) => current === key ? null : current);
              }}
              onSelectEntry={(key) => setSelectedChronicleKey(key)}
              key={shape.key}
              onStartEntryEdit={onStartEntryEdit}
              onStartLaneDrag={startChronicleLaneDrag}
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

function buildChronicleLaneEntries(rows: ChartRow[], dragPreview: DragPreview | null): ChronicleLaneEntry[] {
  let order = 0;

  return rows.flatMap((row) =>
    row.entries.map((entry) => {
      const currentOrder = order;
      order += 1;
      const shouldFreezeLane = dragPreview?.source === "chronicle";

      return {
        displayEntry: shouldFreezeLane ? entry : previewEntryForDrag(entry, dragPreview),
        entry,
        key: chronicleLaneEntryKey(entry),
        order: currentOrder
      };
    })
  );
}

function buildChronicleEntryShapes(
  rows: ChartRow[],
  dragPreview: DragPreview | null,
  laneIndexes: ChronicleLaneIndexes,
  {
    axisStart,
    laneHeight,
    scrollLeft,
    unitWidth
  }: {
    axisStart: number;
    laneHeight: number;
    scrollLeft: number;
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
    const laneIndex = laneIndexes[entryKey(item.entry)] ?? 0;
    const startValue = item.displayEntry.startValue;
    const endValue = item.displayEntry.endValue;
    const valueLeft = Math.max(0, (startValue - axisStart) * unitWidth);
    const isSingleValue = startValue === endValue;
    const rangeLabel = formatRange(item.displayEntry);
    const fileNameLabelWidth = labelWidthForText(item.entry.fileName);
    const labelWidth = labelWidthForText(rangeLabel);
    const naturalWidth = isSingleValue ? unitWidth : (endValue - startValue + 1) * unitWidth;
    const width = Math.max(4, naturalWidth);
    const x = isSingleValue
      ? Math.max(0, valueLeft + (naturalWidth - width) / 2)
      : valueLeft;
    const height = laneHeight;
    const y = laneIndex * laneHeight;
    const maxLabelLeft = Math.max(0, width - labelWidth);
    const labelLeft = isSingleValue
      ? (width - labelWidth) / 2
      : Math.max(CHRONICLE_LABEL_PADDING_X, Math.min(maxLabelLeft, scrollLeft - x + CHRONICLE_LABEL_PADDING_X));
    const labelX = x + labelLeft;
    const labelY = y + Math.max(30, Math.min(height - 5, height / 2 + 12));
    const fileNameLabelX = labelX;
    const fileNameLabelY = labelY - 20;
    const fileNameBackgroundWidth = labelFitsInBar(fileNameLabelWidth, width, labelLeft) ? fileNameLabelWidth : 0;
    const labelBackgroundWidth = visibleLabelWidth(labelWidth, width - labelLeft);
    const clipKey = clipIdKey(item.entry, item.order);

    return {
      displayEntry: item.displayEntry,
      entry: item.entry,
      fileNameClipId: `chronicle-file-label-${clipKey}`,
      fileNameLabelWidth: fileNameBackgroundWidth,
      fileNameLabelX,
      fileNameLabelY,
      height,
      key: entryKey(item.entry),
      labelClipId: `chronicle-range-label-${clipKey}`,
      labelWidth: labelBackgroundWidth,
      labelX,
      labelY,
      laneIndex,
      path: roundedRectPath(x, y, width, height, 3),
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

function labelFitsInBar(labelWidth: number, barWidth: number, labelLeft: number): boolean {
  return (
    labelWidth >= CHRONICLE_MIN_LABEL_WIDTH &&
    labelLeft >= 0 &&
    labelLeft + labelWidth <= barWidth
  );
}

function visibleLabelWidth(labelWidth: number, availableWidth: number): number {
  const width = Math.min(labelWidth, Math.max(0, availableWidth));

  return width >= CHRONICLE_MIN_LABEL_WIDTH ? width : 0;
}

function clipIdKey(entry: ChartEntry, order: number): string {
  return `${entryKey(entry)}-${order}`.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function roundedRectPath(x: number, y: number, width: number, height: number, radius: number): string {
  const r = Math.min(radius, width / 2, height / 2);
  return [
    `M ${x + r},${y}`,
    `H ${x + width - r}`,
    `Q ${x + width},${y} ${x + width},${y + r}`,
    `V ${y + height - r}`,
    `Q ${x + width},${y + height} ${x + width - r},${y + height}`,
    `H ${x + r}`,
    `Q ${x},${y + height} ${x},${y + height - r}`,
    `V ${y + r}`,
    `Q ${x},${y} ${x + r},${y}`,
    "Z"
  ].join(" ");
}

function ChronicleEntrySvgShape({
  dragPreview,
  draggingLaneKey,
  onHoverEntry,
  onLeaveEntry,
  onSelectEntry,
  onStartLaneDrag,
  onStartEntryEdit,
  shape
}: {
  dragPreview: DragPreview | null;
  draggingLaneKey: string | null;
  onHoverEntry: (key: string) => void;
  onLeaveEntry: (key: string) => void;
  onSelectEntry: (key: string) => void;
  onStartLaneDrag: (
    event: PointerEvent<Element>,
    entry: ChartEntry,
    laneIndex: number
  ) => void;
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
  const isLaneDragging = draggingLaneKey === shape.key;
  const laneHandleWidth = Math.min(36, Math.max(18, shape.width - 18));

  return (
    <g
      aria-label={`${entry.fileName} ${rangeLabel}`}
      className={`chronicle-fill chronicle-fill--chronicle${isDragging || isLaneDragging ? " chronicle-fill--dragging" : ""}`}
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
      <path
        className="chronicle-fill-shape"
        d={shape.path}
      />
      <path
        className="chronicle-fill-hit"
        d={shape.path}
      />
      <rect
        aria-hidden="true"
        className="chronicle-fill-lane-drag"
        height={6}
        onPointerDown={(event) => onStartLaneDrag(event, entry, shape.laneIndex)}
        rx={3}
        ry={3}
        width={laneHandleWidth}
        x={shape.x + Math.max(9, (shape.width - laneHandleWidth) / 2)}
        y={shape.y + 3}
      />
      {shape.fileNameLabelWidth > 0 ? (
        <>
          <clipPath id={shape.fileNameClipId}>
            <rect
              height={CHRONICLE_LABEL_HEIGHT}
              width={shape.fileNameLabelWidth}
              x={shape.fileNameLabelX}
              y={shape.fileNameLabelY - 14}
            />
          </clipPath>
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
            clipPath={`url(#${shape.fileNameClipId})`}
            dominantBaseline="middle"
            x={shape.fileNameLabelX + CHRONICLE_LABEL_PADDING_X}
            y={shape.fileNameLabelY - 5}
          >
            {entry.fileName}
          </text>
        </>
      ) : null}
      {shape.labelWidth > 0 ? (
        <>
          <clipPath id={shape.labelClipId}>
            <rect
              height={CHRONICLE_LABEL_HEIGHT}
              width={shape.labelWidth}
              x={shape.labelX}
              y={shape.labelY - 14}
            />
          </clipPath>
          <rect
            className="chronicle-fill-label-bg"
            height={CHRONICLE_LABEL_HEIGHT}
            rx={4}
            ry={4}
            width={shape.labelWidth}
            x={shape.labelX}
            y={shape.labelY - 14}
          />
          <text
            className="chronicle-fill-label"
            clipPath={`url(#${shape.labelClipId})`}
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
        height={Math.max(18, shape.height - 8)}
        onPointerDown={(event) => onStartEntryEdit(event, entry, "resize-start")}
        width={10}
        x={shape.x}
        y={shape.y + 4}
      />
      <rect
        aria-hidden="true"
        className="chronicle-fill-resize chronicle-fill-resize--end"
        height={Math.max(18, shape.height - 8)}
        onPointerDown={(event) => onStartEntryEdit(event, entry, "resize-end")}
        width={10}
        x={shape.x + shape.width - 10}
        y={shape.y + 4}
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
        aria-label={`${shape.entry.fileName}を開く`}
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
