import { rm } from "node:fs/promises";

import { app } from "electron";

import {
  getWorkspaceStateChannel,
  refreshWorkspaceChannel,
  type WorkspaceState
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { getWorkspaceFileIndexCachePath } from "../files/workspaceFileIndex";
import { invalidateWorkspaceData } from "../files/workspaceDataInvalidation";
import { getMainTranslator } from "../i18n";
import { readAppSettings } from "../settings/appSettings";
import { syncWorkspaceWatcher } from "../workspace/workspaceWatcher";
import { ipcErrorDetails } from "./activeWorkspace";
import { isRefreshWorkspaceInput } from "./workspaceHandlerValidators";
import { buildWorkspaceState } from "./workspaceState";
import { handleLocalizedIpc } from "./localizedIpcHandler";

const workspaceRefreshPromises = new Map<string, Promise<RelicResult<WorkspaceState>>>();

export function registerWorkspaceStateHandlers(): void {
  handleLocalizedIpc(getWorkspaceStateChannel, async (): Promise<RelicResult<WorkspaceState>> => {
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

  handleLocalizedIpc(
    refreshWorkspaceChannel,
    async (_event, input: unknown): Promise<RelicResult<WorkspaceState>> => {
      try {
        const t = await getMainTranslator();
        if (!isRefreshWorkspaceInput(input)) {
          return fail("WORKSPACE_REFRESH_INVALID_INPUT", t("refresh.invalidWorkspace"));
        }
        return refreshWorkspaceState(input.workspaceId, t);
      } catch (error) {
        return fail(
          "WORKSPACE_REFRESH_FAILED",
          "ファイル一覧と派生データを更新できませんでした。",
          ipcErrorDetails(error)
        );
      }
    }
  );
}

function refreshWorkspaceState(
  workspaceId: string,
  t: Awaited<ReturnType<typeof getMainTranslator>>
): Promise<RelicResult<WorkspaceState>> {
  const existing = workspaceRefreshPromises.get(workspaceId);
  if (existing) return existing;

  const promise = (async (): Promise<RelicResult<WorkspaceState>> => {
    try {
      const userDataPath = app.getPath("userData");
      const settings = await readAppSettings(userDataPath);
      if (settings.lastWorkspaceId !== workspaceId) {
        return fail("WORKSPACE_REFRESH_STALE", t("refresh.workspaceChanged"));
      }

      invalidateWorkspaceData(workspaceId);
      await rm(getWorkspaceFileIndexCachePath(userDataPath, workspaceId), { force: true });
      const state = await buildWorkspaceState(settings, { strict: true });
      const latestSettings = await readAppSettings(userDataPath);
      if (latestSettings.lastWorkspaceId !== workspaceId) {
        return fail("WORKSPACE_REFRESH_STALE", t("refresh.workspaceChanged"));
      }

      syncWorkspaceWatcher(latestSettings);
      return ok(state);
    } catch (error) {
      return fail(
        "WORKSPACE_REFRESH_FAILED",
        t("refresh.dataFailed"),
        ipcErrorDetails(error)
      );
    }
  })().finally(() => {
    if (workspaceRefreshPromises.get(workspaceId) === promise) {
      workspaceRefreshPromises.delete(workspaceId);
    }
  });
  workspaceRefreshPromises.set(workspaceId, promise);
  return promise;
}
