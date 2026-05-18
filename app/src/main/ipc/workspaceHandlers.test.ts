import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const electronMock = vi.hoisted(() => ({
  getAllWindows: vi.fn().mockReturnValue([]),
  getPath: vi.fn(),
  handle: vi.fn(),
  showOpenDialog: vi.fn(),
  showSaveDialog: vi.fn()
}));

vi.mock("electron", () => ({
  app: { getPath: electronMock.getPath },
  BrowserWindow: { getAllWindows: electronMock.getAllWindows },
  dialog: {
    showOpenDialog: electronMock.showOpenDialog,
    showSaveDialog: electronMock.showSaveDialog
  },
  ipcMain: { handle: electronMock.handle }
}));

import {
  defaultEditorSettings,
  defaultFeatureToggles,
  defaultFrontmatterTemplates,
  defaultUserDefinedFields,
  getWorkspaceStateChannel
} from "../../shared/ipc";
import { writeAppSettings } from "../settings/appSettings";
import { defaultGanttCharts, writeWorkspaceSettings } from "../settings/workspaceSettings";
import { addOrActivateWorkspace, createWorkspaceSummary } from "../workspace/workspaceService";
import { registerWorkspaceHandlers } from "./workspaceHandlers";

describe("workspaceHandlers", () => {
  const temporaryPaths: string[] = [];

  afterEach(async () => {
    vi.clearAllMocks();
    await Promise.all(
      temporaryPaths.splice(0).map((temporaryPath) =>
        rm(temporaryPath, {
          force: true,
          recursive: true
        })
      )
    );
  });

  it("起動時のワークスペース状態でアクティブワークスペースのファイルツリーを復元する", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-user-data-"));
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-workspace-"));
    temporaryPaths.push(userDataPath, workspacePath);

    await writeFile(path.join(workspacePath, "読書メモ.md"), "# 読書メモ\n", "utf8");
    await mkdir(path.join(workspacePath, "資料"));
    await writeFile(path.join(workspacePath, "資料", "保管メモ.md"), "# 保管メモ\n", "utf8");

    const workspace = createWorkspaceSummary(workspacePath);
    const settings = addOrActivateWorkspace(
      {
        editorSettings: defaultEditorSettings,
        featureToggles: defaultFeatureToggles,
        frontmatterTemplates: defaultFrontmatterTemplates,
        lastWorkspaceId: null,
        userDefinedFields: defaultUserDefinedFields,
        workspaces: []
      },
      workspace
    );
    await writeAppSettings(userDataPath, settings);
    await writeWorkspaceSettings(userDataPath, workspace.id, {
      ganttCharts: defaultGanttCharts,
      pinnedPaths: ["読書メモ.md"],
      workspacePath
    });

    electronMock.getPath.mockReturnValue(userDataPath);
    registerWorkspaceHandlers();
    const getWorkspaceStateHandler = electronMock.handle.mock.calls.find(
      ([channel]) => channel === getWorkspaceStateChannel
    )?.[1];

    if (!getWorkspaceStateHandler) throw new Error("getWorkspaceState handler was not registered");

    const result = await getWorkspaceStateHandler();

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        activeWorkspace: workspace,
        pinnedPaths: ["読書メモ.md"],
        workspaces: [workspace]
      })
    });
    expect(result.ok ? result.value.fileTree : []).toEqual([
      {
        children: [
          { name: "保管メモ", path: "資料/保管メモ.md", type: "file" }
        ],
        name: "資料",
        path: "資料",
        type: "folder"
      },
      { name: "読書メモ", path: "読書メモ.md", type: "file" }
    ]);
  });
});
