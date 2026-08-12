import { mkdir, mkdtemp, rename, rm, stat, utimes, writeFile } from "node:fs/promises";
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
  app: { getLocale: vi.fn().mockReturnValue("ja"), getPath: electronMock.getPath },
  BrowserWindow: { getAllWindows: electronMock.getAllWindows },
  dialog: {
    showOpenDialog: electronMock.showOpenDialog,
    showSaveDialog: electronMock.showSaveDialog
  },
  ipcMain: { handle: electronMock.handle }
}));

import {
  defaultEditorSettings,
  defaultFrontmatterTemplates,
  defaultWorkspaceTablePreferences,
  defaultUserDefinedFields,
  getBacklinksChannel,
  getWorkspaceChartsChannel,
  getWorkspaceGraphChannel,
  getWorkspaceStateChannel,
  refreshWorkspaceChannel,
  renameWorkspaceChannel,
  saveWorkspaceChartsChannel,
  searchWorkspaceChannel,
  togglePinChannel
} from "../../shared/ipc";
import * as appSettings from "../settings/appSettings";
import { writeAppSettings } from "../settings/appSettings";
import * as workspaceSettings from "../settings/workspaceSettings";
import { addOrActivateWorkspace, createWorkspaceSummary } from "../workspace/workspaceService";
import { registerFileSearchHandlers } from "./fileSearchHandlers";
import { registerWorkspaceHandlers } from "./workspaceHandlers";

describe("workspaceHandlers", () => {
  const temporaryPaths: string[] = [];

  afterEach(async () => {
    vi.restoreAllMocks();
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

  async function createRenameFixture() {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-user-data-"));
    const workspaceParentPath = await mkdtemp(path.join(os.tmpdir(), "relic-workspace-parent-"));
    temporaryPaths.push(userDataPath, workspaceParentPath);

    const oldWorkspacePath = path.join(workspaceParentPath, "旧ワークスペース");
    await mkdir(oldWorkspacePath);
    const workspace = createWorkspaceSummary(oldWorkspacePath);
    const settings = addOrActivateWorkspace(
      {
        editorSettings: defaultEditorSettings,
        frontmatterTemplates: defaultFrontmatterTemplates,
        lastWorkspaceId: null,
        userDefinedFields: defaultUserDefinedFields,
        workspaces: []
      },
      workspace
    );
    await writeAppSettings(userDataPath, settings);
    await workspaceSettings.writeWorkspaceSettings(userDataPath, workspace.id, {
      charts: workspaceSettings.defaultCharts,
      frontmatterCategoryChoices: [],
      pinnedPaths: ["memo.md"],
      tablePreferences: defaultWorkspaceTablePreferences,
      workspacePath: oldWorkspacePath
    });

    electronMock.getPath.mockReturnValue(userDataPath);
    registerWorkspaceHandlers();
    const renameWorkspaceHandler = electronMock.handle.mock.calls.find(
      ([channel]) => channel === renameWorkspaceChannel
    )?.[1];
    if (!renameWorkspaceHandler) throw new Error("renameWorkspace handler was not registered");

    const newWorkspace = createWorkspaceSummary(path.join(workspaceParentPath, "新ワークスペース"));
    return {
      newWorkspace,
      oldWorkspacePath,
      renameWorkspaceHandler,
      settings,
      userDataPath,
      workspace
    };
  }

  it("起動時のワークスペース状態でアクティブワークスペースのファイルツリーを復元する", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-user-data-"));
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-workspace-"));
    temporaryPaths.push(userDataPath, workspacePath);

    await writeFile(path.join(workspacePath, "読書メモ.md"), "# 読書メモ\n", "utf8");
    await writeFile(path.join(workspacePath, "人物関係.md"), "# 人物関係\n", "utf8");
    await mkdir(path.join(workspacePath, "資料"));
    await writeFile(path.join(workspacePath, "資料", "保管メモ.md"), "# 保管メモ\n", "utf8");

    const workspace = createWorkspaceSummary(workspacePath);
    const settings = addOrActivateWorkspace(
      {
        editorSettings: defaultEditorSettings,
        frontmatterTemplates: defaultFrontmatterTemplates,
        lastWorkspaceId: null,
        userDefinedFields: defaultUserDefinedFields,
        workspaces: []
      },
      workspace
    );
    await writeAppSettings(userDataPath, settings);
    await workspaceSettings.writeWorkspaceSettings(userDataPath, workspace.id, {
      charts: workspaceSettings.defaultCharts,
      frontmatterCategoryChoices: [],
      pinnedPaths: ["読書メモ.md"],
      tablePreferences: defaultWorkspaceTablePreferences,
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
        availability: {
          fileOperationsAvailable: true,
          issues: [],
          status: "available"
        },
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
      { name: "人物関係", path: "人物関係.md", type: "file" },
      { name: "読書メモ", path: "読書メモ.md", type: "file" }
    ]);
    expect(result.ok ? result.value.fileIndex : []).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "markdown", name: "人物関係", path: "人物関係.md", readStatus: "ok" }),
      expect.objectContaining({ kind: "markdown", name: "保管メモ", path: "資料/保管メモ.md", readStatus: "ok" }),
      expect.objectContaining({ kind: "markdown", name: "読書メモ", path: "読書メモ.md", readStatus: "ok" })
    ]));
  });

  it("リフレッシュで追加・削除・名称変更とグラフ・年表の派生データをディスクから再構築する", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-user-data-"));
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-workspace-"));
    temporaryPaths.push(userDataPath, workspacePath);
    const sourcePath = path.join(workspacePath, "source.md");
    await writeFile(sourcePath, "---\nchronicle: 100\n---\n[[oldname]]\n", "utf8");
    await writeFile(path.join(workspacePath, "oldname.md"), "# Old\n", "utf8");
    const originalSourceStat = await stat(sourcePath);

    const workspace = createWorkspaceSummary(workspacePath);
    const settings = addOrActivateWorkspace({
      editorSettings: defaultEditorSettings,
      frontmatterTemplates: defaultFrontmatterTemplates,
      lastWorkspaceId: null,
      userDefinedFields: defaultUserDefinedFields,
      workspaces: []
    }, workspace);
    await writeAppSettings(userDataPath, settings);
    await workspaceSettings.writeWorkspaceSettings(userDataPath, workspace.id, {
      charts: workspaceSettings.defaultCharts,
      frontmatterCategoryChoices: [],
      pinnedPaths: [],
      tablePreferences: defaultWorkspaceTablePreferences,
      workspacePath
    });

    electronMock.getPath.mockReturnValue(userDataPath);
    registerWorkspaceHandlers();
    registerFileSearchHandlers();
    const handlerFor = (channel: string) => {
      const handler = electronMock.handle.mock.calls.find(([registered]) => registered === channel)?.[1];
      if (!handler) throw new Error(`Handler was not registered: ${channel}`);
      return handler;
    };

    await handlerFor(getWorkspaceStateChannel)();
    const initialGraph = await handlerFor(getWorkspaceGraphChannel)();
    expect(initialGraph.ok ? initialGraph.value.nodes.map((node: { id: string }) => node.id) : [])
      .toContain("oldname.md");
    const initialSearch = await handlerFor(searchWorkspaceChannel)(undefined, {
      mode: "fullText",
      query: "oldname"
    });
    expect(initialSearch.ok ? initialSearch.value.results.map((entry: { path: string }) => entry.path) : [])
      .toContain("source.md");
    await rename(path.join(workspacePath, "oldname.md"), path.join(workspacePath, "renamed.md"));
    await writeFile(sourcePath, "---\nchronicle: 200\n---\n[[renamed]]\n", "utf8");
    await utimes(sourcePath, originalSourceStat.atime, originalSourceStat.mtime);
    await writeFile(path.join(workspacePath, "added.md"), "# Added\n", "utf8");
    await writeFile(path.join(workspacePath, "cover.png"), "test image", "utf8");

    const refreshed = await handlerFor(refreshWorkspaceChannel)(undefined, { workspaceId: workspace.id });
    expect(refreshed).toMatchObject({ ok: true });
    expect(refreshed.ok ? refreshed.value.fileIndex?.map((entry: { path: string }) => entry.path) : []).toEqual([
      "added.md",
      "renamed.md",
      "source.md"
    ]);
    expect(refreshed.ok ? refreshed.value.fileTree : []).toEqual(expect.arrayContaining([
      { kind: "image", name: "cover.png", path: "cover.png", type: "file" }
    ]));

    const graph = await handlerFor(getWorkspaceGraphChannel)();
    expect(graph.ok ? graph.value.nodes.map((node: { id: string }) => node.id) : []).toEqual(expect.arrayContaining([
      "added.md",
      "renamed.md",
      "source.md"
    ]));
    expect(graph.ok ? graph.value.nodes.map((node: { id: string }) => node.id) : []).not.toContain("oldname.md");

    const refreshedSearch = await handlerFor(searchWorkspaceChannel)(undefined, {
      mode: "fullText",
      query: "renamed"
    });
    expect(refreshedSearch.ok
      ? refreshedSearch.value.results.map((entry: { path: string }) => entry.path)
      : []).toContain("source.md");
    const staleSearch = await handlerFor(searchWorkspaceChannel)(undefined, {
      mode: "fullText",
      query: "oldname"
    });
    expect(staleSearch.ok ? staleSearch.value.results : []).toEqual([]);

    const backlinks = await handlerFor(getBacklinksChannel)(undefined, { path: "renamed.md" });
    expect(backlinks.ok ? backlinks.value : []).toEqual([
      expect.objectContaining({ sourcePath: "source.md" })
    ]);

    const charts = await handlerFor(getWorkspaceChartsChannel)();
    expect(charts.ok ? charts.value[0]?.entries : []).toEqual([
      expect.objectContaining({ path: "source.md", startPoint: { month: null, year: 200 } })
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
        availability: {
          fileOperationsAvailable: false,
          issues: [
            expect.objectContaining({ area: "file-tree", kind: "missing" })
          ],
          status: "unavailable"
        },
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
        frontmatterTemplates: defaultFrontmatterTemplates,
        lastWorkspaceId: null,
        userDefinedFields: defaultUserDefinedFields,
        workspaces: []
      },
      workspace
    );
    await writeAppSettings(userDataPath, settings);
    await mkdir(workspaceSettings.getWorkspaceSettingsPath(userDataPath, workspace.id), { recursive: true });

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
        availability: {
          fileOperationsAvailable: true,
          issues: [
            expect.objectContaining({ area: "settings" })
          ],
          status: "degraded"
        },
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

  it("チャート保存後は永続化した正規化済み設定でチャートを返す", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-user-data-"));
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-workspace-"));
    temporaryPaths.push(userDataPath, workspacePath);
    await writeFile(path.join(workspacePath, "note.md"), "# Note\n", "utf8");

    const workspace = createWorkspaceSummary(workspacePath);
    const settings = addOrActivateWorkspace(
      {
        editorSettings: defaultEditorSettings,
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
    const saveChartsHandler = electronMock.handle.mock.calls.find(
      ([channel]) => channel === saveWorkspaceChartsChannel
    )?.[1];

    if (!saveChartsHandler) throw new Error("saveWorkspaceCharts handler was not registered");

    const result = await saveChartsHandler(undefined, [
      {
        filePaths: ["note.md"],
        id: " chronicle ",
        name: " 年表 ",
        source: "chronicle"
      }
    ]);

    expect(result).toEqual({
      ok: true,
      value: [
        expect.objectContaining({
          entries: [],
          filePaths: ["note.md"],
          id: "chronicle",
          name: "年表",
          source: "chronicle"
        })
      ]
    });
  });

  it("ワークスペースID変更時はworkspace settingsを新IDに移行して旧IDを削除する", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-user-data-"));
    const workspaceParentPath = await mkdtemp(path.join(os.tmpdir(), "relic-workspace-parent-"));
    temporaryPaths.push(userDataPath, workspaceParentPath);

    const oldWorkspacePath = path.join(workspaceParentPath, "旧ワークスペース");
    await mkdir(oldWorkspacePath);
    const workspace = createWorkspaceSummary(oldWorkspacePath);
    const settings = addOrActivateWorkspace(
      {
        editorSettings: defaultEditorSettings,
        frontmatterTemplates: defaultFrontmatterTemplates,
        lastWorkspaceId: null,
        userDefinedFields: defaultUserDefinedFields,
        workspaces: []
      },
      workspace
    );
    await writeAppSettings(userDataPath, settings);
    await workspaceSettings.writeWorkspaceSettings(userDataPath, workspace.id, {
      charts: workspaceSettings.defaultCharts,
      frontmatterCategoryChoices: [],
      pinnedPaths: ["memo.md"],
      tablePreferences: defaultWorkspaceTablePreferences,
      workspacePath: oldWorkspacePath
    });

    electronMock.getPath.mockReturnValue(userDataPath);
    registerWorkspaceHandlers();
    const renameWorkspaceHandler = electronMock.handle.mock.calls.find(
      ([channel]) => channel === renameWorkspaceChannel
    )?.[1];

    if (!renameWorkspaceHandler) throw new Error("renameWorkspace handler was not registered");

    const result = await renameWorkspaceHandler(undefined, {
      workspaceId: workspace.id,
      name: "新ワークスペース"
    });

    const newWorkspace = createWorkspaceSummary(path.join(workspaceParentPath, "新ワークスペース"));
    const oldWorkspaceSettingsPath = workspaceSettings.getWorkspaceSettingsPath(userDataPath, workspace.id);
    const newWorkspaceSettingsPath = workspaceSettings.getWorkspaceSettingsPath(userDataPath, newWorkspace.id);

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        activeWorkspace: expect.objectContaining({
          id: newWorkspace.id,
          name: "新ワークスペース",
          path: newWorkspace.path
        }),
        pinnedPaths: ["memo.md"],
        workspaces: [expect.objectContaining({ id: newWorkspace.id, name: "新ワークスペース" })]
      })
    });
    await expect(stat(oldWorkspaceSettingsPath)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await stat(newWorkspaceSettingsPath)).toBeTruthy();
    expect(await workspaceSettings.readWorkspaceSettings(userDataPath, newWorkspace.id)).toMatchObject({
      pinnedPaths: ["memo.md"],
      workspacePath: newWorkspace.path
    });
  });

  it("ワークスペースIDが同じ大文字小文字変更でもworkspace settingsのパスを更新する", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-user-data-"));
    const workspaceParentPath = await mkdtemp(path.join(os.tmpdir(), "relic-workspace-parent-"));
    temporaryPaths.push(userDataPath, workspaceParentPath);

    const oldWorkspacePath = path.join(workspaceParentPath, "Relic Notes");
    await mkdir(oldWorkspacePath);
    const workspace = createWorkspaceSummary(oldWorkspacePath);
    const settings = addOrActivateWorkspace(
      {
        editorSettings: defaultEditorSettings,
        frontmatterTemplates: defaultFrontmatterTemplates,
        lastWorkspaceId: null,
        userDefinedFields: defaultUserDefinedFields,
        workspaces: []
      },
      workspace
    );
    await writeAppSettings(userDataPath, settings);
    await workspaceSettings.writeWorkspaceSettings(userDataPath, workspace.id, {
      charts: workspaceSettings.defaultCharts,
      frontmatterCategoryChoices: [],
      pinnedPaths: ["memo.md"],
      tablePreferences: defaultWorkspaceTablePreferences,
      workspacePath: oldWorkspacePath
    });

    electronMock.getPath.mockReturnValue(userDataPath);
    registerWorkspaceHandlers();
    const renameWorkspaceHandler = electronMock.handle.mock.calls.find(
      ([channel]) => channel === renameWorkspaceChannel
    )?.[1];
    if (!renameWorkspaceHandler) throw new Error("renameWorkspace handler was not registered");

    const result = await renameWorkspaceHandler(undefined, {
      name: "relic notes",
      workspaceId: workspace.id
    });
    const nextWorkspace = createWorkspaceSummary(path.join(workspaceParentPath, "relic notes"));

    expect(result).toMatchObject({
      ok: true,
      value: {
        activeWorkspace: nextWorkspace,
        workspaces: [nextWorkspace]
      }
    });
    const oldPathAfterRename = await stat(oldWorkspacePath).catch(() => undefined);
    const newPathAfterRename = await stat(nextWorkspace.path);
    if (oldPathAfterRename) {
      expect(oldPathAfterRename.dev).toBe(newPathAfterRename.dev);
      expect(oldPathAfterRename.ino).toBe(newPathAfterRename.ino);
    }
    expect(await workspaceSettings.readWorkspaceSettings(userDataPath, workspace.id)).toMatchObject({
      pinnedPaths: ["memo.md"],
      workspacePath: nextWorkspace.path
    });
  });

  it("旧workspace settings削除失敗時は成功扱いにせず、補償できれば元へ戻す", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-user-data-"));
    const workspaceParentPath = await mkdtemp(path.join(os.tmpdir(), "relic-workspace-parent-"));
    temporaryPaths.push(userDataPath, workspaceParentPath);

    const oldWorkspacePath = path.join(workspaceParentPath, "旧ワークスペース");
    await mkdir(oldWorkspacePath);
    const workspace = createWorkspaceSummary(oldWorkspacePath);
    const settings = addOrActivateWorkspace(
      {
        editorSettings: defaultEditorSettings,
        frontmatterTemplates: defaultFrontmatterTemplates,
        lastWorkspaceId: null,
        userDefinedFields: defaultUserDefinedFields,
        workspaces: []
      },
      workspace
    );
    await writeAppSettings(userDataPath, settings);
    await workspaceSettings.writeWorkspaceSettings(userDataPath, workspace.id, {
      charts: workspaceSettings.defaultCharts,
      frontmatterCategoryChoices: [],
      pinnedPaths: ["memo.md"],
      tablePreferences: defaultWorkspaceTablePreferences,
      workspacePath: oldWorkspacePath
    });
    const removeWorkspaceSettingsSpy = vi.spyOn(workspaceSettings, "removeWorkspaceSettings");
    removeWorkspaceSettingsSpy.mockRejectedValueOnce(new Error("削除失敗"));

    electronMock.getPath.mockReturnValue(userDataPath);
    registerWorkspaceHandlers();
    const renameWorkspaceHandler = electronMock.handle.mock.calls.find(
      ([channel]) => channel === renameWorkspaceChannel
    )?.[1];

    if (!renameWorkspaceHandler) throw new Error("renameWorkspace handler was not registered");

    const result = await renameWorkspaceHandler(undefined, {
      workspaceId: workspace.id,
      name: "新ワークスペース"
    });

    const newWorkspace = createWorkspaceSummary(path.join(workspaceParentPath, "新ワークスペース"));
    expect(result).toMatchObject({
      error: {
        code: "WORKSPACE_RENAME_FAILED",
        recovery: { status: "rolled-back" }
      },
      ok: false
    });
    expect(removeWorkspaceSettingsSpy).toHaveBeenCalledWith(userDataPath, workspace.id);
    await expect(stat(oldWorkspacePath)).resolves.toBeTruthy();
    await expect(stat(newWorkspace.path)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await workspaceSettings.readWorkspaceSettings(userDataPath, workspace.id)).toMatchObject({
      pinnedPaths: ["memo.md"],
      workspacePath: oldWorkspacePath
    });
    await expect(stat(workspaceSettings.getWorkspaceSettingsPath(userDataPath, newWorkspace.id)))
      .rejects.toMatchObject({ code: "ENOENT" });
  });

  it("旧workspace settings削除後に失敗した場合は回復必須として状態を返す", async () => {
    const fixture = await createRenameFixture();
    const oldSettingsPath = workspaceSettings.getWorkspaceSettingsPath(
      fixture.userDataPath,
      fixture.workspace.id
    );
    const removeWorkspaceSettingsSpy = vi.spyOn(workspaceSettings, "removeWorkspaceSettings");
    removeWorkspaceSettingsSpy.mockImplementationOnce(async () => {
      await rm(oldSettingsPath, { force: true });
      throw new Error("削除後の通知失敗");
    });

    const result = await fixture.renameWorkspaceHandler(undefined, {
      name: "新ワークスペース",
      workspaceId: fixture.workspace.id
    });

    expect(result).toMatchObject({
      error: {
        code: "WORKSPACE_RENAME_FAILED",
        recovery: {
          settingsMigration: {
            oldSettingsRemoval: { state: "missing", status: "failed" }
          },
          status: "recovery-required"
        }
      },
      ok: false
    });
    await expect(stat(fixture.oldWorkspacePath)).resolves.toBeTruthy();
    await expect(stat(fixture.newWorkspace.path)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(stat(oldSettingsPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("旧workspace settingsの事前読込に失敗した場合はフォルダを変更しない", async () => {
    const fixture = await createRenameFixture();
    vi.spyOn(workspaceSettings, "readWorkspaceSettings").mockRejectedValueOnce(
      new Error("旧設定の読込失敗")
    );

    const result = await fixture.renameWorkspaceHandler(undefined, {
      name: "新ワークスペース",
      workspaceId: fixture.workspace.id
    });

    expect(result).toMatchObject({
      error: { code: "WORKSPACE_RENAME_FAILED" },
      ok: false
    });
    await expect(stat(fixture.oldWorkspacePath)).resolves.toBeTruthy();
    await expect(stat(fixture.newWorkspace.path)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(appSettings.readAppSettings(fixture.userDataPath)).resolves.toEqual(fixture.settings);
  });

  it("新workspace settingsの書込に失敗した場合はフォルダと旧設定を元へ戻す", async () => {
    const fixture = await createRenameFixture();
    const updateWorkspaceSettingsSpy = vi.spyOn(workspaceSettings, "updateWorkspaceSettings");
    updateWorkspaceSettingsSpy.mockRejectedValueOnce(new Error("新設定の書込失敗"));

    const result = await fixture.renameWorkspaceHandler(undefined, {
      name: "新ワークスペース",
      workspaceId: fixture.workspace.id
    });

    expect(result).toMatchObject({
      error: {
        code: "WORKSPACE_RENAME_FAILED",
        recovery: {
          directory: "rolled-back",
          settingsMigration: { phase: "new-settings", status: "write-failed" },
          status: "rolled-back"
        }
      },
      ok: false
    });
    await expect(stat(fixture.oldWorkspacePath)).resolves.toBeTruthy();
    await expect(stat(fixture.newWorkspace.path)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(stat(workspaceSettings.getWorkspaceSettingsPath(fixture.userDataPath, fixture.newWorkspace.id)))
      .rejects.toMatchObject({ code: "ENOENT" });
    expect(updateWorkspaceSettingsSpy).toHaveBeenCalledWith(
      fixture.userDataPath,
      fixture.newWorkspace.id,
      expect.any(Function)
    );
  });

  it("アプリ設定の書込に失敗した場合は新設定を片付けてフォルダを元へ戻す", async () => {
    const fixture = await createRenameFixture();
    const updateAppSettingsSpy = vi.spyOn(appSettings, "updateAppSettings");
    updateAppSettingsSpy.mockRejectedValueOnce(new Error("アプリ設定の書込失敗"));

    const result = await fixture.renameWorkspaceHandler(undefined, {
      name: "新ワークスペース",
      workspaceId: fixture.workspace.id
    });

    expect(result).toMatchObject({
      error: {
        code: "WORKSPACE_RENAME_FAILED",
        recovery: {
          directory: "rolled-back",
          settingsMigration: { phase: "app-settings", status: "write-failed" },
          status: "rolled-back"
        }
      },
      ok: false
    });
    await expect(stat(fixture.oldWorkspacePath)).resolves.toBeTruthy();
    await expect(stat(fixture.newWorkspace.path)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(stat(workspaceSettings.getWorkspaceSettingsPath(fixture.userDataPath, fixture.newWorkspace.id)))
      .rejects.toMatchObject({ code: "ENOENT" });
    await expect(appSettings.readAppSettings(fixture.userDataPath)).resolves.toEqual(fixture.settings);
    expect(updateAppSettingsSpy).toHaveBeenCalledOnce();
  });

  it("補償時に元フォルダが先に作られた場合は上書きせず回復必須を返す", async () => {
    const fixture = await createRenameFixture();
    const updateWorkspaceSettingsSpy = vi.spyOn(workspaceSettings, "updateWorkspaceSettings");
    updateWorkspaceSettingsSpy.mockImplementationOnce(async () => {
      await mkdir(fixture.oldWorkspacePath);
      throw new Error("新設定の書込失敗");
    });

    const result = await fixture.renameWorkspaceHandler(undefined, {
      name: "新ワークスペース",
      workspaceId: fixture.workspace.id
    });

    expect(result).toMatchObject({
      error: {
        code: "WORKSPACE_RENAME_FAILED",
        recovery: {
          directory: "source-occupied",
          status: "recovery-required"
        }
      },
      ok: false
    });
    await expect(stat(fixture.oldWorkspacePath)).resolves.toBeTruthy();
    await expect(stat(fixture.newWorkspace.path)).resolves.toBeTruthy();
  });

  it("移動先フォルダが変更された場合は上書きせず回復必須を返す", async () => {
    const fixture = await createRenameFixture();
    const updateWorkspaceSettingsSpy = vi.spyOn(workspaceSettings, "updateWorkspaceSettings");
    updateWorkspaceSettingsSpy.mockImplementationOnce(async () => {
      await rm(fixture.newWorkspace.path, { force: true, recursive: true });
      await mkdir(fixture.newWorkspace.path);
      throw new Error("新設定の書込失敗");
    });

    const result = await fixture.renameWorkspaceHandler(undefined, {
      name: "新ワークスペース",
      workspaceId: fixture.workspace.id
    });

    expect(result).toMatchObject({
      error: {
        code: "WORKSPACE_RENAME_FAILED",
        recovery: {
          directory: "destination-changed",
          status: "recovery-required"
        }
      },
      ok: false
    });
    await expect(stat(fixture.oldWorkspacePath)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(stat(fixture.newWorkspace.path)).resolves.toBeTruthy();
  });
});
