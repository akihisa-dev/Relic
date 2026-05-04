import { mkdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

import type { WorkspaceState, WorkspaceSummary, WorkspaceTreeNode } from "../../shared/ipc";
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

export function toWorkspaceState(
  settings: AppSettings,
  fileTree: WorkspaceTreeNode[] = []
): WorkspaceState {
  const activeWorkspace =
    settings.workspaces.find((workspace) => workspace.id === settings.lastWorkspaceId) ?? null;

  return {
    activeWorkspace,
    fileTree,
    workspaces: settings.workspaces
  };
}
