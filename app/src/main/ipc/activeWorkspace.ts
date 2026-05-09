import { app } from "electron";

import { fail, type RelicResult } from "../../shared/result";
import { readAppSettings } from "../settings/appSettings";
import { toWorkspaceState } from "../workspace/workspaceService";

interface IpcFailure {
  code: string;
  message: string;
}

export async function withActiveWorkspace<T>(
  failure: IpcFailure,
  action: (workspacePath: string) => Promise<RelicResult<T>>
): Promise<RelicResult<T>> {
  try {
    const settings = await readAppSettings(app.getPath("userData"));
    const state = toWorkspaceState(settings);

    if (!state.activeWorkspace) {
      return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
    }

    return action(state.activeWorkspace.path);
  } catch (error) {
    return fail(
      failure.code,
      failure.message,
      error instanceof Error ? error.message : String(error)
    );
  }
}
