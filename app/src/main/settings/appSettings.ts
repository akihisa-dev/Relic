import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import {
  aiProviders,
  chronicleCalendarIds,
  coworkPanelMaxWidth,
  coworkPanelMinWidth,
  defaultAppUiSettings,
  defaultAIProvider,
  defaultOpenAIWorkspaceModel,
  defaultEditorSettings,
  defaultFeatureToggles,
  defaultFrontmatterTemplates,
  defaultUserDefinedFields,
  openAIWorkspaceModels,
  type AppUiSettings,
  type EditorSettings,
  type FeatureToggles,
  type FrontmatterTemplate,
  type AIProvider,
  type OpenAIWorkspaceModel,
  type UserDefinedField,
  type UserDefinedFieldType,
  type WorkspaceSummary
} from "../../shared/ipc";
import { atomicWriteTextFile } from "../files/atomicWrite";

export interface AppSettings {
  aiSettings: {
    aiProvider: AIProvider;
    openAIModel: OpenAIWorkspaceModel;
  };
  editorSettings: EditorSettings;
  featureToggles: FeatureToggles;
  frontmatterTemplates: FrontmatterTemplate[];
  lastWorkspaceId: string | null;
  uiSettings?: AppUiSettings;
  userDefinedFields: UserDefinedField[];
  workspaces: WorkspaceSummary[];
}

const defaultAppSettings: AppSettings = {
  aiSettings: {
    aiProvider: defaultAIProvider,
    openAIModel: defaultOpenAIWorkspaceModel
  },
  editorSettings: defaultEditorSettings,
  featureToggles: defaultFeatureToggles,
  frontmatterTemplates: defaultFrontmatterTemplates,
  lastWorkspaceId: null,
  uiSettings: defaultAppUiSettings,
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
      aiSettings: parseAISettings(parsedSettings.aiSettings),
      editorSettings: parseEditorSettings(parsedSettings.editorSettings),
      featureToggles: parseFeatureToggles(parsedSettings.featureToggles),
      frontmatterTemplates: parseFrontmatterTemplates(parsedSettings.frontmatterTemplates),
      lastWorkspaceId: parseLastWorkspaceId(parsedSettings.lastWorkspaceId, workspaces),
      uiSettings: parseAppUiSettings(parsedSettings.uiSettings),
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

function parseAISettings(raw: unknown): AppSettings["aiSettings"] {
  if (typeof raw !== "object" || raw === null) {
    return defaultAppSettings.aiSettings;
  }

  const s = raw as Record<string, unknown>;

  return {
    aiProvider: parseAIProvider(s.aiProvider),
    openAIModel: parseOpenAIWorkspaceModel(s.openAIModel)
  };
}

function parseAIProvider(value: unknown): AIProvider {
  return aiProviders.includes(value as AIProvider)
    ? value as AIProvider
    : defaultAIProvider;
}

function parseOpenAIWorkspaceModel(value: unknown): OpenAIWorkspaceModel {
  return openAIWorkspaceModels.includes(value as OpenAIWorkspaceModel)
    ? value as OpenAIWorkspaceModel
    : defaultOpenAIWorkspaceModel;
}

function parseAppUiSettings(raw: unknown): AppUiSettings {
  if (typeof raw !== "object" || raw === null) {
    return defaultAppUiSettings;
  }

  const s = raw as Record<string, unknown>;

  return {
    coworkPanelWidth: clampNumber(
      s.coworkPanelWidth,
      coworkPanelMinWidth,
      coworkPanelMaxWidth,
      defaultAppUiSettings.coworkPanelWidth
    )
  };
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

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
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
const FIELD_TYPES_WITH_CHOICES = new Set<UserDefinedFieldType>(["select", "multi-select"]);

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

    const type = f.type as UserDefinedFieldType;
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

function parseFieldChoices(raw: unknown, type: UserDefinedFieldType): string[] {
  if (!FIELD_TYPES_WITH_CHOICES.has(type) || !Array.isArray(raw)) return [];

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
