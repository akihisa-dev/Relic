import { rangeToArray } from "../../shared/chartTime";
import type {
  ChronicleCalendarId,
  ChronicleCalendarSettings,
  ChartDateKind
} from "../../shared/ipc";

export interface DateRange {
  endDate: string;
  startDate: string;
}

export function extractFirstChronicleRangeFromData(
  data: Record<string, unknown>,
  calendars: ChronicleCalendarSettings[]
): { calendar: ChronicleCalendarSettings; endYear: number; startYear: number } | null {
  for (const calendar of calendars) {
    if (!isChronicleCalendarActive(calendar)) continue;

    const range = extractChronicleRangeFromData(data, calendar.id);

    if (range) return { ...range, calendar };
  }

  return null;
}

export function extractChronicleRangeFromData(
  data: Record<string, unknown>,
  fieldName: ChronicleCalendarId
): { endYear: number; startYear: number } | null {
  const value = data[fieldName];

  if (!Array.isArray(value) || (value.length !== 1 && value.length !== 2)) return null;
  if (!value.every((year) => isValidChronicleYear(year, fieldName !== "chronicle0"))) return null;

  const startYear = value[0];
  const endYear = value.length === 1 ? startYear : value[1];

  if (startYear > endYear) return null;

  return { endYear, startYear };
}

export function extractDateRangeFromData(data: Record<string, unknown>, kind: ChartDateKind): DateRange | null {
  return extractRawDateRangeFromData(data, dateFieldNameForKind(kind));
}

export function extractRawDateRangeFromData(data: Record<string, unknown>, fieldName: string): DateRange | null {
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

export function normalizeDateFieldsForWrite(data: Record<string, unknown>): Record<string, unknown> {
  const next = { ...data };

  for (const fieldName of ["plannedDate", "actualDate"]) {
    const range = extractRawDateRangeFromData(data, fieldName);
    if (range) next[fieldName] = rangeToArray(range.startDate, range.endDate);
  }

  return next;
}

export function dateFieldNameForKind(kind: ChartDateKind): "actualDate" | "plannedDate" {
  return kind === "actual" ? "actualDate" : "plannedDate";
}

export function dateKindOrder(kind: ChartDateKind | undefined): number {
  if (kind === "actual") return 1;
  return 0;
}

export function dateYear(value: string): number {
  return Number(value.slice(0, 4));
}

export function calendarById(
  calendars: ChronicleCalendarSettings[],
  id: ChronicleCalendarId
): ChronicleCalendarSettings | null {
  return calendars.find((calendar) => calendar.id === id) ?? null;
}

export function calendarMainStartYear(calendar: ChronicleCalendarSettings): number {
  return calendar.id === "chronicle0" ? 1 : calendar.startYear ?? 1;
}

export function calendarYearToMainYear(calendar: ChronicleCalendarSettings, year: number): number {
  return calendarMainStartYear(calendar) + year - 1;
}

export function mainYearToCalendarYear(calendar: ChronicleCalendarSettings, mainYear: number): number {
  return mainYear - calendarMainStartYear(calendar) + 1;
}

export function formatCalendarYear(calendar: ChronicleCalendarSettings, year: number): string {
  return `${calendar.name.trim() || calendar.id} ${formatYear(year)}`;
}

function isValidChronicleYear(value: unknown, allowZeroOrNegative: boolean): value is number {
  return typeof value === "number" && Number.isInteger(value) && (allowZeroOrNegative || value >= 1);
}

function isChronicleCalendarActive(calendar: ChronicleCalendarSettings): boolean {
  return calendar.id === "chronicle0" ||
    (Number.isInteger(calendar.startYear) && Number(calendar.startYear) >= 1);
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
