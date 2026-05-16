import type { GanttChartEntry, GanttChartSource } from "../shared/ipc";
import { axisToYear, dateToDay, yearToAxis } from "../shared/chartTime";
import {
  DATE_SCALES,
  LABEL_HORIZONTAL_PADDING,
  type DateAxisSegmentUnit,
  type DateScale,
  type DateScaleUnit
} from "./chronicleTimelineConstants";

export interface DateAxisSegment {
  endValue: number;
  label: string;
  startValue: number;
}

export interface ChartGuideTick {
  isMajor: boolean;
  value: number;
}

export function timelineBounds(
  entries: GanttChartEntry[],
  tickInterval: number,
  source: GanttChartSource,
  dateScale: DateScale | null
): { axisEnd: number; axisStart: number } {
  if (entries.length === 0) {
    const today = source === "date" ? currentDateDay() : 1;
    if (source === "date" && dateScale) {
      const start = previousDateUnit(today, dateScale.unit);
      let end = start;
      for (let i = 0; i < 8; i += 1) end = nextDateUnit(end, dateScale.unit);

      return { axisEnd: end - 1, axisStart: start };
    }

    return {
      axisEnd: today + tickInterval * 4,
      axisStart: today - tickInterval
    };
  }

  const starts = entries.map((entry) => entry.startValue);
  const ends = entries.map((entry) => entry.endValue);
  const today = source === "date" ? currentDateDay() : null;
  const min = Math.min(...starts, ...(today === null ? [] : [today]));
  const max = Math.max(...ends, ...(today === null ? [] : [today]));
  const padding = source === "date"
    ? Math.max(3, Math.ceil((max - min + 1) * 0.18))
    : Math.max(1, Math.ceil((max - min + 1) * 0.06));
  const paddedStart = min - padding;
  const paddedEnd = max + padding;

  if (source === "date" && dateScale) {
    return {
      axisEnd: nextDateUnit(paddedEnd, dateScale.unit) - 1,
      axisStart: previousDateUnit(paddedStart, dateScale.unit)
    };
  }

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
  interval: number,
  source: GanttChartSource,
  dateScale: DateScale | null
): number[] {
  if (source === "date") return buildDateTicks(axisStart, axisEnd, dateGuideUnit(dateScale ?? DATE_SCALES[0]));

  return buildChronicleTicks(axisStart, axisEnd, chronicleAxisTickInterval(interval));
}

export function buildGuideTicks(
  axisStart: number,
  axisEnd: number,
  ticks: number[],
  interval: number,
  source: GanttChartSource,
  dateScale: DateScale | null
): ChartGuideTick[] {
  if (source !== "date") {
    const majorTicks = new Set(buildChronicleTicks(axisStart, axisEnd, chronicleMajorGuideInterval(interval)));
    return buildChronicleTicks(axisStart, axisEnd, chronicleMinorGuideInterval(interval))
      .map((value) => ({
        isMajor: majorTicks.has(value),
        value
      }));
  }

  if (!dateScale) return ticks.map((value) => ({ isMajor: false, value }));

  const majorTicks = new Set(buildDateTicks(axisStart, axisEnd, dateMajorGuideUnit(dateScale)));
  return ticks.map((value) => ({
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

export function buildDateTicks(axisStart: number, axisEnd: number, unit: DateAxisSegmentUnit): number[] {
  const ticks: number[] = [];
  let cursor = previousDateUnit(axisStart, unit);

  while (cursor <= axisEnd) {
    if (cursor >= axisStart) ticks.push(cursor);
    cursor = nextDateUnit(cursor, unit);
  }

  return ticks;
}

export function dateGuideUnit(scale: DateScale): DateAxisSegmentUnit {
  return "day";
}

export function dateMajorGuideUnit(scale: DateScale): DateAxisSegmentUnit {
  return "month";
}

export function formatRange(entry: GanttChartEntry, source: GanttChartSource, dateScale: DateScale | null): string {
  if (source !== "date" || !dateScale) {
    if (entry.startValue === entry.endValue) return entry.startLabel;
    return `${entry.startLabel} 〜 ${entry.endLabel}`;
  }

  const start = formatDateLabel(entry.startLabel, dateScale.unit);
  const end = formatDateLabel(entry.endLabel, dateScale.unit);

  if (start === end) return start;
  return `${start} 〜 ${end}`;
}

export function formatAxisValue(value: number, source: GanttChartSource): string {
  const year = axisToYear(value);
  return year < 0 ? `−${Math.abs(year)}` : String(year);
}

export function labelWidthForText(text: string): number {
  return text.length * 8 + LABEL_HORIZONTAL_PADDING;
}

export function currentDateDay(): number {
  return dateToDay(new Date().toISOString().slice(0, 10));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function buildDateAxisSegments(
  axisStart: number,
  axisEnd: number,
  unit: DateAxisSegmentUnit
): DateAxisSegment[] {
  const segments: DateAxisSegment[] = [];
  let cursor = startOfDateUnit(axisStart, unit);

  while (cursor <= axisEnd) {
    const next = nextDateUnit(cursor, unit);
    const startValue = Math.max(axisStart, cursor);
    const endValue = Math.min(axisEnd, next - 1);

    if (endValue >= startValue) {
      segments.push({
        endValue,
        label: formatDateAxisSegmentLabel(cursor, unit),
        startValue
      });
    }

    cursor = next;
  }

  return segments;
}

export function buildChronicleAxisSegments(axisStart: number, axisEnd: number, interval: number): DateAxisSegment[] {
  const segments: DateAxisSegment[] = [];
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

export function startOfDateUnit(value: number, unit: DateAxisSegmentUnit): number {
  const date = new Date(value * 86_400_000);
  if (unit === "day") return value;

  const month = unit === "year"
    ? 0
    : date.getUTCMonth();

  return dateToDay(`${date.getUTCFullYear()}-${String(month + 1).padStart(2, "0")}-01`);
}

export function nextDateUnit(value: number, unit: DateAxisSegmentUnit): number {
  const date = new Date(value * 86_400_000);

  if (unit === "day") return value + 1;

  if (unit === "month") {
    date.setUTCMonth(date.getUTCMonth() + 1, 1);
  } else {
    date.setUTCFullYear(date.getUTCFullYear() + 1, 0, 1);
  }

  return Math.floor(date.getTime() / 86_400_000);
}

export function previousDateUnit(value: number, unit: DateAxisSegmentUnit): number {
  return startOfDateUnit(value, unit);
}

export function dateUnitWidth(scale: DateScale | null): number {
  return 22;
}

export function chronicleUnitWidth(interval: number, tickWidth: number): number {
  if (interval === 1) return tickWidth / 2;
  return tickWidth / interval;
}

export function dateAxisHeightForScale(scale: DateScale | null): number {
  return 69;
}

export function formatDateAxisSegmentLabel(value: number, unit: DateAxisSegmentUnit): string {
  const date = new Date(value * 86_400_000);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;

  if (unit === "year") return String(year);
  if (unit === "day") return String(date.getUTCDate()).padStart(2, "0");
  return String(month).padStart(2, "0");
}

export function formatChronicleAxisSegmentLabel(year: number): string {
  return year < 0 ? `−${Math.abs(year)}` : String(year);
}

export function formatDateLabel(value: string, unit: DateScaleUnit): string {
  return value.slice(8, 10);
}

export function isGanttChartSource(value: unknown): value is GanttChartSource {
  return value === "chronicle" || value === "date";
}
