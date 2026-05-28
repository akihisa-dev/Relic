import { mkdir, mkdtemp, readdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
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
import { generateTableOfContents, generateTitleList, mergeFiles, splitFileByHeading } from "./toolActions";

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

  it("ファイル情報を取得できないMarkdownファイルはスキップしてタイトル一覧生成を続行する", async () => {
    const { workspacePath } = await prepareActiveWorkspace();
    await writeFile(path.join(workspacePath, "blocked.md"), "# Blocked\n", "utf8");
    await writeFile(path.join(workspacePath, "visible.md"), "# Visible\n", "utf8");

    const result = await generateTitleList(
      {
        outputFolder: ".",
        outputName: "Titles",
        sortBy: "name"
      },
      {
        async stat(filePath) {
          if (path.basename(filePath) === "blocked.md") {
            throw Object.assign(new Error("Permission denied"), { code: "EACCES" });
          }

          return stat(filePath);
        }
      }
    );

    expect(result).toEqual({ ok: true, value: "Titles.md" });
    await expect(readFile(path.join(workspacePath, "Titles.md"), "utf8")).resolves.toBe("- [[visible]]\n");
  });

  it("ファイル情報を取得できないMarkdownファイルはスキップして結合を続行する", async () => {
    const { workspacePath } = await prepareActiveWorkspace();
    await writeFile(path.join(workspacePath, "blocked.md"), "blocked", "utf8");
    await writeFile(path.join(workspacePath, "visible.md"), "visible", "utf8");

    const result = await mergeFiles(
      {
        filterType: "all",
        filterValue: "",
        insertFilenameHeading: false,
        outputFolder: ".",
        outputName: "Merged",
        sortBy: "name"
      },
      {
        async stat(filePath) {
          if (path.basename(filePath) === "blocked.md") {
            throw Object.assign(new Error("Permission denied"), { code: "EACCES" });
          }

          return stat(filePath);
        }
      }
    );

    expect(result).toEqual({ ok: true, value: "Merged.md" });
    await expect(readFile(path.join(workspacePath, "Merged.md"), "utf8")).resolves.toBe("visible\n");
  });

  it("タグ絞り込み中に読めないMarkdownファイルはスキップして結合を続行する", async () => {
    const { workspacePath } = await prepareActiveWorkspace();
    await writeFile(path.join(workspacePath, "blocked.md"), "---\ntags: [keep]\n---\nblocked", "utf8");
    await writeFile(path.join(workspacePath, "visible.md"), "---\ntags: [keep]\n---\nvisible", "utf8");

    const result = await mergeFiles(
      {
        filterType: "tag",
        filterValue: "keep",
        insertFilenameHeading: false,
        outputFolder: ".",
        outputName: "Merged",
        sortBy: "name"
      },
      {
        async readFile(filePath, encoding) {
          if (path.basename(filePath) === "blocked.md") {
            throw Object.assign(new Error("Permission denied"), { code: "EACCES" });
          }

          return readFile(filePath, encoding);
        }
      }
    );

    expect(result).toEqual({ ok: true, value: "Merged.md" });
    await expect(readFile(path.join(workspacePath, "Merged.md"), "utf8")).resolves.toBe(
      "---\ntags: [keep]\n---\nvisible\n"
    );
  });

  it("フロントマター絞り込み中に読めないMarkdownファイルはスキップして結合を続行する", async () => {
    const { workspacePath } = await prepareActiveWorkspace();
    await writeFile(path.join(workspacePath, "blocked.md"), "---\nstatus: keep\n---\nblocked", "utf8");
    await writeFile(path.join(workspacePath, "visible.md"), "---\nstatus: keep\n---\nvisible", "utf8");

    const result = await mergeFiles(
      {
        filterType: "frontmatter",
        filterValue: "keep",
        frontmatterField: "status",
        insertFilenameHeading: false,
        outputFolder: ".",
        outputName: "Merged",
        sortBy: "name"
      },
      {
        async readFile(filePath, encoding) {
          if (path.basename(filePath) === "blocked.md") {
            throw Object.assign(new Error("Permission denied"), { code: "EACCES" });
          }

          return readFile(filePath, encoding);
        }
      }
    );

    expect(result).toEqual({ ok: true, value: "Merged.md" });
    await expect(readFile(path.join(workspacePath, "Merged.md"), "utf8")).resolves.toBe(
      "---\nstatus: keep\n---\nvisible\n"
    );
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
