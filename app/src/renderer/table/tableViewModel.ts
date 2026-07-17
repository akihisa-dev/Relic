import type { WorkspaceTableRow, WorkspaceTableValue } from "../../shared/ipc";

export type TableSort = { direction: "asc" | "desc"; property: string | null };

const collator = new Intl.Collator("ja", { numeric: true, sensitivity: "base" });

export function sortTableRows(rows: WorkspaceTableRow[], sort: TableSort): WorkspaceTableRow[] {
  return [...rows].sort((left, right) => {
    const leftValue = sort.property === null ? null : left.properties[sort.property];
    const rightValue = sort.property === null ? null : right.properties[sort.property];
    const missingOrder = compareMissing(leftValue, rightValue);
    if (missingOrder !== 0) return missingOrder;

    const primary = sort.property === null
      ? collator.compare(left.name, right.name)
      : leftValue && rightValue
        ? compareValues(leftValue, rightValue)
        : 0;
    if (primary !== 0) return sort.direction === "asc" ? primary : -primary;

    const nameOrder = collator.compare(left.name, right.name);
    return nameOrder !== 0 ? nameOrder : collator.compare(left.path, right.path);
  });
}

export function duplicateFileNames(rows: WorkspaceTableRow[]): Set<string> {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.name, (counts.get(row.name) ?? 0) + 1);
  return new Set(Array.from(counts).filter(([, count]) => count > 1).map(([name]) => name));
}

export function directoryForPath(path: string): string {
  const separator = path.lastIndexOf("/");
  return separator < 0 ? "." : path.slice(0, separator);
}

export function nextTableSort(current: TableSort, property: string | null): TableSort {
  return current.property === property
    ? { direction: current.direction === "asc" ? "desc" : "asc", property }
    : { direction: "asc", property };
}

export function visibleTableRange(
  rowCount: number,
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  overscan = 6
): { end: number; start: number } {
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const end = Math.min(rowCount, Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan);
  return { end, start };
}

function compareMissing(left: WorkspaceTableValue | undefined | null, right: WorkspaceTableValue | undefined | null): number {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return 0;
}

function compareValues(left: WorkspaceTableValue, right: WorkspaceTableValue): number {
  if (left.kind === "number" && right.kind === "number") {
    return (left.numberValue ?? 0) - (right.numberValue ?? 0);
  }
  return collator.compare(left.text, right.text);
}
