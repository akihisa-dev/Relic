import { mkdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

import type { WorkspaceState, WorkspaceSummary, WorkspaceTreeNode } from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { attachmentsDirectoryName, templatesDirectoryName } from "../../shared/workspace";
import type { AppSettings } from "../settings/appSettings";

export function createWorkspaceSummary(workspacePath: string): WorkspaceSummary {
  const normalizedPath = path.resolve(workspacePath);

  return {
    id: createHash("sha256").update(normalizedPath).digest("hex").slice(0, 16),
    name: path.basename(normalizedPath),
    path: normalizedPath
  };
}

export async function prepareWorkspace(workspacePath: string): Promise<void> {
  await Promise.all([
    mkdir(path.join(workspacePath, attachmentsDirectoryName), { recursive: true }),
    mkdir(path.join(workspacePath, templatesDirectoryName), { recursive: true })
  ]);
}

export function addOrActivateWorkspace(
  settings: AppSettings,
  workspace: WorkspaceSummary
): AppSettings {
  const existingIndex = settings.workspaces.findIndex((item) => item.id === workspace.id);
  const workspaces = [...settings.workspaces];

  if (existingIndex >= 0) {
    workspaces[existingIndex] = workspace;
  } else {
    workspaces.push(workspace);
  }

  return {
    ...settings,
    lastWorkspaceId: workspace.id,
    workspaces
  };
}

export function activateWorkspace(settings: AppSettings, workspaceId: string): RelicResult<AppSettings> {
  if (!settings.workspaces.some((workspace) => workspace.id === workspaceId)) {
    return fail("WORKSPACE_NOT_FOUND", "登録済みワークスペースが見つかりませんでした。");
  }

  return ok({
    ...settings,
    lastWorkspaceId: workspaceId
  });
}

export function removeWorkspaceRegistration(
  settings: AppSettings,
  workspaceId: string
): RelicResult<AppSettings> {
  if (!settings.workspaces.some((workspace) => workspace.id === workspaceId)) {
    return fail("WORKSPACE_NOT_FOUND", "登録済みワークスペースが見つかりませんでした。");
  }

  const workspaces = settings.workspaces.filter((workspace) => workspace.id !== workspaceId);
  const lastWorkspaceId =
    settings.lastWorkspaceId === workspaceId
      ? workspaces.at(0)?.id ?? null
      : settings.lastWorkspaceId;

  return ok({
    ...settings,
    lastWorkspaceId,
    workspaces
  });
}

export function renameWorkspaceRegistration(
  settings: AppSettings,
  workspaceId: string,
  name: string
): RelicResult<AppSettings> {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return fail("WORKSPACE_NAME_EMPTY", "ワークスペース名を入力してください。");
  }

  if (/[\/\\\r\n]/.test(trimmedName)) {
    return fail("WORKSPACE_NAME_INVALID", "ワークスペース名に使えない文字が含まれています。");
  }

  if (!settings.workspaces.some((workspace) => workspace.id === workspaceId)) {
    return fail("WORKSPACE_NOT_FOUND", "登録済みワークスペースが見つかりませんでした。");
  }

  return ok({
    ...settings,
    workspaces: settings.workspaces.map((workspace) => (
      workspace.id === workspaceId ? { ...workspace, name: trimmedName } : workspace
    ))
  });
}

export function toWorkspaceState(
  settings: AppSettings,
  fileTree: WorkspaceTreeNode[] = [],
  pinnedPaths: string[] = []
): WorkspaceState {
  const activeWorkspace =
    settings.workspaces.find((workspace) => workspace.id === settings.lastWorkspaceId) ?? null;

  return {
    activeWorkspace,
    fileTree,
    pinnedPaths,
    workspaces: settings.workspaces
  };
}
