import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { defaultAutoSyncSettings, defaultEditorSettings } from "../../shared/ipc";
import { attachmentsDirectoryName, templatesDirectoryName } from "../../shared/workspace";
import {
  addOrActivateWorkspace,
  activateWorkspace,
  createWorkspaceSummary,
  prepareWorkspace,
  toWorkspaceState
} from "./workspaceService";

const baseSettings = { autoSync: defaultAutoSyncSettings, editorSettings: defaultEditorSettings };

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

  it("ワークスペース準備時に必須フォルダを作成する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-workspace-"));
    temporaryPaths.push(workspacePath);

    await prepareWorkspace(workspacePath);

    expect((await stat(path.join(workspacePath, attachmentsDirectoryName))).isDirectory()).toBe(
      true
    );
    expect((await stat(path.join(workspacePath, templatesDirectoryName))).isDirectory()).toBe(true);
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
});
