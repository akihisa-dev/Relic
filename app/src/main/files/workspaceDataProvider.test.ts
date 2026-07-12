import { describe, expect, it, vi } from "vitest";

import { createWorkspaceDerivedDataCache } from "./workspaceDerivedData";
import { WorkspaceDataProvider } from "./workspaceDataProvider";

describe("WorkspaceDataProvider", () => {
  it("キャッシュパスと派生データsnapshotを同じ要求から組み立てる", async () => {
    const fileIndex = {
      entries: [],
      records: [],
      stats: {
        cacheHitCount: 0,
        cachedContentHitCount: 0,
        cacheMissCount: 0,
        readFileCount: 0,
        readHeadCount: 0,
        statCount: 0,
        targetPathCount: 0,
        unreadableCount: 0
      }
    };
    const parseCache = createWorkspaceDerivedDataCache();
    const getSnapshot = vi.fn().mockResolvedValue({ fileIndex, parseCache });
    const provider = new WorkspaceDataProvider({
      getCachePath: (userDataPath, workspaceId) => `${userDataPath}/${workspaceId}.json`,
      getSnapshot
    });

    const result = await provider.get({
      maxSearchFileBytes: 1024,
      userDataPath: "/user-data",
      workspaceId: "workspace-1",
      workspacePath: "/workspace"
    });

    expect(getSnapshot).toHaveBeenCalledWith({
      cachePath: "/user-data/workspace-1.json",
      maxSearchFileBytes: 1024,
      workspaceId: "workspace-1",
      workspacePath: "/workspace"
    });
    expect(result).toEqual({
      options: { cachePath: "/user-data/workspace-1.json", fileIndex, parseCache },
      workspacePath: "/workspace"
    });
  });
});
