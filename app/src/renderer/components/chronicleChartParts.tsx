import type { ReactElement } from "react";

import type { ChronicleCalendarSettings, ChartEntry, ChartSource } from "../../shared/ipc";
import {
  ROW_HEIGHT,
  activeChronicleAxisCalendars,
  buildChronicleDataYearTicks,
  formatChronicleCalendarAxisLabel,
  type ChartGuideTick,
  type TimelineOffscreenIndicator
} from "../chronicleTimeline";
import type { Translator } from "../i18nModel";

export function ChronicleAxis({
  axisEnd,
  axisStart,
  calendars,
  entries,
  interval,
  scrollLeft,
  unitWidth,
  viewportWidth,
  width
}: {
  axisEnd: number;
  axisStart: number;
  calendars: ChronicleCalendarSettings[];
  entries: ChartEntry[];
  interval: number;
  scrollLeft: number;
  unitWidth: number;
  viewportWidth: number;
  width: number;
}): ReactElement {
  void axisEnd;
  void scrollLeft;
  void viewportWidth;
  void interval;
  const dataYears = buildChronicleDataYearTicks(entries);
  const axisCalendars = activeChronicleAxisCalendars(calendars);
  const rowHeight = axisCalendars.length === 1 ? 34 : 24;

  return (
    <div className="chronicle-axis chronicle-axis--chronicle" style={{ width }}>
      {axisCalendars.map((calendar, rowIndex) => (
        <div
          className={`chronicle-axis-row chronicle-axis-row--chronicle${rowIndex < axisCalendars.length - 1 ? " chronicle-axis-row--divider" : ""}`}
          key={`chronicle-axis-${calendar.name}`}
          style={{ height: rowHeight }}
        >
          {dataYears.map(({ value, year }) => (
            <span
              className="chronicle-axis-year"
              key={`${calendar.name}-${year}`}
              style={{
                left: (value - axisStart) * unitWidth
              }}
            >
              {formatChronicleCalendarAxisLabel(calendar, year)}
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
