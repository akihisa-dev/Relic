import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createMarkdownFile, normalizeMarkdownFileName, readMarkdownFile } from "./markdownFiles";

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
