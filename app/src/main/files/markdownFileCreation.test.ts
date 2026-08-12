import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createMarkdownFile,
  createMarkdownFileAtPath,
  importMarkdownFiles,
  normalizeMarkdownFileName
} from "./markdownFileCreation";
import { readMarkdownFile } from "./markdownFileContent";
import { createRealpathRaceOperations } from "./test/markdownFileTestUtils";

describe("normalizeMarkdownFileName", () => {
  it("拡張子なしのファイル名に .md を付与する", () => {
    expect(normalizeMarkdownFileName("読書メモ")).toEqual({
      ok: true,
      value: "読書メモ.md"
    });
  });

  it("大文字のMarkdown拡張子は二重に付与せず保持する", () => {
    expect(normalizeMarkdownFileName("読書メモ.MD")).toEqual({
      ok: true,
      value: "読書メモ.MD"
    });
  });

  it("スラッシュを含むファイル名を拒否する", () => {
    expect(normalizeMarkdownFileName("notes/読書メモ").ok).toBe(false);
  });

  it("可搬性を損なう予約名や扱えない文字を含むファイル名を拒否する", () => {
    expect(normalizeMarkdownFileName("CON.md")).toMatchObject({
      error: { code: "FILE_NAME_INVALID" },
      ok: false
    });
    expect(normalizeMarkdownFileName("a:b")).toMatchObject({
      error: { code: "FILE_NAME_INVALID" },
      ok: false
    });
  });

  it("隠しMarkdown名を拒否する", () => {
    expect(normalizeMarkdownFileName(".note.md")).toMatchObject({
      error: { code: "FILE_NAME_HIDDEN" },
      ok: false
    });
  });
});

describe("createMarkdownFile", () => {
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

  it("Markdownファイルを空の本文で作成する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-create-file-"));
    temporaryPaths.push(workspacePath);

    await expect(createMarkdownFile(workspacePath, "読書メモ")).resolves.toEqual({
      ok: true,
      value: {
        path: "読書メモ.md"
      }
    });
    await expect(readFile(path.join(workspacePath, "読書メモ.md"), "utf8")).resolves.toBe("");
    await expect(readdir(workspacePath)).resolves.toEqual(["読書メモ.md"]);
  });

  it("同名ファイルがある場合は上書きしない", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-create-file-"));
    temporaryPaths.push(workspacePath);

    await writeFile(path.join(workspacePath, "読書メモ.md"), "既存", "utf8");

    const result = await createMarkdownFile(workspacePath, "読書メモ");

    expect(result.ok).toBe(false);
    await expect(readFile(path.join(workspacePath, "読書メモ.md"), "utf8")).resolves.toBe("既存");
  });

});

describe("createMarkdownFileAtPath", () => {
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

  it("ワークスペース相対パスにMarkdownファイルを作成する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-create-linked-file-"));
    temporaryPaths.push(workspacePath);

    await expect(createMarkdownFileAtPath(workspacePath, "folder/新規ノート.md")).resolves.toEqual({
      ok: true,
      value: {
        content: "",
        name: "新規ノート",
        path: "folder/新規ノート.md"
      }
    });
    await expect(readFile(path.join(workspacePath, "folder", "新規ノート.md"), "utf8")).resolves.toBe("");
    await expect(readdir(path.join(workspacePath, "folder"))).resolves.toEqual(["新規ノート.md"]);
  });

  it("大文字のMarkdown拡張子を持つファイルを作成して読み込める", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-create-linked-file-"));
    temporaryPaths.push(workspacePath);

    await expect(createMarkdownFileAtPath(workspacePath, "folder/新規ノート.MD", "# 本文")).resolves.toEqual({
      ok: true,
      value: {
        content: "# 本文",
        name: "新規ノート",
        path: "folder/新規ノート.MD"
      }
    });
    await expect(readMarkdownFile(workspacePath, "folder/新規ノート.MD")).resolves.toEqual({
      ok: true,
      value: {
        content: "# 本文",
        name: "新規ノート",
        path: "folder/新規ノート.MD"
      }
    });
  });

  it("本文を指定してMarkdownファイルを作成する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-create-linked-file-"));
    temporaryPaths.push(workspacePath);

    await expect(createMarkdownFileAtPath(workspacePath, "folder/本文あり.md", "# 本文\ncontent")).resolves.toEqual({
      ok: true,
      value: {
        content: "# 本文\ncontent",
        name: "本文あり",
        path: "folder/本文あり.md"
      }
    });
    await expect(readFile(path.join(workspacePath, "folder", "本文あり.md"), "utf8")).resolves.toBe("# 本文\ncontent");
  });

  it("ワークスペース外とMarkdown以外への作成を拒否する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-create-linked-file-"));
    temporaryPaths.push(workspacePath);

    await expect(createMarkdownFileAtPath(workspacePath, "../outside.md")).resolves.toMatchObject({
      ok: false
    });
    await expect(createMarkdownFileAtPath(workspacePath, "image.png")).resolves.toMatchObject({
      ok: false
    });
  });

  it("検証後に親フォルダの実体がワークスペース外へ変わったMarkdown作成を直前再確認で拒否する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-create-linked-file-"));
    const outsidePath = await mkdtemp(path.join(os.tmpdir(), "relic-outside-file-"));
    temporaryPaths.push(workspacePath, outsidePath);
    const linkedParentPath = path.join(workspacePath, "linked");

    await expect(createMarkdownFileAtPath(workspacePath, "linked/new.md", "", createRealpathRaceOperations({
      changingPath: linkedParentPath,
      safeRealPath: path.join(workspacePath, "inside-linked"),
      unsafeRealPath: path.join(outsidePath, "linked"),
      workspacePath
    }))).resolves.toMatchObject({
      error: { code: "WORKSPACE_PATH_OUTSIDE" },
      ok: false
    });
    await expect(readdir(workspacePath)).resolves.toEqual([]);
  });
});

describe("importMarkdownFiles", () => {
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

  it("外部Markdownファイルをワークスペース直下にコピーする", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-import-workspace-"));
    const sourcePath = await mkdtemp(path.join(os.tmpdir(), "relic-import-source-"));
    temporaryPaths.push(workspacePath, sourcePath);
    const markdownPath = path.join(sourcePath, "読書メモ.md");
    await writeFile(markdownPath, "# 読書メモ", "utf8");

    await expect(importMarkdownFiles(workspacePath, [markdownPath], "")).resolves.toEqual({
      ok: true,
      value: [{
        content: "# 読書メモ",
        name: "読書メモ",
        path: "読書メモ.md"
      }]
    });
    await expect(readFile(path.join(workspacePath, "読書メモ.md"), "utf8")).resolves.toBe("# 読書メモ");
    await expect(readFile(markdownPath, "utf8")).resolves.toBe("# 読書メモ");
  });

  it("外部の隠しMarkdownを副作用なく拒否する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-import-workspace-"));
    const sourcePath = await mkdtemp(path.join(os.tmpdir(), "relic-import-source-"));
    temporaryPaths.push(workspacePath, sourcePath);
    const markdownPath = path.join(sourcePath, ".note.md");
    await writeFile(markdownPath, "hidden", "utf8");

    await expect(importMarkdownFiles(workspacePath, [markdownPath], "")).resolves.toMatchObject({
      error: { code: "FILE_NAME_HIDDEN" },
      ok: false
    });
    await expect(readdir(workspacePath)).resolves.toEqual([]);
    await expect(readFile(markdownPath, "utf8")).resolves.toBe("hidden");
  });

  it("外部Markdownファイルを指定フォルダにコピーする", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-import-workspace-"));
    const sourcePath = await mkdtemp(path.join(os.tmpdir(), "relic-import-source-"));
    temporaryPaths.push(workspacePath, sourcePath);
    await mkdir(path.join(workspacePath, "Archive"));
    const markdownPath = path.join(sourcePath, "Log.MD");
    await writeFile(markdownPath, "log", "utf8");

    await expect(importMarkdownFiles(workspacePath, [markdownPath], "Archive")).resolves.toEqual({
      ok: true,
      value: [{
        content: "log",
        name: "Log",
        path: "Archive/Log.MD"
      }]
    });
    await expect(readFile(path.join(workspacePath, "Archive", "Log.MD"), "utf8")).resolves.toBe("log");
  });

  it("Markdown以外と同名コピーを拒否する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-import-workspace-"));
    const sourcePath = await mkdtemp(path.join(os.tmpdir(), "relic-import-source-"));
    temporaryPaths.push(workspacePath, sourcePath);
    const textPath = path.join(sourcePath, "memo.txt");
    const markdownPath = path.join(sourcePath, "既存.md");
    await writeFile(textPath, "text", "utf8");
    await writeFile(markdownPath, "new", "utf8");
    await writeFile(path.join(workspacePath, "既存.md"), "old", "utf8");

    await expect(importMarkdownFiles(workspacePath, [textPath], "")).resolves.toMatchObject({
      error: { code: "FILE_TYPE_UNSUPPORTED" },
      ok: false
    });
    await expect(importMarkdownFiles(workspacePath, [markdownPath], "")).resolves.toMatchObject({
      error: { code: "FILE_ALREADY_EXISTS" },
      ok: false
    });
    await expect(readFile(path.join(workspacePath, "既存.md"), "utf8")).resolves.toBe("old");
  });

  it("複数ファイル追加の途中失敗では未変更の先行コピーだけを戻す", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-import-workspace-"));
    const sourcePath = await mkdtemp(path.join(os.tmpdir(), "relic-import-source-"));
    temporaryPaths.push(workspacePath, sourcePath);
    const firstSource = path.join(sourcePath, "first.md");
    const secondSource = path.join(sourcePath, "second.md");
    await writeFile(firstSource, "first", "utf8");
    await writeFile(secondSource, "second", "utf8");
    const firstDestination = path.join(workspacePath, "first.md");

    const result = await importMarkdownFiles(workspacePath, [firstSource, secondSource], "", {}, {
      copyFile: async (source, destination, flags) => {
        await copyFile(source, destination, flags);
        if (source === secondSource) {
          await writeFile(firstDestination, "edited", "utf8");
          throw new Error("second copy failed");
        }
      }
    });

    expect(result).toMatchObject({
      error: {
        code: "FILE_IMPORT_FAILED",
        recovery: { reasonCode: "IMPORT_CLEANUP_REQUIRED", remainingPaths: ["first.md"] }
      },
      ok: false
    });
    await expect(readFile(firstDestination, "utf8")).resolves.toBe("edited");
  });

  it("複数ファイル追加の途中で先行コピーがシンボリックリンクへ置換された場合は保持する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-import-workspace-"));
    const sourcePath = await mkdtemp(path.join(os.tmpdir(), "relic-import-source-"));
    const outsidePath = await mkdtemp(path.join(os.tmpdir(), "relic-import-outside-"));
    temporaryPaths.push(workspacePath, sourcePath, outsidePath);
    const firstSource = path.join(sourcePath, "first.md");
    const secondSource = path.join(sourcePath, "second.md");
    const outsideTarget = path.join(outsidePath, "outside.md");
    const firstDestination = path.join(workspacePath, "first.md");
    await writeFile(firstSource, "first", "utf8");
    await writeFile(secondSource, "second", "utf8");
    await writeFile(outsideTarget, "outside", "utf8");

    const result = await importMarkdownFiles(workspacePath, [firstSource, secondSource], "", {}, {
      copyFile: async (source, destination, flags) => {
        await copyFile(source, destination, flags);
        if (source === secondSource) {
          await rm(firstDestination);
          await symlink(outsideTarget, firstDestination);
          throw new Error("second copy failed");
        }
      }
    });

    expect(result).toMatchObject({
      error: {
        code: "FILE_IMPORT_FAILED",
        recovery: { reasonCode: "IMPORT_CLEANUP_REQUIRED", remainingPaths: ["first.md"] }
      },
      ok: false
    });
    await expect(readFile(firstDestination, "utf8")).resolves.toBe("outside");
    await expect(readFile(outsideTarget, "utf8")).resolves.toBe("outside");
  });

  it("複数ファイル追加の通常失敗では先行コピーを安全に削除する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-import-workspace-"));
    const sourcePath = await mkdtemp(path.join(os.tmpdir(), "relic-import-source-"));
    temporaryPaths.push(workspacePath, sourcePath);
    const firstSource = path.join(sourcePath, "first.md");
    const secondSource = path.join(sourcePath, "second.md");
    await writeFile(firstSource, "first", "utf8");
    await writeFile(secondSource, "second", "utf8");

    const result = await importMarkdownFiles(workspacePath, [firstSource, secondSource], "", {}, {
      copyFile: async (source, destination, flags) => {
        if (source === secondSource) throw new Error("second copy failed");
        await copyFile(source, destination, flags);
      }
    });

    expect(result).toMatchObject({ error: { code: "FILE_IMPORT_FAILED" }, ok: false });
    if (!result.ok) expect(result.error.recovery).toBeUndefined();
    await expect(readFile(path.join(workspacePath, "first.md"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("複数ファイル追加のクリーンアップ失敗を復旧要求として返す", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-import-workspace-"));
    const sourcePath = await mkdtemp(path.join(os.tmpdir(), "relic-import-source-"));
    temporaryPaths.push(workspacePath, sourcePath);
    const firstSource = path.join(sourcePath, "first.md");
    const secondSource = path.join(sourcePath, "second.md");
    const firstDestination = path.join(workspacePath, "first.md");
    await writeFile(firstSource, "first", "utf8");
    await writeFile(secondSource, "second", "utf8");

    const result = await importMarkdownFiles(workspacePath, [firstSource, secondSource], "", {}, {
      copyFile: async (source, destination, flags) => {
        if (source === secondSource) throw new Error("second copy failed");
        await copyFile(source, destination, flags);
      },
      unlink: async () => {
        throw new Error("cleanup failed");
      }
    });

    expect(result).toMatchObject({
      error: {
        code: "FILE_IMPORT_FAILED",
        recovery: { reasonCode: "IMPORT_CLEANUP_REQUIRED", remainingPaths: ["first.md"] }
      },
      ok: false
    });
    await expect(readFile(firstDestination, "utf8")).resolves.toBe("first");
  });
});
