import {
  workspaceTablePreferenceLimits,
  type WorkspaceTableFilter,
  type WorkspaceTablePreferences,
  type WorkspaceTableRow,
  type WorkspaceTableValue
} from "../../shared/ipc";

export type TableSort = { direction: "asc" | "desc"; property: string | null };
export type TableColumnDropEdge = "after" | "before";

export const compactTableRowHeight = 48;
export const wrappedTableRowHeight = 80;

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

export function filterTableRows(
  rows: WorkspaceTableRow[],
  search: string,
  filters: WorkspaceTableFilter[],
  selectedProperties: string[]
): WorkspaceTableRow[] {
  const query = normalizeSearchText(search.trim());
  return rows.filter((row) => {
    if (query && !searchableRowText(row, selectedProperties).some((value) => normalizeSearchText(value).includes(query))) return false;
    return filters.every((filter) => matchesFilter(row, filter));
  });
}

export function tableColumnWidth(preferences: WorkspaceTablePreferences, property: string): number {
  return preferences.columnWidths.find((entry) => entry.property === property)?.width ?? workspaceTablePreferenceLimits.propertyColumnDefault;
}

export function withTableColumnWidth(
  preferences: WorkspaceTablePreferences,
  property: string,
  width: number
): WorkspaceTablePreferences {
  const nextWidth = clamp(width, workspaceTablePreferenceLimits.propertyColumnMinimum, workspaceTablePreferenceLimits.propertyColumnMaximum);
  return {
    ...preferences,
    columnWidths: [
      ...preferences.columnWidths.filter((entry) => entry.property !== property),
      { property, width: nextWidth }
    ]
  };
}

export function withFileColumnWidth(preferences: WorkspaceTablePreferences, width: number): WorkspaceTablePreferences {
  return {
    ...preferences,
    fileColumnWidth: clamp(width, workspaceTablePreferenceLimits.fileColumnMinimum, workspaceTablePreferenceLimits.fileColumnMaximum)
  };
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

export function reorderTableProperties(
  properties: string[],
  source: string,
  target: string,
  edge: TableColumnDropEdge
): string[] {
  if (source === target || !properties.includes(source) || !properties.includes(target)) return properties;
  const next = properties.filter((property) => property !== source);
  const targetIndex = next.indexOf(target);
  next.splice(edge === "before" ? targetIndex : targetIndex + 1, 0, source);
  return next;
}

export function tableColumnDragOffsets(
  properties: string[],
  widths: Readonly<Record<string, number>>,
  source: string,
  target: string,
  edge: TableColumnDropEdge
): Readonly<Record<string, number>> {
  const reordered = reorderTableProperties(properties, source, target, edge);
  if (reordered === properties || reordered.every((property, index) => property === properties[index])) return {};

  const originalPositions = columnPositions(properties, widths);
  const reorderedPositions = columnPositions(reordered, widths);
  return Object.fromEntries(properties.flatMap((property) => {
    if (property === source) return [];
    const offset = (reorderedPositions[property] ?? 0) - (originalPositions[property] ?? 0);
    return offset === 0 ? [] : [[property, offset]];
  }));
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

function columnPositions(
  properties: string[],
  widths: Readonly<Record<string, number>>
): Record<string, number> {
  let position = 0;
  return Object.fromEntries(properties.map((property) => {
    const entry: [string, number] = [property, position];
    position += widths[property] ?? 0;
    return entry;
  }));
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

function searchableRowText(row: WorkspaceTableRow, selectedProperties: string[]): string[] {
  return [row.name, row.path, ...selectedProperties.flatMap((property) => row.properties[property]?.text ?? [])];
}

function matchesFilter(row: WorkspaceTableRow, filter: WorkspaceTableFilter): boolean {
  if (filter.target === "frontmatter") {
    return filter.operator === "invalid" ? row.frontmatterStatus === "invalid" : row.frontmatterStatus !== "invalid";
  }
  if (filter.target === "file") return matchesText(`${row.name} ${row.path}`, filter.operator, filter.value ?? "");
  const value = filter.property ? row.properties[filter.property] : undefined;
  if (filter.operator === "missing") return value === undefined;
  if (filter.operator === "exists") return value !== undefined;
  if (filter.operator === "empty") return value !== undefined && (value.kind === "empty-array" || value.kind === "empty-string" || value.kind === "null");
  return value !== undefined && matchesText(value.text, filter.operator, filter.value ?? "");
}

function matchesText(text: string, operator: WorkspaceTableFilter["operator"], value: string): boolean {
  const normalizedText = normalizeSearchText(text);
  const normalizedValue = normalizeSearchText(value);
  if (operator === "equals") return normalizedText === normalizedValue;
  if (operator === "not-contains") return !normalizedText.includes(normalizedValue);
  return normalizedText.includes(normalizedValue);
}

function normalizeSearchText(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase();
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}
