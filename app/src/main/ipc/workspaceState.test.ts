import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  finishPerformanceMeasure: vi.fn(),
  getPath: vi.fn(),
  getWorkspaceFileIndexCachePath: vi.fn(),
  getWorkspaceData: vi.fn(),
  readWorkspaceFileIndex: vi.fn(),
  readWorkspaceFileTree: vi.fn(),
  readWorkspaceSettings: vi.fn(),
  startPerformanceMeasure: vi.fn()
}));

vi.mock("electron", () => ({
  app: { getPath: dependencies.getPath }
}));

vi.mock("../files/fileTree", () => ({
  readWorkspaceFileTree: dependencies.readWorkspaceFileTree
}));

vi.mock("../files/workspaceFileIndex", () => ({
  defaultWorkspaceFileIndexMaxSearchFileBytes: 2 * 1024 * 1024,
  getWorkspaceFileIndexCachePath: dependencies.getWorkspaceFileIndexCachePath,
  readWorkspaceFileIndex: dependencies.readWorkspaceFileIndex
}));

vi.mock("../files/workspaceDataProvider", () => ({
  workspaceDataProvider: {
    get: dependencies.getWorkspaceData
  }
}));

vi.mock("../files/performanceLog", () => ({
  finishPerformanceMeasure: dependencies.finishPerformanceMeasure,
  startPerformanceMeasure: dependencies.startPerformanceMeasure
}));

vi.mock("../settings/workspaceSettings", () => ({
  readWorkspaceSettings: dependencies.readWorkspaceSettings
}));

import type { AppSettings } from "../settings/appSettings";
import { buildWorkspaceState, workspaceReadIssue } from "./workspaceState";

const settings: AppSettings = {
  editorSettings: {
    font: "system",
    fontSize: 16,
    frontmatterDateFormat: "ymd",
    language: "en",
    lineHeight: 1.7,
    maxWidth: "660px",
    showLineNumbers: false,
    spellCheck: true,
    theme: "system"
  },
  frontmatterTemplates: [],
  lastWorkspaceId: "ws-1",
  userDefinedFields: [],
  workspaces: [{ id: "ws-1", name: "Notes", path: "/workspace" }]
};

describe("buildWorkspaceState availability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.getPath.mockReturnValue("/user-data");
    dependencies.getWorkspaceFileIndexCachePath.mockReturnValue("/cache/index.json");
    dependencies.startPerformanceMeasure.mockReturnValue(10);
    dependencies.readWorkspaceFileTree.mockResolvedValue([]);
    dependencies.readWorkspaceFileIndex.mockResolvedValue({
      entries: [],
      records: [],
      stats: {}
    });
    dependencies.getWorkspaceData.mockResolvedValue({
      options: {
        fileIndex: {
          entries: [],
          records: [],
          stats: {}
        }
      }
    });
    dependencies.readWorkspaceSettings.mockResolvedValue({ pinnedPaths: [] });
  });

  it("アクティブな登録がなければファイルを読まず空の状態を返す", async () => {
    const inactiveSettings: AppSettings = {
      ...settings,
      lastWorkspaceId: null,
      workspaces: []
    };

    const result = await buildWorkspaceState(inactiveSettings);

    expect(result).toMatchObject({
      activeWorkspace: null,
      fileIndex: [],
      fileTree: [],
      pinnedPaths: []
    });
    expect(dependencies.readWorkspaceFileTree).not.toHaveBeenCalled();
    expect(dependencies.finishPerformanceMeasure).toHaveBeenCalledWith(
      "buildWorkspaceState",
      10,
      { activeWorkspace: false }
    );
  });

  it("正常な空フォルダは利用可能な空状態として返す", async () => {
    await expect(buildWorkspaceState(settings)).resolves.toMatchObject({
      availability: {
        fileOperationsAvailable: true,
        issues: [],
        status: "available"
      },
      fileTree: []
    });
  });

  it.each([
    ["ENOENT", "missing"],
    ["EACCES", "permission"],
    ["EIO", "temporary"]
  ] as const)("ファイル一覧の%s失敗を空フォルダと区別する", async (code, kind) => {
    dependencies.readWorkspaceFileTree.mockRejectedValueOnce(fileSystemError(code));

    await expect(buildWorkspaceState(settings)).resolves.toMatchObject({
      availability: {
        fileOperationsAvailable: false,
        issues: [{ area: "file-tree", kind }],
        status: "unavailable"
      },
      fileTree: []
    });
    expect(dependencies.readWorkspaceFileIndex).not.toHaveBeenCalled();
  });

  it("索引だけ失敗した場合はファイル一覧と操作可能状態を維持する", async () => {
    const fileTree = [{ name: "Note", path: "Note.md", type: "file" as const }];
    dependencies.readWorkspaceFileTree.mockResolvedValueOnce(fileTree);
    dependencies.getWorkspaceData.mockRejectedValueOnce(fileSystemError("EIO"));

    const result = await buildWorkspaceState(settings);
    expect(result).toMatchObject({
      availability: {
        fileOperationsAvailable: true,
        issues: [{ area: "file-index", kind: "temporary" }],
        status: "degraded"
      },
      fileIndex: [],
      fileTree
    });
    expect(dependencies.getWorkspaceData).toHaveBeenCalledWith({
      fileTree,
      maxSearchFileBytes: 2 * 1024 * 1024,
      userDataPath: "/user-data",
      workspaceId: "ws-1",
      workspacePath: "/workspace"
    });
    expect(dependencies.finishPerformanceMeasure).toHaveBeenCalledWith(
      "buildWorkspaceState",
      10,
      {
        activeWorkspace: true,
        fileIndexEntries: 0,
        fileTreeNodes: 1,
        readIssues: 1
      }
    );
  });

  it("設定だけ失敗した場合はファイル一覧と既定のピン留めを維持して警告する", async () => {
    const fileTree = [{ name: "Note", path: "Note.md", type: "file" as const }];
    dependencies.readWorkspaceFileTree.mockResolvedValueOnce(fileTree);
    dependencies.readWorkspaceSettings.mockRejectedValueOnce(
      Object.assign(new Error("unsupported"), { name: "UnsupportedWorkspaceSettingsVersionError" })
    );

    await expect(buildWorkspaceState(settings)).resolves.toMatchObject({
      availability: {
        fileOperationsAvailable: true,
        issues: [{ area: "settings", kind: "unsupported" }],
        status: "degraded"
      },
      fileTree,
      pinnedPaths: []
    });
  });

  it("同じ失敗は初期読込と厳格指定の再読込で同じ分類にする", async () => {
    dependencies.readWorkspaceFileTree.mockRejectedValue(fileSystemError("ENOENT"));

    const initial = await buildWorkspaceState(settings);
    const refreshed = await buildWorkspaceState(settings);

    expect(refreshed.availability).toEqual(initial.availability);
  });

  it("再試行で読込に成功すると通常状態へ戻る", async () => {
    dependencies.readWorkspaceFileTree
      .mockRejectedValueOnce(fileSystemError("EAGAIN"))
      .mockResolvedValueOnce([]);

    expect((await buildWorkspaceState(settings)).availability?.status).toBe("unavailable");
    expect((await buildWorkspaceState(settings)).availability?.status).toBe("available");
  });
});

describe("workspaceReadIssue", () => {
  it("詳細へローカル絶対パスを残さない", () => {
    const issue = workspaceReadIssue(
      "file-tree",
      new Error("ENOENT: cannot read '/Users/example/Documents/Notes'")
    );

    expect(issue.details).not.toContain("/Users/example");
  });
});

function fileSystemError(code: string): Error & { code: string } {
  return Object.assign(new Error(`${code}: workspace read failed`), { code });
}
