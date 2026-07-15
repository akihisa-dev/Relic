import type { ChroniclePoint } from "../../shared/ipc";

export interface ChronicleRange {
  end: ChroniclePoint;
  entryIndex: 0;
  start: ChroniclePoint;
}

export function extractChronicleRangesFromData(
  data: Record<string, unknown>
): ChronicleRange[] {
  const range = parseChronicleRange(data.chronicle);
  if (!range) return [];

  return [{
    end: { month: null, year: range.end },
    entryIndex: 0,
    start: { month: null, year: range.start }
  }];
}

export function parseChronicleRange(value: unknown): { end: number; start: number } | null {
  if (Number.isInteger(value) && value !== 0) {
    return { end: Number(value), start: Number(value) };
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;

  const range = value as Record<string, unknown>;
  if (!Number.isInteger(range.start) || range.start === 0) return null;
  const end = range.end === undefined ? range.start : range.end;
  if (!Number.isInteger(end) || end === 0 || Number(range.start) > Number(end)) return null;

  return { end: Number(end), start: Number(range.start) };
}

export function formatPoint(point: ChroniclePoint): string {
  return point.year < 0 ? `−${Math.abs(point.year)}` : String(point.year);
}
