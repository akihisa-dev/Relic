import path from "node:path";

import { axisToYear, dateToDay, dayToDate, rangeToArray, shiftDateYears, yearToAxis } from "../../shared/chartTime";
import type { GanttChartDateKind, GanttChartEntry, UpdateGanttChartEntryInput } from "../../shared/ipc";
import { parseFrontmatter } from "./frontmatter";

export interface DateRange {
  endDate: string;
  startDate: string;
}

export function collectGanttEntriesForMarkdown(
  relativePath: string,
  content: string
): Record<"chronicle" | "date", GanttChartEntry[]> {
  const entriesBySource: Record<"chronicle" | "date", GanttChartEntry[]> = {
    chronicle: [],
    date: []
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

  const frontmatter = parseFrontmatter(content);
  const dateRanges: Array<{ kind: GanttChartDateKind; range: DateRange }> = [];
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

export function sortChronicleEntries(entries: GanttChartEntry[]): GanttChartEntry[] {
  return [...entries].sort((a, b) =>
    a.startValue - b.startValue ||
      a.endValue - b.endValue ||
      a.fileName.localeCompare(b.fileName, "ja")
  );
}

export function sortDateEntries(entries: GanttChartEntry[]): GanttChartEntry[] {
  return [...entries].sort((a, b) =>
    a.fileName.localeCompare(b.fileName, "ja") ||
      a.path.localeCompare(b.path, "ja") ||
      dateKindOrder(a.dateKind) - dateKindOrder(b.dateKind) ||
      a.startValue - b.startValue ||
      a.endValue - b.endValue
  );
}

export function updateChronicleDataForChartEdit(
  data: Record<string, unknown>,
  input: UpdateGanttChartEntryInput
): Record<string, unknown> {
  const start = Math.min(input.startValue, input.endValue);
  const end = Math.max(input.startValue, input.endValue);

  if (input.source === "chronicle") {
    const originalStartYear = axisToYear(input.originalStartValue);
    const originalEndYear = axisToYear(input.originalEndValue);
    const startYear = axisToYear(start);
    const endYear = axisToYear(end);
    const next: Record<string, unknown> = {
      ...data,
      chronicle: rangeToArray(startYear, endYear)
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
  next.chronicle = rangeToArray(startYear, endYear);

  return normalizeDateFieldsForWrite(next);
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

export function extractDateRange(markdown: string): DateRange | null {
  const { data } = parseFrontmatter(markdown);
  return extractDateRangeFromData(data, "planned");
}

function extractDateRangeFromData(data: Record<string, unknown>, kind: GanttChartDateKind): DateRange | null {
  const value = kind === "planned" ? data.plannedDate : data.actualDate;

  if (!Array.isArray(value) || (value.length !== 1 && value.length !== 2)) return null;
  const dates = value.map(normalizeDateValue);
  if (dates.some((date) => date === null)) return null;

  const startDate = dates[0];
  const endDate = dates.length === 1 ? startDate : dates[1];
  if (!startDate || !endDate) return null;

  if (startDate > endDate) return null;

  return { endDate, startDate };
}

function extractStatusValues(data: Record<string, unknown>): string[] {
  const value = data.status;
  const rawValues = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const statuses = rawValues
    .filter((candidate): candidate is string => typeof candidate === "string")
    .map((candidate) => candidate.trim())
    .filter((candidate) => candidate.length > 0);

  return [...new Set(statuses)];
}

function dateFieldNameForKind(kind: GanttChartDateKind): "actualDate" | "plannedDate" {
  return kind === "actual" ? "actualDate" : "plannedDate";
}

function dateKindOrder(kind: GanttChartDateKind | undefined): number {
  if (kind === "actual") return 1;
  return 0;
}

function normalizeDateFieldsForWrite(data: Record<string, unknown>): Record<string, unknown> {
  const next = { ...data };

  for (const fieldName of ["plannedDate", "actualDate"]) {
    const range = extractRawDateRangeFromData(data, fieldName);
    if (range) next[fieldName] = rangeToArray(range.startDate, range.endDate);
  }

  return next;
}

function extractRawDateRangeFromData(data: Record<string, unknown>, fieldName: string): DateRange | null {
  const value = data[fieldName];

  if (!Array.isArray(value) || (value.length !== 1 && value.length !== 2)) return null;
  const dates = value.map(normalizeDateValue);
  if (dates.some((date) => date === null)) return null;

  const startDate = dates[0];
  const endDate = dates.length === 1 ? startDate : dates[1];
  if (!startDate || !endDate) return null;
  if (startDate > endDate) return null;

  return { endDate, startDate };
}

function dateYear(value: string): number {
  return Number(value.slice(0, 4));
}

function isValidChronicleYear(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value !== 0;
}

function normalizeDateValue(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }

  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const fallbackDate = new Date(trimmed.replace(/\s*\([^)]*\)\s*$/, ""));
    return Number.isNaN(fallbackDate.getTime()) ? null : fallbackDate.toISOString().slice(0, 10);
  }

  const date = new Date(`${trimmed}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === trimmed ? trimmed : null;
}

function formatYear(year: number): string {
  return year < 0 ? `−${Math.abs(year)}` : String(year);
}
