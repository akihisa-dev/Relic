import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { attachmentsDirectoryName, templatesDirectoryName } from "../../shared/workspace";
import {
  addOrActivateWorkspace,
  createWorkspaceSummary,
  prepareWorkspace,
  toWorkspaceState
} from "./workspaceService";

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
      {
        lastWorkspaceId: null,
        workspaces: []
      },
      workspace
    );
    const nextSettings = addOrActivateWorkspace(firstSettings, workspace);

    expect(nextSettings.workspaces).toHaveLength(1);
    expect(toWorkspaceState(nextSettings).activeWorkspace).toEqual(workspace);
  });
});
