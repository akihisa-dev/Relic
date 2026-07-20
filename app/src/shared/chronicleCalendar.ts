export interface ChronicleCalendarDefinition {
  name: string;
  yearOne: number;
}

export interface ChronicleCalendarSettings {
  baseCalendarName: string;
  calendars: ChronicleCalendarDefinition[];
  visibleCalendarNames: string[];
}

export const defaultChronicleCalendarSettings: ChronicleCalendarSettings = {
  baseCalendarName: "基準暦",
  calendars: [],
  visibleCalendarNames: ["基準暦"]
};

export function chronicleCalendarNames(settings: ChronicleCalendarSettings): string[] {
  return [settings.baseCalendarName, ...settings.calendars.map((calendar) => calendar.name)];
}

export function chronicleYearToOrdinal(year: number): number {
  return year > 0 ? year - 1 : year;
}

export function chronicleOrdinalToYear(ordinal: number): number {
  return ordinal >= 0 ? ordinal + 1 : ordinal;
}

export function calendarYearToBaseYear(
  year: number,
  calendarName: string,
  settings: ChronicleCalendarSettings
): number | null {
  if (calendarName === settings.baseCalendarName) return year;
  const calendar = settings.calendars.find((candidate) => candidate.name === calendarName);
  if (!calendar) return null;
  return chronicleOrdinalToYear(
    chronicleYearToOrdinal(calendar.yearOne) + chronicleYearToOrdinal(year)
  );
}

export function baseYearToCalendarYear(
  baseYear: number,
  calendarName: string,
  settings: ChronicleCalendarSettings
): number | null {
  if (calendarName === settings.baseCalendarName) return baseYear;
  const calendar = settings.calendars.find((candidate) => candidate.name === calendarName);
  if (!calendar) return null;
  return chronicleOrdinalToYear(
    chronicleYearToOrdinal(baseYear) - chronicleYearToOrdinal(calendar.yearOne)
  );
}
