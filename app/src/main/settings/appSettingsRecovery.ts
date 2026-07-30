import { link, readFile, unlink } from "node:fs/promises";
import path from "node:path";

import {
  createDefaultAppSettings,
  getAppSettingsPath,
  readAppSettings,
  writeAppSettings,
  type AppSettings
} from "./appSettings";
import { writePrivateSettingsTextFile } from "./secureSettingsFile";

export interface AppSettingsRecoveryState {
  backupPath: string | null;
  kind: "corrupt" | "unsupported";
  settingsPath: string;
}

export type AppSettingsStartupState =
  | { settings: AppSettings; status: "ready" }
  | { recovery: AppSettingsRecoveryState; status: "recovery-required" };

export async function readAppSettingsForStartup(
  userDataPath: string
): Promise<AppSettingsStartupState> {
  const pendingRecovery = await readPendingRecovery(userDataPath);
  if (pendingRecovery) {
    return {
      recovery: pendingRecovery,
      status: "recovery-required"
    };
  }

  try {
    return {
      settings: await readAppSettings(userDataPath),
      status: "ready"
    };
  } catch (error) {
    if (isCorruptAppSettingsError(error)) {
      const recovery: AppSettingsRecoveryState = {
        backupPath: error.backupPath,
        kind: "corrupt",
        settingsPath: error.settingsPath
      };
      await writePendingRecovery(userDataPath, recovery);
      return { recovery, status: "recovery-required" };
    }

    if (isNamedError(error, "UnsupportedSettingsVersionError")) {
      const recovery: AppSettingsRecoveryState = {
        backupPath: null,
        kind: "unsupported",
        settingsPath: getAppSettingsPath(userDataPath)
      };
      await writePendingRecovery(userDataPath, recovery);
      return { recovery, status: "recovery-required" };
    }

    throw error;
  }
}

export async function replaceAppSettingsWithDefaults(
  userDataPath: string,
  recovery: AppSettingsRecoveryState
): Promise<AppSettings> {
  if (recovery.kind === "unsupported" && !recovery.backupPath) {
    recovery.backupPath = await archiveUnsupportedSettingsFile(recovery.settingsPath);
    await writePendingRecovery(userDataPath, recovery);
  }

  const settings = createDefaultAppSettings();
  await writeAppSettings(userDataPath, settings);
  await removePendingRecovery(userDataPath);
  return settings;
}

function getAppSettingsRecoveryPath(userDataPath: string): string {
  return path.join(userDataPath, "app-settings.recovery.json");
}

async function readPendingRecovery(
  userDataPath: string
): Promise<AppSettingsRecoveryState | null> {
  try {
    const raw = JSON.parse(await readFile(getAppSettingsRecoveryPath(userDataPath), "utf8")) as unknown;
    if (!isObject(raw) || raw.schemaVersion !== 1) return null;
    if (raw.kind !== "corrupt" && raw.kind !== "unsupported") return null;

    const settingsPath = getAppSettingsPath(userDataPath);
    if (raw.settingsPath !== settingsPath) return null;
    if (raw.backupPath !== null && !isSafeRecoveryBackupPath(raw.backupPath, userDataPath)) {
      return null;
    }

    return {
      backupPath: raw.backupPath,
      kind: raw.kind,
      settingsPath
    };
  } catch (error) {
    if (isMissingFileError(error) || error instanceof SyntaxError) return null;
    throw error;
  }
}

async function writePendingRecovery(
  userDataPath: string,
  recovery: AppSettingsRecoveryState
): Promise<void> {
  await writePrivateSettingsTextFile(
    getAppSettingsRecoveryPath(userDataPath),
    `${JSON.stringify({
      backupPath: recovery.backupPath,
      kind: recovery.kind,
      schemaVersion: 1,
      settingsPath: recovery.settingsPath
    }, null, 2)}\n`
  );
}

async function removePendingRecovery(userDataPath: string): Promise<void> {
  await unlink(getAppSettingsRecoveryPath(userDataPath)).catch((error: unknown) => {
    if (!isMissingFileError(error)) throw error;
  });
}

async function archiveUnsupportedSettingsFile(settingsPath: string): Promise<string | null> {
  const parsedPath = path.parse(settingsPath);

  for (let suffix = 0; ; suffix += 1) {
    const suffixText = suffix === 0 ? "" : `-${suffix}`;
    const backupPath = path.join(
      parsedPath.dir,
      `${parsedPath.name}.unsupported-${Date.now()}${suffixText}.json`
    );

    try {
      await link(settingsPath, backupPath);
      await unlink(settingsPath);
      return backupPath;
    } catch (error) {
      if (isMissingFileError(error)) return null;
      if (isAlreadyExistsError(error)) continue;
      throw error;
    }
  }
}

function isCorruptAppSettingsError(error: unknown): error is Error & {
  backupPath: string;
  settingsPath: string;
} {
  return isNamedError(error, "CorruptAppSettingsError") &&
    "backupPath" in error &&
    typeof error.backupPath === "string" &&
    "settingsPath" in error &&
    typeof error.settingsPath === "string";
}

function isNamedError(error: unknown, name: string): error is Error {
  return error instanceof Error && error.name === name;
}

function isSafeRecoveryBackupPath(value: unknown, userDataPath: string): value is string {
  if (typeof value !== "string" || !path.isAbsolute(value)) return false;
  if (path.dirname(value) !== userDataPath) return false;
  return /^app-settings\.(?:corrupt|unsupported)-\d+(?:-\d+)?\.json$/.test(path.basename(value));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMissingFileError(error: unknown): boolean {
  return hasErrorCode(error, "ENOENT");
}

function isAlreadyExistsError(error: unknown): boolean {
  return hasErrorCode(error, "EEXIST");
}

function hasErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === code
  );
}
