import { chmod, link, mkdir, mkdtemp, readdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createMarkdownFile,
  createMarkdownFileAtPath,
  duplicateMarkdownFile,
  importMarkdownFiles,
  moveMarkdownFile,
  normalizeMarkdownFileName,
  readMarkdownFile,
  renameMarkdownFile,
  writeMarkdownFileContent
} from "./markdownFiles";
import type { RealpathOperations } from "./paths";

function createRealpathRaceOperations(options: {
  changingPath: string;
  safeRealPath: string;
  unsafeRealPath: string;
  workspacePath: string;
}): RealpathOperations {
  let changingPathChecks = 0;

  return {
    async realpath(filePath) {
      if (filePath === options.workspacePath) return options.workspacePath;
      if (filePath === options.changingPath) {
        changingPathChecks += 1;
        return changingPathChecks === 1
          ? options.safeRealPath
          : options.unsafeRealPath;
      }

      return filePath;
    }
  };
}

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

  it("Windows予約名や扱えない文字を含むファイル名を拒否する", () => {
    expect(normalizeMarkdownFileName("CON.md")).toMatchObject({
      error: { code: "FILE_NAME_INVALID" },
      ok: false
    });
    expect(normalizeMarkdownFileName("a:b")).toMatchObject({
      error: { code: "FILE_NAME_INVALID" },
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
});

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

  it.runIf(process.platform !== "win32")("既存Markdownのmodeを保存後も保持する", async () => {
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

describe("renameMarkdownFile", () => {
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

  it("Markdownファイル名を変更する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-rename-file-"));
    temporaryPaths.push(workspacePath);

    await writeFile(path.join(workspacePath, "before.md"), "# Before", "utf8");

    await expect(renameMarkdownFile(workspacePath, "before.md", "after")).resolves.toEqual({
      ok: true,
      value: {
        content: "# Before",
        name: "after",
        path: "after.md"
      }
    });
    await expect(readFile(path.join(workspacePath, "after.md"), "utf8")).resolves.toBe("# Before");
  });

  it("リネーム時に内部リンクも更新する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-rename-file-"));
    temporaryPaths.push(workspacePath);

    await writeFile(path.join(workspacePath, "before.md"), "# Before", "utf8");
    await writeFile(path.join(workspacePath, "source.md"), "[[before]]", "utf8");

    await expect(renameMarkdownFile(workspacePath, "before.md", "after")).resolves.toMatchObject({
      ok: true
    });
    await expect(readFile(path.join(workspacePath, "source.md"), "utf8")).resolves.toBe("[[after]]");
  });

  it("移動先が同じ実体を指す場合は一時名を経由してMarkdownファイル名を変更する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-rename-file-"));
    temporaryPaths.push(workspacePath);

    await writeFile(path.join(workspacePath, "before.md"), "# Before", "utf8");
    await link(path.join(workspacePath, "before.md"), path.join(workspacePath, "after.md"));

    await expect(renameMarkdownFile(workspacePath, "before.md", "after")).resolves.toEqual({
      ok: true,
      value: {
        content: "# Before",
        name: "after",
        path: "after.md"
      }
    });
    await expect(readFile(path.join(workspacePath, "after.md"), "utf8")).resolves.toBe("# Before");
    await expect(readFile(path.join(workspacePath, "before.md"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("同名ファイルがある場合は上書きしない", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-rename-file-"));
    temporaryPaths.push(workspacePath);

    await writeFile(path.join(workspacePath, "before.md"), "before", "utf8");
    await writeFile(path.join(workspacePath, "after.md"), "after", "utf8");

    const result = await renameMarkdownFile(workspacePath, "before.md", "after");

    expect(result.ok).toBe(false);
    await expect(readFile(path.join(workspacePath, "before.md"), "utf8")).resolves.toBe("before");
    await expect(readFile(path.join(workspacePath, "after.md"), "utf8")).resolves.toBe("after");
  });

  it("Markdown以外とワークスペース外への参照を拒否する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-rename-file-"));
    temporaryPaths.push(workspacePath);

    await expect(renameMarkdownFile(workspacePath, "image.png", "image2")).resolves.toMatchObject({
      ok: false
    });
    await expect(renameMarkdownFile(workspacePath, "../outside.md", "inside")).resolves.toMatchObject({
      ok: false
    });
  });

  it("シンボリックリンク経由で実体がワークスペース外のMarkdownリネームを拒否する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-rename-file-"));
    const outsidePath = await mkdtemp(path.join(os.tmpdir(), "relic-outside-file-"));
    temporaryPaths.push(workspacePath, outsidePath);

    await writeFile(path.join(outsidePath, "outside.md"), "outside", "utf8");
    await symlink(path.join(outsidePath, "outside.md"), path.join(workspacePath, "linked.md"));

    await expect(renameMarkdownFile(workspacePath, "linked.md", "renamed")).resolves.toMatchObject({
      ok: false
    });
    await expect(readFile(path.join(outsidePath, "outside.md"), "utf8")).resolves.toBe("outside");
  });

  it("検証後に実体がワークスペース外へ変わったMarkdownリネームを直前再確認で拒否する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-rename-file-"));
    const outsidePath = await mkdtemp(path.join(os.tmpdir(), "relic-outside-file-"));
    temporaryPaths.push(workspacePath, outsidePath);
    const notePath = path.join(workspacePath, "note.md");

    await writeFile(notePath, "# Note", "utf8");

    await expect(renameMarkdownFile(workspacePath, "note.md", "renamed", createRealpathRaceOperations({
      changingPath: notePath,
      safeRealPath: notePath,
      unsafeRealPath: path.join(outsidePath, "note.md"),
      workspacePath
    }))).resolves.toMatchObject({
      error: { code: "WORKSPACE_PATH_OUTSIDE" },
      ok: false
    });
    await expect(readFile(notePath, "utf8")).resolves.toBe("# Note");
  });
});

describe("duplicateMarkdownFile", () => {
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

  it("同じフォルダにMarkdownファイルを複製する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-duplicate-file-"));
    temporaryPaths.push(workspacePath);

    await writeFile(path.join(workspacePath, "読書メモ.md"), "# 読書メモ", "utf8");

    await expect(duplicateMarkdownFile(workspacePath, "読書メモ.md")).resolves.toEqual({
      ok: true,
      value: {
        content: "# 読書メモ",
        name: "読書メモ のコピー",
        path: "読書メモ のコピー.md"
      }
    });
    await expect(readFile(path.join(workspacePath, "読書メモ のコピー.md"), "utf8")).resolves.toBe(
      "# 読書メモ"
    );
    expect((await readdir(workspacePath)).sort()).toEqual(["読書メモ のコピー.md", "読書メモ.md"]);
  });

  it("コピー名が既にある場合は連番で複製する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-duplicate-file-"));
    temporaryPaths.push(workspacePath);

    await writeFile(path.join(workspacePath, "読書メモ.md"), "original", "utf8");
    await writeFile(path.join(workspacePath, "読書メモ のコピー.md"), "copy", "utf8");

    await expect(duplicateMarkdownFile(workspacePath, "読書メモ.md")).resolves.toMatchObject({
      ok: true,
      value: {
        path: "読書メモ のコピー 2.md"
      }
    });
  });

  it("Markdown以外とワークスペース外への参照を拒否する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-duplicate-file-"));
    temporaryPaths.push(workspacePath);

    await expect(duplicateMarkdownFile(workspacePath, "image.png")).resolves.toMatchObject({
      ok: false
    });
    await expect(duplicateMarkdownFile(workspacePath, "../outside.md")).resolves.toMatchObject({
      ok: false
    });
  });

  it("検証後に実体がワークスペース外へ変わったMarkdown複製を直前再確認で拒否する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-duplicate-file-"));
    const outsidePath = await mkdtemp(path.join(os.tmpdir(), "relic-outside-file-"));
    temporaryPaths.push(workspacePath, outsidePath);
    const notePath = path.join(workspacePath, "note.md");

    await writeFile(notePath, "# Note", "utf8");

    await expect(duplicateMarkdownFile(workspacePath, "note.md", createRealpathRaceOperations({
      changingPath: notePath,
      safeRealPath: notePath,
      unsafeRealPath: path.join(outsidePath, "note.md"),
      workspacePath
    }))).resolves.toMatchObject({
      error: { code: "WORKSPACE_PATH_OUTSIDE" },
      ok: false
    });
    await expect(readdir(workspacePath)).resolves.toEqual(["note.md"]);
  });
});

describe("moveMarkdownFile", () => {
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

  it("Markdownファイルを別フォルダへ移動する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-move-file-"));
    temporaryPaths.push(workspacePath);

    await mkdir(path.join(workspacePath, "archive"));
    await writeFile(path.join(workspacePath, "note.md"), "# Note", "utf8");

    await expect(moveMarkdownFile(workspacePath, "note.md", "archive")).resolves.toEqual({
      ok: true,
      value: {
        content: "# Note",
        name: "note",
        path: "archive/note.md"
      }
    });
    await expect(readFile(path.join(workspacePath, "archive/note.md"), "utf8")).resolves.toBe("# Note");
  });

  it("別フォルダへの移動時に内部リンクをパス付きリンクへ更新する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-move-file-"));
    temporaryPaths.push(workspacePath);

    await mkdir(path.join(workspacePath, "archive"));
    await writeFile(path.join(workspacePath, "note.md"), "# Note", "utf8");
    await writeFile(path.join(workspacePath, "source.md"), "[[note]]", "utf8");

    await expect(moveMarkdownFile(workspacePath, "note.md", "archive")).resolves.toMatchObject({
      ok: true
    });
    await expect(readFile(path.join(workspacePath, "source.md"), "utf8")).resolves.toBe(
      "[[archive/note]]"
    );
  });

  it("別フォルダへ移動したファイル内の basename-only リンクの意味を維持する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-move-file-"));
    temporaryPaths.push(workspacePath);

    await mkdir(path.join(workspacePath, "archive"));
    await writeFile(path.join(workspacePath, "note.md"), "[[target]]", "utf8");
    await writeFile(path.join(workspacePath, "target.md"), "", "utf8");

    await expect(moveMarkdownFile(workspacePath, "note.md", "archive")).resolves.toMatchObject({
      ok: true
    });
    await expect(readFile(path.join(workspacePath, "archive", "note.md"), "utf8")).resolves.toBe("[[../target]]");
  });

  it("移動先に同名ファイルがある場合は上書きしない", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-move-file-"));
    temporaryPaths.push(workspacePath);

    await mkdir(path.join(workspacePath, "archive"));
    await writeFile(path.join(workspacePath, "note.md"), "source", "utf8");
    await writeFile(path.join(workspacePath, "archive/note.md"), "existing", "utf8");

    await expect(moveMarkdownFile(workspacePath, "note.md", "archive")).resolves.toMatchObject({
      ok: false
    });
    await expect(readFile(path.join(workspacePath, "note.md"), "utf8")).resolves.toBe("source");
    await expect(readFile(path.join(workspacePath, "archive/note.md"), "utf8")).resolves.toBe("existing");
  });

  it("ワークスペース外の移動先フォルダを拒否する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-move-file-"));
    temporaryPaths.push(workspacePath);

    await writeFile(path.join(workspacePath, "note.md"), "# Note", "utf8");

    await expect(moveMarkdownFile(workspacePath, "note.md", "../outside")).resolves.toMatchObject({
      ok: false
    });
    await expect(readFile(path.join(workspacePath, "note.md"), "utf8")).resolves.toBe("# Note");
  });

  it("シンボリックリンク経由で実体がワークスペース外のMarkdown移動を拒否する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-move-file-"));
    const outsidePath = await mkdtemp(path.join(os.tmpdir(), "relic-outside-file-"));
    temporaryPaths.push(workspacePath, outsidePath);

    await mkdir(path.join(workspacePath, "archive"));
    await writeFile(path.join(outsidePath, "outside.md"), "outside", "utf8");
    await symlink(path.join(outsidePath, "outside.md"), path.join(workspacePath, "linked.md"));

    await expect(moveMarkdownFile(workspacePath, "linked.md", "archive")).resolves.toMatchObject({
      ok: false
    });
    await expect(readFile(path.join(outsidePath, "outside.md"), "utf8")).resolves.toBe("outside");
  });

  it("検証後に実体がワークスペース外へ変わったMarkdown移動を直前再確認で拒否する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-move-file-"));
    const outsidePath = await mkdtemp(path.join(os.tmpdir(), "relic-outside-file-"));
    temporaryPaths.push(workspacePath, outsidePath);
    const notePath = path.join(workspacePath, "note.md");

    await mkdir(path.join(workspacePath, "archive"));
    await writeFile(notePath, "# Note", "utf8");

    await expect(moveMarkdownFile(workspacePath, "note.md", "archive", createRealpathRaceOperations({
      changingPath: notePath,
      safeRealPath: notePath,
      unsafeRealPath: path.join(outsidePath, "note.md"),
      workspacePath
    }))).resolves.toMatchObject({
      error: { code: "WORKSPACE_PATH_OUTSIDE" },
      ok: false
    });
    await expect(readFile(notePath, "utf8")).resolves.toBe("# Note");
  });
});
