import {
  defaultChronicleCalendars,
  type ChronicleCalendarSettings,
  type ChartEntry
} from "../shared/ipc";
import { monthAxisToYear, pointToMonthAxis } from "../shared/chartTime";
import {
  LABEL_HORIZONTAL_PADDING
} from "./chronicleTimelineConstants";

export interface ChronicleAxisSegment {
  endValue: number;
  label: string;
  startValue: number;
}

export interface ChartGuideTick {
  isMajor: boolean;
  value: number;
}

export interface ChronicleDataYearTick {
  value: number;
  year: number;
}

export interface TimelineVisibleRange {
  visibleEnd: number;
  visibleStart: number;
}

export function timelineBounds(
  entries: ChartEntry[],
  tickInterval: number
): { axisEnd: number; axisStart: number } {
  if (entries.length === 0) {
    return {
      axisEnd: 1 + tickInterval * 4,
      axisStart: 1 - tickInterval
    };
  }

  const starts = entries.map((entry) => entry.startValue);
  const ends = entries.map((entry) => entry.endValue);
  const min = Math.min(...starts);
  const max = Math.max(...ends);
  const padding = Math.max(1, Math.ceil((max - min + 1) * 0.06));
  const paddedStart = min - padding;
  const paddedEnd = max + padding;

  const boundsInterval = chronicleAxisTickInterval(tickInterval);
  const startYear = Math.floor(monthAxisToYear(paddedStart) / boundsInterval) * boundsInterval - boundsInterval;
  const endYear = Math.ceil(monthAxisToYear(paddedEnd) / boundsInterval) * boundsInterval + boundsInterval;

  return {
    axisEnd: pointToMonthAxis(endYear === 0 ? boundsInterval : endYear, 12),
    axisStart: pointToMonthAxis(startYear === 0 ? -boundsInterval : startYear, 1)
  };
}

export function buildTicks(
  axisStart: number,
  axisEnd: number,
  interval: number
): number[] {
  return buildChronicleTicks(axisStart, axisEnd, chronicleAxisTickInterval(interval));
}

export function buildGuideTicks(
  axisStart: number,
  axisEnd: number,
  ticks: number[],
  interval: number
): ChartGuideTick[] {
  void ticks;
  const majorTicks = new Set(buildChronicleTicks(axisStart, axisEnd, chronicleMajorGuideInterval(interval)));
  return buildChronicleTicks(axisStart, axisEnd, chronicleMinorGuideInterval(interval))
    .map((value) => ({
      isMajor: majorTicks.has(value),
      value
    }));
}

export function timelineVisibleRange({
  axisEnd,
  axisStart,
  overscanUnits = 14,
  scrollLeft,
  unitWidth,
  viewportWidth
}: {
  axisEnd: number;
  axisStart: number;
  overscanUnits?: number;
  scrollLeft: number;
  unitWidth: number;
  viewportWidth: number;
}): TimelineVisibleRange {
  const safeUnitWidth = Math.max(1, unitWidth);
  const safeViewportWidth = Math.max(1, viewportWidth);
  const visibleStart = clamp(
    Math.floor(axisStart + scrollLeft / safeUnitWidth) - overscanUnits,
    axisStart,
    axisEnd
  );
  const visibleEnd = clamp(
    Math.ceil(axisStart + (scrollLeft + safeViewportWidth) / safeUnitWidth) + overscanUnits,
    visibleStart,
    axisEnd
  );

  return { visibleEnd, visibleStart };
}

export function buildVisibleChronicleGuideTicks(
  axisStart: number,
  axisEnd: number,
  interval: number,
  visibleRange: TimelineVisibleRange
): ChartGuideTick[] {
  const visibleStart = clamp(visibleRange.visibleStart, axisStart, axisEnd);
  const visibleEnd = clamp(visibleRange.visibleEnd, visibleStart, axisEnd);
  const majorTicks = new Set(buildChronicleTicks(visibleStart, visibleEnd, chronicleMajorGuideInterval(interval)));

  return buildChronicleTicks(visibleStart, visibleEnd, chronicleMinorGuideInterval(interval))
    .map((value) => ({
      isMajor: majorTicks.has(value),
      value
    }));
}

export function buildChronicleDataYearTicks(entries: ChartEntry[]): ChronicleDataYearTick[] {
  const years = new Set<number>();

  for (const entry of entries) {
    years.add(monthAxisToYear(entry.startValue));
    years.add(monthAxisToYear(entry.endValue));
  }

  return [...years]
    .filter((year) => year !== 0)
    .sort((a, b) => a - b)
    .map((year) => ({
      value: pointToMonthAxis(year, 1),
      year
    }));
}

function buildChronicleTicks(axisStart: number, axisEnd: number, interval: number): number[] {
  const first = firstChronicleTickYear(monthAxisToYear(axisStart), interval);
  const endYear = monthAxisToYear(axisEnd);
  const ticks: number[] = [];

  for (let year = first; year <= endYear; year += interval) {
    if (year === 0) continue;
    const tick = pointToMonthAxis(year, 1);
    if (tick < axisStart || tick > axisEnd) continue;
    ticks.push(tick);
  }

  return ticks;
}

function firstChronicleTickYear(startYear: number, interval: number): number {
  if (interval <= 1) return startYear;
  return Math.ceil(startYear / interval) * interval;
}

export function chronicleAxisTickInterval(interval: number): number {
  return Math.max(1, interval);
}

function chronicleMajorGuideInterval(interval: number): number {
  return interval === 1 ? 10 : 100;
}

function chronicleMinorGuideInterval(interval: number): number {
  return interval === 100 ? 10 : interval;
}

export function formatRange(entry: ChartEntry): string {
  const startLabel = chronicleLabelWithoutCalendarName(entry.startLabel, entry.chronicleCalendarName);
  const endLabel = chronicleLabelWithoutCalendarName(entry.endLabel, entry.chronicleCalendarName);

  if (entry.startValue === entry.endValue) return startLabel;
  return `${startLabel} 〜 ${endLabel}`;
}

export function formatAxisValue(value: number): string {
  const year = monthAxisToYear(value);
  return year < 0 ? `−${Math.abs(year)}` : String(year);
}

export function labelWidthForText(text: string): number {
  return text.length * 8 + LABEL_HORIZONTAL_PADDING;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function buildVisibleChronicleAxisSegments(
  axisStart: number,
  axisEnd: number,
  interval: number,
  visibleRange: TimelineVisibleRange
): ChronicleAxisSegment[] {
  const visibleStart = clamp(visibleRange.visibleStart, axisStart, axisEnd);
  const visibleEnd = clamp(visibleRange.visibleEnd, visibleStart, axisEnd);
  const segments: ChronicleAxisSegment[] = [];
  const first = firstChronicleTickYear(monthAxisToYear(visibleStart), interval);
  const endYear = monthAxisToYear(visibleEnd);

  for (let year = first; year <= endYear; year += interval) {
    if (year === 0) continue;

    const nextYear = year + interval;
    const startValue = Math.max(axisStart, pointToMonthAxis(year, 1));
    const endValue = Math.min(axisEnd, pointToMonthAxis(nextYear, 1) - 1);

    if (endValue >= visibleStart && endValue >= startValue) {
      segments.push({
        endValue,
        label: formatChronicleAxisSegmentLabel(year),
        startValue
      });
    }
  }

  return segments;
}

export function buildChronicleAxisSegments(axisStart: number, axisEnd: number, interval: number): ChronicleAxisSegment[] {
  const segments: ChronicleAxisSegment[] = [];
  const first = firstChronicleTickYear(monthAxisToYear(axisStart), interval);
  const endYear = monthAxisToYear(axisEnd);

  for (let year = first; year <= endYear; year += interval) {
    if (year === 0) continue;

    const nextYear = year + interval;
    const startValue = Math.max(axisStart, pointToMonthAxis(year, 1));
    const endValue = Math.min(axisEnd, pointToMonthAxis(nextYear, 1) - 1);

    if (endValue >= startValue) {
      segments.push({
        endValue,
        label: formatChronicleAxisSegmentLabel(year),
        startValue
      });
    }
  }

  return segments;
}

export function chronicleUnitWidth(interval: number, tickWidth: number): number {
  return tickWidth / (interval * 12);
}

export function activeChronicleAxisCalendars(calendars: ChronicleCalendarSettings[]): ChronicleCalendarSettings[] {
  const mainCalendar = calendars[0] ?? defaultChronicleCalendars[0];
  return [{ ...mainCalendar, name: mainCalendar.name.trim() || defaultChronicleCalendars[0].name }];
}

export function chronicleAxisHeightForCalendars(calendars: ChronicleCalendarSettings[]): number {
  return Math.max(34, activeChronicleAxisCalendars(calendars).length * 24);
}

export function formatChronicleCalendarAxisLabel(calendar: ChronicleCalendarSettings, mainYear: number): string {
  const year = mainYear - (calendar.startYear ?? 1) + 1;
  return formatChronicleAxisSegmentLabel(year);
}

function formatChronicleAxisSegmentLabel(year: number): string {
  return year < 0 ? `−${Math.abs(year)}` : String(year);
}

function chronicleLabelWithoutCalendarName(label: string, calendarName: string | undefined): string {
  const name = calendarName?.trim();
  if (!name) return label;

  const trimmed = label.trim();
  return trimmed.startsWith(`${name} `) ? trimmed.slice(name.length + 1) : trimmed;
}
