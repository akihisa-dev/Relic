import { rm } from "node:fs/promises";
import path from "node:path";

import {
  type ChartSettings,
  type FrontmatterCategoryChoice,
  type ChartSource,
  defaultWorkspaceTablePreferences,
  type WorkspaceTableFilter,
  type WorkspaceTablePreferences,
  workspaceTablePreferenceLimits
} from "../../shared/ipc";
import {
  defaultChronicleCalendarSettings,
  isValidChronicleCalendarRange,
  type ChronicleCalendarSettings
} from "../../shared/chronicleCalendar";
import { normalizeWorkspaceRelativeInputPath } from "../files/paths";
import {
  assertCurrentSettingsSchemaVersion,
  SecureVersionedJsonStore
} from "./secureVersionedJsonStore";

export interface WorkspaceSettings {
  charts: ChartSettings[];
  chronicleCalendarSettings?: ChronicleCalendarSettings;
  frontmatterCategoryChoices: FrontmatterCategoryChoice[];
  pinnedPaths: string[];
  tablePreferences: WorkspaceTablePreferences;
  workspacePath: string;
}

type PersistedWorkspaceSettings = {
  charts?: unknown;
  chronicleCalendarSettings?: unknown;
  frontmatterCategoryChoices?: unknown;
  pinnedPaths?: unknown;
  schemaVersion?: unknown;
  tablePreferences?: unknown;
  workspacePath?: unknown;
};

export const defaultCharts: ChartSettings[] = [
  { filePaths: [], id: "chronicle", name: "chronicle", source: "chronicle" }
];

const WORKSPACE_SETTINGS_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
export const currentWorkspaceSettingsSchemaVersion = 6;
const workspaceSettingsStore = new SecureVersionedJsonStore<PersistedWorkspaceSettings, WorkspaceSettings>({
  createCorruptError: createCorruptWorkspaceSettingsError,
  createDefaultValue: createDefaultWorkspaceSettings,
  parse: parseWorkspaceSettings,
  parseObject: parseSettingsObject,
  serialize: serializeWorkspaceSettings
});

function createDefaultWorkspaceSettings(): WorkspaceSettings {
  return {
    charts: defaultCharts.map((chart) => ({
      ...chart,
      ...(chart.filePaths ? { filePaths: [...chart.filePaths] } : {})
    })),
    chronicleCalendarSettings: {
      ...defaultChronicleCalendarSettings,
      calendars: defaultChronicleCalendarSettings.calendars.map((calendar) => ({ ...calendar })),
      visibleCalendarNames: [...defaultChronicleCalendarSettings.visibleCalendarNames]
    },
    frontmatterCategoryChoices: [],
    pinnedPaths: [],
    tablePreferences: cloneDefaultTablePreferences(),
    workspacePath: ""
  };
}

export function getWorkspaceSettingsPath(userDataPath: string, workspaceId: string): string {
  assertSafeWorkspaceSettingsId(workspaceId);

  return path.join(userDataPath, "workspaces", `${workspaceId}.json`);
}

export async function readWorkspaceSettings(
  userDataPath: string,
  workspaceId: string
): Promise<WorkspaceSettings> {
  try {
    const settingsPath = getWorkspaceSettingsPath(userDataPath, workspaceId);
    return workspaceSettingsStore.read(settingsPath);
  } catch (error) {
    if (isInvalidWorkspaceSettingsIdError(error)) return createDefaultWorkspaceSettings();
    throw error;
  }
}

function parseWorkspaceSettings(raw: PersistedWorkspaceSettings): WorkspaceSettings {
  return {
    charts: parseCharts(raw.charts),
    chronicleCalendarSettings: parseChronicleCalendarSettings(raw.chronicleCalendarSettings),
    frontmatterCategoryChoices: parseFrontmatterCategoryChoices(raw.frontmatterCategoryChoices),
    pinnedPaths: parsePinnedPaths(raw.pinnedPaths),
    tablePreferences: parseWorkspaceTablePreferences(raw.tablePreferences),
    workspacePath: typeof raw.workspacePath === "string" ? raw.workspacePath : ""
  };
}

export function parseChronicleCalendarSettings(raw: unknown): ChronicleCalendarSettings {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return defaultChronicleCalendarSettings;
  const candidate = raw as Record<string, unknown>;
  const baseCalendarName = typeof candidate.baseCalendarName === "string" ? candidate.baseCalendarName.trim() : "";
  if (!baseCalendarName) return defaultChronicleCalendarSettings;
  const calendars = Array.isArray(candidate.calendars) ? candidate.calendars.flatMap((value) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return [];
    const calendar = value as Record<string, unknown>;
    const name = typeof calendar.name === "string" ? calendar.name.trim() : "";
    if (!name || !Number.isSafeInteger(calendar.yearOne) || calendar.yearOne === 0) return [];
    const range = parseChronicleCalendarRange(calendar.range);
    return [{ name, range, yearOne: Number(calendar.yearOne) }];
  }) : [];
  const names = new Set([baseCalendarName]);
  const uniqueCalendars = calendars.filter((calendar) => {
    if (names.has(calendar.name)) return false;
    names.add(calendar.name);
    return true;
  });
  const visibleCalendarNames = Array.isArray(candidate.visibleCalendarNames)
    ? candidate.visibleCalendarNames.filter((name): name is string => typeof name === "string" && names.has(name))
    : [];
  return {
    baseCalendarName,
    calendars: uniqueCalendars,
    visibleCalendarNames: [baseCalendarName, ...Array.from(new Set(visibleCalendarNames)).filter((name) => name !== baseCalendarName)]
  };
}

function parseChronicleCalendarRange(raw: unknown): { end: number; start: number } | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const candidate = raw as Record<string, unknown>;
  const range = { end: Number(candidate.end), start: Number(candidate.start) };
  return isValidChronicleCalendarRange(range) ? range : null;
}

export function parseCharts(raw: unknown): ChartSettings[] {
  if (!Array.isArray(raw)) return defaultCharts;

  const parsed = raw.flatMap((chart): ChartSettings[] => {
    if (typeof chart !== "object" || chart === null) return [];

    const candidate = chart as Record<string, unknown>;
    const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
    const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
    const source = candidate.source;

    if (!id || !isChartSource(source)) return [];

    return [{
      filePaths: parseChartFilePaths(candidate.filePaths),
      id,
      name: name || defaultChartName(source),
      source
    }];
  });

  return defaultCharts.map((defaultChart) => {
    const saved = parsed.find((chart) => chart.id === defaultChart.id || chart.source === defaultChart.source);

    return {
      ...defaultChart,
      filePaths: saved?.filePaths ?? defaultChart.filePaths
    };
  });
}

export function parsePinnedPaths(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];

  const paths = raw.flatMap((item): string[] => {
    if (typeof item !== "string") return [];

    const normalized = normalizePinnedPath(item);
    return normalized ? [normalized] : [];
  });

  return Array.from(new Set(paths));
}

export function parseFrontmatterCategoryChoices(raw: unknown): FrontmatterCategoryChoice[] {
  if (!Array.isArray(raw)) return [];

  const choices = raw.flatMap((item): string[] => {
    if (typeof item !== "string") return [];

    const normalized = item.trim();
    return normalized ? [normalized] : [];
  });

  return Array.from(new Set(choices));
}

export function parseTableProperties(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];

  const properties = raw.flatMap((item): string[] => {
    if (typeof item !== "string" || item.length === 0 || item.length > 1024 || item.trim() !== item || item.includes("\0")) {
      return [];
    }
    return [item];
  });

  return Array.from(new Set(properties)).slice(0, workspaceTablePreferenceLimits.propertyCount);
}

export function parseWorkspaceTablePreferences(raw: unknown): WorkspaceTablePreferences {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return cloneDefaultTablePreferences();
  const candidate = raw as Record<string, unknown>;
  const selectedProperties = parseTableProperties(candidate.selectedProperties);
  const selectedSet = new Set(selectedProperties);
  const columnWidths = Array.isArray(candidate.columnWidths) ? candidate.columnWidths.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return [];
    const width = entry as Record<string, unknown>;
    if (typeof width.property !== "string" || !selectedSet.has(width.property)) return [];
    if (!Number.isInteger(width.width) || Number(width.width) < workspaceTablePreferenceLimits.propertyColumnMinimum || Number(width.width) > workspaceTablePreferenceLimits.propertyColumnMaximum) return [];
    return [{ property: width.property, width: Number(width.width) }];
  }) : [];
  const uniqueWidths = columnWidths.filter((entry, index) => columnWidths.findIndex((item) => item.property === entry.property) === index);
  const wrappedProperties = parseTableProperties(candidate.wrappedProperties).filter((property) => selectedSet.has(property));
  const filters = parseWorkspaceTableFilters(candidate.filters);
  const sortCandidate = typeof candidate.sort === "object" && candidate.sort !== null && !Array.isArray(candidate.sort)
    ? candidate.sort as Record<string, unknown>
    : {};
  const sortProperty = sortCandidate.property === null || (typeof sortCandidate.property === "string" && selectedSet.has(sortCandidate.property))
    ? sortCandidate.property as string | null
    : null;
  return {
    columnWidths: uniqueWidths,
    fileColumnWidth: Number.isInteger(candidate.fileColumnWidth) && Number(candidate.fileColumnWidth) >= workspaceTablePreferenceLimits.fileColumnMinimum && Number(candidate.fileColumnWidth) <= workspaceTablePreferenceLimits.fileColumnMaximum
      ? Number(candidate.fileColumnWidth)
      : defaultWorkspaceTablePreferences.fileColumnWidth,
    filters,
    selectedProperties,
    sort: {
      direction: sortCandidate.direction === "desc" ? "desc" : "asc",
      property: sortProperty
    },
    wrappedProperties
  };
}

function parseWorkspaceTableFilters(raw: unknown): WorkspaceTableFilter[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, workspaceTablePreferenceLimits.filterCount).flatMap((entry): WorkspaceTableFilter[] => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return [];
    const filter = entry as Record<string, unknown>;
    if (filter.target === "frontmatter" && (filter.operator === "invalid" || filter.operator === "valid")) {
      return [{ operator: filter.operator, target: "frontmatter" }];
    }
    if (filter.target === "file" && (filter.operator === "contains" || filter.operator === "not-contains" || filter.operator === "equals") && validFilterValue(filter.value)) {
      return [{ operator: filter.operator, target: "file", value: filter.value }];
    }
    if (filter.target === "property" && validTableProperty(filter.property)) {
      if ((filter.operator === "contains" || filter.operator === "not-contains" || filter.operator === "equals") && validFilterValue(filter.value)) {
        return [{ operator: filter.operator, property: filter.property, target: "property", value: filter.value }];
      }
      if (filter.operator === "empty" || filter.operator === "exists" || filter.operator === "missing") {
        return [{ operator: filter.operator, property: filter.property, target: "property" }];
      }
    }
    return [];
  });
}

function validFilterValue(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= workspaceTablePreferenceLimits.filterValueLength && !value.includes("\0");
}

function validTableProperty(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= workspaceTablePreferenceLimits.propertyNameLength && value.trim() === value && !value.includes("\0");
}

function cloneDefaultTablePreferences(): WorkspaceTablePreferences {
  return {
    ...defaultWorkspaceTablePreferences,
    columnWidths: [],
    filters: [],
    selectedProperties: [],
    sort: { ...defaultWorkspaceTablePreferences.sort },
    wrappedProperties: []
  };
}

function normalizePinnedPath(raw: string): string | null {
  return normalizeWorkspaceRelativeSettingPath(raw);
}

export function normalizeWorkspaceRelativeSettingPath(raw: string): string | null {
  return normalizeWorkspaceRelativeInputPath(raw);
}

function parseChartFilePaths(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;

  const paths = raw.flatMap((item): string[] => {
    if (typeof item !== "string") return [];

    const normalized = normalizeWorkspaceRelativeSettingPath(item);
    return normalized ? [normalized] : [];
  });

  return Array.from(new Set(paths));
}

function isChartSource(value: unknown): value is ChartSource {
  return value === "chronicle";
}

function defaultChartName(source: ChartSource): string {
  void source;
  return "クロニクル";
}

function assertSafeWorkspaceSettingsId(workspaceId: string): void {
  if (workspaceId.trim() !== workspaceId || !WORKSPACE_SETTINGS_ID_PATTERN.test(workspaceId)) {
    throw new Error("Invalid workspace settings id.");
  }
}

function isInvalidWorkspaceSettingsIdError(error: unknown): boolean {
  return error instanceof Error && error.message === "Invalid workspace settings id.";
}

export async function writeWorkspaceSettings(
  userDataPath: string,
  workspaceId: string,
  settings: WorkspaceSettings
): Promise<void> {
  const settingsPath = getWorkspaceSettingsPath(userDataPath, workspaceId);

  await workspaceSettingsStore.write(settingsPath, settings);
}

export async function updateWorkspaceSettings(
  userDataPath: string,
  workspaceId: string,
  update: (current: WorkspaceSettings) => Promise<WorkspaceSettings> | WorkspaceSettings
): Promise<WorkspaceSettings> {
  return workspaceSettingsStore.update(getWorkspaceSettingsPath(userDataPath, workspaceId), update);
}

export async function removeWorkspaceSettings(
  userDataPath: string,
  workspaceId: string
): Promise<void> {
  const settingsPath = getWorkspaceSettingsPath(userDataPath, workspaceId);

  await rm(settingsPath, { force: true });
}

function parseSettingsObject(raw: unknown, settingsPath: string): PersistedWorkspaceSettings | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return null;
  }

  const settings = raw as PersistedWorkspaceSettings;
  assertCurrentSettingsSchemaVersion(
    settings,
    currentWorkspaceSettingsSchemaVersion,
    settingsPath,
    "ワークスペース設定",
    "UnsupportedWorkspaceSettingsVersionError"
  );
  return settings;
}

function serializeWorkspaceSettings(settings: WorkspaceSettings): PersistedWorkspaceSettings {
  return {
    schemaVersion: currentWorkspaceSettingsSchemaVersion,
    ...settings
  };
}

function createCorruptWorkspaceSettingsError(settingsPath: string): Error {
  const error = new Error(`設定JSONが壊れています: ${settingsPath}`) as Error;
  error.name = "CorruptWorkspaceSettingsError";
  return error;
}
