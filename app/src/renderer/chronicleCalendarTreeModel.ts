import type { ChronicleCalendarSettings } from "../shared/chronicleCalendar";
import type { ChartEntry } from "../shared/ipc";
import {
  chronicleCategoryKey,
  createChronicleCategoryOptions,
  type ChronicleCategoryOption
} from "./chronicleCategoryModel";

const CHRONICLE_CALENDAR_HUE_COUNT = 360;
const CHRONICLE_CALENDAR_HUE_STEP = 137;

export interface ChronicleCalendarTreeCategory extends ChronicleCategoryOption {
  visibilityKey: string;
}

export interface ChronicleCalendarTreeNode {
  calendarName: string;
  categories: ChronicleCalendarTreeCategory[];
  hue: number | null;
}

export function chronicleCalendarCategoryVisibilityKey(calendarName: string, categoryKey: string): string {
  return JSON.stringify([calendarName, categoryKey]);
}

export function chronicleEntryCategoryVisibilityKey(entry: ChartEntry, baseCalendarName: string): string {
  return chronicleCalendarCategoryVisibilityKey(
    entry.calendarName?.trim() || baseCalendarName,
    chronicleCategoryKey(entry.category)
  );
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
  categoryChoices: string[],
  uncategorizedLabel: string,
  calendarHues: ReadonlyMap<string, number> = createChronicleCalendarHues(settings),
  categoryHues: ReadonlyMap<string, number> = new Map()
): ChronicleCalendarTreeNode[] {
  const calendarNames = [settings.baseCalendarName, ...settings.calendars.map((calendar) => calendar.name)];
  const knownNames = new Set(calendarNames);
  const entriesByCalendar = new Map<string, ChartEntry[]>(calendarNames.map((name) => [name, []]));

  for (const entry of entries) {
    const calendarName = entry.calendarName?.trim() || settings.baseCalendarName;
    if (!knownNames.has(calendarName)) continue;
    entriesByCalendar.get(calendarName)?.push(entry);
  }

  return calendarNames.map((calendarName) => ({
    calendarName,
    categories: createChronicleCategoryOptions(
      entriesByCalendar.get(calendarName) ?? [],
      categoryChoices,
      uncategorizedLabel
    ).map((category) => ({
      ...category,
      hue: categoryHues.get(category.key) ?? category.hue,
      visibilityKey: chronicleCalendarCategoryVisibilityKey(calendarName, category.key)
    })),
    hue: calendarName === settings.baseCalendarName ? null : calendarHues.get(calendarName) ?? null
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
