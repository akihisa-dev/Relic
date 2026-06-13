import { app } from "electron";

import type { WorkspaceState } from "../../shared/ipc";
import { readWorkspaceFileTree } from "../files/fileTree";
import { getWorkspaceFileIndexCachePath, readWorkspaceFileIndex } from "../files/workspaceFileIndex";
import { type AppSettings } from "../settings/appSettings";
import { readWorkspaceSettings } from "../settings/workspaceSettings";
import { toWorkspaceState } from "../workspace/workspaceService";

export async function buildWorkspaceState(settings: AppSettings): Promise<WorkspaceState> {
  const activeWorkspace =
    settings.workspaces.find((ws) => ws.id === settings.lastWorkspaceId) ?? null;

  if (!activeWorkspace) {
    return toWorkspaceState(settings);
  }

  const userDataPath = app.getPath("userData");
  const [fileTree, fileIndex, wsSettings] = await Promise.all([
    readWorkspaceFileTree(activeWorkspace.path).catch(() => []),
    readWorkspaceFileIndex(activeWorkspace.path, {
      cachePath: getWorkspaceFileIndexCachePath(userDataPath, activeWorkspace.id)
    }).catch(() => ({ entries: [], records: [] })),
    readWorkspaceSettings(userDataPath, activeWorkspace.id).catch(() => null)
  ]);

  return toWorkspaceState(settings, fileTree, wsSettings?.pinnedPaths ?? [], fileIndex.entries);
}
