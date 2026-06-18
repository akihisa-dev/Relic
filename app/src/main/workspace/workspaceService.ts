import { rename, stat } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

import type { WorkspaceFileIndexEntry, WorkspaceState, WorkspaceSummary, WorkspaceTreeNode } from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import type { AppSettings } from "../settings/appSettings";
import { errorDetails } from "../files/fileSystem";
import { validateBaseName } from "../files/names";

const DEFAULT_MAX_RENAME_TEMPORARY_PATH_CANDIDATES = 1000;

export function createWorkspaceSummary(
  workspacePath: string,
  platform: NodeJS.Platform = process.platform
): WorkspaceSummary {
  const normalizedPath = path.resolve(workspacePath);
  const idPath = normalizeWorkspacePathForId(normalizedPath, platform);

  return {
    id: createHash("sha256").update(idPath).digest("hex").slice(0, 16),
    name: path.basename(normalizedPath),
    path: normalizedPath
  };
}

export function normalizeWorkspacePathForId(
  workspacePath: string,
  platform: NodeJS.Platform = process.platform
): string {
  const normalizedPath = path.resolve(workspacePath);

  return platform === "darwin" || platform === "win32"
    ? normalizedPath.toLocaleLowerCase("en-US")
    : normalizedPath;
}

export async function prepareWorkspace(workspacePath: string): Promise<void> {
  await stat(workspacePath);
}

export function addOrActivateWorkspace(
  settings: AppSettings,
  workspace: WorkspaceSummary,
  platform: NodeJS.Platform = process.platform
): AppSettings {
  const incomingWorkspaceKey = normalizeWorkspacePathForId(workspace.path, platform);
  const existingIndex = settings.workspaces.findIndex((item) => (
    item.id === workspace.id ||
    normalizeWorkspacePathForId(item.path, platform) === incomingWorkspaceKey
  ));
  const workspaces = [...settings.workspaces];
  const savedWorkspace = existingIndex >= 0
    ? { ...workspace, id: workspaces[existingIndex].id }
    : workspace;

  if (existingIndex >= 0) {
    workspaces[existingIndex] = savedWorkspace;
  } else {
    workspaces.push(savedWorkspace);
  }

  return {
    ...settings,
    lastWorkspaceId: savedWorkspace.id,
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
      const temporaryPath = await findAvailableRenameTemporaryPath(
        path.dirname(workspace.path),
        nextWorkspace.id
      );
      if (!temporaryPath.ok) return temporaryPath;
      await rename(workspace.path, temporaryPath.value);

      try {
        await rename(temporaryPath.value, nextWorkspace.path);
      } catch (error) {
        await rename(temporaryPath.value, workspace.path).catch(() => undefined);
        throw error;
      }
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
      errorDetails(error)
    );
  }
}

export function toWorkspaceState(
  settings: AppSettings,
  fileTree: WorkspaceTreeNode[] = [],
  pinnedPaths: string[] = [],
  fileIndex: WorkspaceFileIndexEntry[] = []
): WorkspaceState {
  const activeWorkspace =
    settings.workspaces.find((workspace) => workspace.id === settings.lastWorkspaceId) ?? null;

  return {
    activeWorkspace,
    fileIndex,
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

export async function findAvailableRenameTemporaryPath(
  parentPath: string,
  workspaceId: string,
  maxCandidates = DEFAULT_MAX_RENAME_TEMPORARY_PATH_CANDIDATES
): Promise<RelicResult<string>> {
  const basePath = path.join(parentPath, `.relic-rename-${workspaceId}-${Date.now()}`);

  for (let index = 0; index < maxCandidates; index += 1) {
    const candidatePath = index === 0 ? basePath : `${basePath}-${index}`;

    try {
      await stat(candidatePath);
    } catch (error) {
      if (isMissingFileError(error)) return ok(candidatePath);
      throw error;
    }
  }

  return fail("WORKSPACE_RENAME_TEMPORARY_PATH_EXHAUSTED", "ワークスペース名変更用の一時フォルダ名候補が多すぎます。");
}
