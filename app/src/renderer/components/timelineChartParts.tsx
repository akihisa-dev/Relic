import type { PointerEvent, ReactElement, RefObject } from "react";

import {
  ROW_HEIGHT,
  buildVisibleTimelineAxisSegments,
  buildVisibleTimelineGuideTicks,
  timelineVisibleRange,
  type ChartGuideTick,
  type TimelineOffscreenIndicator
} from "../timelineTimeline";
import type { Translator } from "../i18n";

export function TimelineAxis({
  axisEnd,
  axisStart,
  interval,
  scrollLeft,
  unitWidth,
  viewportWidth,
  width
}: {
  axisEnd: number;
  axisStart: number;
  interval: number;
  scrollLeft: number;
  unitWidth: number;
  viewportWidth: number;
  width: number;
}): ReactElement {
  const visibleRange = timelineVisibleRange({ axisEnd, axisStart, scrollLeft, unitWidth, viewportWidth });
  const segments = buildVisibleTimelineAxisSegments(axisStart, axisEnd, interval, visibleRange);
  const guideTicks = buildVisibleTimelineGuideTicks(axisStart, axisEnd, interval, visibleRange);

  return (
    <div className="timeline-axis timeline-axis--timeline" style={{ width }}>
      <ChartGuideLines
        axisStart={axisStart}
        rowCount={0}
        ticks={guideTicks}
        unitWidth={unitWidth}
      />
      <div className="timeline-axis-row timeline-axis-row--timeline">
        {segments.map((segment) => (
          <span
            className="timeline-axis-cell"
            key={`${segment.label}-${segment.startValue}`}
            style={{
              left: (segment.startValue - axisStart) * unitWidth,
              width: Math.max(1, (segment.endValue - segment.startValue + 1) * unitWidth)
            }}
          >
            {segment.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ChartGuideLines({
  axisStart,
  rowCount,
  ticks,
  unitWidth
}: {
  axisStart: number;
  rowCount: number;
  ticks: ChartGuideTick[];
  unitWidth: number;
}): ReactElement {
  const rowLines = Array.from({ length: rowCount + 1 }, (_value, index) => index * ROW_HEIGHT);

  return (
    <div aria-hidden="true" className="timeline-guide-lines timeline-guide-lines--timeline">
      {ticks.map((tick) => (
        <span
          className={`timeline-guide-line timeline-guide-line--${tick.isMajor ? "major" : "minor"}`}
          key={`tick-${tick.value}`}
          style={{ left: (tick.value - axisStart) * unitWidth }}
        />
      ))}
      {rowLines.map((top) => (
        <span
          className="timeline-guide-row-line"
          key={`row-${top}`}
          style={{ top }}
        />
      ))}
    </div>
  );
}

export function TimelineOffscreenJumpButtons({
  indicators,
  leftOffset,
  onJump,
  t
}: {
  indicators: { left: TimelineOffscreenIndicator | null; right: TimelineOffscreenIndicator | null };
  leftOffset: number;
  onJump: (value: number) => void;
  t: Translator;
}): ReactElement | null {
  if (!indicators.left && !indicators.right) return null;

  return (
    <div className="timeline-offscreen-jumps">
      {indicators.left ? (
        <button
          aria-label={t("timeline.offscreenPast", { count: indicators.left.count })}
          className="timeline-offscreen-jump timeline-offscreen-jump--left"
          onClick={() => onJump(indicators.left?.targetValue ?? 0)}
          style={{ left: leftOffset + 10 }}
          title={t("timeline.offscreenPast", { count: indicators.left.count })}
          type="button"
        >
          ← {indicators.left.count}
        </button>
      ) : null}
      {indicators.right ? (
        <button
          aria-label={t("timeline.offscreenFuture", { count: indicators.right.count })}
          className="timeline-offscreen-jump timeline-offscreen-jump--right"
          onClick={() => onJump(indicators.right?.targetValue ?? 0)}
          title={t("timeline.offscreenFuture", { count: indicators.right.count })}
          type="button"
        >
          {indicators.right.count} →
        </button>
      ) : null}
    </div>
  );
}

export function VerticalOffscreenJumpButtons({
  indicators,
  onJump,
  t
}: {
  indicators: { bottom: { count: number; targetIndex: number } | null; top: { count: number; targetIndex: number } | null };
  onJump: (rowIndex: number) => void;
  t: Translator;
}): ReactElement | null {
  if (!indicators.top && !indicators.bottom) return null;

  return (
    <div className="timeline-vertical-offscreen-jumps">
      {indicators.top ? (
        <button
          aria-label={t("timeline.offscreenAbove", { count: indicators.top.count })}
          className="timeline-vertical-offscreen-jump timeline-vertical-offscreen-jump--top"
          onClick={() => onJump(indicators.top?.targetIndex ?? 0)}
          title={t("timeline.offscreenAbove", { count: indicators.top.count })}
          type="button"
        >
          ↑ {indicators.top.count}
        </button>
      ) : null}
      {indicators.bottom ? (
        <button
          aria-label={t("timeline.offscreenBelow", { count: indicators.bottom.count })}
          className="timeline-vertical-offscreen-jump timeline-vertical-offscreen-jump--bottom"
          onClick={() => onJump(indicators.bottom?.targetIndex ?? 0)}
          title={t("timeline.offscreenBelow", { count: indicators.bottom.count })}
          type="button"
        >
          {indicators.bottom.count} ↓
        </button>
      ) : null}
    </div>
  );
}

export function VerticalMinimap({
  label,
  minimapRef,
  onPointerDown,
  viewport
}: {
  label: string;
  minimapRef: RefObject<HTMLDivElement | null>;
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  viewport: { heightPercent: number; topPercent: number };
}): ReactElement {
  return (
    <div className="timeline-vertical-minimap">
      <div
        aria-label={label}
        className="timeline-vertical-minimap-track"
        onPointerDown={onPointerDown}
        ref={minimapRef}
        role="slider"
        tabIndex={0}
      >
        <span
          className="timeline-vertical-minimap-window"
          style={{
            height: `${viewport.heightPercent}%`,
            top: `${viewport.topPercent}%`
          }}
        />
      </div>
    </div>
  );
}
