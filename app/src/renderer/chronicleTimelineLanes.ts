import type { ChartEntry } from "../shared/ipc";
import { entryKey } from "./chronicleTimelineRows";

export interface ChronicleLaneEntry {
  displayEntry: ChartEntry;
  entry: ChartEntry;
  key: string;
  order: number;
}

export type ChronicleLaneIndexes = Record<string, number>;

export function assignChronicleLaneIndexes(
  entries: ChronicleLaneEntry[],
  preferredLaneIndexes: ChronicleLaneIndexes = {}
): ChronicleLaneIndexes {
  const laneEndValues: number[] = [];
  const preferredLaneByFile = new Map<string, number>();
  const laneIndexes: ChronicleLaneIndexes = {};

  for (const item of entries.toSorted((a, b) =>
    a.displayEntry.startValue - b.displayEntry.startValue ||
    a.displayEntry.endValue - b.displayEntry.endValue ||
    a.order - b.order
  )) {
    const explicitLane = preferredLaneIndexes[item.key];
    const fileKey = item.entry.path || item.entry.fileName;
    const preferredLane = explicitLane ?? preferredLaneByFile.get(fileKey);
    const laneIndex = preferredLane !== undefined && canUseLane(laneEndValues, preferredLane, item.displayEntry.startValue)
      ? preferredLane
      : findAvailableLaneIndex(laneEndValues, item.displayEntry.startValue);
    const nextLaneIndex = laneIndex === -1 ? laneEndValues.length : laneIndex;

    laneEndValues[nextLaneIndex] = item.displayEntry.endValue;
    preferredLaneByFile.set(fileKey, nextLaneIndex);
    laneIndexes[item.key] = nextLaneIndex;
  }

  return laneIndexes;
}

export function moveChronicleEntryLane(
  entries: ChronicleLaneEntry[],
  currentLaneIndexes: ChronicleLaneIndexes,
  movingKey: string,
  targetLaneIndex: number
): ChronicleLaneIndexes {
  const entriesByKey = new Map(entries.map((entry) => [entry.key, entry]));
  const movingEntry = entriesByKey.get(movingKey);
  if (!movingEntry) return currentLaneIndexes;

  const laneIndexes: ChronicleLaneIndexes = { ...currentLaneIndexes };
  laneIndexes[movingKey] = Math.max(0, Math.floor(targetLaneIndex));

  const queue = [movingKey];
  let guard = entries.length * entries.length + entries.length;

  while (queue.length > 0 && guard > 0) {
    guard -= 1;
    const key = queue.shift();
    if (!key) continue;

    const sourceEntry = entriesByKey.get(key);
    if (!sourceEntry) continue;

    const sourceLane = laneIndexes[key] ?? 0;
    for (const candidate of entries) {
      if (candidate.key === key) continue;
      if ((laneIndexes[candidate.key] ?? 0) !== sourceLane) continue;
      if (!chronicleEntriesOverlap(sourceEntry.displayEntry, candidate.displayEntry)) continue;

      laneIndexes[candidate.key] = sourceLane + 1;
      queue.push(candidate.key);
    }
  }

  return laneIndexes;
}

export function chronicleEntriesOverlap(a: ChartEntry, b: ChartEntry): boolean {
  return a.startValue <= b.endValue && b.startValue <= a.endValue;
}

export function chronicleLaneEntryKey(entry: ChartEntry): string {
  return entryKey(entry);
}

function canUseLane(laneEndValues: number[], laneIndex: number, startValue: number): boolean {
  return (laneEndValues[laneIndex] ?? -Infinity) < startValue;
}

function findAvailableLaneIndex(laneEndValues: number[], startValue: number): number {
  for (let index = 0; index < laneEndValues.length; index += 1) {
    if (laneEndValues[index] < startValue) return index;
  }

  return -1;
}
