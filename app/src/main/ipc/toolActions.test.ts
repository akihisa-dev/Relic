import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const electronMock = vi.hoisted(() => ({
  getPath: vi.fn()
}));

vi.mock("electron", () => ({
  app: { getPath: electronMock.getPath }
}));

import {
  defaultEditorSettings,
  defaultFeatureToggles,
  defaultFrontmatterTemplates,
  defaultUserDefinedFields
} from "../../shared/ipc";
import { writeAppSettings } from "../settings/appSettings";
import { addOrActivateWorkspace, createWorkspaceSummary } from "../workspace/workspaceService";
import { generateTableOfContents, generateTitleList, splitFileByHeading } from "./toolActions";

describe("toolActions", () => {
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

  it("タイトル一覧生成後に一時ファイルを残さない", async () => {
    const { workspacePath } = await prepareActiveWorkspace();
    await writeFile(path.join(workspacePath, "note.md"), "# Note\n", "utf8");

    const result = await generateTitleList({
      outputFolder: ".",
      outputName: "Titles",
      sortBy: "name"
    });

    expect(result).toEqual({ ok: true, value: "Titles.md" });
    await expect(readFile(path.join(workspacePath, "Titles.md"), "utf8")).resolves.toBe("- [[note]]\n");
    expect((await readdir(workspacePath)).sort()).toEqual(["Titles.md", "note.md"]);
  });

  it("出力先フォルダが外部実体のシンボリックリンクなら書き込まない", async () => {
    const { outsidePath, workspacePath } = await prepareActiveWorkspace();
    await writeFile(path.join(workspacePath, "note.md"), "# Note\n", "utf8");
    await symlink(outsidePath, path.join(workspacePath, "linked-out"), "dir");

    const result = await generateTitleList({
      outputFolder: "linked-out",
      outputName: "Titles",
      sortBy: "name"
    });

    expect(result).toMatchObject({
      error: { code: "WORKSPACE_PATH_OUTSIDE" },
      ok: false
    });
    await expect(readFile(path.join(outsidePath, "Titles.md"), "utf8")).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("目次生成の対象フォルダが外部実体のシンボリックリンクなら読み込まない", async () => {
    const { outsidePath, workspacePath } = await prepareActiveWorkspace();
    await writeFile(path.join(outsidePath, "external.md"), "# External\n", "utf8");
    await symlink(outsidePath, path.join(workspacePath, "linked-out"), "dir");

    const result = await generateTableOfContents({
      includeSubfolders: true,
      outputFolder: ".",
      outputName: "Toc",
      targetFolder: "linked-out"
    });

    expect(result).toMatchObject({
      error: { code: "WORKSPACE_PATH_OUTSIDE" },
      ok: false
    });
    await expect(readFile(path.join(workspacePath, "Toc.md"), "utf8")).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("分割元ファイルが外部実体のシンボリックリンクなら読み込まない", async () => {
    const { outsidePath, workspacePath } = await prepareActiveWorkspace();
    await writeFile(path.join(outsidePath, "external.md"), "## A\n外部\n", "utf8");
    await symlink(path.join(outsidePath, "external.md"), path.join(workspacePath, "external.md"));

    const result = await splitFileByHeading({
      headingLevel: 2,
      outputFolder: ".",
      sourcePath: "external.md"
    });

    expect(result).toMatchObject({
      error: { code: "WORKSPACE_PATH_OUTSIDE" },
      ok: false
    });
    await expect(readFile(path.join(workspacePath, "A.md"), "utf8")).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  async function prepareActiveWorkspace(): Promise<{
    outsidePath: string;
    workspacePath: string;
  }> {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-tools-user-data-"));
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-tools-workspace-"));
    const outsidePath = await mkdtemp(path.join(os.tmpdir(), "relic-tools-outside-"));
    temporaryPaths.push(userDataPath, workspacePath, outsidePath);
    await mkdir(workspacePath, { recursive: true });

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

    return { outsidePath, workspacePath };
  }
});
