import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { WorkspaceSummary } from "../../shared/ipc";

export interface AppSettings {
  lastWorkspaceId: string | null;
  workspaces: WorkspaceSummary[];
}

const defaultAppSettings: AppSettings = {
  lastWorkspaceId: null,
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
      lastWorkspaceId:
        typeof parsedSettings.lastWorkspaceId === "string" ? parsedSettings.lastWorkspaceId : null,
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
