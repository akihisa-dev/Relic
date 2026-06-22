import path from "node:path";

import { axisToYear, rangeToArray, yearToAxis } from "../../shared/chartTime";
import { stripMarkdownExtension } from "../../shared/markdownExtension";
import {
  defaultChronicleCalendars,
  type ChronicleCalendarSettings,
  type ChartEntry,
  type UpdateChartEntryInput
} from "../../shared/ipc";
import { parseFrontmatter } from "./frontmatter";
import {
  calendarById,
  calendarMainStartYear,
  calendarYearToMainYear,
  extractFirstChronicleRangeFromData,
  formatCalendarYear,
  mainYearToCalendarYear
} from "./chronicleModel";

export function collectChartEntriesForMarkdown(
  relativePath: string,
  content: string,
  calendars: ChronicleCalendarSettings[] = defaultChronicleCalendars
): Record<"chronicle", ChartEntry[]> {
  const entriesBySource: Record<"chronicle", ChartEntry[]> = { chronicle: [] };
  const fileName = stripMarkdownExtension(path.basename(relativePath));
  const frontmatter = parseFrontmatter(content);
  const range = extractFirstChronicleRangeFromData(frontmatter.data, calendars);

  if (range) {
    const startValue = yearToAxis(calendarYearToMainYear(range.calendar, range.startYear));
    const endValue = yearToAxis(calendarYearToMainYear(range.calendar, range.endYear));
    entriesBySource.chronicle.push({
      chronicleCalendarId: range.calendar.id,
      chronicleCalendarName: range.calendar.name,
      chronicleCalendarStartYear: calendarMainStartYear(range.calendar),
      endLabel: formatCalendarYear(range.calendar, range.endYear),
      endValue,
      fileName,
      path: relativePath,
      startLabel: formatCalendarYear(range.calendar, range.startYear),
      startValue
    });
  }

  return entriesBySource;
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

  const originalStartYear = axisToYear(input.originalStartValue);
  const originalEndYear = axisToYear(input.originalEndValue);
  void originalStartYear;
  void originalEndYear;
  const startYear = axisToYear(start);
  const endYear = axisToYear(end);
  const calendar = calendarById(calendars, input.chronicleCalendarId ?? "chronicle0");
  const fieldName = calendar?.id ?? "chronicle0";
  const nextStartYear = calendar ? mainYearToCalendarYear(calendar, startYear) : startYear;
  const nextEndYear = calendar ? mainYearToCalendarYear(calendar, endYear) : endYear;
  const next: Record<string, unknown> = {
    ...data,
    [fieldName]: rangeToArray(nextStartYear, nextEndYear)
  };

  return next;
}

export function extractChronicleRange(
  markdown: string,
  calendars: ChronicleCalendarSettings[] = defaultChronicleCalendars
): { endYear: number; startYear: number } | null {
  const { data } = parseFrontmatter(markdown);
  const range = extractFirstChronicleRangeFromData(data, calendars);
  if (!range) return null;

  return { endYear: range.endYear, startYear: range.startYear };
}
