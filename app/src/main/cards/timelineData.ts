import path from "node:path";

import { axisToYear, rangeToArray, yearToAxis } from "../../shared/chartTime";
import type { TimelineChartEntry, UpdateTimelineChartEntryInput } from "../../shared/ipc";
import { parseFrontmatter } from "./frontmatter";

export function collectTimelineEntriesForMarkdown(
  relativePath: string,
  content: string
): Record<"timeline", TimelineChartEntry[]> {
  const entriesBySource: Record<"timeline", TimelineChartEntry[]> = {
    timeline: []
  };
  const cardName = path.basename(relativePath, ".md");
  const range = extractTimelineRange(content);

  if (range) {
    entriesBySource.timeline.push({
      endLabel: formatYear(range.endYear),
      endValue: yearToAxis(range.endYear),
      cardName,
      path: relativePath,
      startLabel: formatYear(range.startYear),
      startValue: yearToAxis(range.startYear)
    });
  }

  return entriesBySource;
}

export function sortTimelineEntries(entries: TimelineChartEntry[]): TimelineChartEntry[] {
  return [...entries].sort((a, b) =>
    a.startValue - b.startValue ||
      a.endValue - b.endValue ||
      a.cardName.localeCompare(b.cardName, "ja")
  );
}

export function updateTimelineDataForChartEdit(
  data: Record<string, unknown>,
  input: UpdateTimelineChartEntryInput
): Record<string, unknown> {
  const start = Math.min(input.startValue, input.endValue);
  const end = Math.max(input.startValue, input.endValue);
  const startYear = axisToYear(start);
  const endYear = axisToYear(end);

  return {
    ...data,
    timeline: rangeToArray(startYear, endYear)
  };
}

export function extractTimelineRange(markdown: string): { endYear: number; startYear: number } | null {
  const { data } = parseFrontmatter(markdown);
  return extractTimelineRangeFromData(data);
}

function extractTimelineRangeFromData(data: Record<string, unknown>): { endYear: number; startYear: number } | null {
  const value = data.timeline;

  if (!Array.isArray(value) || (value.length !== 1 && value.length !== 2)) return null;
  if (!value.every(isValidTimelineYear)) return null;

  const startYear = value[0];
  const endYear = value.length === 1 ? startYear : value[1];

  if (startYear > endYear) return null;

  return { endYear, startYear };
}

function isValidTimelineYear(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value !== 0;
}

function formatYear(year: number): string {
  return year < 0 ? `−${Math.abs(year)}` : String(year);
}
