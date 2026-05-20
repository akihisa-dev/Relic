import type { GanttChartEntry } from "../shared/ipc";
import { clamp } from "./chronicleTimelineAxis";
import { entryKey } from "./chronicleTimelineRows";

export interface TimelineOffscreenIndicator {
  count: number;
  targetValue: number;
}

export interface MinimapItem {
  key: string;
  leftPercent: number;
  widthPercent: number;
}

export function timelineOffscreenBarIndicators(
  entries: GanttChartEntry[],
  visibleStartValue: number,
  visibleEndValue: number
): { left: TimelineOffscreenIndicator | null; right: TimelineOffscreenIndicator | null } {
  const leftEntries = entries.filter((entry) => entry.endValue < visibleStartValue);
  const rightEntries = entries.filter((entry) => entry.startValue > visibleEndValue);
  const leftTarget = leftEntries.length > 0 ? Math.max(...leftEntries.map((entry) => entry.endValue)) : null;
  const rightTarget = rightEntries.length > 0 ? Math.min(...rightEntries.map((entry) => entry.startValue)) : null;

  return {
    left: leftTarget === null ? null : { count: leftEntries.length, targetValue: leftTarget },
    right: rightTarget === null ? null : { count: rightEntries.length, targetValue: rightTarget }
  };
}

export function minimapItemsForEntries(entries: GanttChartEntry[], axisStart: number, axisEnd: number): MinimapItem[] {
  const span = Math.max(1, axisEnd - axisStart + 1);

  return entries.map((entry) => ({
    key: entryKey(entry),
    leftPercent: clamp(((entry.startValue - axisStart) / span) * 100, 0, 100),
    widthPercent: clamp(((entry.endValue - entry.startValue + 1) / span) * 100, 0.8, 100)
  }));
}

export function minimapViewportRange(
  axisStart: number,
  axisEnd: number,
  visibleStartValue: number,
  visibleEndValue: number
): { leftPercent: number; widthPercent: number } {
  const span = Math.max(1, axisEnd - axisStart + 1);
  const leftPercent = clamp(((visibleStartValue - axisStart) / span) * 100, 0, 100);
  const widthPercent = clamp(((visibleEndValue - visibleStartValue) / span) * 100, 2, 100 - leftPercent);

  return { leftPercent, widthPercent };
}

export function chronicleNavigationTarget(entries: GanttChartEntry[], axisStart: number, axisEnd: number): number | null {
  if (entries.length === 0) return null;

  const sortedMidpoints = entries
    .map((entry) => (entry.startValue + entry.endValue) / 2)
    .sort((a, b) => a - b);
  const midpoint = sortedMidpoints[Math.floor(sortedMidpoints.length / 2)] ?? (axisStart + axisEnd) / 2;

  return clamp(midpoint, axisStart, axisEnd);
}
