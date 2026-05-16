import { useLayoutEffect, useState } from "react";
import type { ReactElement } from "react";

import type { GanttChartSource } from "../../shared/ipc";
import { currentDateDay } from "../chronicleTimeline";
import {
  ROW_HEIGHT,
  buildChronicleAxisSegments,
  buildDateAxisSegments,
  type ChartGuideTick,
  type DateOffscreenIndicator,
  type DateScale
} from "../chronicleTimeline";
import type { Translator } from "../i18n";

export function DateAxis({
  axisEnd,
  axisStart,
  scale,
  unitWidth,
  width
}: {
  axisEnd: number;
  axisStart: number;
  scale: DateScale;
  unitWidth: number;
  width: number;
}): ReactElement {
  const years = buildDateAxisSegments(axisStart, axisEnd, "year");
  const months = buildDateAxisSegments(axisStart, axisEnd, "month");
  const units = buildDateAxisSegments(axisStart, axisEnd, scale.unit);
  const rows = scale.unit === "day"
    ? [years, months, units]
    : scale.unit === "year"
      ? [units]
      : [years, units];

  return (
    <div className="chronicle-axis chronicle-axis--date" style={{ width }}>
      {rows.map((row, rowIndex) => (
        <div
          className={`chronicle-axis-row${rowIndex < rows.length - 1 ? " chronicle-axis-row--divider" : ""}`}
          key={`date-axis-row-${rowIndex}`}
        >
          {row.map((segment) => (
            <span
              className="chronicle-axis-cell"
              key={`${rowIndex}-${segment.label}-${segment.startValue}`}
              style={{
                left: (segment.startValue - axisStart) * unitWidth,
                width: Math.max(1, (segment.endValue - segment.startValue + 1) * unitWidth)
              }}
            >
              {segment.label}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

export function ChronicleAxis({
  axisEnd,
  axisStart,
  interval,
  unitWidth,
  width
}: {
  axisEnd: number;
  axisStart: number;
  interval: number;
  unitWidth: number;
  width: number;
}): ReactElement {
  const segments = buildChronicleAxisSegments(axisStart, axisEnd, interval);

  return (
    <div className="chronicle-axis chronicle-axis--chronicle" style={{ width }}>
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
  source: GanttChartSource;
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

export function useStableTimelineBounds(
  computedBounds: { axisEnd: number; axisStart: number },
  key: string
): { axisEnd: number; axisStart: number } {
  const [stable, setStable] = useState<{ bounds: { axisEnd: number; axisStart: number }; key: string } | null>(null);

  useLayoutEffect(() => {
    setStable((current) => {
      if (!current || current.key !== key) {
        return { bounds: computedBounds, key };
      }

      const nextBounds = {
        axisEnd: Math.max(current.bounds.axisEnd, computedBounds.axisEnd),
        axisStart: Math.min(current.bounds.axisStart, computedBounds.axisStart)
      };

      if (
        nextBounds.axisEnd === current.bounds.axisEnd &&
        nextBounds.axisStart === current.bounds.axisStart
      ) {
        return current;
      }

      return { bounds: nextBounds, key };
    });
  }, [computedBounds.axisEnd, computedBounds.axisStart, key]);

  if (!stable || stable.key !== key) return computedBounds;

  return stable.bounds;
}
