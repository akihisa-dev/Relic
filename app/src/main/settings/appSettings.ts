import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import {
  chronicleCalendarIds,
  defaultEditorSettings,
  defaultFeatureToggles,
  defaultFrontmatterTemplates,
  defaultUserDefinedFields,
  type EditorSettings,
  type FeatureToggles,
  type FrontmatterTemplate,
  type UserDefinedField,
  type UserDefinedFieldType,
  type WorkspaceSummary
} from "../../shared/ipc";
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

export function getAppSettingsPath(userDataPath: string): string {
  return path.join(userDataPath, "app-settings.json");
}

export async function readAppSettings(userDataPath: string): Promise<AppSettings> {
  const settingsPath = getAppSettingsPath(userDataPath);

  try {
    const rawSettings = await readFile(settingsPath, "utf8");
    const parsedSettings = parseSettingsObject(rawSettings);

    if (!parsedSettings) {
      return defaultAppSettings;
    }

    const workspaces = parseWorkspaceSummaries(parsedSettings.workspaces);

    return {
      editorSettings: parseEditorSettings(parsedSettings.editorSettings),
      featureToggles: parseFeatureToggles(parsedSettings.featureToggles),
      frontmatterTemplates: parseFrontmatterTemplates(parsedSettings.frontmatterTemplates),
      lastWorkspaceId: parseLastWorkspaceId(parsedSettings.lastWorkspaceId, workspaces),
      userDefinedFields: parseUserDefinedFields(parsedSettings.userDefinedFields),
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
  await atomicWriteTextFile(getAppSettingsPath(userDataPath), `${JSON.stringify(settings, null, 2)}\n`);
}

function parseEditorSettings(raw: unknown): EditorSettings {
  if (typeof raw !== "object" || raw === null) {
    return defaultEditorSettings;
  }

  const s = raw as Record<string, unknown>;

  return {
    font: s.font === "gothic" || s.font === "mincho" || s.font === "mono" ? s.font : "system",
    fontSize: typeof s.fontSize === "number" && s.fontSize > 0 ? s.fontSize : defaultEditorSettings.fontSize,
    frontmatterDateFormat: s.frontmatterDateFormat === "system" ||
      s.frontmatterDateFormat === "mdy" ||
      s.frontmatterDateFormat === "dmy"
      ? s.frontmatterDateFormat
      : "ymd",
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
    calendar: typeof s.calendar === "boolean" ? s.calendar : true,
    chronicle: typeof s.chronicle === "boolean" ? s.chronicle : false,
    chronicleSettings: typeof s.chronicleSettings === "boolean" ? s.chronicleSettings : false,
    tools: typeof s.tools === "boolean" ? s.tools : false,
    frontmatter: typeof s.frontmatter === "boolean" ? s.frontmatter : false,
    rightPanel: typeof s.rightPanel === "boolean" ? s.rightPanel : true
  };
}

const VALID_FIELD_TYPES: UserDefinedFieldType[] = [
  "text",
  "number",
  "date",
  "datetime",
  "time",
  "boolean",
  "select",
  "multi-select",
  "url"
];
const VALID_FIELD_TYPES_SET = new Set<UserDefinedFieldType>(VALID_FIELD_TYPES);
const FIELD_NAME_PATTERN = /^[^\s:][^\r\n:]*$/;
const RESERVED_FIELD_NAMES = new Set(["aliases", "tags", "status", ...chronicleCalendarIds, "plannedDate", "actualDate"]);
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
      !FIELD_NAME_PATTERN.test(f.name) ||
      RESERVED_FIELD_NAMES.has(f.name)
    ) continue;
    if (names.has(f.name)) continue;
    if (!VALID_FIELD_TYPES_SET.has(f.type as UserDefinedFieldType)) continue;

    const field: UserDefinedField = { name: f.name, type: f.type as UserDefinedFieldType };

    if (Array.isArray(f.choices)) {
      field.choices = f.choices.filter((c): c is string => typeof c === "string");
    }

    result.push(field);
    names.add(field.name);
  }

  return result;
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
        typeof fieldName === "string" && FIELD_NAME_PATTERN.test(fieldName)
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
      candidate.path.trim() === "" ||
      !path.isAbsolute(candidate.path)
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

function parseLastWorkspaceId(raw: unknown, workspaces: WorkspaceSummary[]): string | null {
  if (typeof raw !== "string" || raw.trim() === "") {
    return null;
  }

  return workspaces.some((workspace) => workspace.id === raw) ? raw : null;
}

function parseSettingsObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(raw);

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }

    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}
