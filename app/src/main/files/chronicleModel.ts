import type {
  ChronicleCalendarId,
  ChronicleCalendarSettings
} from "../../shared/ipc";

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

  if (typeof startYear !== "number" || typeof endYear !== "number") return null;

  if (startYear > endYear) return null;

  return { endYear, startYear };
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

function formatYear(year: number): string {
  return year < 0 ? `−${Math.abs(year)}` : String(year);
}
