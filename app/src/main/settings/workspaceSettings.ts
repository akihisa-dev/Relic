import { readFile, rm, rename } from "node:fs/promises";
import path from "node:path";

import {
  defaultChronicleCalendars,
  type ChronicleCalendarSettings,
  type ChartSettings,
  type FrontmatterCategoryChoice,
  type ChartSource
} from "../../shared/ipc";
import { normalizeWorkspaceRelativeInputPath } from "../files/paths";
import { writePrivateSettingsTextFile } from "./secureSettingsFile";

export interface WorkspaceSettings {
  chronicleCalendars: ChronicleCalendarSettings[];
  charts: ChartSettings[];
  frontmatterCategoryChoices: FrontmatterCategoryChoice[];
  pinnedPaths: string[];
  workspacePath: string;
}

type PersistedWorkspaceSettings = Partial<Omit<WorkspaceSettings, "charts">> & {
  charts?: unknown;
  ganttCharts?: unknown;
  schemaVersion?: unknown;
};

export const defaultCharts: ChartSettings[] = [
  { filePaths: [], id: "chronicle", name: "chronicle", source: "chronicle" }
];

const defaultWorkspaceSettings: WorkspaceSettings = {
  chronicleCalendars: defaultChronicleCalendars,
  charts: defaultCharts,
  frontmatterCategoryChoices: [],
  pinnedPaths: [],
  workspacePath: ""
};

const currentWorkspaceSettingsSchemaVersion = 1;
type MigrationResult<T> = {
  didMigrate: boolean;
  settings: T;
};
const WORKSPACE_SETTINGS_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
type SerializedUpdate = Promise<unknown>;
const workspaceSettingsUpdateQueues = new Map<string, SerializedUpdate>();

function queueWorkspaceSettingsUpdate<T>(
  settingsPath: string,
  task: () => Promise<T>
): Promise<T> {
  const currentQueue = workspaceSettingsUpdateQueues.get(settingsPath) ?? Promise.resolve();
  const next = currentQueue.catch(() => undefined).then(task);
  const settled = next.finally(() => undefined);
  workspaceSettingsUpdateQueues.set(settingsPath, settled);
  void settled.finally(() => {
    if (workspaceSettingsUpdateQueues.get(settingsPath) === settled) {
      workspaceSettingsUpdateQueues.delete(settingsPath);
    }
  }).catch(() => undefined);
  return next;
}

export function getWorkspaceSettingsPath(userDataPath: string, workspaceId: string): string {
  assertSafeWorkspaceSettingsId(workspaceId);

  return path.join(userDataPath, "workspaces", `${workspaceId}.json`);
}

export async function readWorkspaceSettings(
  userDataPath: string,
  workspaceId: string
): Promise<WorkspaceSettings> {
  return readWorkspaceSettingsInternal(userDataPath, workspaceId, { persistMigration: true });
}

async function readWorkspaceSettingsInternal(
  userDataPath: string,
  workspaceId: string,
  options: { persistMigration: boolean }
): Promise<WorkspaceSettings> {
  try {
    const settingsPath = getWorkspaceSettingsPath(userDataPath, workspaceId);
    const raw = await readFile(settingsPath, "utf8");
    const parsedJson = parseSettingsJson(raw);

    if (!parsedJson.ok) {
      await backupCorruptedSettingsFile(settingsPath);
      throw createCorruptWorkspaceSettingsError(settingsPath);
    }

    const parsed = parseSettingsObject(parsedJson.value);

    if (!parsed) {
      return defaultWorkspaceSettings;
    }

    const migrated = migrateWorkspaceSettings(parsed, settingsPath);
    if (migrated.didMigrate && options.persistMigration) {
      try {
        await persistMigratedWorkspaceSettings(settingsPath);
      } catch {
        // 書き戻し失敗時も読み込み結果は捨てず、続行する
      }
    }

    return {
      chronicleCalendars: parseChronicleCalendars(migrated.settings.chronicleCalendars),
      charts: parseCharts(migrated.settings.charts),
      frontmatterCategoryChoices: parseFrontmatterCategoryChoices(migrated.settings.frontmatterCategoryChoices),
      pinnedPaths: parsePinnedPaths(migrated.settings.pinnedPaths),
      workspacePath: typeof migrated.settings.workspacePath === "string" ? migrated.settings.workspacePath : ""
    };
  } catch (error) {
    if (isMissingFileError(error) || isInvalidWorkspaceSettingsIdError(error)) {
      return defaultWorkspaceSettings;
    }

    throw error;
  }
}

export function parseChronicleCalendars(raw: unknown): ChronicleCalendarSettings[] {
  if (!Array.isArray(raw)) return defaultChronicleCalendars;

  const usedNames = new Set<string>();
  const parsed = raw.flatMap((item): ChronicleCalendarSettings[] => {
    if (typeof item !== "object" || item === null) return [];

    const candidate = item as Record<string, unknown>;
    const name = typeof candidate.name === "string" ? candidate.name.trim() : "";

    if (!name || usedNames.has(name) || typeof candidate.name !== "string") return [];
    usedNames.add(name);

    if (!("startYear" in candidate)) return [{ name }];

    return Number.isInteger(candidate.startYear) && Number(candidate.startYear) >= 1
      ? [{ name, startYear: Number(candidate.startYear) }]
      : [{ name }];
  });

  return parsed.length > 0 ? parsed : defaultChronicleCalendars;
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
  return "年表";
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

  await writePrivateSettingsTextFile(
    settingsPath,
    `${JSON.stringify(serializeWorkspaceSettings(settings), null, 2)}\n`
  );
}

export async function updateWorkspaceSettings(
  userDataPath: string,
  workspaceId: string,
  update: (current: WorkspaceSettings) => Promise<WorkspaceSettings> | WorkspaceSettings
): Promise<WorkspaceSettings> {
  return queueWorkspaceSettingsUpdate(getWorkspaceSettingsPath(userDataPath, workspaceId), async () => {
    const current = await readWorkspaceSettingsInternal(userDataPath, workspaceId, { persistMigration: false });
    const next = await update(current);
    await writeWorkspaceSettings(userDataPath, workspaceId, next);
    return next;
  });
}

export async function removeWorkspaceSettings(
  userDataPath: string,
  workspaceId: string
): Promise<void> {
  const settingsPath = getWorkspaceSettingsPath(userDataPath, workspaceId);

  await rm(settingsPath, { force: true });
}

function parseSettingsJson(raw: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}

function parseSettingsObject(raw: unknown): PersistedWorkspaceSettings | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return null;
  }

  return raw as PersistedWorkspaceSettings;
}

function migrateWorkspaceSettings(
  raw: PersistedWorkspaceSettings,
  settingsPath: string
): MigrationResult<PersistedWorkspaceSettings> {
  const schemaVersion = readWorkspaceSettingsSchemaVersion(raw.schemaVersion, settingsPath);

  if (schemaVersion === currentWorkspaceSettingsSchemaVersion) {
    return { didMigrate: false, settings: raw };
  }

  if (schemaVersion === 0) {
    return {
      didMigrate: true,
      settings: {
        ...raw,
        charts: raw.charts ?? raw.ganttCharts,
        schemaVersion: currentWorkspaceSettingsSchemaVersion
      }
    };
  }

  throw createUnsupportedWorkspaceSettingsVersionError(settingsPath, schemaVersion);
}

async function persistMigratedWorkspaceSettings(settingsPath: string): Promise<void> {
  return queueWorkspaceSettingsUpdate(settingsPath, async () => {
    const raw = await readFile(settingsPath, "utf8");
    const parsedJson = parseSettingsJson(raw);

    if (!parsedJson.ok) {
      return;
    }

    const parsedSettings = parseSettingsObject(parsedJson.value);
    if (!parsedSettings) {
      return;
    }

    const latestMigration = migrateWorkspaceSettings(parsedSettings, settingsPath);
    if (!latestMigration.didMigrate) {
      return;
    }

    await writeMigratedWorkspaceSettings(settingsPath, latestMigration.settings);
  });
}

async function writeMigratedWorkspaceSettings(
  settingsPath: string,
  settings: PersistedWorkspaceSettings
): Promise<void> {
  await writePrivateSettingsTextFile(
    settingsPath,
    `${JSON.stringify({
      ...settings,
      schemaVersion: currentWorkspaceSettingsSchemaVersion
    }, null, 2)}\n`
  );
}

function serializeWorkspaceSettings(settings: WorkspaceSettings): Record<string, unknown> {
  return {
    schemaVersion: currentWorkspaceSettingsSchemaVersion,
    ...settings
  };
}

function readWorkspaceSettingsSchemaVersion(raw: unknown, settingsPath: string): number {
  if (raw === undefined) return 0;
  if (!Number.isInteger(raw) || Number(raw) < 0) {
    throw createUnsupportedWorkspaceSettingsVersionError(settingsPath, raw);
  }

  const schemaVersion = Number(raw);
  if (schemaVersion > currentWorkspaceSettingsSchemaVersion) {
    throw createUnsupportedWorkspaceSettingsVersionError(settingsPath, schemaVersion);
  }

  return schemaVersion;
}

function createCorruptWorkspaceSettingsError(settingsPath: string): Error {
  const error = new Error(`設定JSONが壊れています: ${settingsPath}`) as Error;
  error.name = "CorruptWorkspaceSettingsError";
  return error;
}

function createUnsupportedWorkspaceSettingsVersionError(settingsPath: string, schemaVersion: unknown): Error {
  const error = new Error(`ワークスペース設定形式がこのRelicでは読めません: ${settingsPath} (schemaVersion: ${String(schemaVersion)})`) as Error;
  error.name = "UnsupportedWorkspaceSettingsVersionError";
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
