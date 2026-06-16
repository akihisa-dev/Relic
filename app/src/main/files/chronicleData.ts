import path from "node:path";

import { axisToYear, dateToDay, dayToDate, rangeToArray, shiftDateYears, yearToAxis } from "../../shared/chartTime";
import { stripMarkdownExtension } from "../../shared/markdownExtension";
import {
  defaultChronicleCalendars,
  type ChronicleCalendarSettings,
  type ChartDateKind,
  type ChartEntry,
  type UpdateChartEntryInput
} from "../../shared/ipc";
import { parseFrontmatter } from "./frontmatter";
import {
  calendarById,
  calendarMainStartYear,
  calendarYearToMainYear,
  dateFieldNameForKind,
  dateKindOrder,
  dateYear,
  extractDateRangeFromData,
  extractFirstChronicleRangeFromData,
  formatCalendarYear,
  mainYearToCalendarYear,
  normalizeDateFieldsForWrite,
  type DateRange
} from "./chronicleModel";

export function collectChartEntriesForMarkdown(
  relativePath: string,
  content: string,
  calendars: ChronicleCalendarSettings[] = defaultChronicleCalendars
): Record<"chronicle" | "date", ChartEntry[]> {
  const entriesBySource: Record<"chronicle" | "date", ChartEntry[]> = {
    chronicle: [],
    date: []
  };
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

  const dateRanges: Array<{ kind: ChartDateKind; range: DateRange }> = [];
  const plannedDateRange = extractDateRangeFromData(frontmatter.data, "planned");
  const actualDateRange = extractDateRangeFromData(frontmatter.data, "actual");
  const statuses = extractStatusValues(frontmatter.data);

  if (plannedDateRange) dateRanges.push({ kind: "planned", range: plannedDateRange });
  if (actualDateRange) dateRanges.push({ kind: "actual", range: actualDateRange });

  for (const { kind, range: dateRange } of dateRanges) {
    entriesBySource.date.push({
      dateKind: kind,
      endLabel: dateRange.endDate,
      endValue: dateToDay(dateRange.endDate),
      fileName,
      path: relativePath,
      startLabel: dateRange.startDate,
      startValue: dateToDay(dateRange.startDate),
      statuses
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

export function sortDateEntries(entries: ChartEntry[]): ChartEntry[] {
  return entries.toSorted((a, b) =>
    a.fileName.localeCompare(b.fileName, "ja") ||
      a.path.localeCompare(b.path, "ja") ||
      dateKindOrder(a.dateKind) - dateKindOrder(b.dateKind) ||
      a.startValue - b.startValue ||
      a.endValue - b.endValue
  );
}

export function updateChronicleDataForChartEdit(
  data: Record<string, unknown>,
  input: UpdateChartEntryInput,
  calendars: ChronicleCalendarSettings[] = defaultChronicleCalendars
): Record<string, unknown> {
  const start = Math.min(input.startValue, input.endValue);
  const end = Math.max(input.startValue, input.endValue);

  if (input.source === "chronicle") {
    const originalStartYear = axisToYear(input.originalStartValue);
    const originalEndYear = axisToYear(input.originalEndValue);
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
    for (const kind of ["planned", "actual"] as const) {
      const dateRange = extractDateRangeFromData(data, kind);

      if (dateRange) {
        const fieldName = dateFieldNameForKind(kind);
        const nextStartDate = shiftDateYears(dateRange.startDate, startYear - originalStartYear);
        const nextEndDate = shiftDateYears(dateRange.endDate, endYear - originalEndYear);
        const nextDateRange = rangeToArray(nextStartDate, nextEndDate);
        next[fieldName] = nextDateRange;
      }
    }

    return normalizeDateFieldsForWrite(next);
  }

  const startDate = dayToDate(start);
  const endDate = dayToDate(end);
  const dateKind = input.dateKind ?? "planned";
  const fieldName = dateFieldNameForKind(dateKind);
  const next: Record<string, unknown> = {
    ...data,
    [fieldName]: rangeToArray(startDate, endDate)
  };

  const startYear = dateYear(startDate);
  const endYear = dateYear(endDate);
  next.chronicle0 = rangeToArray(startYear, endYear);

  return normalizeDateFieldsForWrite(next);
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

export function extractDateRange(markdown: string): DateRange | null {
  const { data } = parseFrontmatter(markdown);
  return extractDateRangeFromData(data, "planned");
}

function extractStatusValues(data: Record<string, unknown>): string[] {
  const value = data.status;
  const rawValues = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const statuses = rawValues.flatMap((candidate) => {
    if (typeof candidate !== "string") return [];
    const status = candidate.trim();
    return status ? [status] : [];
  });

  return [...new Set(statuses)];
}
