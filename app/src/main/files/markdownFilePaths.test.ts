import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createCopyRelativePath,
  markdownPathInFolder,
  renamedMarkdownPath
} from "./markdownFilePaths";

describe("markdown workspace paths", () => {
  it("Windows風の区切りが混ざってもワークスペース相対パスはスラッシュ区切りで作る", () => {
    expect(markdownPathInFolder("資料\\読書メモ.md", "archive")).toBe("archive/読書メモ.md");
    expect(markdownPathInFolder("資料\\読書メモ.md", "archive\\2026")).toBe("archive/2026/読書メモ.md");
    expect(renamedMarkdownPath("資料\\読書メモ.md", "読書ログ")).toEqual({
      ok: true,
      value: "資料/読書ログ.md"
    });
  });
});

describe("createCopyRelativePath", () => {
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

  it("コピー名候補が上限まで埋まっている場合は停止する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-copy-path-"));
    temporaryPaths.push(workspacePath);

    await writeFile(path.join(workspacePath, "読書メモ.md"), "original", "utf8");
    await writeFile(path.join(workspacePath, "読書メモ のコピー.md"), "copy", "utf8");
    await writeFile(path.join(workspacePath, "読書メモ のコピー 2.md"), "copy 2", "utf8");

    await expect(createCopyRelativePath(workspacePath, "読書メモ.md", 2)).rejects.toThrow(
      "コピー名の候補が多すぎます。"
    );
  });

  it("Windows風の区切りが混ざった複製元でもコピー候補をスラッシュ区切りで返す", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-copy-path-"));
    temporaryPaths.push(workspacePath);

    await mkdir(path.join(workspacePath, "資料"));
    await writeFile(path.join(workspacePath, "資料", "読書メモ.md"), "original", "utf8");
    await writeFile(path.join(workspacePath, "資料", "読書メモ のコピー.md"), "copy", "utf8");

    await expect(createCopyRelativePath(workspacePath, "資料\\読書メモ.md")).resolves.toBe(
      "資料/読書メモ のコピー 2.md"
    );
  });
});
