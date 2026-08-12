import { isDeepStrictEqual } from "node:util";
import { lstat } from "node:fs/promises";
import path from "node:path";

import { fail, ok, type RelicResult } from "../../shared/result";
import { readAppSettings, updateAppSettings, type AppSettings } from "../settings/appSettings";
import * as workspaceSettings from "../settings/workspaceSettings";
import type { WorkspaceSettings } from "../settings/workspaceSettings";
import {
  readFileSystemEntryIdentity,
  rollbackRenamedDirectoryWithoutOverwrite,
  type FileSystemEntryIdentity,
  type SafeDirectoryRollbackResult
} from "../files/renameOperations";
import { renameWorkspaceRegistration } from "../workspace/workspaceService";
import { ipcErrorDetails } from "./activeWorkspace";

export async function renameWorkspaceRegistrationTransaction(
  userDataPath: string,
  settings: AppSettings,
  workspaceId: string,
  name: string
): Promise<RelicResult<AppSettings>> {
  const previousWorkspace = settings.workspaces.find((workspace) => workspace.id === workspaceId);

  if (!previousWorkspace) {
    const missingWorkspaceResult = await renameWorkspaceRegistration(settings, workspaceId, name);
    return missingWorkspaceResult.ok
      ? fail("WORKSPACE_NOT_FOUND", "登録済みワークスペースが見つかりませんでした。")
      : missingWorkspaceResult;
  }

  // Preflight old settings before moving the user folder. A corrupt or
  // unsupported settings file must never leave an unregistered directory.
  const previousWorkspaceSettings = name === previousWorkspace.name
    ? undefined
    : await workspaceSettings.readWorkspaceSettings(userDataPath, previousWorkspace.id);
  const renameResult = await renameWorkspaceRegistration(settings, workspaceId, name);

  if (!renameResult.ok) return renameResult;

  const nextWorkspace = renameResult.value.nextSettings.workspaces.find(
    (workspace) => workspace.id === renameResult.value.newWorkspaceId
  );
  if (!nextWorkspace) {
    return fail(
      "WORKSPACE_RENAME_FAILED",
      "名前変更後のワークスペース情報を確認できませんでした。"
    );
  }

  const workspaceIdsChanged = renameResult.value.oldWorkspaceId !== renameResult.value.newWorkspaceId;
  const workspacePathChanged = previousWorkspace.path !== nextWorkspace.path;

  if (!workspaceIdsChanged && !workspacePathChanged) {
    const savedSettings = await updateAppSettings(
      userDataPath,
      () => renameResult.value.nextSettings
    );
    return ok(savedSettings);
  }

  let movedIdentity: FileSystemEntryIdentity;
  try {
    movedIdentity = await readFileSystemEntryIdentity(nextWorkspace.path);
  } catch (error) {
    return fail(
      "WORKSPACE_RENAME_FAILED",
      "名前変更後のワークスペースを確認できませんでした。",
      ipcErrorDetails(error),
      workspaceRenameRecovery(
        previousWorkspace,
        nextWorkspace,
        "recovery-required",
        { phase: "directory-moved", status: isMissingFileError(error) ? "missing" : "unknown" },
        { status: "not-started" }
      )
    );
  }

  if (
    workspaceIdsChanged &&
    await workspaceSettingsDestinationOccupied(userDataPath, renameResult.value.newWorkspaceId)
  ) {
    const rollback = await rollbackWorkspaceDirectory(
      nextWorkspace.path,
      previousWorkspace.path,
      movedIdentity
    );
    return fail(
      "WORKSPACE_RENAME_FAILED",
      "新しいワークスペース設定が既に存在するため、名前を変更できませんでした。",
      undefined,
      workspaceRenameRecovery(
        previousWorkspace,
        nextWorkspace,
        rollback.ok ? "rolled-back" : "recovery-required",
        { phase: "preflight", status: "destination-settings-occupied" },
        { status: rollback.ok ? "old-preserved" : "unknown", rollback }
      )
    );
  }

  const sourceWorkspaceSettings = previousWorkspaceSettings ?? await workspaceSettings.readWorkspaceSettings(
    userDataPath,
    renameResult.value.oldWorkspaceId
  );
  const migratedWorkspaceSettings: WorkspaceSettings = {
    ...sourceWorkspaceSettings,
    workspacePath: nextWorkspace.path
  };

  try {
    await workspaceSettings.updateWorkspaceSettings(
      userDataPath,
      renameResult.value.newWorkspaceId,
      async () => {
        if (
          workspaceIdsChanged &&
          await workspaceSettingsDestinationOccupied(userDataPath, renameResult.value.newWorkspaceId)
        ) {
          throw new Error("New workspace settings appeared before migration.");
        }
        return migratedWorkspaceSettings;
      }
    );
  } catch (error) {
    const cleanup = await rollbackMigratedWorkspaceSettings(
      userDataPath,
      renameResult.value.oldWorkspaceId,
      renameResult.value.newWorkspaceId,
      sourceWorkspaceSettings,
      migratedWorkspaceSettings
    );
    const rollback = await rollbackWorkspaceDirectory(
      nextWorkspace.path,
      previousWorkspace.path,
      movedIdentity
    );
    return fail(
      "WORKSPACE_RENAME_FAILED",
      "ワークスペース設定を移行できませんでした。",
      ipcErrorDetails(error),
      workspaceRenameRecovery(
        previousWorkspace,
        nextWorkspace,
        rollback.ok && cleanupSucceeded(cleanup) ? "rolled-back" : "recovery-required",
        { phase: "new-settings", status: "write-failed", cleanup },
        { status: "old-preserved", rollback }
      )
    );
  }

  let savedSettings: Awaited<ReturnType<typeof updateAppSettings>>;
  try {
    savedSettings = await updateAppSettings(
      userDataPath,
      () => renameResult.value.nextSettings
    );
  } catch (error) {
    const appCompensation = await compensateAppSettings(
      userDataPath,
      settings,
      renameResult.value.nextSettings
    );
    const cleanup = await rollbackMigratedWorkspaceSettings(
      userDataPath,
      renameResult.value.oldWorkspaceId,
      renameResult.value.newWorkspaceId,
      sourceWorkspaceSettings,
      migratedWorkspaceSettings
    );
    const rollback = await rollbackWorkspaceDirectory(
      nextWorkspace.path,
      previousWorkspace.path,
      movedIdentity
    );
    return fail(
      "WORKSPACE_RENAME_FAILED",
      "ワークスペース登録設定を保存できませんでした。",
      ipcErrorDetails(error),
      workspaceRenameRecovery(
        previousWorkspace,
        nextWorkspace,
        rollback.ok && cleanupSucceeded(cleanup) && appCompensation.status !== "conflict" && appCompensation.status !== "failed"
          ? "rolled-back"
          : "recovery-required",
        { phase: "app-settings", status: "write-failed", cleanup },
        { status: appCompensation.status, rollback }
      )
    );
  }

  if (workspaceIdsChanged) {
    try {
      await removeWorkspaceSettingsSafely(
        userDataPath,
        renameResult.value.oldWorkspaceId,
        sourceWorkspaceSettings
      );
    } catch (error) {
      const appCompensation = await compensateAppSettings(
        userDataPath,
        settings,
        renameResult.value.nextSettings
      );
      const cleanup = await cleanupMigratedWorkspaceSettings(
        userDataPath,
        renameResult.value.newWorkspaceId,
        migratedWorkspaceSettings
      );
      const oldSettings = await inspectWorkspaceSettings(
        userDataPath,
        renameResult.value.oldWorkspaceId,
        sourceWorkspaceSettings
      );
      const rollback = await rollbackWorkspaceDirectory(
        nextWorkspace.path,
        previousWorkspace.path,
        movedIdentity
      );
      return fail(
        "WORKSPACE_RENAME_FAILED",
        "旧ワークスペース設定を削除できず、名前変更を完了できませんでした。",
        ipcErrorDetails(error),
        workspaceRenameRecovery(
          previousWorkspace,
          nextWorkspace,
          rollback.ok && cleanupSucceeded(cleanup) && oldSettings === "preserved" &&
            appCompensation.status !== "conflict" && appCompensation.status !== "failed"
            ? "rolled-back"
            : "recovery-required",
          {
            phase: "old-settings",
            status: "remove-failed",
            cleanup,
            oldSettingsRemoval: { status: "failed", state: oldSettings }
          },
          { status: appCompensation.status, rollback }
        )
      );
    }
  }

  return ok(savedSettings);
}

type CleanupStatus = {
  status: "changed" | "failed" | "missing" | "removed" | "unknown";
};

type WorkspaceSettingsRollbackStatus = CleanupStatus | {
  status: "old-preserved" | "restored";
};

type AppSettingsCompensationStatus = {
  status: "conflict" | "failed" | "old-preserved" | "restored";
};

type WorkspaceSettingsState = "changed" | "failed" | "missing" | "preserved";

async function workspaceSettingsDestinationOccupied(
  userDataPath: string,
  workspaceId: string
): Promise<boolean> {
  try {
    await lstat(path.join(userDataPath, "workspaces", `${workspaceId}.json`));
    return true;
  } catch (error) {
    return !isMissingFileError(error);
  }
}

async function cleanupMigratedWorkspaceSettings(
  userDataPath: string,
  workspaceId: string,
  expected: WorkspaceSettings
): Promise<CleanupStatus> {
  try {
    const settingsPath = path.join(userDataPath, "workspaces", `${workspaceId}.json`);
    let entry;
    try {
      entry = await lstat(settingsPath);
    } catch (error) {
      if (isMissingFileError(error)) return { status: "missing" };
      return { status: "failed" };
    }
    if (!entry.isFile()) return { status: "changed" };
    const current = await workspaceSettings.readWorkspaceSettings(userDataPath, workspaceId);
    if (!isDeepStrictEqual(current, expected)) return { status: "changed" };
    let latestEntry;
    try {
      latestEntry = await lstat(settingsPath);
    } catch (error) {
      return isMissingFileError(error) ? { status: "missing" } : { status: "failed" };
    }
    if (
      !latestEntry.isFile() ||
      latestEntry.dev !== entry.dev ||
      latestEntry.ino !== entry.ino
    ) {
      return { status: "changed" };
    }
    await workspaceSettings.removeWorkspaceSettings(userDataPath, workspaceId);
    return { status: "removed" };
  } catch {
    return { status: "failed" };
  }
}

async function removeWorkspaceSettingsSafely(
  userDataPath: string,
  workspaceId: string,
  expected: WorkspaceSettings
): Promise<void> {
  const settingsPath = path.join(userDataPath, "workspaces", `${workspaceId}.json`);
  let entry;
  try {
    entry = await lstat(settingsPath);
  } catch (error) {
    if (isMissingFileError(error)) return;
    throw error;
  }
  if (!entry.isFile()) {
    throw new Error("Workspace settings changed before removal.");
  }

  const current = await workspaceSettings.readWorkspaceSettings(userDataPath, workspaceId);
  if (!isDeepStrictEqual(current, expected)) {
    throw new Error("Workspace settings changed before removal.");
  }

  let latestEntry;
  try {
    latestEntry = await lstat(settingsPath);
  } catch (error) {
    if (isMissingFileError(error)) return;
    throw error;
  }
  if (
    !latestEntry.isFile() ||
    latestEntry.dev !== entry.dev ||
    latestEntry.ino !== entry.ino
  ) {
    throw new Error("Workspace settings changed before removal.");
  }

  await workspaceSettings.removeWorkspaceSettings(userDataPath, workspaceId);
}

async function rollbackMigratedWorkspaceSettings(
  userDataPath: string,
  oldWorkspaceId: string,
  newWorkspaceId: string,
  source: WorkspaceSettings,
  migrated: WorkspaceSettings
): Promise<WorkspaceSettingsRollbackStatus> {
  if (oldWorkspaceId !== newWorkspaceId) {
    return cleanupMigratedWorkspaceSettings(userDataPath, newWorkspaceId, migrated);
  }

  try {
    const current = await workspaceSettings.readWorkspaceSettings(userDataPath, oldWorkspaceId);
    if (isDeepStrictEqual(current, source)) return { status: "old-preserved" };
    if (!isDeepStrictEqual(current, migrated)) return { status: "changed" };

    await workspaceSettings.updateWorkspaceSettings(userDataPath, oldWorkspaceId, (candidate) => {
      if (!isDeepStrictEqual(candidate, migrated)) {
        throw new Error("Workspace settings changed during workspace rename compensation.");
      }
      return source;
    });
    return { status: "restored" };
  } catch {
    return { status: "failed" };
  }
}

async function inspectWorkspaceSettings(
  userDataPath: string,
  workspaceId: string,
  expected: WorkspaceSettings
): Promise<WorkspaceSettingsState> {
  try {
    const settingsPath = path.join(userDataPath, "workspaces", `${workspaceId}.json`);
    let entry;
    try {
      entry = await lstat(settingsPath);
    } catch (error) {
      return isMissingFileError(error) ? "missing" : "failed";
    }
    if (!entry.isFile()) return "changed";
    const current = await workspaceSettings.readWorkspaceSettings(userDataPath, workspaceId);
    return isDeepStrictEqual(current, expected) ? "preserved" : "changed";
  } catch {
    return "failed";
  }
}

async function rollbackWorkspaceDirectory(
  currentPath: string,
  originalPath: string,
  expectedCurrent: FileSystemEntryIdentity
): Promise<SafeDirectoryRollbackResult> {
  try {
    return await rollbackRenamedDirectoryWithoutOverwrite(currentPath, originalPath, expectedCurrent);
  } catch (error) {
    return { error, ok: false, reason: "rollback-failed" };
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

async function compensateAppSettings(
  userDataPath: string,
  previousSettings: AppSettings,
  expectedNextSettings: AppSettings
): Promise<AppSettingsCompensationStatus> {
  try {
    const currentSettings = await readAppSettings(userDataPath);
    if (isDeepStrictEqual(currentSettings, previousSettings)) {
      return { status: "old-preserved" };
    }
    if (!isDeepStrictEqual(currentSettings, expectedNextSettings)) {
      return { status: "conflict" };
    }

    await updateAppSettings(userDataPath, (current) => {
      if (!isDeepStrictEqual(current, expectedNextSettings)) {
        throw new Error("App settings changed during workspace rename compensation.");
      }
      return previousSettings;
    });
    return { status: "restored" };
  } catch {
    return { status: "failed" };
  }
}

function workspaceRenameRecovery(
  oldWorkspace: { path: string },
  currentWorkspace: { path: string },
  status: "recovery-required" | "rolled-back",
  settingsMigration: Record<string, unknown>,
  directory: { status: string; rollback?: SafeDirectoryRollbackResult }
): Record<string, unknown> {
  return {
    currentPath: directory.rollback?.ok === true ? oldWorkspace.path : currentWorkspace.path,
    directory: directory.rollback?.ok === true ? "rolled-back" : directory.rollback?.reason ?? directory.status,
    oldPath: oldWorkspace.path,
    reason: directory.rollback?.ok === true
      ? "rollback-completed"
      : directory.rollback?.reason ?? directory.status,
    settingsMigration,
    status
  };
}

function cleanupSucceeded(cleanup: WorkspaceSettingsRollbackStatus): boolean {
  return cleanup.status === "missing" || cleanup.status === "removed" ||
    cleanup.status === "old-preserved" || cleanup.status === "restored";
}
