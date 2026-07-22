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
import { createTranslator } from "../../shared/i18n";
import { resolveWikiLinks } from "../../shared/links";
import { writeAppSettings } from "../settings/appSettings";
import { addOrActivateWorkspace, createWorkspaceSummary } from "../workspace/workspaceService";
import {
  generateTagIndex,
  generateTableOfContents,
  generateTitleList,
  mergeFiles
} from "./toolActions";
import { uniqueFilePath, writeUniqueToolOutputFile } from "./toolOutputFiles";

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

  it("明示的なワークスペース対象で4機能を実行し入力Markdownを変更しない", async () => {
    const source = "---\ntags: [project]\n---\n# Note\n";

    const titleWorkspace = await prepareActiveWorkspace();
    await writeFile(path.join(titleWorkspace.workspacePath, "note.md"), source, "utf8");
    await expect(generateTitleList({
      outputFolder: "",
      outputName: "Titles",
      sortBy: "name",
      target: { kind: "workspace" }
    })).resolves.toMatchObject({ ok: true, value: "Titles.md" });
    await expect(readFile(path.join(titleWorkspace.workspacePath, "note.md"), "utf8")).resolves.toBe(source);

    const tocWorkspace = await prepareActiveWorkspace();
    await writeFile(path.join(tocWorkspace.workspacePath, "note.md"), source, "utf8");
    await expect(generateTableOfContents({
      outputFolder: "",
      outputName: "Toc",
      target: { kind: "workspace" },
    })).resolves.toMatchObject({ ok: true, value: "Toc.md" });
    await expect(readFile(path.join(tocWorkspace.workspacePath, "note.md"), "utf8")).resolves.toBe(source);

    const tagWorkspace = await prepareActiveWorkspace();
    await writeFile(path.join(tagWorkspace.workspacePath, "note.md"), source, "utf8");
    await expect(generateTagIndex({
      includeUntagged: false,
      outputFolder: "",
      outputName: "Tags",
      sortBy: "name",
      target: { kind: "workspace" },
    })).resolves.toMatchObject({ ok: true, value: "Tags.md" });
    await expect(readFile(path.join(tagWorkspace.workspacePath, "note.md"), "utf8")).resolves.toBe(source);

    const mergeWorkspace = await prepareActiveWorkspace();
    await writeFile(path.join(mergeWorkspace.workspacePath, "note.md"), source, "utf8");
    await expect(mergeFiles({
      filterType: "all",
      filterValue: "",
      insertFilenameHeading: false,
      outputFolder: "",
      outputName: "Merged",
      sortBy: "name",
      target: { kind: "workspace" }
    })).resolves.toMatchObject({ ok: true, value: "Merged.md" });
    await expect(readFile(path.join(mergeWorkspace.workspacePath, "note.md"), "utf8")).resolves.toBe(source);
  });

  it("明示された複数Markdownだけからタイトル一覧を生成する", async () => {
    const { workspacePath } = await prepareActiveWorkspace();
    await mkdir(path.join(workspacePath, "notes"));
    await writeFile(path.join(workspacePath, "notes", "a.md"), "A", "utf8");
    await writeFile(path.join(workspacePath, "notes", "b.md"), "B", "utf8");
    await writeFile(path.join(workspacePath, "other.md"), "Other", "utf8");

    const result = await generateTitleList({
      outputFolder: "",
      outputName: "Titles",
      sortBy: "name",
      target: { kind: "files", paths: ["notes/a.md", "notes/b.md"] }
    });

    expect(result).toEqual({ ok: true, value: "Titles.md" });
    await expect(readFile(path.join(workspacePath, "Titles.md"), "utf8")).resolves.toBe("- [[a]]\n- [[b]]\n");
    await expect(readFile(path.join(workspacePath, "notes", "a.md"), "utf8")).resolves.toBe("A");
    await expect(readFile(path.join(workspacePath, "notes", "b.md"), "utf8")).resolves.toBe("B");
  });

  it("フォルダ対象では子フォルダ以下だけをマージする", async () => {
    const { workspacePath } = await prepareActiveWorkspace();
    await mkdir(path.join(workspacePath, "notes", "child"), { recursive: true });
    await writeFile(path.join(workspacePath, "notes", "a.md"), "A", "utf8");
    await writeFile(path.join(workspacePath, "notes", "child", "b.md"), "B", "utf8");
    await writeFile(path.join(workspacePath, "other.md"), "Other", "utf8");

    const result = await mergeFiles({
      filterType: "all",
      filterValue: "",
      insertFilenameHeading: false,
      outputFolder: "",
      outputName: "Merged",
      sortBy: "name",
      target: { kind: "folder", path: "notes" }
    });

    expect(result).toEqual({ ok: true, value: "Merged.md" });
    await expect(readFile(path.join(workspacePath, "Merged.md"), "utf8")).resolves.toBe("A\n\n---\n\nB\n");
  });

  it("フォルダ対象の目次は対象フォルダ自身を重ねず配下の階層を出力する", async () => {
    const { workspacePath } = await prepareActiveWorkspace();
    await mkdir(path.join(workspacePath, "notes", "child"), { recursive: true });
    await writeFile(path.join(workspacePath, "notes", "a.md"), "A", "utf8");
    await writeFile(path.join(workspacePath, "notes", "child", "b.md"), "B", "utf8");

    const result = await generateTableOfContents({
      outputFolder: "",
      outputName: "Toc",
      target: { kind: "folder", path: "notes" },
    });

    expect(result).toEqual({ ok: true, value: "Toc.md" });
    await expect(readFile(path.join(workspacePath, "Toc.md"), "utf8")).resolves.toBe(
      "- **child/**\n  - [[b]]\n- [[a]]\n"
    );
  });

  it("明示された複数Markdownだけからタグ別索引を生成する", async () => {
    const { workspacePath } = await prepareActiveWorkspace();
    await writeFile(path.join(workspacePath, "a.md"), "---\ntags: [selected]\n---\n", "utf8");
    await writeFile(path.join(workspacePath, "b.md"), "---\ntags: [selected]\n---\n", "utf8");
    await writeFile(path.join(workspacePath, "other.md"), "---\ntags: [other]\n---\n", "utf8");

    const result = await generateTagIndex({
      includeUntagged: false,
      outputFolder: "",
      outputName: "Tags",
      sortBy: "name",
      target: { kind: "files", paths: ["a.md", "b.md"] },
    });

    expect(result).toEqual({ ok: true, value: "Tags.md" });
    await expect(readFile(path.join(workspacePath, "Tags.md"), "utf8")).resolves.toBe(
      "# タグ別索引\n\n## selected\n- [[a]]\n- [[b]]\n"
    );
  });

  it("空の対象では出力ファイルを作成しない", async () => {
    const { workspacePath } = await prepareActiveWorkspace();
    await mkdir(path.join(workspacePath, "empty"));

    const result = await generateTagIndex({
      includeUntagged: false,
      outputFolder: "",
      outputName: "Tags",
      sortBy: "name",
      target: { kind: "folder", path: "empty" },
    });

    expect(result).toMatchObject({ error: { code: "TOOL_TARGET_EMPTY" }, ok: false });
    await expect(readFile(path.join(workspacePath, "Tags.md"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("タイトル一覧生成後に一時ファイルを残さない", async () => {
    const { workspacePath } = await prepareActiveWorkspace();
    await writeFile(path.join(workspacePath, "note.md"), "# Note\n", "utf8");

    const result = await generateTitleList({
      outputFolder: ".",
      outputName: "Titles",
      sortBy: "name",
      target: { kind: "workspace" }
    });

    expect(result).toEqual({ ok: true, value: "Titles.md" });
    await expect(readFile(path.join(workspacePath, "Titles.md"), "utf8")).resolves.toBe("- [[note]]\n");
    expect((await readdir(workspacePath)).sort()).toEqual(["Titles.md", "note.md"]);
  });

  it("出力名に.mdが含まれていてもMarkdownファイルとして保存する", async () => {
    const { workspacePath } = await prepareActiveWorkspace();
    await writeFile(path.join(workspacePath, "note.md"), "# Note\n", "utf8");

    const result = await generateTitleList({
      outputFolder: ".",
      outputName: "Titles.md",
      sortBy: "name",
      target: { kind: "workspace" }
    });

    expect(result).toEqual({ ok: true, value: "Titles.md" });
    await expect(readFile(path.join(workspacePath, "Titles.md"), "utf8")).resolves.toBe("- [[note]]\n");
  });

  it("出力ファイル名候補が上限まで埋まっている場合は停止する", async () => {
    const { workspacePath } = await prepareActiveWorkspace();
    await writeFile(path.join(workspacePath, "Report.md"), "existing", "utf8");
    await writeFile(path.join(workspacePath, "Report-1.md"), "existing 1", "utf8");

    await expect(uniqueFilePath(workspacePath, "Report", 2)).resolves.toMatchObject({
      error: { code: "TOOL_OUTPUT_NAME_EXHAUSTED" },
      ok: false
    });
  });

  it("出力ファイル作成直前に同名ファイルができた場合は次候補へ進む", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-tool-output-race-"));
    temporaryPaths.push(workspacePath);
    const attempts: string[] = [];

    const result = await writeUniqueToolOutputFile(
      workspacePath,
      "Report",
      "content",
      3,
      async (filePath, content) => {
        attempts.push(path.basename(filePath));
        if (attempts.length === 1) {
          throw Object.assign(new Error("exists"), { code: "EEXIST" });
        }

        await writeFile(filePath, content, "utf8");
      }
    );

    expect(result).toEqual({
      ok: true,
      value: path.join(workspacePath, "Report-1.md")
    });
    expect(attempts).toEqual(["Report.md", "Report-1.md"]);
    await expect(readFile(path.join(workspacePath, "Report-1.md"), "utf8")).resolves.toBe("content");
  });

  it("出力先に同名ファイルがある場合は上書きせず採番する", async () => {
    const { workspacePath } = await prepareActiveWorkspace();
    await writeFile(path.join(workspacePath, "note.md"), "# Note\n", "utf8");
    await writeFile(path.join(workspacePath, "Titles.md"), "existing", "utf8");

    const result = await generateTitleList({
      outputFolder: ".",
      outputName: "Titles",
      sortBy: "name",
      target: { kind: "workspace" }
    });

    expect(result).toEqual({ ok: true, value: "Titles-1.md" });
    await expect(readFile(path.join(workspacePath, "Titles.md"), "utf8")).resolves.toBe("existing");
    await expect(readFile(path.join(workspacePath, "Titles-1.md"), "utf8")).resolves.toBe(
      "- [[note]]\n- [[Titles]]\n"
    );
  });

  it("制御文字やOSで危険な記号を含む出力名は拒否する", async () => {
    const { workspacePath } = await prepareActiveWorkspace();
    await writeFile(path.join(workspacePath, "note.md"), "# Note\n", "utf8");

    await expect(generateTitleList({
      outputFolder: ".",
      outputName: "Bad\u0000Name",
      sortBy: "name",
      target: { kind: "workspace" }
    })).resolves.toMatchObject({
      error: { code: "TOOL_OUTPUT_NAME_INVALID" },
      ok: false
    });
    await expect(generateTitleList({
      outputFolder: ".",
      outputName: "Bad:Name",
      sortBy: "name",
      target: { kind: "workspace" }
    })).resolves.toMatchObject({
      error: { code: "TOOL_OUTPUT_NAME_INVALID" },
      ok: false
    });
    await expect(readFile(path.join(workspacePath, "Bad:Name.md"), "utf8")).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("ファイル情報を取得できないMarkdownファイルはスキップしてタイトル一覧生成を続行する", async () => {
    const { workspacePath } = await prepareActiveWorkspace();
    await writeFile(path.join(workspacePath, "blocked.md"), "# Blocked\n", "utf8");
    await writeFile(path.join(workspacePath, "visible.md"), "# Visible\n", "utf8");

    const result = await generateTitleList(
      {
        outputFolder: ".",
        outputName: "Titles",
        sortBy: "name",
        target: { kind: "workspace" }
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

  it("タイトル一覧は出力先フォルダからではなく既存ファイルへのリンクを生成する", async () => {
    const { workspacePath } = await prepareActiveWorkspace();
    await mkdir(path.join(workspacePath, "notes"));
    await writeFile(path.join(workspacePath, "root.md"), "# Root\n", "utf8");
    await writeFile(path.join(workspacePath, "notes", "child.md"), "# Child\n", "utf8");

    const result = await generateTitleList({
      outputFolder: "indexes",
      outputName: "Titles",
      sortBy: "name",
      target: { kind: "workspace" }
    });

    expect(result).toEqual({ ok: true, value: "indexes/Titles.md" });
    const content = await readFile(path.join(workspacePath, "indexes", "Titles.md"), "utf8");
    expect(content).toBe("- [[child]]\n- [[root]]\n");
    expect(resolveWikiLinks(content, "indexes/Titles.md", ["notes/child.md", "root.md"])).toEqual([
      expect.objectContaining({ exists: true, path: "notes/child.md" }),
      expect.objectContaining({ exists: true, path: "root.md" })
    ]);
  });

  it("タイトル一覧は同名Markdownが複数ある場合だけパス付きリンクを生成する", async () => {
    const { workspacePath } = await prepareActiveWorkspace();
    await mkdir(path.join(workspacePath, "archive"));
    await mkdir(path.join(workspacePath, "notes"));
    await writeFile(path.join(workspacePath, "archive", "child.md"), "# Archive\n", "utf8");
    await writeFile(path.join(workspacePath, "notes", "child.md"), "# Child\n", "utf8");
    await writeFile(path.join(workspacePath, "root.md"), "# Root\n", "utf8");

    const result = await generateTitleList({
      outputFolder: "indexes",
      outputName: "Titles",
      sortBy: "name",
      target: { kind: "workspace" }
    });

    expect(result).toEqual({ ok: true, value: "indexes/Titles.md" });
    const content = await readFile(path.join(workspacePath, "indexes", "Titles.md"), "utf8");
    expect(content).toContain("- [[./archive/child|child]]\n");
    expect(content).toContain("- [[./notes/child|child]]\n");
    expect(content).toContain("- [[root]]\n");
    expect(resolveWikiLinks(content, "indexes/Titles.md", ["archive/child.md", "notes/child.md", "root.md"])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ exists: true, path: "archive/child.md" }),
        expect.objectContaining({ exists: true, path: "notes/child.md" }),
        expect.objectContaining({ exists: true, path: "root.md" })
      ])
    );
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
        sortBy: "name",
        target: { kind: "workspace" }
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
        sortBy: "name",
        target: { kind: "workspace" }
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

  it("結合処理は元の候補順を保ったまま出力する", async () => {
    const { workspacePath } = await prepareActiveWorkspace();
    await writeFile(path.join(workspacePath, "a.md"), "A\n", "utf8");
    await writeFile(path.join(workspacePath, "b.md"), "B\n", "utf8");

    const result = await mergeFiles(
      {
        filterType: "all",
        filterValue: "",
        insertFilenameHeading: false,
        outputFolder: ".",
        outputName: "Merged",
        sortBy: "name",
        target: { kind: "workspace" }
      },
      {
        async readFile(filePath, encoding) {
          if (path.basename(filePath) === "a.md") {
            await new Promise((resolve) => setTimeout(resolve, 30));
          }

          return readFile(filePath, encoding);
        }
      }
    );

    expect(result).toEqual({ ok: true, value: "Merged.md" });
    await expect(readFile(path.join(workspacePath, "Merged.md"), "utf8")).resolves.toBe("A\n\n---\n\nB\n");
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
        sortBy: "name",
        target: { kind: "workspace" }
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

  it("フォルダ絞り込みの結合は同じ接頭辞の別フォルダを含めない", async () => {
    const { workspacePath } = await prepareActiveWorkspace();
    await mkdir(path.join(workspacePath, "notes"));
    await mkdir(path.join(workspacePath, "notes-old"));
    await writeFile(path.join(workspacePath, "notes", "keep.md"), "keep", "utf8");
    await writeFile(path.join(workspacePath, "notes-old", "skip.md"), "skip", "utf8");

    const result = await mergeFiles({
      filterType: "folder",
      filterValue: "notes",
      insertFilenameHeading: false,
      outputFolder: ".",
      outputName: "Merged",
      sortBy: "name",
      target: { kind: "workspace" }
    });

    expect(result).toEqual({ ok: true, value: "Merged.md" });
    await expect(readFile(path.join(workspacePath, "Merged.md"), "utf8")).resolves.toBe("keep\n");
  });

  it("結合ファイルの挿入見出しはファイル名由来の危険なMarkdown構造を避ける", async () => {
    const { workspacePath } = await prepareActiveWorkspace();
    await writeFile(path.join(workspacePath, "### Bad.md"), "content", "utf8");
    await writeFile(path.join(workspacePath, "---.md"), "rule", "utf8");

    const result = await mergeFiles({
      filterType: "all",
      filterValue: "",
      insertFilenameHeading: true,
      outputFolder: ".",
      outputName: "Merged",
      sortBy: "name",
      target: { kind: "workspace" }
    });

    expect(result).toEqual({ ok: true, value: "Merged.md" });
    await expect(readFile(path.join(workspacePath, "Merged.md"), "utf8")).resolves.toBe(
      "# 無題\n\nrule\n\n---\n\n# Bad\n\ncontent\n"
    );
  });

  it("出力先フォルダが外部実体のシンボリックリンクなら書き込まない", async () => {
    const { outsidePath, workspacePath } = await prepareActiveWorkspace();
    await writeFile(path.join(workspacePath, "note.md"), "# Note\n", "utf8");
    await symlink(outsidePath, path.join(workspacePath, "linked-out"), "dir");

    const result = await generateTitleList({
      outputFolder: "linked-out",
      outputName: "Titles",
      sortBy: "name",
      target: { kind: "workspace" }
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
      outputFolder: ".",
      outputName: "Toc",
      target: { kind: "folder", path: "linked-out" }
    });

    expect(result).toMatchObject({
      error: { code: "WORKSPACE_PATH_OUTSIDE" },
      ok: false
    });
    await expect(readFile(path.join(workspacePath, "Toc.md"), "utf8")).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("目次生成はサブフォルダ内の既存ファイルへのリンクを生成する", async () => {
    const { workspacePath } = await prepareActiveWorkspace();
    await mkdir(path.join(workspacePath, "notes"));
    await writeFile(path.join(workspacePath, "root.md"), "# Root\n", "utf8");
    await writeFile(path.join(workspacePath, "notes", "child.md"), "# Child\n", "utf8");

    const result = await generateTableOfContents({
      outputFolder: "indexes",
      outputName: "Toc",
      target: { kind: "workspace" }
    });

    expect(result).toEqual({ ok: true, value: "indexes/Toc.md" });
    const content = await readFile(path.join(workspacePath, "indexes", "Toc.md"), "utf8");
    expect(content).toBe("- **notes/**\n  - [[child]]\n- [[root]]\n");
    expect(resolveWikiLinks(content, "indexes/Toc.md", ["notes/child.md", "root.md"])).toEqual([
      expect.objectContaining({ exists: true, path: "notes/child.md" }),
      expect.objectContaining({ exists: true, path: "root.md" })
    ]);
  });

  it("目次生成は同名Markdownが複数ある場合だけパス付きリンクを生成する", async () => {
    const { workspacePath } = await prepareActiveWorkspace();
    await mkdir(path.join(workspacePath, "archive"));
    await mkdir(path.join(workspacePath, "notes"));
    await writeFile(path.join(workspacePath, "archive", "child.md"), "# Archive\n", "utf8");
    await writeFile(path.join(workspacePath, "notes", "child.md"), "# Child\n", "utf8");
    await writeFile(path.join(workspacePath, "root.md"), "# Root\n", "utf8");

    const result = await generateTableOfContents({
      outputFolder: "indexes",
      outputName: "Toc",
      target: { kind: "workspace" }
    });

    expect(result).toEqual({ ok: true, value: "indexes/Toc.md" });
    const content = await readFile(path.join(workspacePath, "indexes", "Toc.md"), "utf8");
    expect(content).toBe("- **archive/**\n  - [[./archive/child|child]]\n- **notes/**\n  - [[./notes/child|child]]\n- [[root]]\n");
    expect(resolveWikiLinks(content, "indexes/Toc.md", ["archive/child.md", "notes/child.md", "root.md"])).toEqual([
      expect.objectContaining({ exists: true, path: "archive/child.md" }),
      expect.objectContaining({ exists: true, path: "notes/child.md" }),
      expect.objectContaining({ exists: true, path: "root.md" })
    ]);
  });

  it("タグ別索引はタグごとの内部リンク一覧を生成する", async () => {
    const { workspacePath } = await prepareActiveWorkspace();
    await mkdir(path.join(workspacePath, "notes"));
    await mkdir(path.join(workspacePath, "indexes"));
    await writeFile(path.join(workspacePath, "notes", "a.md"), "---\ntags: [project, idea]\n---\n# A\n", "utf8");
    await writeFile(path.join(workspacePath, "notes", "b.md"), "---\ntags:\n  - project\n---\n# B\n", "utf8");
    await writeFile(path.join(workspacePath, "notes", "untagged.md"), "# Untagged\n", "utf8");

    const result = await generateTagIndex({
      includeUntagged: true,
      outputFolder: "indexes",
      outputName: "Tags",
      sortBy: "name",
      target: { kind: "folder", path: "notes" }
    });

    expect(result).toEqual({ ok: true, value: "indexes/Tags.md" });
    const content = await readFile(path.join(workspacePath, "indexes", "Tags.md"), "utf8");
    expect(content).toBe(
      "# タグ別索引\n\n## idea\n- [[a]]\n\n## project\n- [[a]]\n- [[b]]\n\n## タグなし\n- [[untagged]]\n"
    );
    expect(resolveWikiLinks(content, "indexes/Tags.md", [
      "notes/a.md",
      "notes/b.md",
      "notes/untagged.md"
    ])).toEqual([
      expect.objectContaining({ exists: true, path: "notes/a.md" }),
      expect.objectContaining({ exists: true, path: "notes/a.md" }),
      expect.objectContaining({ exists: true, path: "notes/b.md" }),
      expect.objectContaining({ exists: true, path: "notes/untagged.md" })
    ]);
  });

  it("タグ別索引のRelic生成文言だけを英語へ切り替える", async () => {
    const { workspacePath } = await prepareActiveWorkspace();
    await mkdir(path.join(workspacePath, "notes"));
    await writeFile(path.join(workspacePath, "notes", "会議.md"), "# Meeting\n", "utf8");

    const result = await generateTagIndex({
      includeUntagged: true,
      outputFolder: ".",
      outputName: "Index",
      sortBy: "name",
      target: { kind: "folder", path: "notes" }
    }, {}, createTranslator("en"));

    expect(result).toEqual({ ok: true, value: "Index.md" });
    await expect(readFile(path.join(workspacePath, "Index.md"), "utf8")).resolves.toBe(
      "# Tag Index\n\n## Untagged\n- [[会議]]\n"
    );
  });

  it("タグ別索引の見出しはタグ名由来の危険なMarkdown構造を避ける", async () => {
    const { workspacePath } = await prepareActiveWorkspace();
    await mkdir(path.join(workspacePath, "notes"));
    await writeFile(path.join(workspacePath, "notes", "bad.md"), "---\ntags: ['### bad']\n---\n# Bad\n", "utf8");
    await writeFile(path.join(workspacePath, "notes", "rule.md"), "---\ntags: ['---']\n---\n# Rule\n", "utf8");
    await writeFile(path.join(workspacePath, "notes", "normal.md"), "---\ntags: [通常]\n---\n# Normal\n", "utf8");

    const result = await generateTagIndex({
      includeUntagged: false,
      outputFolder: ".",
      outputName: "Tags",
      sortBy: "name",
      target: { kind: "folder", path: "notes" }
    });

    expect(result).toEqual({ ok: true, value: "Tags.md" });
    await expect(readFile(path.join(workspacePath, "Tags.md"), "utf8")).resolves.toBe(
      "# タグ別索引\n\n## 無題\n- [[rule]]\n\n## bad\n- [[bad]]\n\n## 通常\n- [[normal]]\n"
    );
  });

  it("タグ別索引は明示された対象だけを使い読めない候補を除外する", async () => {
    const { workspacePath } = await prepareActiveWorkspace();
    await mkdir(path.join(workspacePath, "notes"));
    await mkdir(path.join(workspacePath, "notes", "child"));
    await writeFile(path.join(workspacePath, "notes", "visible.md"), "---\ntags: [project]\n---\n# Visible\n", "utf8");
    await writeFile(path.join(workspacePath, "notes", "blocked.md"), "---\ntags: [project]\n---\n# Blocked\n", "utf8");
    await writeFile(path.join(workspacePath, "notes", "child", "nested.md"), "---\ntags: [project]\n---\n# Nested\n", "utf8");

    const result = await generateTagIndex(
      {
        includeUntagged: false,
        outputFolder: "",
        outputName: "Tags",
        sortBy: "name",
        target: { kind: "files", paths: ["notes/visible.md", "notes/blocked.md"] }
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

    expect(result).toEqual({ ok: true, value: "Tags.md" });
    await expect(readFile(path.join(workspacePath, "Tags.md"), "utf8")).resolves.toBe(
      "# タグ別索引\n\n## project\n- [[visible]]\n"
    );
  });

  it("タグ別索引の対象フォルダが外部実体のシンボリックリンクなら読み込まない", async () => {
    const { outsidePath, workspacePath } = await prepareActiveWorkspace();
    await writeFile(path.join(outsidePath, "external.md"), "---\ntags: [secret]\n---\n# External\n", "utf8");
    await symlink(outsidePath, path.join(workspacePath, "linked-out"), "dir");

    const result = await generateTagIndex({
      includeUntagged: false,
      outputFolder: "",
      outputName: "Tags",
      sortBy: "name",
      target: { kind: "folder", path: "linked-out" }
    });

    expect(result).toMatchObject({
      error: { code: "WORKSPACE_PATH_OUTSIDE" },
      ok: false
    });
    await expect(readFile(path.join(workspacePath, "Tags.md"), "utf8")).rejects.toMatchObject({
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
