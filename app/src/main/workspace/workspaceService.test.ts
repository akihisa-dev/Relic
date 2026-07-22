import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultEditorSettings, defaultFeatureToggles, defaultFrontmatterTemplates, defaultUserDefinedFields } from "../../shared/ipc";
import {
  addOrActivateWorkspace,
  activateWorkspace,
  createWorkspaceSummary,
  findAvailableRenameTemporaryPath,
  prepareWorkspace,
  renameWorkspaceRegistration,
  removeWorkspaceRegistration,
  toWorkspaceState
} from "./workspaceService";

const baseSettings = {
  editorSettings: defaultEditorSettings,
  featureToggles: defaultFeatureToggles,
  frontmatterTemplates: defaultFrontmatterTemplates,
  userDefinedFields: defaultUserDefinedFields
};

describe("workspaceService", () => {
  const temporaryPaths: string[] = [];

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(
      temporaryPaths.splice(0).map((temporaryPath) =>
        rm(temporaryPath, {
          force: true,
          recursive: true
        })
      )
    );
  });

  it("ワークスペース準備時に専用フォルダを作成しない", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-workspace-"));
    temporaryPaths.push(workspacePath);

    await prepareWorkspace(workspacePath);

    expect((await stat(workspacePath)).isDirectory()).toBe(true);
    await expect(stat(path.join(workspacePath, "attachments"))).rejects.toMatchObject({
      code: "ENOENT"
    });
    await expect(stat(path.join(workspacePath, "templates"))).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("同じパスのワークスペースを重複登録せずアクティブにする", () => {
    const workspace = createWorkspaceSummary("/tmp/relic-notes");
    const firstSettings = addOrActivateWorkspace(
      { ...baseSettings, lastWorkspaceId: null, workspaces: [] },
      workspace
    );
    const nextSettings = addOrActivateWorkspace(firstSettings, workspace);

    expect(nextSettings.workspaces).toHaveLength(1);
    expect(toWorkspaceState(nextSettings).activeWorkspace).toEqual(workspace);
  });

  it("同じパスが別IDで登録済みでも既存IDを維持する", () => {
    const workspace = createWorkspaceSummary("/tmp/relic-notes");
    const registeredWorkspace = { ...workspace, id: "legacy-workspace-id" };
    const settings = {
      ...baseSettings,
      lastWorkspaceId: null,
      workspaces: [registeredWorkspace]
    };

    const result = addOrActivateWorkspace(settings, workspace);

    expect(result.lastWorkspaceId).toBe(registeredWorkspace.id);
    expect(result.workspaces).toEqual([{ ...workspace, id: registeredWorkspace.id }]);
  });

  it("大文字小文字を区別しない環境では大小文字違いの同じワークスペースを重複登録しない", () => {
    const workspace = createWorkspaceSummary("/tmp/Relic-Notes");
    const sameWorkspaceDifferentCase = createWorkspaceSummary("/tmp/relic-notes");
    const firstSettings = addOrActivateWorkspace(
      { ...baseSettings, lastWorkspaceId: null, workspaces: [] },
      workspace
    );
    const nextSettings = addOrActivateWorkspace(firstSettings, sameWorkspaceDifferentCase);

    expect(nextSettings.workspaces).toHaveLength(1);
    expect(nextSettings.lastWorkspaceId).toBe(workspace.id);
    expect(nextSettings.workspaces[0]).toEqual({
      ...sameWorkspaceDifferentCase,
      id: workspace.id
    });
  });

  it("登録済みワークスペースをアクティブに切り替える", () => {
    const firstWorkspace = createWorkspaceSummary("/tmp/relic-notes-1");
    const secondWorkspace = createWorkspaceSummary("/tmp/relic-notes-2");

    const settings = {
      ...baseSettings,
      lastWorkspaceId: firstWorkspace.id,
      workspaces: [firstWorkspace, secondWorkspace]
    };
    const result = activateWorkspace(settings, secondWorkspace.id);

    expect(result).toEqual({
      ok: true,
      value: {
        ...baseSettings,
        lastWorkspaceId: secondWorkspace.id,
        workspaces: [firstWorkspace, secondWorkspace]
      }
    });
  });

  it("未登録ワークスペースへの切り替えを拒否する", () => {
    expect(
      activateWorkspace(
        { ...baseSettings, lastWorkspaceId: null, workspaces: [] },
        "missing"
      ).ok
    ).toBe(false);
  });

  it("登録済みワークスペースを一覧から外し、アクティブなら次の候補へ移る", () => {
    const firstWorkspace = createWorkspaceSummary("/tmp/relic-notes-1");
    const secondWorkspace = createWorkspaceSummary("/tmp/relic-notes-2");
    const settings = {
      ...baseSettings,
      lastWorkspaceId: firstWorkspace.id,
      workspaces: [firstWorkspace, secondWorkspace]
    };

    const result = removeWorkspaceRegistration(settings, firstWorkspace.id);

    expect(result).toEqual({
      ok: true,
      value: {
        ...baseSettings,
        lastWorkspaceId: secondWorkspace.id,
        workspaces: [secondWorkspace]
      }
    });
  });

  it("非アクティブな登録を外しても現在のワークスペースを維持する", () => {
    const firstWorkspace = createWorkspaceSummary("/tmp/relic-notes-1");
    const secondWorkspace = createWorkspaceSummary("/tmp/relic-notes-2");
    const result = removeWorkspaceRegistration(
      {
        ...baseSettings,
        lastWorkspaceId: firstWorkspace.id,
        workspaces: [firstWorkspace, secondWorkspace]
      },
      secondWorkspace.id
    );

    expect(result).toMatchObject({
      ok: true,
      value: { lastWorkspaceId: firstWorkspace.id, workspaces: [firstWorkspace] }
    });
  });

  it("最後のアクティブ登録を外すと未選択状態へ戻す", () => {
    const workspace = createWorkspaceSummary("/tmp/relic-notes");
    const result = removeWorkspaceRegistration(
      { ...baseSettings, lastWorkspaceId: workspace.id, workspaces: [workspace] },
      workspace.id
    );

    expect(result).toMatchObject({
      ok: true,
      value: { lastWorkspaceId: null, workspaces: [] }
    });
  });

  it("未登録ワークスペースの削除を拒否する", () => {
    const result = removeWorkspaceRegistration(
      { ...baseSettings, lastWorkspaceId: null, workspaces: [] },
      "missing"
    );

    expect(result).toMatchObject({
      error: { code: "WORKSPACE_NOT_FOUND" },
      ok: false
    });
  });

  it("登録済みワークスペースのフォルダ名を変更する", async () => {
    const parentPath = await mkdtemp(path.join(os.tmpdir(), "relic-workspace-parent-"));
    temporaryPaths.push(parentPath);
    const workspacePath = path.join(parentPath, "relic-notes");
    await mkdir(workspacePath);
    await prepareWorkspace(workspacePath);
    const workspace = createWorkspaceSummary(workspacePath);
    const settings = {
      ...baseSettings,
      lastWorkspaceId: workspace.id,
      workspaces: [workspace]
    };

    const result = await renameWorkspaceRegistration(settings, workspace.id, "小説メモ");
    const nextWorkspace = createWorkspaceSummary(path.join(parentPath, "小説メモ"));

    expect(result).toEqual({
      ok: true,
      value: {
        nextSettings: {
          ...baseSettings,
          lastWorkspaceId: nextWorkspace.id,
          workspaces: [nextWorkspace]
        },
        newWorkspaceId: nextWorkspace.id,
        oldWorkspaceId: workspace.id
      }
    });
    await expect(stat(path.join(parentPath, "小説メモ"))).resolves.toBeTruthy();
  });

  it("未登録ワークスペースの名前変更を拒否する", async () => {
    const result = await renameWorkspaceRegistration(
      { ...baseSettings, lastWorkspaceId: null, workspaces: [] },
      "missing",
      "Renamed"
    );

    expect(result).toMatchObject({
      error: { code: "WORKSPACE_NOT_FOUND" },
      ok: false
    });
  });

  it("同じ名前への変更ではファイル操作も設定変更も行わない", async () => {
    const workspace = createWorkspaceSummary("/tmp/relic-notes");
    const settings = {
      ...baseSettings,
      lastWorkspaceId: workspace.id,
      workspaces: [workspace]
    };

    const result = await renameWorkspaceRegistration(
      settings,
      workspace.id,
      workspace.name
    );

    expect(result).toEqual({
      ok: true,
      value: {
        newWorkspaceId: workspace.id,
        nextSettings: settings,
        oldWorkspaceId: workspace.id
      }
    });
  });

  it("登録先がフォルダでない場合は名前変更を拒否する", async () => {
    const parentPath = await mkdtemp(path.join(os.tmpdir(), "relic-workspace-parent-"));
    temporaryPaths.push(parentPath);
    const workspacePath = path.join(parentPath, "relic-notes");
    await writeFile(workspacePath, "not a directory", "utf8");
    const workspace = createWorkspaceSummary(workspacePath);

    const result = await renameWorkspaceRegistration(
      { ...baseSettings, lastWorkspaceId: workspace.id, workspaces: [workspace] },
      workspace.id,
      "Renamed"
    );

    expect(result).toMatchObject({
      error: { code: "WORKSPACE_RENAME_NOT_DIRECTORY" },
      ok: false
    });
  });

  it("変更先と同名の別フォルダがある場合は上書きしない", async () => {
    const parentPath = await mkdtemp(path.join(os.tmpdir(), "relic-workspace-parent-"));
    temporaryPaths.push(parentPath);
    const workspacePath = path.join(parentPath, "relic-notes");
    await mkdir(workspacePath);
    await mkdir(path.join(parentPath, "Renamed"));
    const workspace = createWorkspaceSummary(workspacePath);

    const result = await renameWorkspaceRegistration(
      { ...baseSettings, lastWorkspaceId: workspace.id, workspaces: [workspace] },
      workspace.id,
      "Renamed"
    );

    expect(result).toMatchObject({
      error: { code: "WORKSPACE_ALREADY_EXISTS" },
      ok: false
    });
    await expect(stat(workspacePath)).resolves.toBeTruthy();
  });

  it("非アクティブなワークスペースの名前変更では現在の選択を維持する", async () => {
    const parentPath = await mkdtemp(path.join(os.tmpdir(), "relic-workspace-parent-"));
    temporaryPaths.push(parentPath);
    const activePath = path.join(parentPath, "active");
    const renamedPath = path.join(parentPath, "rename-me");
    await mkdir(activePath);
    await mkdir(renamedPath);
    const activeWorkspace = createWorkspaceSummary(activePath);
    const workspace = createWorkspaceSummary(renamedPath);

    const result = await renameWorkspaceRegistration(
      {
        ...baseSettings,
        lastWorkspaceId: activeWorkspace.id,
        workspaces: [activeWorkspace, workspace]
      },
      workspace.id,
      "Renamed"
    );

    expect(result).toMatchObject({
      ok: true,
      value: {
        nextSettings: {
          lastWorkspaceId: activeWorkspace.id,
          workspaces: [activeWorkspace, expect.objectContaining({ name: "Renamed" })]
        }
      }
    });
  });

  it("登録フォルダが失われている場合は名前変更失敗を返す", async () => {
    const parentPath = await mkdtemp(path.join(os.tmpdir(), "relic-workspace-parent-"));
    temporaryPaths.push(parentPath);
    const workspace = createWorkspaceSummary(path.join(parentPath, "missing"));

    const result = await renameWorkspaceRegistration(
      { ...baseSettings, lastWorkspaceId: workspace.id, workspaces: [workspace] },
      workspace.id,
      "Renamed"
    );

    expect(result).toMatchObject({
      error: { code: "WORKSPACE_RENAME_FAILED" },
      ok: false
    });
  });

  it("登録済みワークスペースの大文字小文字だけの名前変更を許可する", async () => {
    const parentPath = await mkdtemp(path.join(os.tmpdir(), "relic-workspace-parent-"));
    temporaryPaths.push(parentPath);
    const workspacePath = path.join(parentPath, "Relic Notes");
    await mkdir(workspacePath);
    await prepareWorkspace(workspacePath);
    const workspace = createWorkspaceSummary(workspacePath);
    const settings = {
      ...baseSettings,
      lastWorkspaceId: workspace.id,
      workspaces: [workspace]
    };

    const result = await renameWorkspaceRegistration(settings, workspace.id, "relic notes");
    const nextWorkspace = createWorkspaceSummary(path.join(parentPath, "relic notes"));

    expect(result).toEqual({
      ok: true,
      value: {
        nextSettings: {
          ...baseSettings,
          lastWorkspaceId: nextWorkspace.id,
          workspaces: [nextWorkspace]
        },
        newWorkspaceId: nextWorkspace.id,
        oldWorkspaceId: workspace.id
      }
    });
  });

  it("一時フォルダ名が既存でも大文字小文字だけのワークスペース名変更を続行する", async () => {
    const parentPath = await mkdtemp(path.join(os.tmpdir(), "relic-workspace-parent-"));
    temporaryPaths.push(parentPath);
    const workspacePath = path.join(parentPath, "Relic Notes");
    await mkdir(workspacePath);
    await prepareWorkspace(workspacePath);
    const workspace = createWorkspaceSummary(workspacePath);
    const nextWorkspace = createWorkspaceSummary(path.join(parentPath, "relic notes"));
    const settings = {
      ...baseSettings,
      lastWorkspaceId: workspace.id,
      workspaces: [workspace]
    };
    vi.spyOn(Date, "now").mockReturnValue(12345);
    await mkdir(path.join(parentPath, `.relic-rename-${nextWorkspace.id}-12345`));

    const result = await renameWorkspaceRegistration(settings, workspace.id, "relic notes");

    expect(result).toEqual({
      ok: true,
      value: {
        nextSettings: {
          ...baseSettings,
          lastWorkspaceId: nextWorkspace.id,
          workspaces: [nextWorkspace]
        },
        newWorkspaceId: nextWorkspace.id,
        oldWorkspaceId: workspace.id
      }
    });
    await expect(stat(nextWorkspace.path)).resolves.toBeTruthy();
  });

  it("ワークスペース名変更用の一時フォルダ名候補が上限まで埋まっている場合は停止する", async () => {
    const parentPath = await mkdtemp(path.join(os.tmpdir(), "relic-workspace-parent-"));
    temporaryPaths.push(parentPath);
    vi.spyOn(Date, "now").mockReturnValue(12345);

    await mkdir(path.join(parentPath, ".relic-rename-workspace-id-12345"));
    await mkdir(path.join(parentPath, ".relic-rename-workspace-id-12345-1"));

    await expect(findAvailableRenameTemporaryPath(parentPath, "workspace-id", 2)).resolves.toMatchObject({
      error: { code: "WORKSPACE_RENAME_TEMPORARY_PATH_EXHAUSTED" },
      ok: false
    });
  });

  it("空のワークスペース名は拒否する", async () => {
    const workspace = createWorkspaceSummary("/tmp/relic-notes");
    const result = await renameWorkspaceRegistration(
      { ...baseSettings, lastWorkspaceId: workspace.id, workspaces: [workspace] },
      workspace.id,
      "  "
    );

    expect(result.ok).toBe(false);
  });

  it("可搬性を損なう予約名のワークスペース名は拒否する", async () => {
    const workspace = createWorkspaceSummary("/tmp/relic-notes");
    const result = await renameWorkspaceRegistration(
      { ...baseSettings, lastWorkspaceId: workspace.id, workspaces: [workspace] },
      workspace.id,
      "CON"
    );

    expect(result).toMatchObject({
      error: { code: "FILE_NAME_INVALID" },
      ok: false
    });
  });
});
