import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  defaultAutoSyncSettings,
  type AutoSyncInterval,
  type AutoSyncSettings
} from "../../shared/ipc";

export interface WorkspaceSettings {
  autoSync: AutoSyncSettings;
  pinnedPaths: string[];
  workspacePath: string;
}

const defaultWorkspaceSettings: WorkspaceSettings = {
  autoSync: defaultAutoSyncSettings,
  pinnedPaths: [],
  workspacePath: ""
};

export function getWorkspaceSettingsPath(userDataPath: string, workspaceId: string): string {
  return path.join(userDataPath, "workspaces", `${workspaceId}.json`);
}

export async function readWorkspaceSettings(
  userDataPath: string,
  workspaceId: string
): Promise<WorkspaceSettings> {
  const settingsPath = getWorkspaceSettingsPath(userDataPath, workspaceId);

  try {
    const raw = await readFile(settingsPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<WorkspaceSettings>;

    return {
      autoSync: parseAutoSyncSettings(parsed.autoSync),
      pinnedPaths: Array.isArray(parsed.pinnedPaths)
        ? parsed.pinnedPaths.filter((p) => typeof p === "string")
        : [],
      workspacePath: typeof parsed.workspacePath === "string" ? parsed.workspacePath : ""
    };
  } catch (error) {
    if (isMissingFileError(error)) {
      return defaultWorkspaceSettings;
    }

    throw error;
  }
}

export async function writeWorkspaceSettings(
  userDataPath: string,
  workspaceId: string,
  settings: WorkspaceSettings
): Promise<void> {
  const settingsPath = getWorkspaceSettingsPath(userDataPath, workspaceId);

  await mkdir(path.dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
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
