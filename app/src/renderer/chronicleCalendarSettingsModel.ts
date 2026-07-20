import {
  chronicleCalendarNames,
  type ChronicleCalendarSettings
} from "../shared/chronicleCalendar";

export interface ChronicleCalendarSettingsDraft {
  baseCalendarName: string;
  calendars: Array<{ isNew: boolean; name: string; rangeEnd: string; yearOne: string }>;
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
      yearOne: String(calendar.yearOne)
    }))
  };
}

export function normalizeChronicleCalendarSettingsDraft(
  draft: ChronicleCalendarSettingsDraft
): ChronicleCalendarSettings | null {
  const calendars = draft.calendars.flatMap((calendar) => {
    const yearOne = parseChronicleCalendarYearOne(calendar.yearOne);
    const range = parseChronicleCalendarEndYear(calendar.rangeEnd);
    const hasRangeInput = calendar.rangeEnd.trim() !== "";
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

export function parseChronicleCalendarEndYear(endValue: string): { end: number; start: 1 } | null {
  const end = parseChronicleCalendarYearOne(endValue);
  return end !== null && end >= 1 ? { end, start: 1 } : null;
}

export function parseChronicleCalendarYearOne(value: string): number | null {
  const normalized = value.trim();
  if (!/^-?\d+$/.test(normalized)) return null;
  const yearOne = Number(normalized);
  return Number.isSafeInteger(yearOne) && yearOne !== 0 ? yearOne : null;
}
