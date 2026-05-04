import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { searchWorkspace } from "./search";

describe("searchWorkspace", () => {
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

  it("全文検索で一致行のみを返す", async () => {
    const workspacePath = await createSearchWorkspace();

    await expect(searchWorkspace(workspacePath, "ドラフト", "fullText")).resolves.toEqual({
      ok: true,
      value: [
        {
          fileName: "読書メモ",
          lineNumber: 5,
          lineText: "本文ドラフト",
          path: "読書メモ.md"
        }
      ]
    });
  });

  it("ファイル名検索でファイル名に一致するノートを返す", async () => {
    const workspacePath = await createSearchWorkspace();

    await expect(searchWorkspace(workspacePath, "nested", "fileName")).resolves.toMatchObject({
      ok: true,
      value: [{ fileName: "nested", lineNumber: null, path: "folder/nested.md" }]
    });
  });

  it("タグ検索で本文タグとfrontmatter tagsを対象にする", async () => {
    const workspacePath = await createSearchWorkspace();

    await expect(searchWorkspace(workspacePath, "#資料", "tag")).resolves.toMatchObject({
      ok: true,
      value: [
        { fileName: "nested", path: "folder/nested.md" },
        { fileName: "読書メモ", path: "読書メモ.md" }
      ]
    });
  });

  it("正規表現検索と無効な正規表現エラーに対応する", async () => {
    const workspacePath = await createSearchWorkspace();

    const result = await searchWorkspace(workspacePath, "^# ", "regex");

    expect(result).toMatchObject({ ok: true });
    expect(result.ok ? result.value : []).toContainEqual({
      fileName: "読書メモ",
      lineNumber: 4,
      lineText: "# 読書メモ",
      path: "読書メモ.md"
    });
    await expect(searchWorkspace(workspacePath, "[", "regex")).resolves.toMatchObject({
      ok: false,
      error: { code: "SEARCH_REGEX_INVALID" }
    });
  });

  async function createSearchWorkspace(): Promise<string> {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-search-"));
    temporaryPaths.push(workspacePath);
    await mkdir(path.join(workspacePath, "folder"));
    await writeFile(
      path.join(workspacePath, "読書メモ.md"),
      "---\ntags: [資料]\n---\n# 読書メモ\n本文ドラフト",
      "utf8"
    );
    await writeFile(path.join(workspacePath, "folder", "nested.md"), "#資料\n別本文", "utf8");
    await writeFile(path.join(workspacePath, "image.txt"), "ドラフト", "utf8");

    return workspacePath;
  }
});
