import type {
  FeatureToggles,
  ChronicleCalendarSettings,
  FrontmatterCategoryChoice,
  FrontmatterTemplate,
  ChartSettings,
  ChartSource,
  RenameWorkspaceInput,
  RefreshWorkspaceInput,
  SwitchWorkspaceInput,
  UpdateChartEntryInput,
  UserDefinedField,
} from "../../shared/ipc";
import { workspaceTablePreferenceLimits, type WorkspaceTablePreferences } from "../../shared/ipc";
import { isValidChronicleCalendarRange } from "../../shared/chronicleCalendar";
import {
  isUserDefinedFieldType,
  isValidUserDefinedFieldName,
  userDefinedFieldNamePattern,
  userDefinedFieldTypeNeedsChoices
} from "../../shared/frontmatterFields";
import { isWorkspaceRelativeInputPath } from "../files/paths";

const chartSources: ChartSource[] = ["chronicle"];
const workspaceIdPattern = /^[A-Za-z0-9_-]+$/;

export function isUserDefinedFieldsInput(input: unknown): input is UserDefinedField[] {
  if (!Array.isArray(input)) return false;

  const names = new Set<string>();

  return input.every((field) => {
    if (typeof field !== "object" || field === null) return false;
    const candidate = field as Record<string, unknown>;

    if (
      typeof candidate.name !== "string" ||
      !isValidUserDefinedFieldName(candidate.name)
    ) return false;
    if (names.has(candidate.name)) return false;
    names.add(candidate.name);
    if (!isUserDefinedFieldType(candidate.type)) return false;
    const type = candidate.type;
    if ("choices" in candidate && !Array.isArray(candidate.choices)) return false;
    if (Array.isArray(candidate.choices)) {
      if (!userDefinedFieldTypeNeedsChoices(type)) return false;
      const choices = new Set<string>();
      for (const choice of candidate.choices) {
        if (typeof choice !== "string" || choice.trim() !== choice || choice === "" || choices.has(choice)) return false;
        choices.add(choice);
      }
    }

    return true;
  });
}

export function isChartsInput(input: unknown): input is ChartSettings[] {
  if (!Array.isArray(input) || input.length !== 1) return false;

  const sources = new Set<ChartSource>();

  return input.every((chart) => {
    if (typeof chart !== "object" || chart === null) return false;

    const candidate = chart as Record<string, unknown>;
    if (typeof candidate.id !== "string" || candidate.id.trim() === "") return false;
    if (typeof candidate.name !== "string" || candidate.name.trim() === "") return false;
    if (!chartSources.includes(candidate.source as ChartSource)) return false;
    if (sources.has(candidate.source as ChartSource)) return false;
    if ("filePaths" in candidate && !Array.isArray(candidate.filePaths)) return false;
    if (Array.isArray(candidate.filePaths) && !candidate.filePaths.every(isWorkspaceRelativeInputPath)) return false;

    sources.add(candidate.source as ChartSource);
    return true;
  });
}

export function isUpdateChartEntryInput(input: unknown): input is UpdateChartEntryInput {
  if (typeof input !== "object" || input === null) return false;

  const candidate = input as Record<string, unknown>;
  const startValue = candidate.startValue;
  const endValue = candidate.endValue;

  if (typeof startValue !== "number" || typeof endValue !== "number") return false;

  return (
    isWorkspaceRelativeInputPath(candidate.path) &&
    chartSources.includes(candidate.source as ChartSource) &&
    Number.isInteger(candidate.chronicleEntryIndex) &&
    Number(candidate.chronicleEntryIndex) >= 0 &&
    (candidate.kind === "move" || candidate.kind === "resize-start" || candidate.kind === "resize-end") &&
    Number.isInteger(candidate.originalStartValue) &&
    Number.isInteger(candidate.originalEndValue) &&
    Number.isInteger(startValue) &&
    Number.isInteger(endValue) &&
    startValue <= endValue
  );
}

export function isFrontmatterCategoryChoicesInput(input: unknown): input is FrontmatterCategoryChoice[] {
  if (!Array.isArray(input)) return false;

  const choices = new Set<string>();

  return input.every((choice) => {
    if (typeof choice !== "string") return false;
    if (choice.trim() !== choice || choice === "" || choices.has(choice)) return false;
    choices.add(choice);
    return true;
  });
}

export function isChronicleCalendarSettingsInput(input: unknown): input is ChronicleCalendarSettings {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return false;
  const candidate = input as Record<string, unknown>;
  if (typeof candidate.baseCalendarName !== "string" || !validCalendarName(candidate.baseCalendarName)) return false;
  if (!Array.isArray(candidate.calendars) || candidate.calendars.length > 32) return false;
  const names = new Set([candidate.baseCalendarName]);
  for (const value of candidate.calendars) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    const calendar = value as Record<string, unknown>;
    if (typeof calendar.name !== "string" || !validCalendarName(calendar.name) || names.has(calendar.name)) return false;
    if (!Number.isSafeInteger(calendar.yearOne) || calendar.yearOne === 0) return false;
    if (calendar.range !== null) {
      if (typeof calendar.range !== "object" || Array.isArray(calendar.range)) return false;
      const range = calendar.range as Record<string, unknown>;
      if (!isValidChronicleCalendarRange({ end: Number(range.end), start: Number(range.start) })) return false;
    }
    names.add(calendar.name);
  }
  return Array.isArray(candidate.visibleCalendarNames) && candidate.visibleCalendarNames.length > 0 &&
    new Set(candidate.visibleCalendarNames).size === candidate.visibleCalendarNames.length &&
    candidate.visibleCalendarNames[0] === candidate.baseCalendarName &&
    candidate.visibleCalendarNames.every((name) => typeof name === "string" && names.has(name));
}

function validCalendarName(name: string): boolean {
  return name.length > 0 && name.length <= 100 && name.trim() === name && !name.includes("\0");
}

export function isWorkspaceTablePreferencesInput(input: unknown): input is WorkspaceTablePreferences {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return false;
  const candidate = input as Record<string, unknown>;
  if (!validTableProperties(candidate.selectedProperties)) return false;
  const selected = new Set(candidate.selectedProperties);
  if (!Number.isInteger(candidate.fileColumnWidth) || Number(candidate.fileColumnWidth) < workspaceTablePreferenceLimits.fileColumnMinimum || Number(candidate.fileColumnWidth) > workspaceTablePreferenceLimits.fileColumnMaximum) return false;
  if (!Array.isArray(candidate.columnWidths) || candidate.columnWidths.length > workspaceTablePreferenceLimits.propertyCount) return false;
  const widthProperties = new Set<string>();
  if (!candidate.columnWidths.every((entry) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return false;
    const width = entry as Record<string, unknown>;
    if (!validTableProperty(width.property) || !selected.has(width.property) || widthProperties.has(width.property)) return false;
    if (!Number.isInteger(width.width) || Number(width.width) < workspaceTablePreferenceLimits.propertyColumnMinimum || Number(width.width) > workspaceTablePreferenceLimits.propertyColumnMaximum) return false;
    widthProperties.add(width.property);
    return true;
  })) return false;
  if (!validTableProperties(candidate.wrappedProperties) || !candidate.wrappedProperties.every((property) => selected.has(property))) return false;
  if (typeof candidate.sort !== "object" || candidate.sort === null || Array.isArray(candidate.sort)) return false;
  const sort = candidate.sort as Record<string, unknown>;
  if (sort.direction !== "asc" && sort.direction !== "desc") return false;
  if (sort.property !== null && (!validTableProperty(sort.property) || !selected.has(sort.property))) return false;
  if (!Array.isArray(candidate.filters) || candidate.filters.length > workspaceTablePreferenceLimits.filterCount) return false;
  return candidate.filters.every(validTableFilter);
}

function validTableProperties(input: unknown): input is string[] {
  if (!Array.isArray(input) || input.length > workspaceTablePreferenceLimits.propertyCount) return false;
  const properties = new Set<string>();
  return input.every((property) => {
    if (!validTableProperty(property) || properties.has(property)) return false;
    properties.add(property);
    return true;
  });
}

function validTableProperty(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= workspaceTablePreferenceLimits.propertyNameLength && value.trim() === value && !value.includes("\0");
}

function validTableFilter(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const filter = value as Record<string, unknown>;
  if (filter.target === "frontmatter") return filter.operator === "invalid" || filter.operator === "valid";
  if (filter.target === "file") {
    return (filter.operator === "contains" || filter.operator === "not-contains" || filter.operator === "equals") && validTableFilterValue(filter.value);
  }
  if (filter.target !== "property" || !validTableProperty(filter.property)) return false;
  if (filter.operator === "empty" || filter.operator === "exists" || filter.operator === "missing") return filter.value === undefined;
  return (filter.operator === "contains" || filter.operator === "not-contains" || filter.operator === "equals") && validTableFilterValue(filter.value);
}

function validTableFilterValue(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= workspaceTablePreferenceLimits.filterValueLength && !value.includes("\0");
}

export function isFrontmatterTemplatesInput(input: unknown): input is FrontmatterTemplate[] {
  if (!Array.isArray(input)) return false;

  const names = new Set<string>();

  return input.every((template) => {
    if (typeof template !== "object" || template === null) return false;
    const candidate = template as Record<string, unknown>;
    if (typeof candidate.name !== "string" || candidate.name.trim() === "") return false;
    if (names.has(candidate.name)) return false;
    names.add(candidate.name);

    return (
      Array.isArray(candidate.fieldNames) &&
      candidate.fieldNames.length > 0 &&
      candidate.fieldNames.every((fieldName) => (
        typeof fieldName === "string" && userDefinedFieldNamePattern.test(fieldName)
      ))
    );
  });
}

export function isFeatureTogglesInput(input: unknown): input is FeatureToggles {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return false;

  const candidate = input as Record<string, unknown>;
  return (
    typeof candidate.cards === "boolean" &&
    typeof candidate.chronicle === "boolean" &&
    typeof candidate.graph === "boolean" &&
    typeof candidate.sphere === "boolean" &&
    typeof candidate.table === "boolean" &&
    typeof candidate.tools === "boolean" &&
    typeof candidate.frontmatter === "boolean"
  );
}

export function isWorkspaceIdInput(input: unknown): input is { workspaceId: string } {
  const workspaceId = (input as { workspaceId?: unknown })?.workspaceId;

  return (
    typeof input === "object" &&
    input !== null &&
    "workspaceId" in input &&
    typeof workspaceId === "string" &&
    workspaceId.trim() === workspaceId &&
    workspaceIdPattern.test(workspaceId)
  );
}

export function isSwitchWorkspaceInput(input: unknown): input is SwitchWorkspaceInput {
  return isWorkspaceIdInput(input);
}

export function isRefreshWorkspaceInput(input: unknown): input is RefreshWorkspaceInput {
  return isWorkspaceIdInput(input);
}

export function isRenameWorkspaceInput(input: unknown): input is RenameWorkspaceInput {
  return (
    isWorkspaceIdInput(input) &&
    "workspaceId" in input &&
    "name" in input &&
    typeof (input as { name?: unknown }).name === "string"
  );
}
