import path from "node:path";

import { axisToYear, rangeToArray, yearToAxis } from "../../shared/chartTime";
import type { GanttChartEntry, UpdateGanttChartEntryInput } from "../../shared/ipc";
import { parseFrontmatter } from "./frontmatter";

export function collectGanttEntriesForMarkdown(
  relativePath: string,
  content: string
): Record<"chronicle", GanttChartEntry[]> {
  const entriesBySource: Record<"chronicle", GanttChartEntry[]> = {
    chronicle: []
  };
  const fileName = path.basename(relativePath, ".md");
  const range = extractChronicleRange(content);

  if (range) {
    entriesBySource.chronicle.push({
      endLabel: formatYear(range.endYear),
      endValue: yearToAxis(range.endYear),
      fileName,
      path: relativePath,
      startLabel: formatYear(range.startYear),
      startValue: yearToAxis(range.startYear)
    });
  }

  return entriesBySource;
}

export function sortChronicleEntries(entries: GanttChartEntry[]): GanttChartEntry[] {
  return [...entries].sort((a, b) =>
    a.startValue - b.startValue ||
      a.endValue - b.endValue ||
      a.fileName.localeCompare(b.fileName, "ja")
  );
}

export function updateChronicleDataForChartEdit(
  data: Record<string, unknown>,
  input: UpdateGanttChartEntryInput
): Record<string, unknown> {
  const start = Math.min(input.startValue, input.endValue);
  const end = Math.max(input.startValue, input.endValue);
  const startYear = axisToYear(start);
  const endYear = axisToYear(end);

  return {
    ...data,
    chronicle: rangeToArray(startYear, endYear)
  };
}

export function extractChronicleRange(markdown: string): { endYear: number; startYear: number } | null {
  const { data } = parseFrontmatter(markdown);
  return extractChronicleRangeFromData(data);
}

function extractChronicleRangeFromData(data: Record<string, unknown>): { endYear: number; startYear: number } | null {
  const value = data.chronicle;

  if (!Array.isArray(value) || (value.length !== 1 && value.length !== 2)) return null;
  if (!value.every(isValidChronicleYear)) return null;

  const startYear = value[0];
  const endYear = value.length === 1 ? startYear : value[1];

  if (startYear > endYear) return null;

  return { endYear, startYear };
}

function isValidChronicleYear(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value !== 0;
}

function formatYear(year: number): string {
  return year < 0 ? `−${Math.abs(year)}` : String(year);
}
