import type { TimelineChartEntry, TimelineChartSource } from "../shared/ipc";
import { axisToYear, yearToAxis } from "../shared/chartTime";
import {
  LABEL_HORIZONTAL_PADDING
} from "./timelineTimelineConstants";

export interface TimelineAxisSegment {
  endValue: number;
  label: string;
  startValue: number;
}

export interface ChartGuideTick {
  isMajor: boolean;
  value: number;
}

export interface TimelineVisibleRange {
  visibleEnd: number;
  visibleStart: number;
}

export function timelineBounds(
  entries: TimelineChartEntry[],
  tickInterval: number
): { axisEnd: number; axisStart: number } {
  if (entries.length === 0) {
    const today = 1;
    return {
      axisEnd: today + tickInterval * 4,
      axisStart: today - tickInterval
    };
  }

  const starts = entries.map((entry) => entry.startValue);
  const ends = entries.map((entry) => entry.endValue);
  const min = Math.min(...starts);
  const max = Math.max(...ends);
  const padding = Math.max(1, Math.ceil((max - min + 1) * 0.06));
  const paddedStart = min - padding;
  const paddedEnd = max + padding;

  const boundsInterval = timelineAxisTickInterval(tickInterval);
  const startYear = Math.floor(axisToYear(paddedStart) / boundsInterval) * boundsInterval - boundsInterval;
  const endYear = Math.ceil(axisToYear(paddedEnd) / boundsInterval) * boundsInterval + boundsInterval;

  return {
    axisEnd: yearToAxis(endYear === 0 ? boundsInterval : endYear),
    axisStart: yearToAxis(startYear === 0 ? -boundsInterval : startYear)
  };
}

export function buildTicks(
  axisStart: number,
  axisEnd: number,
  interval: number
): number[] {
  return buildTimelineTicks(axisStart, axisEnd, timelineAxisTickInterval(interval));
}

export function buildGuideTicks(
  axisStart: number,
  axisEnd: number,
  ticks: number[],
  interval: number
): ChartGuideTick[] {
  void ticks;
  const majorTicks = new Set(buildTimelineTicks(axisStart, axisEnd, timelineMajorGuideInterval(interval)));
  return buildTimelineTicks(axisStart, axisEnd, timelineMinorGuideInterval(interval))
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

export function buildVisibleTimelineGuideTicks(
  axisStart: number,
  axisEnd: number,
  interval: number,
  visibleRange: TimelineVisibleRange
): ChartGuideTick[] {
  const visibleStart = clamp(visibleRange.visibleStart, axisStart, axisEnd);
  const visibleEnd = clamp(visibleRange.visibleEnd, visibleStart, axisEnd);
  const majorTicks = new Set(buildTimelineTicks(visibleStart, visibleEnd, timelineMajorGuideInterval(interval)));

  return buildTimelineTicks(visibleStart, visibleEnd, timelineMinorGuideInterval(interval))
    .map((value) => ({
      isMajor: majorTicks.has(value),
      value
    }));
}

export function buildTimelineTicks(axisStart: number, axisEnd: number, interval: number): number[] {
  const first = firstTimelineTickYear(axisToYear(axisStart), interval);
  const endYear = axisToYear(axisEnd);
  const ticks: number[] = [];

  for (let year = first; year <= endYear; year += interval) {
    if (year === 0) continue;
    const tick = yearToAxis(year);
    if (tick < axisStart || tick > axisEnd) continue;
    ticks.push(tick);
  }

  return ticks;
}

export function firstTimelineTickYear(startYear: number, interval: number): number {
  if (interval <= 1) return startYear;
  return Math.ceil(startYear / interval) * interval;
}

export function timelineAxisTickInterval(interval: number): number {
  return Math.max(1, interval);
}

export function timelineMajorGuideInterval(interval: number): number {
  return interval === 1 ? 10 : 100;
}

export function timelineMinorGuideInterval(interval: number): number {
  return interval === 100 ? 10 : interval;
}

export function formatRange(entry: TimelineChartEntry, source: TimelineChartSource): string {
  void source;
  if (entry.startValue === entry.endValue) return entry.startLabel;
  return `${entry.startLabel} 〜 ${entry.endLabel}`;
}

export function formatAxisValue(value: number, source: TimelineChartSource): string {
  void source;
  const year = axisToYear(value);
  return year < 0 ? `−${Math.abs(year)}` : String(year);
}

export function labelWidthForText(text: string): number {
  return text.length * 8 + LABEL_HORIZONTAL_PADDING;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function buildVisibleTimelineAxisSegments(
  axisStart: number,
  axisEnd: number,
  interval: number,
  visibleRange: TimelineVisibleRange
): TimelineAxisSegment[] {
  const visibleStart = clamp(visibleRange.visibleStart, axisStart, axisEnd);
  const visibleEnd = clamp(visibleRange.visibleEnd, visibleStart, axisEnd);
  const segments: TimelineAxisSegment[] = [];
  const first = firstTimelineTickYear(axisToYear(visibleStart), interval);
  const endYear = axisToYear(visibleEnd);

  for (let year = first; year <= endYear; year += interval) {
    if (year === 0) continue;

    const nextYear = year + interval;
    const startValue = Math.max(axisStart, yearToAxis(year));
    const endValue = Math.min(axisEnd, yearToAxis(nextYear) - 1);

    if (endValue >= visibleStart && endValue >= startValue) {
      segments.push({
        endValue,
        label: formatTimelineAxisSegmentLabel(year),
        startValue
      });
    }
  }

  return segments;
}

export function buildTimelineAxisSegments(axisStart: number, axisEnd: number, interval: number): TimelineAxisSegment[] {
  const segments: TimelineAxisSegment[] = [];
  const first = firstTimelineTickYear(axisToYear(axisStart), interval);
  const endYear = axisToYear(axisEnd);

  for (let year = first; year <= endYear; year += interval) {
    if (year === 0) continue;

    const nextYear = year + interval;
    const startValue = Math.max(axisStart, yearToAxis(year));
    const endValue = Math.min(axisEnd, yearToAxis(nextYear) - 1);

    if (endValue >= startValue) {
      segments.push({
        endValue,
        label: formatTimelineAxisSegmentLabel(year),
        startValue
      });
    }
  }

  return segments;
}

export function timelineUnitWidth(interval: number, tickWidth: number): number {
  if (interval === 1) return tickWidth / 2;
  return tickWidth / interval;
}

export function formatTimelineAxisSegmentLabel(year: number): string {
  return year < 0 ? `−${Math.abs(year)}` : String(year);
}

export function isTimelineChartSource(value: unknown): value is TimelineChartSource {
  return value === "timeline";
}
