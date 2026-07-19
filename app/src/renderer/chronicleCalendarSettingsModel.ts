import {
  chronicleCalendarNames,
  type ChronicleCalendarSettings
} from "../shared/chronicleCalendar";

export interface ChronicleCalendarSettingsDraft {
  baseCalendarName: string;
  calendars: Array<{ name: string; yearOne: string }>;
  visibleCalendarNames: string[];
}

export function createChronicleCalendarSettingsDraft(
  settings: ChronicleCalendarSettings
): ChronicleCalendarSettingsDraft {
  return {
    ...settings,
    calendars: settings.calendars.map((calendar) => ({
      ...calendar,
      yearOne: String(calendar.yearOne)
    }))
  };
}

export function normalizeChronicleCalendarSettingsDraft(
  draft: ChronicleCalendarSettingsDraft
): ChronicleCalendarSettings | null {
  const calendars = draft.calendars.flatMap((calendar) => {
    const yearOne = parseChronicleCalendarYearOne(calendar.yearOne);
    return yearOne === null ? [] : [{ name: calendar.name.trim(), yearOne }];
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
    visibleCalendarNames: visibleCalendarNames.length > 0
      ? visibleCalendarNames
      : [normalized.baseCalendarName]
  };
}

export function parseChronicleCalendarYearOne(value: string): number | null {
  const normalized = value.trim();
  if (!/^-?\d+$/.test(normalized)) return null;
  const yearOne = Number(normalized);
  return Number.isInteger(yearOne) && yearOne !== 0 ? yearOne : null;
}
