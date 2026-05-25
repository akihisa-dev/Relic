import type { PointerEvent, ReactElement, RefObject } from "react";

import type { ChartSource } from "../../shared/ipc";
import { currentDateDay } from "../chronicleTimeline";
import {
  ROW_HEIGHT,
  buildVisibleChronicleAxisSegments,
  buildVisibleChronicleGuideTicks,
  buildVisibleDateAxisSegments,
  buildVisibleDateGuideTicks,
  dateAxisFollowLabelOffset,
  timelineVisibleRange,
  type ChartGuideTick,
  type DateOffscreenIndicator,
  type DateScale
} from "../chronicleTimeline";
import type { Translator } from "../i18n";

export function DateAxis({
  axisEnd,
  axisStart,
  scrollLeft,
  scale,
  unitWidth,
  viewportWidth,
  width
}: {
  axisEnd: number;
  axisStart: number;
  scrollLeft: number;
  scale: DateScale;
  unitWidth: number;
  viewportWidth: number;
  width: number;
}): ReactElement {
  const visibleRange = timelineVisibleRange({ axisEnd, axisStart, scrollLeft, unitWidth, viewportWidth });
  const years = buildVisibleDateAxisSegments(axisStart, axisEnd, visibleRange, "year");
  const months = buildVisibleDateAxisSegments(axisStart, axisEnd, visibleRange, "month");
  const units = buildVisibleDateAxisSegments(axisStart, axisEnd, visibleRange, scale.unit);
  const rows = scale.unit === "day"
    ? [
        { followsScroll: true, key: "year", segments: years },
        { followsScroll: true, key: "month", segments: months },
        { followsScroll: false, key: scale.unit, segments: units }
      ]
    : scale.unit === "year"
      ? [{ followsScroll: false, key: scale.unit, segments: units }]
      : [
          { followsScroll: true, key: "year", segments: years },
          { followsScroll: true, key: scale.unit, segments: units }
        ];

  return (
    <div className="chronicle-axis chronicle-axis--date" style={{ width }}>
      <ChartGuideLines
        axisStart={axisStart}
        dateScale={scale}
        rowCount={0}
        source="date"
        ticks={buildVisibleDateGuideTicks(axisStart, axisEnd, scale, visibleRange)}
        unitWidth={unitWidth}
      />
      {rows.map((row, rowIndex) => (
        <div
          className={`chronicle-axis-row${rowIndex < rows.length - 1 ? " chronicle-axis-row--divider" : ""}`}
          key={`date-axis-row-${row.key}`}
        >
          {row.segments.map((segment) => {
            const labelOffset = row.followsScroll
              ? dateAxisFollowLabelOffset({ axisStart, scrollLeft, segment, unitWidth })
              : 0;

            return (
              <span
                className={`chronicle-axis-cell${row.followsScroll ? " chronicle-axis-cell--follow" : ""}`}
                key={`${row.key}-${segment.label}-${segment.startValue}`}
                style={{
                  left: (segment.startValue - axisStart) * unitWidth,
                  width: Math.max(1, (segment.endValue - segment.startValue + 1) * unitWidth)
                }}
              >
                <span
                  className={`chronicle-axis-cell-label${row.followsScroll ? " chronicle-axis-cell-label--follow" : ""}`}
                  style={row.followsScroll ? { transform: `translateX(${labelOffset}px)` } : undefined}
                >
                  {segment.label}
                </span>
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function ChronicleAxis({
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
  const segments = buildVisibleChronicleAxisSegments(axisStart, axisEnd, interval, visibleRange);
  const guideTicks = buildVisibleChronicleGuideTicks(axisStart, axisEnd, interval, visibleRange);

  return (
    <div className="chronicle-axis chronicle-axis--chronicle" style={{ width }}>
      <ChartGuideLines
        axisStart={axisStart}
        dateScale={null}
        rowCount={0}
        source="chronicle"
        ticks={guideTicks}
        unitWidth={unitWidth}
      />
      <div className="chronicle-axis-row chronicle-axis-row--chronicle">
        {segments.map((segment) => (
          <span
            className="chronicle-axis-cell"
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
  dateScale,
  rowCount,
  source,
  ticks,
  unitWidth
}: {
  axisStart: number;
  dateScale: DateScale | null;
  rowCount: number;
  source: ChartSource;
  ticks: ChartGuideTick[];
  unitWidth: number;
}): ReactElement {
  const rowLines = Array.from({ length: rowCount + 1 }, (_value, index) => index * ROW_HEIGHT);
  const sourceClassName = source === "date"
    ? `chronicle-guide-lines--date chronicle-guide-lines--date-${dateScale?.unit ?? "month"}`
    : "chronicle-guide-lines--chronicle";

  return (
    <div aria-hidden="true" className={`chronicle-guide-lines ${sourceClassName}`}>
      {ticks.map((tick) => (
        <span
          className={`chronicle-guide-line chronicle-guide-line--${tick.isMajor ? "major" : "minor"}`}
          key={`tick-${tick.value}`}
          style={{ left: (tick.value - axisStart) * unitWidth }}
        />
      ))}
      {rowLines.map((top) => (
        <span
          className="chronicle-guide-row-line"
          key={`row-${top}`}
          style={{ top }}
        />
      ))}
    </div>
  );
}

export function TodayLine({
  axisEnd,
  axisStart,
  unitWidth
}: {
  axisEnd: number;
  axisStart: number;
  unitWidth: number;
}): ReactElement | null {
  const today = currentDateDay();

  if (today < axisStart || today > axisEnd) return null;

  return (
    <span
      aria-hidden="true"
      className="chronicle-today-line"
      style={{ left: (today - axisStart + 0.5) * unitWidth }}
    />
  );
}

export function DateOffscreenJumpButtons({
  indicators,
  onJump,
  t
}: {
  indicators: { left: DateOffscreenIndicator | null; right: DateOffscreenIndicator | null };
  onJump: (value: number) => void;
  t: Translator;
}): ReactElement | null {
  if (!indicators.left && !indicators.right) return null;

  return (
    <div className="chronicle-offscreen-jumps">
      {indicators.left ? (
        <button
          aria-label={t("chronicle.offscreenLeft", { count: indicators.left.count })}
          className="chronicle-offscreen-jump chronicle-offscreen-jump--left"
          onClick={() => onJump(indicators.left?.targetValue ?? 0)}
          title={t("chronicle.offscreenLeft", { count: indicators.left.count })}
          type="button"
        >
          ← {indicators.left.count}
        </button>
      ) : null}
      {indicators.right ? (
        <button
          aria-label={t("chronicle.offscreenRight", { count: indicators.right.count })}
          className="chronicle-offscreen-jump chronicle-offscreen-jump--right"
          onClick={() => onJump(indicators.right?.targetValue ?? 0)}
          title={t("chronicle.offscreenRight", { count: indicators.right.count })}
          type="button"
        >
          {indicators.right.count} →
        </button>
      ) : null}
    </div>
  );
}

export function TimelineOffscreenJumpButtons({
  indicators,
  leftOffset,
  onJump,
  t
}: {
  indicators: { left: DateOffscreenIndicator | null; right: DateOffscreenIndicator | null };
  leftOffset: number;
  onJump: (value: number) => void;
  t: Translator;
}): ReactElement | null {
  if (!indicators.left && !indicators.right) return null;

  return (
    <div className="chronicle-offscreen-jumps">
      {indicators.left ? (
        <button
          aria-label={t("chronicle.offscreenPast", { count: indicators.left.count })}
          className="chronicle-offscreen-jump chronicle-offscreen-jump--left"
          onClick={() => onJump(indicators.left?.targetValue ?? 0)}
          style={{ left: leftOffset + 10 }}
          title={t("chronicle.offscreenPast", { count: indicators.left.count })}
          type="button"
        >
          ← {indicators.left.count}
        </button>
      ) : null}
      {indicators.right ? (
        <button
          aria-label={t("chronicle.offscreenFuture", { count: indicators.right.count })}
          className="chronicle-offscreen-jump chronicle-offscreen-jump--right"
          onClick={() => onJump(indicators.right?.targetValue ?? 0)}
          title={t("chronicle.offscreenFuture", { count: indicators.right.count })}
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
    <div className="chronicle-vertical-offscreen-jumps">
      {indicators.top ? (
        <button
          aria-label={t("chronicle.offscreenAbove", { count: indicators.top.count })}
          className="chronicle-vertical-offscreen-jump chronicle-vertical-offscreen-jump--top"
          onClick={() => onJump(indicators.top?.targetIndex ?? 0)}
          title={t("chronicle.offscreenAbove", { count: indicators.top.count })}
          type="button"
        >
          ↑ {indicators.top.count}
        </button>
      ) : null}
      {indicators.bottom ? (
        <button
          aria-label={t("chronicle.offscreenBelow", { count: indicators.bottom.count })}
          className="chronicle-vertical-offscreen-jump chronicle-vertical-offscreen-jump--bottom"
          onClick={() => onJump(indicators.bottom?.targetIndex ?? 0)}
          title={t("chronicle.offscreenBelow", { count: indicators.bottom.count })}
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
    <div className="chronicle-vertical-minimap">
      <div
        aria-label={label}
        className="chronicle-vertical-minimap-track"
        onPointerDown={onPointerDown}
        ref={minimapRef}
        role="slider"
        tabIndex={0}
      >
        <span
          className="chronicle-vertical-minimap-window"
          style={{
            height: `${viewport.heightPercent}%`,
            top: `${viewport.topPercent}%`
          }}
        />
      </div>
    </div>
  );
}
