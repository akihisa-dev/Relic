import { chronicleCalendarIds } from "./ipc";

export const reservedFrontmatterFieldNames: string[] = [
  "aliases",
  "tags",
  "status",
  ...chronicleCalendarIds,
  "plannedDate",
  "actualDate"
];

const reservedFrontmatterFieldNameSet = new Set(reservedFrontmatterFieldNames);

export function isReservedFrontmatterFieldName(name: string): boolean {
  return reservedFrontmatterFieldNameSet.has(name);
}
