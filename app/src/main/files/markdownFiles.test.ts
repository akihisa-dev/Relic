import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createMarkdownFile,
  createMarkdownFileAtPath,
  duplicateMarkdownFile,
  moveMarkdownFile,
  normalizeMarkdownFileName,
  readMarkdownFile,
  renameMarkdownFile
} from "./markdownFiles";

describe("normalizeMarkdownFileName", () => {
  it("拡張子なしのファイル名に .md を付与する", () => {
    expect(normalizeMarkdownFileName("読書メモ")).toEqual({
      ok: true,
      value: "読書メモ.md"
    });
  });

  it("スラッシュを含むファイル名を拒否する", () => {
    expect(normalizeMarkdownFileName("notes/読書メモ").ok).toBe(false);
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
});
