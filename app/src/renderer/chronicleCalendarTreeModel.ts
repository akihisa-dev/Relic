import type { ChronicleCalendarSettings } from "../shared/chronicleCalendar";
import type { ChartEntry } from "../shared/ipc";

const CHRONICLE_CALENDAR_HUE_COUNT = 360;
const CHRONICLE_CALENDAR_HUE_STEP = 137;

export interface ChronicleCalendarTreeFile {
  fileName: string;
  path: string;
}

export interface ChronicleCalendarTreeNode {
  calendarName: string;
  files: ChronicleCalendarTreeFile[];
  hue: number | null;
}

export function createChronicleCalendarHues(
  settings: ChronicleCalendarSettings
): ReadonlyMap<string, number> {
  const hues = new Map<string, number>();
  const usedSlots = new Set<number>();
  const names = [...new Set(settings.calendars.map((calendar) => calendar.name))]
    .toSorted((left, right) => left.localeCompare(right, "ja"));

  for (const name of names) {
    let slot = hashCalendarName(name) % CHRONICLE_CALENDAR_HUE_COUNT;
    while (usedSlots.has(slot) && usedSlots.size < CHRONICLE_CALENDAR_HUE_COUNT) {
      slot = (slot + 1) % CHRONICLE_CALENDAR_HUE_COUNT;
    }
    usedSlots.add(slot);
    hues.set(name, (slot * CHRONICLE_CALENDAR_HUE_STEP) % CHRONICLE_CALENDAR_HUE_COUNT);
  }
  return hues;
}

export function createChronicleCalendarTree(
  entries: ChartEntry[],
  settings: ChronicleCalendarSettings,
  hues: ReadonlyMap<string, number> = createChronicleCalendarHues(settings)
): ChronicleCalendarTreeNode[] {
  const calendarNames = [settings.baseCalendarName, ...settings.calendars.map((calendar) => calendar.name)];
  const knownNames = new Set(calendarNames);
  const filesByCalendar = new Map<string, Map<string, ChronicleCalendarTreeFile>>(
    calendarNames.map((name) => [name, new Map()])
  );

  for (const entry of entries) {
    const calendarName = entry.calendarName?.trim() || settings.baseCalendarName;
    if (!knownNames.has(calendarName)) continue;
    const files = filesByCalendar.get(calendarName);
    if (!files?.has(entry.path)) files?.set(entry.path, { fileName: entry.fileName, path: entry.path });
  }

  return calendarNames.map((calendarName) => ({
    calendarName,
    files: [...(filesByCalendar.get(calendarName)?.values() ?? [])].toSorted((left, right) => (
      left.fileName.localeCompare(right.fileName, "ja") || left.path.localeCompare(right.path, "ja")
    )),
    hue: calendarName === settings.baseCalendarName ? null : hues.get(calendarName) ?? null
  }));
}

function hashCalendarName(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
