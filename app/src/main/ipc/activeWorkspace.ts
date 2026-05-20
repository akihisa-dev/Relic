import { app } from "electron";

import type { WorkspaceSummary } from "../../shared/ipc";
import { fail, type RelicResult } from "../../shared/result";
import { readAppSettings, type AppSettings } from "../settings/appSettings";
import { toWorkspaceState } from "../workspace/workspaceService";

interface IpcFailure {
  code: string;
  message: string;
}

export interface ActiveWorkspaceContext {
  activeWorkspace: WorkspaceSummary;
  settings: AppSettings;
  userDataPath: string;
}

export function ipcErrorDetails(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function getActiveWorkspaceContext(): Promise<RelicResult<ActiveWorkspaceContext>> {
  const userDataPath = app.getPath("userData");
  const settings = await readAppSettings(userDataPath);
  const state = toWorkspaceState(settings);

  if (!state.activeWorkspace) {
    return fail("WORKSPACE_NOT_SELECTED", "先にカードブックを開いてください。");
  }

  return {
    ok: true,
    value: {
      activeWorkspace: state.activeWorkspace,
      settings,
      userDataPath
    }
  };
}

export async function withActiveWorkspace<T>(
  failure: IpcFailure,
  action: (workspacePath: string) => Promise<RelicResult<T>>
): Promise<RelicResult<T>> {
  try {
    const context = await getActiveWorkspaceContext();
    if (!context.ok) return context;

    return action(context.value.activeWorkspace.path);
  } catch (error) {
    return fail(
      failure.code,
      failure.message,
      ipcErrorDetails(error)
    );
  }
}
