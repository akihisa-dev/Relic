import { mkdir, readFile, rename } from "node:fs/promises";
import path from "node:path";

import {
  defaultEditorSettings,
  defaultFeatureToggles,
  defaultFrontmatterTemplates,
  defaultUserDefinedFields,
  type EditorSettings,
  type FeatureToggles,
  type FrontmatterTemplate,
  type UserDefinedField,
  type WorkspaceSummary
} from "../../shared/ipc";
import {
  isUserDefinedFieldType,
  isValidUserDefinedFieldName,
  userDefinedFieldNamePattern,
  userDefinedFieldTypeNeedsChoices
} from "../../shared/frontmatterFields";
import { atomicWriteTextFile } from "../files/atomicWrite";

export interface AppSettings {
  editorSettings: EditorSettings;
  featureToggles: FeatureToggles;
  frontmatterTemplates: FrontmatterTemplate[];
  lastWorkspaceId: string | null;
  userDefinedFields: UserDefinedField[];
  workspaces: WorkspaceSummary[];
}

const defaultAppSettings: AppSettings = {
  editorSettings: defaultEditorSettings,
  featureToggles: defaultFeatureToggles,
  frontmatterTemplates: defaultFrontmatterTemplates,
  lastWorkspaceId: null,
  userDefinedFields: defaultUserDefinedFields,
  workspaces: []
};

const currentAppSettingsSchemaVersion = 1;
type SerializedUpdate = Promise<unknown>;
let appSettingsUpdateQueue: SerializedUpdate = Promise.resolve();

function queueAppSettingsUpdate<T>(task: () => Promise<T>): Promise<T> {
  const next = appSettingsUpdateQueue.catch(() => undefined).then(task);
  appSettingsUpdateQueue = next.finally(() => undefined);
  return next;
}

export function getAppSettingsPath(userDataPath: string): string {
  return path.join(userDataPath, "app-settings.json");
}

export async function readAppSettings(userDataPath: string): Promise<AppSettings> {
  const settingsPath = getAppSettingsPath(userDataPath);

  try {
    const rawSettings = await readFile(settingsPath, "utf8");
    const parsedJson = parseSettingsJson(rawSettings);

    if (!parsedJson.ok) {
      await backupCorruptedSettingsFile(settingsPath);
      throw createCorruptSettingsError(settingsPath);
    }

    const parsedSettings = parseSettingsObject(parsedJson.value);

    if (!parsedSettings) {
      return defaultAppSettings;
    }

    const migratedSettings = migrateAppSettings(parsedSettings, settingsPath);
    const workspaces = parseWorkspaceSummaries(migratedSettings.workspaces);

    return {
      editorSettings: parseEditorSettings(migratedSettings.editorSettings),
      featureToggles: parseFeatureToggles(migratedSettings.featureToggles),
      frontmatterTemplates: parseFrontmatterTemplates(migratedSettings.frontmatterTemplates),
      lastWorkspaceId: parseLastWorkspaceId(migratedSettings.lastWorkspaceId, workspaces),
      userDefinedFields: parseUserDefinedFields(migratedSettings.userDefinedFields),
      workspaces
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
  await atomicWriteTextFile(getAppSettingsPath(userDataPath), `${JSON.stringify(serializeAppSettings(settings), null, 2)}\n`);
}

export async function updateAppSettings(
  userDataPath: string,
  update: (current: AppSettings) => Promise<AppSettings> | AppSettings
): Promise<AppSettings> {
  return queueAppSettingsUpdate(async () => {
    const current = await readAppSettings(userDataPath);
    const next = await update(current);
    await writeAppSettings(userDataPath, next);
    return next;
  });
}

function parseEditorSettings(raw: unknown): EditorSettings {
  if (typeof raw !== "object" || raw === null) {
    return defaultEditorSettings;
  }

  const s = raw as Record<string, unknown>;

  return {
    font: s.font === "gothic" || s.font === "mincho" || s.font === "mono" ? s.font : "system",
    fontSize: isPositiveFiniteNumber(s.fontSize) ? s.fontSize : defaultEditorSettings.fontSize,
    frontmatterDateFormat: s.frontmatterDateFormat === "system" ||
      s.frontmatterDateFormat === "mdy" ||
      s.frontmatterDateFormat === "dmy"
      ? s.frontmatterDateFormat
      : "ymd",
    language: s.language === "ja" ? "ja" : s.language === "system" ? "system" : "en",
    lineHeight: isPositiveFiniteNumber(s.lineHeight) ? s.lineHeight : defaultEditorSettings.lineHeight,
    maxWidth: s.maxWidth === "550px" || s.maxWidth === "800px" || s.maxWidth === "none" ? s.maxWidth : "660px",
    showLineNumbers: typeof s.showLineNumbers === "boolean" ? s.showLineNumbers : false,
    spellCheck: typeof s.spellCheck === "boolean" ? s.spellCheck : true,
    theme: s.theme === "light" || s.theme === "dark" ? s.theme : "system"
  };
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function parseFeatureToggles(raw: unknown): FeatureToggles {
  if (typeof raw !== "object" || raw === null) {
    return defaultFeatureToggles;
  }

  const s = raw as Record<string, unknown>;

  return {
    calendar: typeof s.calendar === "boolean" ? s.calendar : true,
    chronicle: typeof s.chronicle === "boolean" ? s.chronicle : false,
    chronicleSettings: typeof s.chronicleSettings === "boolean" ? s.chronicleSettings : false,
    tools: typeof s.tools === "boolean" ? s.tools : false,
    frontmatter: typeof s.frontmatter === "boolean" ? s.frontmatter : false,
    rightPanelLinks: typeof s.rightPanelLinks === "boolean" ? s.rightPanelLinks : true,
    rightPanelOutline: typeof s.rightPanelOutline === "boolean" ? s.rightPanelOutline : true
  };
}

const WORKSPACE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

function parseUserDefinedFields(raw: unknown): UserDefinedField[] {
  if (!Array.isArray(raw)) return defaultUserDefinedFields;

  const result: UserDefinedField[] = [];
  const names = new Set<string>();

  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const f = item as Record<string, unknown>;
    if (
      typeof f.name !== "string" ||
      !isValidUserDefinedFieldName(f.name)
    ) continue;
    if (names.has(f.name)) continue;
    if (!isUserDefinedFieldType(f.type)) continue;

    const type = f.type;
    const field: UserDefinedField = { name: f.name, type };
    const choices = parseFieldChoices(f.choices, type);

    if (choices.length > 0) {
      field.choices = choices;
    }

    result.push(field);
    names.add(field.name);
  }

  return result;
}

function parseFieldChoices(raw: unknown, type: UserDefinedField["type"]): string[] {
  if (!userDefinedFieldTypeNeedsChoices(type) || !Array.isArray(raw)) return [];

  const choices: string[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (typeof item !== "string") continue;
    const choice = item.trim();
    if (!choice || seen.has(choice)) continue;
    choices.push(choice);
    seen.add(choice);
  }

  return choices;
}

function parseFrontmatterTemplates(raw: unknown): FrontmatterTemplate[] {
  if (!Array.isArray(raw)) return defaultFrontmatterTemplates;

  const result: FrontmatterTemplate[] = [];
  const names = new Set<string>();

  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const template = item as Record<string, unknown>;
    if (typeof template.name !== "string") continue;

    const name = template.name.trim();
    if (!name || names.has(name)) continue;

    const fieldNames = Array.isArray(template.fieldNames)
      ? template.fieldNames.filter((fieldName): fieldName is string => (
        typeof fieldName === "string" && userDefinedFieldNamePattern.test(fieldName)
      ))
      : [];

    if (fieldNames.length === 0) continue;

    result.push({ fieldNames, name });
    names.add(name);
  }

  return result;
}

function parseWorkspaceSummaries(raw: unknown): WorkspaceSummary[] {
  if (!Array.isArray(raw)) return [];

  const result: WorkspaceSummary[] = [];
  const ids = new Set<string>();

  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const candidate = item as Record<string, unknown>;

    if (
      typeof candidate.id !== "string" ||
      !isSafeWorkspaceId(candidate.id) ||
      ids.has(candidate.id) ||
      typeof candidate.name !== "string" ||
      candidate.name.trim() === "" ||
      typeof candidate.path !== "string" ||
      !isNormalizedAbsolutePath(candidate.path)
    ) {
      continue;
    }

    result.push({
      id: candidate.id,
      name: candidate.name,
      path: candidate.path
    });
    ids.add(candidate.id);
  }

  return result;
}

function isSafeWorkspaceId(id: string): boolean {
  return id.trim() === id && WORKSPACE_ID_PATTERN.test(id);
}

function isNormalizedAbsolutePath(value: string): boolean {
  return value.trim() === value && path.isAbsolute(value) && path.resolve(value) === value;
}

function parseLastWorkspaceId(raw: unknown, workspaces: WorkspaceSummary[]): string | null {
  if (typeof raw !== "string" || raw.trim() === "") {
    return null;
  }

  return workspaces.some((workspace) => workspace.id === raw) ? raw : null;
}

function parseSettingsJson(rawSettings: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(rawSettings) };
  } catch {
    return { ok: false };
  }
}

function parseSettingsObject(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return null;
  }

  return raw as Record<string, unknown>;
}

function migrateAppSettings(raw: Record<string, unknown>, settingsPath: string): Record<string, unknown> {
  const schemaVersion = readSchemaVersion(raw.schemaVersion, settingsPath, "AppSettings");

  if (schemaVersion === currentAppSettingsSchemaVersion) return raw;

  if (schemaVersion === 0) {
    return {
      ...raw,
      featureToggles: migrateFeatureTogglesV0(raw.featureToggles),
      schemaVersion: currentAppSettingsSchemaVersion
    };
  }

  throw createUnsupportedSettingsVersionError(settingsPath, "AppSettings", schemaVersion);
}

function migrateFeatureTogglesV0(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return raw;

  const toggles = raw as Record<string, unknown>;
  const legacyRightPanel = typeof toggles.rightPanel === "boolean" ? toggles.rightPanel : true;

  return {
    ...toggles,
    rightPanelLinks: typeof toggles.rightPanelLinks === "boolean" ? toggles.rightPanelLinks : legacyRightPanel,
    rightPanelOutline: typeof toggles.rightPanelOutline === "boolean" ? toggles.rightPanelOutline : legacyRightPanel
  };
}

function serializeAppSettings(settings: AppSettings): Record<string, unknown> {
  return {
    schemaVersion: currentAppSettingsSchemaVersion,
    ...settings
  };
}

function readSchemaVersion(raw: unknown, settingsPath: string, scope: string): number {
  if (raw === undefined) return 0;
  if (!Number.isInteger(raw) || Number(raw) < 0) {
    throw createUnsupportedSettingsVersionError(settingsPath, scope, raw);
  }

  const schemaVersion = Number(raw);
  if (schemaVersion > currentAppSettingsSchemaVersion) {
    throw createUnsupportedSettingsVersionError(settingsPath, scope, schemaVersion);
  }

  return schemaVersion;
}

function createCorruptSettingsError(settingsPath: string): Error {
  const error = new Error(`設定JSONが壊れています: ${settingsPath}`) as Error;
  error.name = "CorruptAppSettingsError";
  return error;
}

function createUnsupportedSettingsVersionError(settingsPath: string, scope: string, schemaVersion: unknown): Error {
  const error = new Error(`${scope} の設定形式がこのRelicでは読めません: ${settingsPath} (schemaVersion: ${String(schemaVersion)})`) as Error;
  error.name = "UnsupportedSettingsVersionError";
  return error;
}

async function backupCorruptedSettingsFile(settingsPath: string): Promise<void> {
  const parsedPath = path.parse(settingsPath);
  const backupPath = path.join(parsedPath.dir, `${parsedPath.name}.corrupt-${Date.now()}.json`);
  await rename(settingsPath, backupPath);
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}
