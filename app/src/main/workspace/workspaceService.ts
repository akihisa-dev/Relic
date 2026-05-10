import { mkdir, rename, stat } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

import type { WorkspaceState, WorkspaceSummary, WorkspaceTreeNode } from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { attachmentsDirectoryName, templatesDirectoryName } from "../../shared/workspace";
import type { AppSettings } from "../settings/appSettings";
import { validateBaseName } from "../files/names";

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

export interface RenamedWorkspaceRegistration {
  nextSettings: AppSettings;
  newWorkspaceId: string;
  oldWorkspaceId: string;
}

export async function renameWorkspaceRegistration(
  settings: AppSettings,
  workspaceId: string,
  name: string
): Promise<RelicResult<RenamedWorkspaceRegistration>> {
  const validatedName = validateBaseName(name, "ワークスペース名を入力してください。");

  if (!validatedName.ok) {
    return validatedName;
  }

  const workspace = settings.workspaces.find((item) => item.id === workspaceId);

  if (!workspace) {
    return fail("WORKSPACE_NOT_FOUND", "登録済みワークスペースが見つかりませんでした。");
  }

  const nextPath = path.join(path.dirname(workspace.path), validatedName.value);
  const nextWorkspace = createWorkspaceSummary(nextPath);

  if (workspace.path === nextWorkspace.path) {
    return ok({
      nextSettings: settings,
      newWorkspaceId: workspace.id,
      oldWorkspaceId: workspace.id
    });
  }

  try {
    const sourceStats = await stat(workspace.path);

    if (!sourceStats.isDirectory()) {
      return fail("WORKSPACE_RENAME_NOT_DIRECTORY", "ワークスペースフォルダが見つかりませんでした。");
    }

    let targetIsSourceDirectory = false;

    try {
      const targetStats = await stat(nextWorkspace.path);
      if (sourceStats.dev !== targetStats.dev || sourceStats.ino !== targetStats.ino) {
        return fail("WORKSPACE_ALREADY_EXISTS", "同じ名前のフォルダがすでにあります。");
      }
      targetIsSourceDirectory = true;
    } catch (error) {
      if (!isMissingFileError(error)) throw error;
    }

    if (targetIsSourceDirectory) {
      const temporaryPath = path.join(
        path.dirname(workspace.path),
        `.relic-rename-${nextWorkspace.id}-${Date.now()}`
      );
      await rename(workspace.path, temporaryPath);
      await rename(temporaryPath, nextWorkspace.path);
    } else {
      await rename(workspace.path, nextWorkspace.path);
    }

    const nextSettings: AppSettings = {
      ...settings,
      lastWorkspaceId: settings.lastWorkspaceId === workspace.id
        ? nextWorkspace.id
        : settings.lastWorkspaceId,
      workspaces: settings.workspaces.map((item) => (
        item.id === workspace.id ? nextWorkspace : item
      ))
    };

    return ok({
      nextSettings,
      newWorkspaceId: nextWorkspace.id,
      oldWorkspaceId: workspace.id
    });
  } catch (error) {
    return fail(
      "WORKSPACE_RENAME_FAILED",
      "ワークスペース名を変更できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
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

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}
