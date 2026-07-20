import {
  chronicleCalendarNames,
  isValidChronicleCalendarRange,
  type ChronicleCalendarSettings
} from "../shared/chronicleCalendar";

export interface ChronicleCalendarSettingsDraft {
  baseCalendarName: string;
  calendars: Array<{ isNew: boolean; name: string; rangeEnd: string; rangeStart: string; yearOne: string }>;
  visibleCalendarNames: string[];
}

export function createChronicleCalendarSettingsDraft(
  settings: ChronicleCalendarSettings
): ChronicleCalendarSettingsDraft {
  return {
    ...settings,
    calendars: settings.calendars.map((calendar) => ({
      isNew: false,
      name: calendar.name,
      rangeEnd: calendar.range ? String(calendar.range.end) : "",
      rangeStart: calendar.range ? String(calendar.range.start) : "",
      yearOne: String(calendar.yearOne)
    }))
  };
}

export function normalizeChronicleCalendarSettingsDraft(
  draft: ChronicleCalendarSettingsDraft
): ChronicleCalendarSettings | null {
  const calendars = draft.calendars.flatMap((calendar) => {
    const yearOne = parseChronicleCalendarYearOne(calendar.yearOne);
    const range = parseChronicleCalendarRange(calendar.rangeStart, calendar.rangeEnd);
    const hasRangeInput = calendar.rangeStart.trim() !== "" || calendar.rangeEnd.trim() !== "";
    if (yearOne === null || ((calendar.isNew || hasRangeInput) && range === null)) return [];
    return yearOne === null ? [] : [{ name: calendar.name.trim(), range, yearOne }];
  });
  if (calendars.length !== draft.calendars.length) return null;

  const normalized: ChronicleCalendarSettings = {
    baseCalendarName: draft.baseCalendarName.trim(),
    calendars,
    visibleCalendarNames: draft.visibleCalendarNames
  };
  const names = chronicleCalendarNames(normalized);
  if (!normalized.baseCalendarName || new Set(names).size !== names.length ||
    normalized.calendars.some((calendar) => !calendar.name)) return null;

  const visibleCalendarNames = normalized.visibleCalendarNames.filter((name) => names.includes(name));
  return {
    ...normalized,
    visibleCalendarNames: [normalized.baseCalendarName, ...visibleCalendarNames.filter((name) => name !== normalized.baseCalendarName)]
  };
}

export function parseChronicleCalendarRange(startValue: string, endValue: string): { end: number; start: number } | null {
  const start = parseChronicleCalendarYearOne(startValue);
  const end = parseChronicleCalendarYearOne(endValue);
  if (start === null || end === null) return null;
  const range = { end, start };
  return isValidChronicleCalendarRange(range) ? range : null;
}

export function parseChronicleCalendarYearOne(value: string): number | null {
  const normalized = value.trim();
  if (!/^-?\d+$/.test(normalized)) return null;
  const yearOne = Number(normalized);
  return Number.isSafeInteger(yearOne) && yearOne !== 0 ? yearOne : null;
}
