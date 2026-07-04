import path from "node:path";

import { monthAxisToPoint, pointToMonthAxis } from "../../shared/chartTime";
import { stripMarkdownExtension } from "../../shared/markdownExtension";
import {
  defaultChronicleCalendars,
  type ChronicleCalendarSettings,
  type ChartEntry,
  type UpdateChartEntryInput
} from "../../shared/ipc";
import { parseFrontmatter } from "./frontmatter";
import {
  calendarMainStartYear,
  calendarYearToMainYear,
  extractChronicleRangesFromData,
  formatCalendarPoint,
  mainYearToCalendarYear
} from "./chronicleModel";

export function collectChartEntriesForMarkdown(
  relativePath: string,
  content: string,
  calendars: ChronicleCalendarSettings[] = defaultChronicleCalendars
): Record<"chronicle", ChartEntry[]> {
  return collectChartEntriesForFrontmatterData(
    relativePath,
    parseFrontmatter(content).data,
    calendars
  );
}

export function collectChartEntriesForFrontmatterData(
  relativePath: string,
  data: Record<string, unknown>,
  calendars: ChronicleCalendarSettings[] = defaultChronicleCalendars
): Record<"chronicle", ChartEntry[]> {
  const entriesBySource: Record<"chronicle", ChartEntry[]> = { chronicle: [] };
  const fileName = stripMarkdownExtension(path.basename(relativePath));
  const ranges = extractChronicleRangesFromData(data, calendars);
  const category = extractFrontmatterCategory(data);

  for (const range of ranges) {
    const startPoint = {
      month: range.start.month,
      year: calendarYearToMainYear(range.calendar, range.start.year)
    };
    const endPoint = {
      month: range.end.month,
      year: calendarYearToMainYear(range.calendar, range.end.year)
    };
    const startValue = pointToMonthAxis(startPoint.year, startPoint.month);
    const endValue = pointToMonthAxis(endPoint.year, endPoint.month);
    entriesBySource.chronicle.push({
      ...(category ? { category } : {}),
      chronicleCalendarName: range.calendarName,
      chronicleCalendarStartYear: calendarMainStartYear(range.calendar),
      chronicleEntryIndex: range.entryIndex,
      endValue,
      endPoint: range.end,
      fileName,
      path: relativePath,
      startPoint: range.start,
      endLabel: formatCalendarPoint(range.calendarName, range.end),
      startLabel: formatCalendarPoint(range.calendarName, range.start),
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
  input: UpdateChartEntryInput,
  calendars: ChronicleCalendarSettings[] = defaultChronicleCalendars
): Record<string, unknown> {
  const start = Math.min(input.startValue, input.endValue);
  const end = Math.max(input.startValue, input.endValue);
  const chronicle = Array.isArray(data.chronicle) ? [...data.chronicle] : [];
  const existing = chronicle[input.chronicleEntryIndex];
  const calendarName = Array.isArray(existing) && typeof existing[0] === "string" ? existing[0] : calendars[0]?.name ?? "メイン暦";
  const calendar = calendars.find((item) => item.name.trim() === calendarName.trim()) ?? calendars[0];
  const startPoint = monthAxisToPoint(start);
  const endPoint = monthAxisToPoint(end);
  const nextStart = {
    month: startPoint.month,
    year: calendar ? mainYearToCalendarYear(calendar, startPoint.year) : startPoint.year
  };
  const nextEnd = {
    month: endPoint.month,
    year: calendar ? mainYearToCalendarYear(calendar, endPoint.year) : endPoint.year
  };

  chronicle[input.chronicleEntryIndex] = [
    calendarName.trim(),
    [
      [nextStart.year, nextStart.month],
      [nextEnd.year, nextEnd.month]
    ]
  ];

  return { ...data, chronicle };
}

export function extractChronicleRange(
  markdown: string,
  calendars: ChronicleCalendarSettings[] = defaultChronicleCalendars
): { endYear: number; startYear: number } | null {
  const { data } = parseFrontmatter(markdown);
  const range = extractChronicleRangesFromData(data, calendars)[0];
  if (!range) return null;

  return { endYear: range.end.year, startYear: range.start.year };
}
