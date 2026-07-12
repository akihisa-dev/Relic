import type { ReactElement } from "react";

import type { ChronicleCalendarSettings, ChartSource } from "../../shared/ipc";
import { monthAxisToYear } from "../../shared/chartTime";
import {
  ROW_HEIGHT,
  activeChronicleAxisCalendars,
  buildVisibleChronicleAxisSegments,
  buildVisibleChronicleGuideTicks,
  formatChronicleCalendarAxisLabel,
  timelineVisibleRange,
  type ChartGuideTick,
  type TimelineOffscreenIndicator
} from "../chronicleTimeline";
import type { Translator } from "../i18nModel";

export function ChronicleAxis({
  axisEnd,
  axisStart,
  calendars,
  interval,
  scrollLeft,
  unitWidth,
  viewportWidth,
  width
}: {
  axisEnd: number;
  axisStart: number;
  calendars: ChronicleCalendarSettings[];
  interval: number;
  scrollLeft: number;
  unitWidth: number;
  viewportWidth: number;
  width: number;
}): ReactElement {
  const visibleRange = timelineVisibleRange({ axisEnd, axisStart, scrollLeft, unitWidth, viewportWidth });
  const segments = buildVisibleChronicleAxisSegments(axisStart, axisEnd, interval, visibleRange);
  const guideTicks = buildVisibleChronicleGuideTicks(axisStart, axisEnd, interval, visibleRange);
  const axisCalendars = activeChronicleAxisCalendars(calendars);
  const rowHeight = axisCalendars.length === 1 ? 34 : 24;

  return (
    <div className="chronicle-axis chronicle-axis--chronicle" style={{ width }}>
      <ChartGuideLines
        axisStart={axisStart}
        rowCount={0}
        source="chronicle"
        ticks={guideTicks}
        unitWidth={unitWidth}
      />
      {axisCalendars.map((calendar, rowIndex) => (
        <div
          className={`chronicle-axis-row chronicle-axis-row--chronicle${rowIndex < axisCalendars.length - 1 ? " chronicle-axis-row--divider" : ""}`}
          key={`chronicle-axis-${calendar.name}`}
          style={{ height: rowHeight }}
        >
          {segments.map((segment) => (
            <span
              className="chronicle-axis-cell"
              key={`${calendar.name}-${segment.startValue}`}
              style={{
                left: (segment.startValue - axisStart) * unitWidth,
                width: Math.max(1, (segment.endValue - segment.startValue + 1) * unitWidth)
              }}
            >
              {formatChronicleCalendarAxisLabel(calendar, monthAxisToYear(segment.startValue))}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

export function ChartGuideLines({
  axisStart,
  rowCount,
  source,
  ticks,
  unitWidth
}: {
  axisStart: number;
  rowCount: number;
  source: ChartSource;
  ticks: ChartGuideTick[];
  unitWidth: number;
}): ReactElement {
  const rowLines = rowCount > 0
    ? Array.from({ length: rowCount + 1 }, (_value, index) => index * ROW_HEIGHT)
    : [];
  void source;
  const sourceClassName = "chronicle-guide-lines--chronicle";

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
