import { mkdir } from "node:fs/promises";

import { app, dialog } from "electron";

import {
  createNewWorkspaceChannel,
  openWorkspaceChannel,
  type WorkspaceState
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { getMainTranslator } from "../i18n";
import { readAppSettings, updateAppSettings } from "../settings/appSettings";
import {
  addOrActivateWorkspace,
  createWorkspaceSummary,
  prepareWorkspace
} from "../workspace/workspaceService";
import { syncWorkspaceWatcher } from "../workspace/workspaceWatcher";
import { ipcErrorDetails } from "./activeWorkspace";
import { buildWorkspaceState } from "./workspaceState";
import { handleLocalizedIpc } from "./localizedIpcHandler";

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

      const userDataPath = app.getPath("userData");
      const settings = await readAppSettings(userDataPath);
      const nextSettings = addOrActivateWorkspace(settings, workspace);
      const savedSettings = await updateAppSettings(userDataPath, () => nextSettings);
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

      const userDataPath = app.getPath("userData");
      const settings = await readAppSettings(userDataPath);
      const nextSettings = addOrActivateWorkspace(settings, workspace);
      const savedSettings = await updateAppSettings(userDataPath, () => nextSettings);
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
}

async function currentWorkspaceState(): Promise<RelicResult<WorkspaceState>> {
  const settings = await readAppSettings(app.getPath("userData"));
  syncWorkspaceWatcher(settings);
  return ok(await buildWorkspaceState(settings));
}
