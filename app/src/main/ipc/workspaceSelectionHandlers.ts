import { mkdir } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";

import { app, dialog } from "electron";

import {
  createNewWorkspaceChannel,
  openWorkspaceChannel,
  relinkWorkspaceChannel,
  type WorkspaceState
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { getMainTranslator } from "../i18n";
import { invalidateWorkspaceData } from "../files/workspaceDataInvalidation";
import { transitionWorkspaceFileIndexCacheOwner } from "../files/workspaceFileIndexCache";
import { getWorkspaceFileIndexCachePath } from "../files/workspaceFileIndex";
import { readAppSettings, updateAppSettings, type AppSettings } from "../settings/appSettings";
import * as workspaceSettings from "../settings/workspaceSettings";
import {
  addOrActivateWorkspace,
  createWorkspaceSummary,
  normalizeWorkspacePathForId,
  prepareWorkspace
} from "../workspace/workspaceService";
import { syncWorkspaceWatcher } from "../workspace/workspaceWatcher";
import { runWorkspaceRegistrationTask } from "../workspace/workspaceRegistrationGate";
import { ipcErrorDetails } from "./activeWorkspace";
import { buildWorkspaceState } from "./workspaceState";
import { handleLocalizedIpc } from "./localizedIpcHandler";
import { isWorkspaceIdInput } from "./inputValidation";

export function registerWorkspaceSelectionHandlers(): void {
  handleLocalizedIpc(openWorkspaceChannel, async (): Promise<RelicResult<WorkspaceState>> => {
    try {
      const t = await getMainTranslator();
      const selection = await dialog.showOpenDialog({
        buttonLabel: t("dialogs.openWorkspaceButton"),
        message: t("dialogs.openWorkspaceMessage"),
        properties: ["openDirectory", "createDirectory"]
      });

      if (selection.canceled || selection.filePaths.length === 0) {
        return currentWorkspaceState();
      }

      const workspace = createWorkspaceSummary(selection.filePaths[0]);
      await prepareWorkspace(workspace.path);

      const savedSettings = await runWorkspaceRegistrationTask(async () => {
        const userDataPath = app.getPath("userData");
        const settings = await readAppSettings(userDataPath);
        const nextSettings = addOrActivateWorkspace(settings, workspace);
        const savedSettings = await updateAppSettings(userDataPath, () => nextSettings);
        syncWorkspaceWatcher(savedSettings);
        return savedSettings;
      });

      return ok(await buildWorkspaceState(savedSettings));
    } catch (error) {
      return fail(
        "WORKSPACE_OPEN_FAILED",
        "ワークスペースを開けませんでした。フォルダの権限や保存場所を確認してください。",
        ipcErrorDetails(error)
      );
    }
  });

  handleLocalizedIpc(createNewWorkspaceChannel, async (): Promise<RelicResult<WorkspaceState>> => {
    try {
      const t = await getMainTranslator();
      const selection = await dialog.showSaveDialog({
        buttonLabel: t("dialogs.createWorkspaceButton"),
        message: t("dialogs.createWorkspaceMessage"),
        nameFieldLabel: t("dialogs.workspaceName"),
        showsTagField: false
      });

      if (selection.canceled || !selection.filePath) {
        return currentWorkspaceState();
      }

      await mkdir(selection.filePath, { recursive: true });
      const workspace = createWorkspaceSummary(selection.filePath);
      await prepareWorkspace(workspace.path);

      const savedSettings = await runWorkspaceRegistrationTask(async () => {
        const userDataPath = app.getPath("userData");
        const settings = await readAppSettings(userDataPath);
        const nextSettings = addOrActivateWorkspace(settings, workspace);
        const savedSettings = await updateAppSettings(userDataPath, () => nextSettings);
        syncWorkspaceWatcher(savedSettings);
        return savedSettings;
      });

      return ok(await buildWorkspaceState(savedSettings));
    } catch (error) {
      return fail(
        "WORKSPACE_CREATE_FAILED",
        "ワークスペースを作成できませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  handleLocalizedIpc(
    relinkWorkspaceChannel,
    async (_event, input: unknown): Promise<RelicResult<WorkspaceState>> => {
      const t = await getMainTranslator();
      try {
        if (!isWorkspaceIdInput(input)) {
          return fail("WORKSPACE_RELINK_INVALID_INPUT", t("refresh.invalidWorkspace"));
        }

        const userDataPath = app.getPath("userData");
        const settings = await readAppSettings(userDataPath);
        const workspace = settings.workspaces.find((item) => item.id === input.workspaceId);
        if (!workspace) {
          return fail("WORKSPACE_NOT_FOUND", t("errors.notFound"));
        }

        const selection = await dialog.showOpenDialog({
          buttonLabel: t("dialogs.relinkWorkspaceButton"),
          message: t("dialogs.relinkWorkspaceMessage"),
          properties: ["openDirectory"]
        });
        if (selection.canceled || selection.filePaths.length === 0) {
          return ok(await buildWorkspaceState(settings));
        }

        const selectedWorkspace = createWorkspaceSummary(selection.filePaths[0]);
        await prepareWorkspace(selectedWorkspace.path);
        const savedSettings = await runWorkspaceRegistrationTask(async () => {
          const latestSettings = await readAppSettings(userDataPath);
          const latestWorkspace = latestSettings.workspaces.find((item) => item.id === input.workspaceId);
          if (!latestWorkspace) {
            return fail("WORKSPACE_NOT_FOUND", t("errors.notFound"));
          }
          const duplicate = latestSettings.workspaces.some((item) => (
            item.id !== latestWorkspace.id &&
            normalizeWorkspacePathForId(item.path) === normalizeWorkspacePathForId(selectedWorkspace.path)
          ));
          if (duplicate) {
            return fail("WORKSPACE_RELINK_ALREADY_REGISTERED", t("files.workspaceRelinkAlreadyRegistered"));
          }

          const nextSettings = {
            ...latestSettings,
            lastWorkspaceId: latestWorkspace.id,
            workspaces: latestSettings.workspaces.map((item) => (
              item.id === latestWorkspace.id
                ? { ...item, path: selectedWorkspace.path }
                : item
            ))
          };
          const previousWorkspaceSettings = await workspaceSettings.readWorkspaceSettings(
            userDataPath,
            latestWorkspace.id
          );
          const nextWorkspaceSettings = {
            ...previousWorkspaceSettings,
            workspacePath: selectedWorkspace.path
          };

          try {
            await workspaceSettings.updateWorkspaceSettings(
              userDataPath,
              latestWorkspace.id,
              () => nextWorkspaceSettings
            );
          } catch (error) {
            const compensation = await compensateWorkspaceSettings(
              userDataPath,
              latestWorkspace.id,
              previousWorkspaceSettings,
              nextWorkspaceSettings
            );
            return fail(
              "WORKSPACE_RELINK_FAILED",
              t("files.workspaceRelinkFailed"),
              ipcErrorDetails(error),
              relinkRecovery(
                latestWorkspace.path,
                selectedWorkspace.path,
                compensation.status === "restored" || compensation.status === "old-preserved"
                  ? "rolled-back"
                  : "recovery-required",
                { status: compensation.status },
                { status: "not-started" }
              )
            );
          }

          let savedSettings: Awaited<ReturnType<typeof updateAppSettings>>;
          try {
            savedSettings = await updateAppSettings(userDataPath, () => nextSettings);
          } catch (error) {
            const appCompensation = await compensateAppSettings(
              userDataPath,
              latestSettings,
              nextSettings
            );
            const settingsCompensation = await compensateWorkspaceSettings(
              userDataPath,
              latestWorkspace.id,
              previousWorkspaceSettings,
              nextWorkspaceSettings
            );
            return fail(
              "WORKSPACE_RELINK_FAILED",
              t("files.workspaceRelinkFailed"),
              ipcErrorDetails(error),
              relinkRecovery(
                latestWorkspace.path,
                selectedWorkspace.path,
                appCompensation.status !== "conflict" && appCompensation.status !== "failed" &&
                  (settingsCompensation.status === "restored" || settingsCompensation.status === "old-preserved")
                  ? "rolled-back"
                  : "recovery-required",
                { status: settingsCompensation.status },
                { status: appCompensation.status }
              )
            );
          }

          syncWorkspaceWatcher(savedSettings);
          return ok(savedSettings);
        });
        if (!savedSettings.ok) return savedSettings;
        // The workspace id (and therefore its cache path) is retained across
        // relink. Invalidate the old path generation before priming the new
        // provider snapshot so an old in-flight read cannot win the cache write.
        invalidateWorkspaceData(input.workspaceId);
        await transitionWorkspaceFileIndexCacheOwner(
          getWorkspaceFileIndexCachePath(userDataPath, input.workspaceId),
          savedSettings.value.workspaces.find((item) => item.id === input.workspaceId)?.path ?? selectedWorkspace.path
        );
        return ok(await buildWorkspaceState(savedSettings.value));
      } catch (error) {
        return fail(
          "WORKSPACE_RELINK_FAILED",
          t("files.workspaceRelinkFailed"),
          ipcErrorDetails(error)
        );
      }
    }
  );
}

async function currentWorkspaceState(): Promise<RelicResult<WorkspaceState>> {
  const settings = await runWorkspaceRegistrationTask(async () => {
    const currentSettings = await readAppSettings(app.getPath("userData"));
    syncWorkspaceWatcher(currentSettings);
    return currentSettings;
  });
  return ok(await buildWorkspaceState(settings));
}

type RelinkCompensationStatus = {
  status: "conflict" | "failed" | "old-preserved" | "restored";
};

async function compensateWorkspaceSettings(
  userDataPath: string,
  workspaceId: string,
  previousSettings: Awaited<ReturnType<typeof workspaceSettings.readWorkspaceSettings>>,
  expectedNextSettings: Awaited<ReturnType<typeof workspaceSettings.readWorkspaceSettings>>
): Promise<RelinkCompensationStatus> {
  try {
    const current = await workspaceSettings.readWorkspaceSettings(userDataPath, workspaceId);
    if (isDeepStrictEqual(current, previousSettings)) return { status: "old-preserved" };
    if (!isDeepStrictEqual(current, expectedNextSettings)) return { status: "conflict" };

    await workspaceSettings.updateWorkspaceSettings(userDataPath, workspaceId, (candidate) => {
      if (!isDeepStrictEqual(candidate, expectedNextSettings)) {
        throw new Error("Workspace settings changed during relink compensation.");
      }
      return previousSettings;
    });
    return { status: "restored" };
  } catch {
    return { status: "failed" };
  }
}

async function compensateAppSettings(
  userDataPath: string,
  previousSettings: AppSettings,
  expectedNextSettings: AppSettings
): Promise<RelinkCompensationStatus> {
  try {
    const current = await readAppSettings(userDataPath);
    if (isDeepStrictEqual(current, previousSettings)) return { status: "old-preserved" };
    if (!isDeepStrictEqual(current, expectedNextSettings)) return { status: "conflict" };

    await updateAppSettings(userDataPath, (candidate) => {
      if (!isDeepStrictEqual(candidate, expectedNextSettings)) {
        throw new Error("App settings changed during relink compensation.");
      }
      return previousSettings;
    });
    return { status: "restored" };
  } catch {
    return { status: "failed" };
  }
}

function relinkRecovery(
  oldPath: string,
  currentPath: string,
  status: "recovery-required" | "rolled-back",
  workspaceSettingsState: Record<string, unknown>,
  appSettingsState: Record<string, unknown>
): Record<string, unknown> {
  return {
    appSettings: appSettingsState,
    currentPath,
    oldPath,
    reason: appSettingsState.status === "failed" || appSettingsState.status === "conflict"
      ? "rollback-failed"
      : workspaceSettingsState.status === "failed" || workspaceSettingsState.status === "conflict"
        ? "rollback-failed"
        : "rollback-completed",
    settingsMigration: workspaceSettingsState,
    status
  };
}
