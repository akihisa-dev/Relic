import type { ChroniclePoint } from "../../shared/ipc";

export interface ChronicleRange {
  calendarName: string | null;
  end: ChroniclePoint;
  entryIndex: 0;
  start: ChroniclePoint;
}

export function extractChronicleRangesFromData(
  data: Record<string, unknown>
): ChronicleRange[] {
  if (!Object.prototype.hasOwnProperty.call(data, "chronicle")) return [];
  const range = parseChronicleRange(data.chronicle);
  if (!range) return [];

  return [{
    calendarName: range.calendarName,
    end: { month: null, year: range.end },
    entryIndex: 0,
    start: { month: null, year: range.start }
  }];
}

export function parseChronicleRange(value: unknown): { calendarName: string | null; end: number; start: number } | null {
  if (Number.isInteger(value) && value !== 0) {
    return { calendarName: null, end: Number(value), start: Number(value) };
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;

  const range = value as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(range, "start") || !Number.isInteger(range.start) || range.start === 0) return null;
  const end = !Object.prototype.hasOwnProperty.call(range, "end") ? range.start : range.end;
  if (!Number.isInteger(end) || end === 0 || Number(range.start) > Number(end)) return null;

  const calendarName = Object.prototype.hasOwnProperty.call(range, "calendar") && typeof range.calendar === "string" && range.calendar.trim() === range.calendar && range.calendar !== ""
    ? range.calendar
    : null;
  if (Object.prototype.hasOwnProperty.call(range, "calendar") && calendarName === null) return null;
  return { calendarName, end: Number(end), start: Number(range.start) };
}

export function formatPoint(point: ChroniclePoint): string {
  return point.year < 0 ? `−${Math.abs(point.year)}` : String(point.year);
}
