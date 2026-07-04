import { app } from "electron";

import type { WorkspaceState } from "../../shared/ipc";
import { readWorkspaceFileTree } from "../files/fileTree";
import { getWorkspaceFileIndexCachePath, readWorkspaceFileIndex } from "../files/workspaceFileIndex";
import { finishPerformanceMeasure, startPerformanceMeasure } from "../files/performanceLog";
import { type AppSettings } from "../settings/appSettings";
import { readWorkspaceSettings } from "../settings/workspaceSettings";
import { toWorkspaceState } from "../workspace/workspaceService";

export async function buildWorkspaceState(settings: AppSettings): Promise<WorkspaceState> {
  const startedAt = startPerformanceMeasure();
  const activeWorkspace =
    settings.workspaces.find((ws) => ws.id === settings.lastWorkspaceId) ?? null;

  if (!activeWorkspace) {
    finishPerformanceMeasure("buildWorkspaceState", startedAt, { activeWorkspace: false });
    return toWorkspaceState(settings);
  }

  const userDataPath = app.getPath("userData");
  const fileTreePromise = readWorkspaceFileTree(activeWorkspace.path).catch(() => []);
  const fileIndexPromise = fileTreePromise
    .then((fileTree) =>
      readWorkspaceFileIndex(activeWorkspace.path, {
        cachePath: getWorkspaceFileIndexCachePath(userDataPath, activeWorkspace.id),
        fileTree,
        includeSearchContent: false
      }).catch(() => ({
        entries: [],
        records: [],
        stats: {
          cachedContentHitCount: 0,
          cacheHitCount: 0,
          cacheMissCount: 0,
          readFileCount: 0,
          readHeadCount: 0,
          statCount: 0,
          targetPathCount: 0,
          unreadableCount: 0
        }
      }))
    );

  const [fileTree, fileIndex, wsSettings] = await Promise.all([
    fileTreePromise,
    fileIndexPromise,
    readWorkspaceSettings(userDataPath, activeWorkspace.id).catch(() => null)
  ]);

  const workspaceState = toWorkspaceState(settings, fileTree, wsSettings?.pinnedPaths ?? [], fileIndex.entries);
  finishPerformanceMeasure("buildWorkspaceState", startedAt, {
    activeWorkspace: true,
    fileIndexEntries: fileIndex.entries.length,
    fileTreeNodes: fileTree.length
  });
  return workspaceState;
}
