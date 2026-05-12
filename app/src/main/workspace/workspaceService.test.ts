import { mkdir, mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { defaultEditorSettings, defaultFeatureToggles, defaultFrontmatterTemplates, defaultGitHubIntegrationSettings, defaultUserDefinedFields } from "../../shared/ipc";
import {
  addOrActivateWorkspace,
  activateWorkspace,
  createWorkspaceSummary,
  prepareWorkspace,
  renameWorkspaceRegistration,
  removeWorkspaceRegistration,
  toWorkspaceState
} from "./workspaceService";

const baseSettings = {
  editorSettings: defaultEditorSettings,
  featureToggles: defaultFeatureToggles,
  frontmatterTemplates: defaultFrontmatterTemplates,
  githubIntegration: defaultGitHubIntegrationSettings,
  userDefinedFields: defaultUserDefinedFields
};

describe("workspaceService", () => {
  const temporaryPaths: string[] = [];

  afterEach(async () => {
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

  it("空のワークスペース名は拒否する", async () => {
    const workspace = createWorkspaceSummary("/tmp/relic-notes");
    const result = await renameWorkspaceRegistration(
      { ...baseSettings, lastWorkspaceId: workspace.id, workspaces: [workspace] },
      workspace.id,
      "  "
    );

    expect(result.ok).toBe(false);
  });
});
