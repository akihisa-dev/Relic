import type { GanttChartEntry, GanttChartSource } from "../shared/ipc";
import { axisToYear, yearToAxis } from "../shared/chartTime";
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

export interface TimelineVisibleRange {
  visibleEnd: number;
  visibleStart: number;
}

export function timelineBounds(
  entries: GanttChartEntry[],
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

  const boundsInterval = chronicleAxisTickInterval(tickInterval);
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

export function buildChronicleTicks(axisStart: number, axisEnd: number, interval: number): number[] {
  const first = firstChronicleTickYear(axisToYear(axisStart), interval);
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

export function firstChronicleTickYear(startYear: number, interval: number): number {
  if (interval <= 1) return startYear;
  return Math.ceil(startYear / interval) * interval;
}

export function chronicleAxisTickInterval(interval: number): number {
  return Math.max(1, interval);
}

export function chronicleMajorGuideInterval(interval: number): number {
  return interval === 1 ? 10 : 100;
}

export function chronicleMinorGuideInterval(interval: number): number {
  return interval === 100 ? 10 : interval;
}

export function formatRange(entry: GanttChartEntry, source: GanttChartSource): string {
  void source;
  if (entry.startValue === entry.endValue) return entry.startLabel;
  return `${entry.startLabel} 〜 ${entry.endLabel}`;
}

export function formatAxisValue(value: number, source: GanttChartSource): string {
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

export function buildVisibleChronicleAxisSegments(
  axisStart: number,
  axisEnd: number,
  interval: number,
  visibleRange: TimelineVisibleRange
): ChronicleAxisSegment[] {
  const visibleStart = clamp(visibleRange.visibleStart, axisStart, axisEnd);
  const visibleEnd = clamp(visibleRange.visibleEnd, visibleStart, axisEnd);
  const segments: ChronicleAxisSegment[] = [];
  const first = firstChronicleTickYear(axisToYear(visibleStart), interval);
  const endYear = axisToYear(visibleEnd);

  for (let year = first; year <= endYear; year += interval) {
    if (year === 0) continue;

    const nextYear = year + interval;
    const startValue = Math.max(axisStart, yearToAxis(year));
    const endValue = Math.min(axisEnd, yearToAxis(nextYear) - 1);

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
  const first = firstChronicleTickYear(axisToYear(axisStart), interval);
  const endYear = axisToYear(axisEnd);

  for (let year = first; year <= endYear; year += interval) {
    if (year === 0) continue;

    const nextYear = year + interval;
    const startValue = Math.max(axisStart, yearToAxis(year));
    const endValue = Math.min(axisEnd, yearToAxis(nextYear) - 1);

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
  if (interval === 1) return tickWidth / 2;
  return tickWidth / interval;
}

export function formatChronicleAxisSegmentLabel(year: number): string {
  return year < 0 ? `−${Math.abs(year)}` : String(year);
}

export function isGanttChartSource(value: unknown): value is GanttChartSource {
  return value === "chronicle";
}
