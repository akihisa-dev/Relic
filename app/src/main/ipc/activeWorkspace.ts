import { app } from "electron";

import type { WorkspaceSummary } from "../../shared/ipc";
import { fail, type RelicResult } from "../../shared/result";
import { redactSensitiveText } from "../../shared/securityRedaction";
import { readAppSettings, type AppSettings } from "../settings/appSettings";
import { toWorkspaceState } from "../workspace/workspaceService";
import { isWorkspaceIdInput } from "./inputValidation";

interface IpcFailure {
  code: string;
  message: string;
}

export interface ActiveWorkspaceContext {
  activeWorkspace: WorkspaceSummary;
  settings: AppSettings;
  userDataPath: string;
}

export interface RegisteredWorkspaceContext {
  settings: AppSettings;
  userDataPath: string;
  workspace: WorkspaceSummary;
}

export function ipcErrorDetails(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return redactSensitiveText(message);
}

export async function getActiveWorkspaceContext(): Promise<RelicResult<ActiveWorkspaceContext>> {
  const userDataPath = app.getPath("userData");
  const settings = await readAppSettings(userDataPath);
  const state = toWorkspaceState(settings);

  if (!state.activeWorkspace) {
    return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
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

/** Resolve a workspace by its request owner, independent of the currently active workspace. */
export async function getRegisteredWorkspaceContext(
  workspaceId: string
): Promise<RelicResult<RegisteredWorkspaceContext>> {
  const userDataPath = app.getPath("userData");
  if (!isWorkspaceIdInput({ workspaceId })) {
    return fail("INVALID_WORKSPACE_ID", "ワークスペース指定が正しくありません。");
  }

  const settings = await readAppSettings(userDataPath);
  const workspace = settings.workspaces.find((candidate) => candidate.id === workspaceId);
  if (!workspace) {
    return fail("WORKSPACE_NOT_FOUND", "登録済みワークスペースが見つかりませんでした。");
  }

  return {
    ok: true,
    value: {
      settings,
      userDataPath,
      workspace
    }
  };
}

export async function withActiveWorkspace<T>(
  failure: IpcFailure,
  action: (workspacePath: string) => Promise<RelicResult<T>>
): Promise<RelicResult<T>> {
  return withActiveWorkspaceContext(failure, (context) => action(context.activeWorkspace.path));
}

export async function withActiveWorkspaceContext<T>(
  failure: IpcFailure,
  action: (context: ActiveWorkspaceContext) => Promise<RelicResult<T>>
): Promise<RelicResult<T>> {
  try {
    const context = await getActiveWorkspaceContext();
    if (!context.ok) return context;

    return action(context.value);
  } catch (error) {
    return fail(
      failure.code,
      failure.message,
      ipcErrorDetails(error)
    );
  }
}
