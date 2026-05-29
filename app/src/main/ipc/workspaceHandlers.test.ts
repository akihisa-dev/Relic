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
  defaultChronicleCalendars,
  defaultFrontmatterTemplates,
  defaultUserDefinedFields,
  togglePinChannel,
  getWorkspaceStateChannel
} from "../../shared/ipc";
import { writeAppSettings } from "../settings/appSettings";
import { defaultCharts, getWorkspaceSettingsPath, writeWorkspaceSettings } from "../settings/workspaceSettings";
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
      chronicleCalendars: defaultChronicleCalendars,
      charts: defaultCharts,
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

  it("起動時にアクティブワークスペースのフォルダがなくても状態を返す", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-user-data-"));
    const parentPath = await mkdtemp(path.join(os.tmpdir(), "relic-workspace-parent-"));
    temporaryPaths.push(userDataPath, parentPath);
    const missingWorkspacePath = path.join(parentPath, "missing-workspace");
    const workspace = createWorkspaceSummary(missingWorkspacePath);
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
        fileTree: [],
        pinnedPaths: [],
        workspaces: [workspace]
      })
    });
  });

  it("起動時にワークスペース設定を読めなくても状態を返す", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-user-data-"));
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-workspace-"));
    temporaryPaths.push(userDataPath, workspacePath);
    await writeFile(path.join(workspacePath, "note.md"), "# Note\n", "utf8");

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
    await mkdir(getWorkspaceSettingsPath(userDataPath, workspace.id), { recursive: true });

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
        fileTree: [{ name: "note", path: "note.md", type: "file" }],
        pinnedPaths: [],
        workspaces: [workspace]
      })
    });
  });

  it("不正なピン留めパスは保存しない", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-user-data-"));
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-workspace-"));
    temporaryPaths.push(userDataPath, workspacePath);

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

    electronMock.getPath.mockReturnValue(userDataPath);
    registerWorkspaceHandlers();
    const togglePinHandler = electronMock.handle.mock.calls.find(
      ([channel]) => channel === togglePinChannel
    )?.[1];

    if (!togglePinHandler) throw new Error("togglePin handler was not registered");

    const result = await togglePinHandler(undefined, "../outside.md");

    expect(result).toMatchObject({
      error: { code: "TOGGLE_PIN_INVALID_INPUT" },
      ok: false
    });
  });
});
