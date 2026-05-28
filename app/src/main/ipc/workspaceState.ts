import { app } from "electron";

import type { WorkspaceState } from "../../shared/ipc";
import { readWorkspaceFileTree } from "../files/fileTree";
import { type AppSettings } from "../settings/appSettings";
import { readWorkspaceSettings } from "../settings/workspaceSettings";
import { toWorkspaceState } from "../workspace/workspaceService";

export async function buildWorkspaceState(settings: AppSettings): Promise<WorkspaceState> {
  const activeWorkspace =
    settings.workspaces.find((ws) => ws.id === settings.lastWorkspaceId) ?? null;

  if (!activeWorkspace) {
    return toWorkspaceState(settings);
  }

  const [fileTree, wsSettings] = await Promise.all([
    readWorkspaceFileTree(activeWorkspace.path).catch(() => []),
    readWorkspaceSettings(app.getPath("userData"), activeWorkspace.id)
  ]);

  return toWorkspaceState(settings, fileTree, wsSettings.pinnedPaths);
}
