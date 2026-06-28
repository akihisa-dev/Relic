import type {
  ChronicleCalendarSettings,
  ChroniclePoint
} from "../../shared/ipc";

export interface ChronicleRange {
  calendar: ChronicleCalendarSettings;
  calendarName: string;
  end: ChroniclePoint;
  entryIndex: number;
  start: ChroniclePoint;
}

export type ChronicleYamlEntry = [
  string,
  [
    [number, number | null],
    [number, number | null]
  ]
];

export function extractChronicleRangesFromData(
  data: Record<string, unknown>,
  calendars: ChronicleCalendarSettings[]
): ChronicleRange[] {
  const chronicle = data.chronicle;
  if (!Array.isArray(chronicle)) return [];

  return chronicle.flatMap((entry, entryIndex): ChronicleRange[] => {
    const parsed = parseChronicleYamlEntry(entry);
    if (!parsed) return [];

    const calendar = calendarByName(calendars, parsed[0]);
    if (!calendar) return [];

    const start = tupleToPoint(parsed[1][0]);
    const end = tupleToPoint(parsed[1][1]);

    if (!isValidChronicleRange(start, end)) return [];

    return [{
      calendar,
      calendarName: parsed[0],
      end,
      entryIndex,
      start
    }];
  });
}

export function parseChronicleYamlEntry(value: unknown): ChronicleYamlEntry | null {
  if (!Array.isArray(value) || value.length !== 2) return null;

  const [calendarName, range] = value;
  if (typeof calendarName !== "string" || calendarName.trim() === "") return null;
  if (!Array.isArray(range) || range.length !== 2) return null;

  const start = parseChroniclePointTuple(range[0]);
  const end = parseChroniclePointTuple(range[1]);
  if (!start || !end) return null;

  return [calendarName.trim(), [start, end]];
}

export function chronicleYamlEntry(
  calendarName: string,
  start: ChroniclePoint,
  end: ChroniclePoint
): ChronicleYamlEntry {
  return [
    calendarName.trim(),
    [
      [start.year, start.month],
      [end.year, end.month]
    ]
  ];
}

export function calendarByName(
  calendars: ChronicleCalendarSettings[],
  name: string
): ChronicleCalendarSettings | null {
  const normalized = name.trim();
  return calendars.find((calendar) => calendar.name.trim() === normalized) ?? null;
}

export function calendarMainStartYear(calendar: ChronicleCalendarSettings): number {
  return calendar.startYear ?? 1;
}

export function calendarYearToMainYear(calendar: ChronicleCalendarSettings, year: number): number {
  return calendarMainStartYear(calendar) + year - 1;
}

export function mainYearToCalendarYear(calendar: ChronicleCalendarSettings, mainYear: number): number {
  return mainYear - calendarMainStartYear(calendar) + 1;
}

export function formatCalendarPoint(calendarName: string, point: ChroniclePoint): string {
  return `${calendarName} ${formatPoint(point)}`;
}

export function formatPoint(point: ChroniclePoint): string {
  const year = point.year < 0 ? `−${Math.abs(point.year)}` : String(point.year);
  return point.month === null ? year : `${year}-${String(point.month).padStart(2, "0")}`;
}

export function isValidChronicleRange(start: ChroniclePoint, end: ChroniclePoint): boolean {
  return compareChroniclePoints(start, end) <= 0;
}

export function compareChroniclePoints(a: ChroniclePoint, b: ChroniclePoint): number {
  return pointSortValue(a) - pointSortValue(b);
}

function parseChroniclePointTuple(value: unknown): [number, number | null] | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [year, month] = value;

  if (!Number.isInteger(year) || Number(year) === 0) return null;
  if (month !== null && (!Number.isInteger(month) || Number(month) < 1 || Number(month) > 12)) return null;

  return [Number(year), month === null ? null : Number(month)];
}

function tupleToPoint(tuple: [number, number | null]): ChroniclePoint {
  return { month: tuple[1], year: tuple[0] };
}

function pointSortValue(point: ChroniclePoint): number {
  return point.year * 12 + (point.month ?? 1);
}
