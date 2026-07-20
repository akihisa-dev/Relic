import type { SettingsMigrationResult } from "../settings/secureVersionedJsonStore";

export const currentAppSettingsSchemaVersion = 6;
export const currentWorkspaceSettingsSchemaVersion = 6;

export type WorkspaceSettingsMigrationRecord = {
  charts?: unknown;
  chronicleCalendarSettings?: unknown;
  ganttCharts?: unknown;
  schemaVersion?: unknown;
  tablePreferences?: unknown;
  tableProperties?: unknown;
};

export function migrateAppSettings(
  raw: Record<string, unknown>,
  settingsPath: string
): SettingsMigrationResult<Record<string, unknown>> {
  const schemaVersion = readSchemaVersion(
    raw.schemaVersion,
    currentAppSettingsSchemaVersion,
    settingsPath,
    "AppSettings の設定",
    "UnsupportedSettingsVersionError"
  );

  if (schemaVersion === currentAppSettingsSchemaVersion) {
    return { didMigrate: false, settings: raw };
  }

  if (schemaVersion === 0 || schemaVersion === 1 || schemaVersion === 2 || schemaVersion === 3 || schemaVersion === 4 || schemaVersion === 5) {
    return {
      didMigrate: true,
      settings: {
        ...raw,
        featureToggles: migrateFeatureToggles(raw.featureToggles),
        schemaVersion: currentAppSettingsSchemaVersion
      }
    };
  }

  throw createUnsupportedSettingsVersionError(
    settingsPath,
    "AppSettings の設定",
    schemaVersion,
    "UnsupportedSettingsVersionError"
  );
}

export function migrateWorkspaceSettings<T extends WorkspaceSettingsMigrationRecord>(
  raw: T,
  settingsPath: string
): SettingsMigrationResult<T> {
  const schemaVersion = readSchemaVersion(
    raw.schemaVersion,
    currentWorkspaceSettingsSchemaVersion,
    settingsPath,
    "ワークスペース設定",
    "UnsupportedWorkspaceSettingsVersionError"
  );

  if (schemaVersion === currentWorkspaceSettingsSchemaVersion) {
    return { didMigrate: false, settings: raw };
  }

  if (schemaVersion === 0 || schemaVersion === 1 || schemaVersion === 2 || schemaVersion === 3 || schemaVersion === 4 || schemaVersion === 5) {
    return {
      didMigrate: true,
      settings: {
        ...raw,
        charts: raw.charts ?? raw.ganttCharts,
        tablePreferences: raw.tablePreferences ?? {
          columnWidths: [],
          fileColumnWidth: 260,
          filters: [],
          selectedProperties: raw.tableProperties ?? [],
          sort: { direction: "asc", property: null },
          wrappedProperties: []
        },
        chronicleCalendarSettings: migrateChronicleCalendarSettings(raw.chronicleCalendarSettings),
        schemaVersion: currentWorkspaceSettingsSchemaVersion
      }
    };
  }

  throw createUnsupportedSettingsVersionError(
    settingsPath,
    "ワークスペース設定",
    schemaVersion,
    "UnsupportedWorkspaceSettingsVersionError"
  );
}

function migrateChronicleCalendarSettings(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return raw;
  const settings = raw as Record<string, unknown>;
  if (!Array.isArray(settings.calendars)) return raw;
  return {
    ...settings,
    calendars: settings.calendars.map((value) => (
      typeof value === "object" && value !== null && !Array.isArray(value)
        ? { ...(value as Record<string, unknown>), range: (value as Record<string, unknown>).range ?? null }
        : value
    ))
  };
}

function migrateFeatureToggles(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return raw;

  const toggles = { ...(raw as Record<string, unknown>) };
  delete toggles.rightPanel;
  delete toggles.rightPanelLinks;
  delete toggles.rightPanelOutline;
  return {
    ...toggles,
    cards: typeof toggles.cards === "boolean" ? toggles.cards : false,
    graph: typeof toggles.graph === "boolean" ? toggles.graph : false,
    sphere: typeof toggles.sphere === "boolean" ? toggles.sphere : false,
    table: typeof toggles.table === "boolean" ? toggles.table : false
  };
}

function readSchemaVersion(
  raw: unknown,
  currentVersion: number,
  settingsPath: string,
  scope: string,
  errorName: string
): number {
  if (raw === undefined) return 0;
  if (!Number.isInteger(raw) || Number(raw) < 0) {
    throw createUnsupportedSettingsVersionError(settingsPath, scope, raw, errorName);
  }

  const schemaVersion = Number(raw);
  if (schemaVersion > currentVersion) {
    throw createUnsupportedSettingsVersionError(settingsPath, scope, schemaVersion, errorName);
  }

  return schemaVersion;
}

function createUnsupportedSettingsVersionError(
  settingsPath: string,
  scope: string,
  schemaVersion: unknown,
  errorName: string
): Error {
  const error = new Error(
    `${scope}形式がこのRelicでは読めません: ${settingsPath} (schemaVersion: ${String(schemaVersion)})`
  ) as Error;
  error.name = errorName;
  return error;
}
