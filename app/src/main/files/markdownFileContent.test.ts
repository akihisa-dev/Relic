import { chmod, mkdtemp, readFile, rm, stat, symlink, truncate, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { maxMarkdownReadBytes } from "../../shared/ipc/files";
import { readMarkdownFile, writeMarkdownFileContent } from "./markdownFileContent";
import { createRealpathRaceOperations } from "./test/markdownFileTestUtils";

describe("readMarkdownFile", () => {
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

  it("ワークスペース内のMarkdownファイルを読み込む", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-read-file-"));
    temporaryPaths.push(workspacePath);

    await writeFile(path.join(workspacePath, "読書メモ.md"), "# 読書メモ", "utf8");

    await expect(readMarkdownFile(workspacePath, "読書メモ.md")).resolves.toEqual({
      ok: true,
      value: {
        content: "# 読書メモ",
        name: "読書メモ",
        path: "読書メモ.md"
      }
    });
  });

  it("Markdown以外とワークスペース外への参照を拒否する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-read-file-"));
    temporaryPaths.push(workspacePath);

    await expect(readMarkdownFile(workspacePath, "image.png")).resolves.toMatchObject({
      ok: false
    });
    await expect(readMarkdownFile(workspacePath, "../outside.md")).resolves.toMatchObject({
      ok: false
    });
  });

  it("シンボリックリンク経由で実体がワークスペース外のMarkdown読み込みを拒否する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-read-file-"));
    const outsidePath = await mkdtemp(path.join(os.tmpdir(), "relic-outside-file-"));
    temporaryPaths.push(workspacePath, outsidePath);

    await writeFile(path.join(outsidePath, "outside.md"), "outside", "utf8");
    await symlink(path.join(outsidePath, "outside.md"), path.join(workspacePath, "linked.md"));

    await expect(readMarkdownFile(workspacePath, "linked.md")).resolves.toMatchObject({
      ok: false
    });
  });

  it("検証後に実体がワークスペース外へ変わったMarkdown読み込みを直前再確認で拒否する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-read-file-"));
    const outsidePath = await mkdtemp(path.join(os.tmpdir(), "relic-outside-file-"));
    temporaryPaths.push(workspacePath, outsidePath);
    const notePath = path.join(workspacePath, "note.md");

    await writeFile(notePath, "# Note", "utf8");

    await expect(readMarkdownFile(workspacePath, "note.md", createRealpathRaceOperations({
      changingPath: notePath,
      safeRealPath: notePath,
      unsafeRealPath: path.join(outsidePath, "note.md"),
      workspacePath
    }))).resolves.toMatchObject({
      error: { code: "WORKSPACE_PATH_OUTSIDE" },
      ok: false
    });
  });

  it("上限を超えるMarkdownはreadFileせず拒否する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-read-file-"));
    temporaryPaths.push(workspacePath);
    const notePath = path.join(workspacePath, "large.md");
    await writeFile(notePath, "x", "utf8");
    await truncate(notePath, maxMarkdownReadBytes + 1);
    const read = async () => {
      throw new Error("readFile must not be called");
    };

    await expect(readMarkdownFile(workspacePath, "large.md", { readFile: read })).resolves.toMatchObject({
      error: { code: "FILE_READ_TOO_LARGE" },
      ok: false
    });
  });

  it("stat後に本文が上限を超えたMarkdownは開かない", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-read-file-"));
    temporaryPaths.push(workspacePath);
    const notePath = path.join(workspacePath, "grown.md");
    await writeFile(notePath, "x", "utf8");

    const result = await readMarkdownFile(workspacePath, "grown.md", {
      readFile: async () => "x".repeat(maxMarkdownReadBytes + 1)
    });

    expect(result).toMatchObject({
      error: { code: "FILE_READ_TOO_LARGE" },
      ok: false
    });
  });
});

describe("writeMarkdownFileContent", () => {
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

  it("既存Markdownのmodeを保存後も保持する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-write-markdown-mode-"));
    temporaryPaths.push(workspacePath);
    const filePath = path.join(workspacePath, "private.md");

    await writeFile(filePath, "old", "utf8");
    await chmod(filePath, 0o600);

    await expect(writeMarkdownFileContent(workspacePath, "private.md", "new")).resolves.toMatchObject({ ok: true });
    expect((await stat(filePath)).mode & 0o777).toBe(0o600);
  });

  it("Markdownファイルを安全書き込み経由で更新する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-write-file-"));
    temporaryPaths.push(workspacePath);

    await writeFile(path.join(workspacePath, "読書メモ.md"), "old", "utf8");

    await expect(writeMarkdownFileContent(workspacePath, "読書メモ.md", "new")).resolves.toEqual({
      ok: true,
      value: undefined
    });
    await expect(readFile(path.join(workspacePath, "読書メモ.md"), "utf8")).resolves.toBe("new");
  });

  it("期待した元本文と現在本文が異なる場合は保存しない", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-write-conflict-"));
    temporaryPaths.push(workspacePath);

    await writeFile(path.join(workspacePath, "読書メモ.md"), "external", "utf8");

    await expect(writeMarkdownFileContent(workspacePath, "読書メモ.md", "relic", "old")).resolves.toMatchObject({
      error: expect.objectContaining({ code: "FILE_WRITE_CONFLICT" }),
      ok: false
    });
    await expect(readFile(path.join(workspacePath, "読書メモ.md"), "utf8")).resolves.toBe("external");
  });

  it("Markdown以外とワークスペース外への書き込みを拒否する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-write-file-"));
    temporaryPaths.push(workspacePath);

    await expect(writeMarkdownFileContent(workspacePath, "image.png", "new")).resolves.toMatchObject({
      ok: false
    });
    await expect(writeMarkdownFileContent(workspacePath, "../outside.md", "new")).resolves.toMatchObject({
      ok: false
    });
  });

  it("シンボリックリンク経由で実体がワークスペース外のMarkdown書き込みを拒否する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-write-file-"));
    const outsidePath = await mkdtemp(path.join(os.tmpdir(), "relic-outside-file-"));
    temporaryPaths.push(workspacePath, outsidePath);

    await writeFile(path.join(outsidePath, "outside.md"), "outside", "utf8");
    await symlink(path.join(outsidePath, "outside.md"), path.join(workspacePath, "linked.md"));

    await expect(writeMarkdownFileContent(workspacePath, "linked.md", "new")).resolves.toMatchObject({
      ok: false
    });
    await expect(readFile(path.join(outsidePath, "outside.md"), "utf8")).resolves.toBe("outside");
  });

  it("検証後に実体がワークスペース外へ変わったMarkdown書き込みを直前再確認で拒否する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-write-file-"));
    const outsidePath = await mkdtemp(path.join(os.tmpdir(), "relic-outside-file-"));
    temporaryPaths.push(workspacePath, outsidePath);
    const notePath = path.join(workspacePath, "note.md");

    await writeFile(notePath, "old", "utf8");

    await expect(writeMarkdownFileContent(workspacePath, "note.md", "new", undefined, createRealpathRaceOperations({
      changingPath: notePath,
      safeRealPath: notePath,
      unsafeRealPath: path.join(outsidePath, "note.md"),
      workspacePath
    }))).resolves.toMatchObject({
      error: { code: "WORKSPACE_PATH_OUTSIDE" },
      ok: false
    });
    await expect(readFile(notePath, "utf8")).resolves.toBe("old");
  });
});
