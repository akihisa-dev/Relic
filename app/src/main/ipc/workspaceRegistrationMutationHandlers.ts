import { app, ipcMain } from "electron";

import {
  removeWorkspaceChannel,
  renameWorkspaceChannel,
  switchWorkspaceChannel,
  togglePinChannel,
  type WorkspaceState
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { readAppSettings, updateAppSettings } from "../settings/appSettings";
import * as workspaceSettings from "../settings/workspaceSettings";
import {
  activateWorkspace,
  prepareWorkspace,
  removeWorkspaceRegistration,
  renameWorkspaceRegistration
} from "../workspace/workspaceService";
import { syncWorkspaceWatcher } from "../workspace/workspaceWatcher";
import { ipcErrorDetails } from "./activeWorkspace";
import {
  isRenameWorkspaceInput,
  isSwitchWorkspaceInput,
  isWorkspaceIdInput
} from "./workspaceHandlerValidators";
import { buildWorkspaceState } from "./workspaceState";

export function registerWorkspaceRegistrationMutationHandlers(): void {
  registerTogglePinHandler();
  registerSwitchWorkspaceHandler();
  registerRemoveWorkspaceHandler();
  registerRenameWorkspaceHandler();
}

function registerTogglePinHandler(): void {
  ipcMain.handle(togglePinChannel, async (_event, rawPath: unknown): Promise<RelicResult<WorkspaceState>> => {
    try {
      const pinnedPath = workspaceSettings.parsePinnedPaths([rawPath]).at(0);

      if (!pinnedPath) {
        return fail("TOGGLE_PIN_INVALID_INPUT", "パスが無効です。");
      }

      const userDataPath = app.getPath("userData");
      const settings = await readAppSettings(userDataPath);
      const activeWorkspace = settings.workspaces.find((ws) => ws.id === settings.lastWorkspaceId);

      if (!activeWorkspace) {
        return fail("TOGGLE_PIN_NO_WORKSPACE", "アクティブなワークスペースがありません。");
      }

      const currentWorkspaceSettings = await workspaceSettings.readWorkspaceSettings(
        userDataPath,
        activeWorkspace.id
      );
      const updated = currentWorkspaceSettings.pinnedPaths.includes(pinnedPath)
        ? currentWorkspaceSettings.pinnedPaths.filter((path) => path !== pinnedPath)
        : [...currentWorkspaceSettings.pinnedPaths, pinnedPath];

      await workspaceSettings.updateWorkspaceSettings(
        userDataPath,
        activeWorkspace.id,
        (previousWorkspaceSettings) => ({
          ...previousWorkspaceSettings,
          pinnedPaths: updated
        })
      );

      return ok(await buildWorkspaceState(settings));
    } catch (error) {
      return fail(
        "TOGGLE_PIN_FAILED",
        "ピン留め操作に失敗しました。",
        ipcErrorDetails(error)
      );
    }
  });
}

function registerSwitchWorkspaceHandler(): void {
  ipcMain.handle(
    switchWorkspaceChannel,
    async (_event, input: unknown): Promise<RelicResult<WorkspaceState>> => {
      try {
        if (!isSwitchWorkspaceInput(input)) {
          return fail("WORKSPACE_SWITCH_INVALID_INPUT", "ワークスペースを選択してください。");
        }

        const userDataPath = app.getPath("userData");
        const settings = await readAppSettings(userDataPath);
        const nextSettings = activateWorkspace(settings, input.workspaceId);

        if (!nextSettings.ok) {
          return nextSettings;
        }

        const activeWorkspace = nextSettings.value.workspaces.find(
          (workspace) => workspace.id === input.workspaceId
        );

        if (!activeWorkspace) {
          return fail("WORKSPACE_NOT_FOUND", "登録済みワークスペースが見つかりませんでした。");
        }

        await prepareWorkspace(activeWorkspace.path);
        const savedSettings = await updateAppSettings(userDataPath, () => nextSettings.value);
        syncWorkspaceWatcher(savedSettings);

        return ok(await buildWorkspaceState(savedSettings));
      } catch (error) {
        return fail(
          "WORKSPACE_SWITCH_FAILED",
          "ワークスペースを切り替えられませんでした。",
          ipcErrorDetails(error)
        );
      }
    }
  );
}

function registerRemoveWorkspaceHandler(): void {
  ipcMain.handle(
    removeWorkspaceChannel,
    async (_event, input: unknown): Promise<RelicResult<WorkspaceState>> => {
      try {
        if (!isWorkspaceIdInput(input)) {
          return fail("WORKSPACE_REMOVE_INVALID_INPUT", "ワークスペースを選択してください。");
        }

        const userDataPath = app.getPath("userData");
        const settings = await readAppSettings(userDataPath);
        const nextSettings = removeWorkspaceRegistration(settings, input.workspaceId);

        if (!nextSettings.ok) {
          return nextSettings;
        }

        const savedSettings = await updateAppSettings(userDataPath, () => nextSettings.value);
        syncWorkspaceWatcher(savedSettings);

        return ok(await buildWorkspaceState(savedSettings));
      } catch (error) {
        return fail(
          "WORKSPACE_REMOVE_FAILED",
          "ワークスペースを一覧から削除できませんでした。",
          ipcErrorDetails(error)
        );
      }
    }
  );
}

function registerRenameWorkspaceHandler(): void {
  ipcMain.handle(
    renameWorkspaceChannel,
    async (_event, input: unknown): Promise<RelicResult<WorkspaceState>> => {
      try {
        if (!isRenameWorkspaceInput(input)) {
          return fail("WORKSPACE_RENAME_INVALID_INPUT", "ワークスペース名を入力してください。");
        }

        const userDataPath = app.getPath("userData");
        const settings = await readAppSettings(userDataPath);
        const renameResult = await renameWorkspaceRegistration(settings, input.workspaceId, input.name);

        if (!renameResult.ok) {
          return renameResult;
        }

        if (renameResult.value.oldWorkspaceId !== renameResult.value.newWorkspaceId) {
          const migratedWorkspaceSettings = await workspaceSettings.readWorkspaceSettings(
            userDataPath,
            renameResult.value.oldWorkspaceId
          );
          await workspaceSettings.updateWorkspaceSettings(
            userDataPath,
            renameResult.value.newWorkspaceId,
            () => migratedWorkspaceSettings
          );
        }

        const savedSettings = await updateAppSettings(
          userDataPath,
          () => renameResult.value.nextSettings
        );
        if (renameResult.value.oldWorkspaceId !== renameResult.value.newWorkspaceId) {
          await workspaceSettings.removeWorkspaceSettings(
            userDataPath,
            renameResult.value.oldWorkspaceId
          ).catch(() => undefined);
        }
        syncWorkspaceWatcher(savedSettings);

        return ok(await buildWorkspaceState(savedSettings));
      } catch (error) {
        return fail(
          "WORKSPACE_RENAME_FAILED",
          "ワークスペース名を変更できませんでした。",
          ipcErrorDetails(error)
        );
      }
    }
  );
}
