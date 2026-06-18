import { mkdir } from "node:fs/promises";

import { app, dialog, ipcMain } from "electron";

import {
  createNewWorkspaceChannel,
  getWorkspaceStateChannel,
  openWorkspaceChannel,
  removeWorkspaceChannel,
  renameWorkspaceChannel,
  switchWorkspaceChannel,
  togglePinChannel,
  type WorkspaceState
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { getMainTranslator } from "../i18n";
import { readAppSettings, updateAppSettings } from "../settings/appSettings";
import * as workspaceSettings from "../settings/workspaceSettings";
import {
  addOrActivateWorkspace,
  activateWorkspace,
  createWorkspaceSummary,
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

export function registerWorkspaceRegistrationHandlers(): void {
  ipcMain.handle(getWorkspaceStateChannel, async (): Promise<RelicResult<WorkspaceState>> => {
    try {
      const settings = await readAppSettings(app.getPath("userData"));
      syncWorkspaceWatcher(settings);

      return ok(await buildWorkspaceState(settings));
    } catch (error) {
      return fail(
        "WORKSPACE_STATE_FAILED",
        "ワークスペース情報を読み込めませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(openWorkspaceChannel, async (): Promise<RelicResult<WorkspaceState>> => {
    try {
      const t = await getMainTranslator();
      const selection = await dialog.showOpenDialog({
        buttonLabel: t("dialogs.openWorkspaceButton"),
        message: t("dialogs.openWorkspaceMessage"),
        properties: ["openDirectory", "createDirectory"]
      });

      if (selection.canceled || selection.filePaths.length === 0) {
        const settings = await readAppSettings(app.getPath("userData"));
        syncWorkspaceWatcher(settings);

        return ok(await buildWorkspaceState(settings));
      }

      const workspace = createWorkspaceSummary(selection.filePaths[0]);
      await prepareWorkspace(workspace.path);

      const settings = await readAppSettings(app.getPath("userData"));
      const nextSettings = addOrActivateWorkspace(settings, workspace);
      const savedSettings = await updateAppSettings(app.getPath("userData"), () => nextSettings);
      syncWorkspaceWatcher(savedSettings);

      return ok(await buildWorkspaceState(savedSettings));
    } catch (error) {
      return fail(
        "WORKSPACE_OPEN_FAILED",
        "ワークスペースを開けませんでした。フォルダの権限や保存場所を確認してください。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(createNewWorkspaceChannel, async (): Promise<RelicResult<WorkspaceState>> => {
    try {
      const t = await getMainTranslator();
      const selection = await dialog.showSaveDialog({
        buttonLabel: t("dialogs.createWorkspaceButton"),
        message: t("dialogs.createWorkspaceMessage"),
        nameFieldLabel: t("dialogs.workspaceName"),
        showsTagField: false
      });

      if (selection.canceled || !selection.filePath) {
        const settings = await readAppSettings(app.getPath("userData"));
        syncWorkspaceWatcher(settings);

        return ok(await buildWorkspaceState(settings));
      }

      await mkdir(selection.filePath, { recursive: true });
      const workspace = createWorkspaceSummary(selection.filePath);
      await prepareWorkspace(workspace.path);

      const settings = await readAppSettings(app.getPath("userData"));
      const nextSettings = addOrActivateWorkspace(settings, workspace);
      const savedSettings = await updateAppSettings(app.getPath("userData"), () => nextSettings);
      syncWorkspaceWatcher(savedSettings);

      return ok(await buildWorkspaceState(savedSettings));
    } catch (error) {
      return fail(
        "WORKSPACE_CREATE_FAILED",
        "ワークスペースを作成できませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(togglePinChannel, async (_event, rawPath: unknown): Promise<RelicResult<WorkspaceState>> => {
    try {
      const pinnedPath = workspaceSettings.parsePinnedPaths([rawPath]).at(0);

      if (!pinnedPath) {
        return fail("TOGGLE_PIN_INVALID_INPUT", "パスが無効です。");
      }

      const settings = await readAppSettings(app.getPath("userData"));
      const activeWorkspace = settings.workspaces.find((ws) => ws.id === settings.lastWorkspaceId);

      if (!activeWorkspace) {
        return fail("TOGGLE_PIN_NO_WORKSPACE", "アクティブなワークスペースがありません。");
      }

      const wsSettings = await workspaceSettings.readWorkspaceSettings(
        app.getPath("userData"),
        activeWorkspace.id
      );
      const updated = wsSettings.pinnedPaths.includes(pinnedPath)
        ? wsSettings.pinnedPaths.filter((p) => p !== pinnedPath)
        : [...wsSettings.pinnedPaths, pinnedPath];

      await workspaceSettings.updateWorkspaceSettings(
        app.getPath("userData"),
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

  ipcMain.handle(
    switchWorkspaceChannel,
    async (_event, input: unknown): Promise<RelicResult<WorkspaceState>> => {
      try {
        if (!isSwitchWorkspaceInput(input)) {
          return fail("WORKSPACE_SWITCH_INVALID_INPUT", "ワークスペースを選択してください。");
        }

        const settings = await readAppSettings(app.getPath("userData"));
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
        const savedSettings = await updateAppSettings(app.getPath("userData"), () => nextSettings.value);
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

  ipcMain.handle(
    removeWorkspaceChannel,
    async (_event, input: unknown): Promise<RelicResult<WorkspaceState>> => {
      try {
        if (!isWorkspaceIdInput(input)) {
          return fail("WORKSPACE_REMOVE_INVALID_INPUT", "ワークスペースを選択してください。");
        }

        const settings = await readAppSettings(app.getPath("userData"));
        const nextSettings = removeWorkspaceRegistration(settings, input.workspaceId);

        if (!nextSettings.ok) {
          return nextSettings;
        }

        const savedSettings = await updateAppSettings(app.getPath("userData"), () => nextSettings.value);
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

  ipcMain.handle(
    renameWorkspaceChannel,
    async (_event, input: unknown): Promise<RelicResult<WorkspaceState>> => {
      try {
        if (!isRenameWorkspaceInput(input)) {
          return fail("WORKSPACE_RENAME_INVALID_INPUT", "ワークスペース名を入力してください。");
        }

        const settings = await readAppSettings(app.getPath("userData"));
        const renameResult = await renameWorkspaceRegistration(settings, input.workspaceId, input.name);

        if (!renameResult.ok) {
          return renameResult;
        }

        if (renameResult.value.oldWorkspaceId !== renameResult.value.newWorkspaceId) {
          const migratedWorkspaceSettings = await workspaceSettings.readWorkspaceSettings(
            app.getPath("userData"),
            renameResult.value.oldWorkspaceId
          );
          await workspaceSettings.updateWorkspaceSettings(
            app.getPath("userData"),
            renameResult.value.newWorkspaceId,
            () => migratedWorkspaceSettings
          );
        }

        const savedSettings = await updateAppSettings(
          app.getPath("userData"),
          () => renameResult.value.nextSettings
        );
        if (renameResult.value.oldWorkspaceId !== renameResult.value.newWorkspaceId) {
          await workspaceSettings.removeWorkspaceSettings(
            app.getPath("userData"),
            renameResult.value.oldWorkspaceId
          )
            .catch(() => undefined);
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
