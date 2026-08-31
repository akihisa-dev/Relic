import type {
  SaveWorkspaceTablePreferencesInput,
  WorkspaceTablePreferences
} from "../../shared/ipc";
import { workspaceTablePreferenceLimits } from "../../shared/ipc";
import { isWorkspaceIdInput } from "./inputValidation";

export function isWorkspaceTablePreferencesInput(
  input: unknown
): input is WorkspaceTablePreferences {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return false;
  }
  const candidate = input as Record<string, unknown>;
  if (!validTableProperties(candidate.selectedProperties)) return false;
  const selected = new Set(candidate.selectedProperties);
  if (
    !Number.isInteger(candidate.fileColumnWidth) ||
    Number(candidate.fileColumnWidth) <
      workspaceTablePreferenceLimits.fileColumnMinimum ||
    Number(candidate.fileColumnWidth) >
      workspaceTablePreferenceLimits.fileColumnMaximum
  ) {
    return false;
  }
  if (
    !Array.isArray(candidate.columnWidths) ||
    candidate.columnWidths.length > workspaceTablePreferenceLimits.propertyCount
  ) {
    return false;
  }
  const widthProperties = new Set<string>();
  if (!candidate.columnWidths.every((entry) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      return false;
    }
    const width = entry as Record<string, unknown>;
    if (
      !validTableProperty(width.property) ||
      !selected.has(width.property) ||
      widthProperties.has(width.property)
    ) {
      return false;
    }
    if (
      !Number.isInteger(width.width) ||
      Number(width.width) <
        workspaceTablePreferenceLimits.propertyColumnMinimum ||
      Number(width.width) >
        workspaceTablePreferenceLimits.propertyColumnMaximum
    ) {
      return false;
    }
    widthProperties.add(width.property);
    return true;
  })) {
    return false;
  }
  if (
    !validTableProperties(candidate.wrappedProperties) ||
    !candidate.wrappedProperties.every((property) => selected.has(property))
  ) {
    return false;
  }
  if (
    typeof candidate.sort !== "object" ||
    candidate.sort === null ||
    Array.isArray(candidate.sort)
  ) {
    return false;
  }
  const sort = candidate.sort as Record<string, unknown>;
  if (sort.direction !== "asc" && sort.direction !== "desc") return false;
  if (
    sort.property !== null &&
    (!validTableProperty(sort.property) || !selected.has(sort.property))
  ) {
    return false;
  }
  if (
    !Array.isArray(candidate.filters) ||
    candidate.filters.length > workspaceTablePreferenceLimits.filterCount
  ) {
    return false;
  }
  return candidate.filters.every(validTableFilter);
}

export function isSaveWorkspaceTablePreferencesInput(
  input: unknown
): input is SaveWorkspaceTablePreferencesInput {
  return typeof input === "object" &&
    input !== null &&
    !Array.isArray(input) &&
    isWorkspaceIdInput(input) &&
    isWorkspaceTablePreferencesInput((input as Record<string, unknown>).preferences);
}

function validTableProperties(input: unknown): input is string[] {
  if (
    !Array.isArray(input) ||
    input.length > workspaceTablePreferenceLimits.propertyCount
  ) {
    return false;
  }
  const properties = new Set<string>();
  return input.every((property) => {
    if (!validTableProperty(property) || properties.has(property)) return false;
    properties.add(property);
    return true;
  });
}

function validTableProperty(value: unknown): value is string {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= workspaceTablePreferenceLimits.propertyNameLength &&
    value.trim() === value &&
    !value.includes("\0");
}

function validTableFilter(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const filter = value as Record<string, unknown>;
  if (filter.target === "frontmatter") {
    return filter.operator === "invalid" || filter.operator === "valid";
  }
  if (filter.target === "file") {
    return (
      filter.operator === "contains" ||
      filter.operator === "not-contains" ||
      filter.operator === "equals"
    ) && validTableFilterValue(filter.value);
  }
  if (filter.target !== "property" || !validTableProperty(filter.property)) {
    return false;
  }
  if (
    filter.operator === "empty" ||
    filter.operator === "exists" ||
    filter.operator === "missing"
  ) {
    return filter.value === undefined;
  }
  return (
    filter.operator === "contains" ||
    filter.operator === "not-contains" ||
    filter.operator === "equals"
  ) && validTableFilterValue(filter.value);
}

function validTableFilterValue(value: unknown): value is string {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= workspaceTablePreferenceLimits.filterValueLength &&
    !value.includes("\0");
}
