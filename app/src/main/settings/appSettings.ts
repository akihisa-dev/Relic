import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  defaultAutoSyncSettings,
  defaultEditorSettings,
  defaultFeatureToggles,
  defaultUserDefinedFields,
  type AutoSyncInterval,
  type AutoSyncSettings,
  type EditorSettings,
  type FeatureToggles,
  type UserDefinedField,
  type UserDefinedFieldType,
  type WorkspaceSummary
} from "../../shared/ipc";

export interface AppSettings {
  autoSync: AutoSyncSettings;
  editorSettings: EditorSettings;
  featureToggles: FeatureToggles;
  lastWorkspaceId: string | null;
  userDefinedFields: UserDefinedField[];
  workspaces: WorkspaceSummary[];
}

const defaultAppSettings: AppSettings = {
  autoSync: defaultAutoSyncSettings,
  editorSettings: defaultEditorSettings,
  featureToggles: defaultFeatureToggles,
  lastWorkspaceId: null,
  userDefinedFields: defaultUserDefinedFields,
  workspaces: []
};

export function getAppSettingsPath(userDataPath: string): string {
  return path.join(userDataPath, "app-settings.json");
}

export async function readAppSettings(userDataPath: string): Promise<AppSettings> {
  const settingsPath = getAppSettingsPath(userDataPath);

  try {
    const rawSettings = await readFile(settingsPath, "utf8");
    const parsedSettings = JSON.parse(rawSettings) as Partial<AppSettings>;

    return {
      autoSync: parseAutoSyncSettings(parsedSettings.autoSync),
      editorSettings: parseEditorSettings(parsedSettings.editorSettings),
      featureToggles: parseFeatureToggles(parsedSettings.featureToggles),
      lastWorkspaceId:
        typeof parsedSettings.lastWorkspaceId === "string" ? parsedSettings.lastWorkspaceId : null,
      userDefinedFields: parseUserDefinedFields(parsedSettings.userDefinedFields),
      workspaces: Array.isArray(parsedSettings.workspaces)
        ? parsedSettings.workspaces.filter(isWorkspaceSummary)
        : []
    };
  } catch (error) {
    if (isMissingFileError(error)) {
      return defaultAppSettings;
    }

    throw error;
  }
}

export async function writeAppSettings(
  userDataPath: string,
  settings: AppSettings
): Promise<void> {
  await mkdir(userDataPath, { recursive: true });
  await writeFile(getAppSettingsPath(userDataPath), `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}

function parseEditorSettings(raw: unknown): EditorSettings {
  if (typeof raw !== "object" || raw === null) {
    return defaultEditorSettings;
  }

  const s = raw as Record<string, unknown>;

  return {
    font: s.font === "mincho" || s.font === "mono" ? s.font : "system",
    fontSize: typeof s.fontSize === "number" && s.fontSize > 0 ? s.fontSize : defaultEditorSettings.fontSize,
    language: s.language === "ja" ? "ja" : s.language === "system" ? "system" : "en",
    lineHeight: typeof s.lineHeight === "number" && s.lineHeight > 0 ? s.lineHeight : defaultEditorSettings.lineHeight,
    maxWidth: s.maxWidth === "550px" || s.maxWidth === "800px" || s.maxWidth === "none" ? s.maxWidth : "660px",
    showLineNumbers: typeof s.showLineNumbers === "boolean" ? s.showLineNumbers : false,
    spellCheck: typeof s.spellCheck === "boolean" ? s.spellCheck : true,
    theme: s.theme === "light" || s.theme === "dark" ? s.theme : "system"
  };
}

function parseFeatureToggles(raw: unknown): FeatureToggles {
  if (typeof raw !== "object" || raw === null) {
    return defaultFeatureToggles;
  }

  const s = raw as Record<string, unknown>;

  return {
    git: typeof s.git === "boolean" ? s.git : true,
    tools: typeof s.tools === "boolean" ? s.tools : true,
    frontmatter: typeof s.frontmatter === "boolean" ? s.frontmatter : true,
    rightPanel: typeof s.rightPanel === "boolean" ? s.rightPanel : true
  };
}

function parseAutoSyncSettings(raw: unknown): AutoSyncSettings {
  if (typeof raw !== "object" || raw === null) {
    return defaultAutoSyncSettings;
  }

  const s = raw as Record<string, unknown>;
  const validIntervals: AutoSyncInterval[] = [5, 15, 30, 60];
  const interval = validIntervals.includes(s.intervalMinutes as AutoSyncInterval)
    ? (s.intervalMinutes as AutoSyncInterval)
    : defaultAutoSyncSettings.intervalMinutes;

  return {
    autoPull: typeof s.autoPull === "boolean" ? s.autoPull : false,
    autoPush: typeof s.autoPush === "boolean" ? s.autoPush : false,
    intervalMinutes: interval
  };
}

const VALID_FIELD_TYPES: UserDefinedFieldType[] = ["text", "number", "date", "boolean", "select", "multi-select", "url"];

function parseUserDefinedFields(raw: unknown): UserDefinedField[] {
  if (!Array.isArray(raw)) return defaultUserDefinedFields;

  const result: UserDefinedField[] = [];

  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const f = item as Record<string, unknown>;
    if (typeof f.name !== "string" || !f.name) continue;
    if (!VALID_FIELD_TYPES.includes(f.type as UserDefinedFieldType)) continue;

    const field: UserDefinedField = { name: f.name, type: f.type as UserDefinedFieldType };

    if (Array.isArray(f.choices)) {
      field.choices = f.choices.filter((c): c is string => typeof c === "string");
    }

    result.push(field);
  }

  return result;
}

function isWorkspaceSummary(value: unknown): value is WorkspaceSummary {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.path === "string"
  );
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}
