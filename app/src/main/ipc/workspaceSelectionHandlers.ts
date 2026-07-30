import { mkdir } from "node:fs/promises";

import { app, dialog } from "electron";

import {
  createNewWorkspaceChannel,
  openWorkspaceChannel,
  relinkWorkspaceChannel,
  type WorkspaceState
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { getMainTranslator } from "../i18n";
import { readAppSettings, updateAppSettings } from "../settings/appSettings";
import * as workspaceSettings from "../settings/workspaceSettings";
import {
  addOrActivateWorkspace,
  createWorkspaceSummary,
  normalizeWorkspacePathForId,
  prepareWorkspace
} from "../workspace/workspaceService";
import { syncWorkspaceWatcher } from "../workspace/workspaceWatcher";
import { ipcErrorDetails } from "./activeWorkspace";
import { buildWorkspaceState } from "./workspaceState";
import { handleLocalizedIpc } from "./localizedIpcHandler";
import { isWorkspaceIdInput } from "./workspaceHandlerValidators";

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
        const duplicate = settings.workspaces.some((item) => (
          item.id !== workspace.id &&
          normalizeWorkspacePathForId(item.path) === normalizeWorkspacePathForId(selectedWorkspace.path)
        ));
        if (duplicate) {
          return fail("WORKSPACE_RELINK_ALREADY_REGISTERED", t("files.workspaceRelinkAlreadyRegistered"));
        }

        const nextSettings = {
          ...settings,
          lastWorkspaceId: workspace.id,
          workspaces: settings.workspaces.map((item) => (
            item.id === workspace.id
              ? { ...item, path: selectedWorkspace.path }
              : item
          ))
        };
        const savedSettings = await updateAppSettings(userDataPath, () => nextSettings);
        await workspaceSettings.updateWorkspaceSettings(
          userDataPath,
          workspace.id,
          (current) => ({
            ...current,
            workspacePath: selectedWorkspace.path
          })
        ).catch(() => undefined);
        syncWorkspaceWatcher(savedSettings);
        return ok(await buildWorkspaceState(savedSettings));
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
  const settings = await readAppSettings(app.getPath("userData"));
  syncWorkspaceWatcher(settings);
  return ok(await buildWorkspaceState(settings));
}
