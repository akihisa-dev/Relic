import type { SettingsMigrationResult } from "../settings/secureVersionedJsonStore";

export const currentAppSettingsSchemaVersion = 4;
export const currentWorkspaceSettingsSchemaVersion = 2;

export type WorkspaceSettingsMigrationRecord = {
  charts?: unknown;
  ganttCharts?: unknown;
  schemaVersion?: unknown;
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

  if (schemaVersion === 0 || schemaVersion === 1 || schemaVersion === 2 || schemaVersion === 3) {
    return {
      didMigrate: true,
      settings: {
        ...raw,
        featureToggles: migrateFeatureToggles(raw.featureToggles, schemaVersion),
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

  if (schemaVersion === 0 || schemaVersion === 1) {
    return {
      didMigrate: true,
      settings: {
        ...raw,
        charts: raw.charts ?? raw.ganttCharts,
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

function migrateFeatureToggles(raw: unknown, schemaVersion: 0 | 1 | 2 | 3): unknown {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return raw;

  const toggles = raw as Record<string, unknown>;
  const legacyRightPanel = typeof toggles.rightPanel === "boolean" ? toggles.rightPanel : true;

  return {
    ...toggles,
    graph: typeof toggles.graph === "boolean" ? toggles.graph : true,
    sphere: typeof toggles.sphere === "boolean" ? toggles.sphere : false,
    rightPanelLinks: schemaVersion === 0 && typeof toggles.rightPanelLinks !== "boolean" ? legacyRightPanel : toggles.rightPanelLinks,
    rightPanelOutline: schemaVersion === 0 && typeof toggles.rightPanelOutline !== "boolean" ? legacyRightPanel : toggles.rightPanelOutline
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
