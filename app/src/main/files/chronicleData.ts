import path from "node:path";

import { monthAxisToYear, pointToMonthAxis } from "../../shared/chartTime";
import { stripMarkdownExtension } from "../../shared/markdownExtension";
import type { ChartEntry, UpdateChartEntryInput } from "../../shared/ipc";
import { parseFrontmatter } from "./frontmatter";
import {
  extractChronicleRangesFromData,
  formatPoint,
  parseChronicleRange
} from "./chronicleModel";

export function collectChartEntriesForMarkdown(
  relativePath: string,
  content: string
): Record<"chronicle", ChartEntry[]> {
  return collectChartEntriesForFrontmatterData(
    relativePath,
    parseFrontmatter(content).data
  );
}

export function collectChartEntriesForFrontmatterData(
  relativePath: string,
  data: Record<string, unknown>
): Record<"chronicle", ChartEntry[]> {
  const entriesBySource: Record<"chronicle", ChartEntry[]> = { chronicle: [] };
  const fileName = stripMarkdownExtension(path.basename(relativePath));
  const ranges = extractChronicleRangesFromData(data);
  const category = extractFrontmatterCategory(data);

  for (const range of ranges) {
    const startValue = pointToMonthAxis(range.start.year, null);
    const endValue = pointToMonthAxis(range.end.year, null);
    entriesBySource.chronicle.push({
      ...(category ? { category } : {}),
      chronicleEntryIndex: range.entryIndex,
      endValue,
      endPoint: range.end,
      fileName,
      path: relativePath,
      startPoint: range.start,
      endLabel: formatPoint(range.end),
      startLabel: formatPoint(range.start),
      startValue
    });
  }

  return entriesBySource;
}

export function extractFrontmatterCategory(data: Record<string, unknown>): string | null {
  const value = data.category;
  if (typeof value !== "string") return null;

  const category = value.trim();
  return category ? category : null;
}

export function sortChronicleEntries(entries: ChartEntry[]): ChartEntry[] {
  return entries.toSorted((a, b) =>
    a.startValue - b.startValue ||
      a.endValue - b.endValue ||
      a.fileName.localeCompare(b.fileName, "ja")
  );
}

export function updateChronicleDataForChartEdit(
  data: Record<string, unknown>,
  input: UpdateChartEntryInput
): Record<string, unknown> {
  const start = monthAxisToYear(Math.min(input.startValue, input.endValue));
  const end = monthAxisToYear(Math.max(input.startValue, input.endValue));

  return {
    ...data,
    chronicle: start === end ? start : { end, start }
  };
}

export function extractChronicleRange(
  markdown: string
): { endYear: number; startYear: number } | null {
  const { data } = parseFrontmatter(markdown);
  const range = parseChronicleRange(data.chronicle);
  if (!range) return null;

  return { endYear: range.end, startYear: range.start };
}
