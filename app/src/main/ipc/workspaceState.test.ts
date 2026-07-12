import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  finishPerformanceMeasure: vi.fn(),
  getPath: vi.fn(),
  getWorkspaceFileIndexCachePath: vi.fn(),
  readWorkspaceFileIndex: vi.fn(),
  readWorkspaceFileTree: vi.fn(),
  readWorkspaceSettings: vi.fn(),
  startPerformanceMeasure: vi.fn(),
  toWorkspaceState: vi.fn(),
}));

vi.mock("electron", () => ({
  app: { getPath: dependencies.getPath },
}));

vi.mock("../files/fileTree", () => ({
  readWorkspaceFileTree: dependencies.readWorkspaceFileTree,
}));

vi.mock("../files/workspaceFileIndex", () => ({
  getWorkspaceFileIndexCachePath: dependencies.getWorkspaceFileIndexCachePath,
  readWorkspaceFileIndex: dependencies.readWorkspaceFileIndex,
}));

vi.mock("../files/performanceLog", () => ({
  finishPerformanceMeasure: dependencies.finishPerformanceMeasure,
  startPerformanceMeasure: dependencies.startPerformanceMeasure,
}));

vi.mock("../settings/workspaceSettings", () => ({
  readWorkspaceSettings: dependencies.readWorkspaceSettings,
}));

vi.mock("../workspace/workspaceService", () => ({
  toWorkspaceState: dependencies.toWorkspaceState,
}));

import {
  defaultEditorSettings,
  defaultFeatureToggles,
  defaultFrontmatterTemplates,
  defaultUserDefinedFields,
} from "../../shared/ipc";
import { buildWorkspaceState } from "./workspaceState";

const workspace = {
  id: "workspace-1",
  name: "Notes",
  path: "/workspace",
};
const settings = {
  editorSettings: defaultEditorSettings,
  featureToggles: defaultFeatureToggles,
  frontmatterTemplates: defaultFrontmatterTemplates,
  lastWorkspaceId: workspace.id,
  userDefinedFields: defaultUserDefinedFields,
  workspaces: [workspace],
};

describe("buildWorkspaceState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.getPath.mockReturnValue("/user-data");
    dependencies.getWorkspaceFileIndexCachePath.mockReturnValue("/cache/index.json");
    dependencies.startPerformanceMeasure.mockReturnValue(10);
    dependencies.toWorkspaceState.mockImplementation(
      (appSettings, fileTree = [], pinnedPaths = [], fileIndex = []) => ({
        activeWorkspace: appSettings.workspaces[0] ?? null,
        fileIndex,
        fileTree,
        pinnedPaths,
        workspaces: appSettings.workspaces,
      }),
    );
  });

  it("アクティブな登録がなければファイルを読まず空の状態を返す", async () => {
    const inactiveSettings = {
      ...settings,
      lastWorkspaceId: null,
      workspaces: [],
    };

    const result = await buildWorkspaceState(inactiveSettings);

    expect(result).toMatchObject({
      activeWorkspace: null,
      fileIndex: [],
      fileTree: [],
      pinnedPaths: [],
    });
    expect(dependencies.readWorkspaceFileTree).not.toHaveBeenCalled();
    expect(dependencies.finishPerformanceMeasure).toHaveBeenCalledWith(
      "buildWorkspaceState",
      10,
      { activeWorkspace: false },
    );
  });

  it("索引だけ読めない場合もツリーとピン留めを保って状態を返す", async () => {
    const fileTree = [{ name: "Note", path: "note.md", type: "file" }];
    dependencies.readWorkspaceFileTree.mockResolvedValueOnce(fileTree);
    dependencies.readWorkspaceFileIndex.mockRejectedValueOnce(
      new Error("index unavailable"),
    );
    dependencies.readWorkspaceSettings.mockResolvedValueOnce({
      pinnedPaths: ["note.md"],
    });

    const result = await buildWorkspaceState(settings);

    expect(result).toMatchObject({
      fileIndex: [],
      fileTree,
      pinnedPaths: ["note.md"],
    });
    expect(dependencies.readWorkspaceFileIndex).toHaveBeenCalledWith(
      workspace.path,
      {
        cachePath: "/cache/index.json",
        fileTree,
        includeSearchContent: false,
      },
    );
    expect(dependencies.finishPerformanceMeasure).toHaveBeenCalledWith(
      "buildWorkspaceState",
      10,
      {
        activeWorkspace: true,
        fileIndexEntries: 0,
        fileTreeNodes: 1,
      },
    );
  });
});
