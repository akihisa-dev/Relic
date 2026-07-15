import { rm } from "node:fs/promises";
import path from "node:path";

import {
  type ChartSettings,
  type FrontmatterCategoryChoice,
  type ChartSource
} from "../../shared/ipc";
import { normalizeWorkspaceRelativeInputPath } from "../files/paths";
import {
  currentWorkspaceSettingsSchemaVersion,
  migrateWorkspaceSettings,
  type WorkspaceSettingsMigrationRecord
} from "../compatibility/settingsCompatibility";
import { SecureVersionedJsonStore } from "./secureVersionedJsonStore";

export interface WorkspaceSettings {
  charts: ChartSettings[];
  frontmatterCategoryChoices: FrontmatterCategoryChoice[];
  pinnedPaths: string[];
  workspacePath: string;
}

type PersistedWorkspaceSettings = Partial<Omit<WorkspaceSettings, "charts">> & WorkspaceSettingsMigrationRecord & {
  charts?: unknown;
};

export const defaultCharts: ChartSettings[] = [
  { filePaths: [], id: "chronicle", name: "chronicle", source: "chronicle" }
];

const defaultWorkspaceSettings: WorkspaceSettings = {
  charts: defaultCharts,
  frontmatterCategoryChoices: [],
  pinnedPaths: [],
  workspacePath: ""
};

const WORKSPACE_SETTINGS_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const workspaceSettingsStore = new SecureVersionedJsonStore<PersistedWorkspaceSettings, WorkspaceSettings>({
  createCorruptError: createCorruptWorkspaceSettingsError,
  defaultValue: defaultWorkspaceSettings,
  migrate: migrateWorkspaceSettings,
  parse: parseWorkspaceSettings,
  parseObject: parseSettingsObject,
  serialize: serializeWorkspaceSettings
});

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
    if (isInvalidWorkspaceSettingsIdError(error)) return defaultWorkspaceSettings;
    throw error;
  }
}

function parseWorkspaceSettings(raw: PersistedWorkspaceSettings): WorkspaceSettings {
  return {
    charts: parseCharts(raw.charts),
    frontmatterCategoryChoices: parseFrontmatterCategoryChoices(raw.frontmatterCategoryChoices),
    pinnedPaths: parsePinnedPaths(raw.pinnedPaths),
    workspacePath: typeof raw.workspacePath === "string" ? raw.workspacePath : ""
  };
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

function parseSettingsObject(raw: unknown): PersistedWorkspaceSettings | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return null;
  }

  return raw as PersistedWorkspaceSettings;
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
