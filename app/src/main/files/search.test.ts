import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { searchWorkspace, workspaceSearchMaxFileBytes, workspaceSearchMaxResults } from "./search";

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
      value: searchResultSet([{
        fileName: "読書メモ",
        lineNumber: 8,
        lineText: "本文ドラフト",
        path: "読書メモ.md"
      }])
    });
  });

  it("全文検索で本文中の日本語部分一致を返す", async () => {
    const workspacePath = await createSearchWorkspace();

    await expect(searchWorkspace(workspacePath, "ファイルツリー", "fullText")).resolves.toEqual({
      ok: true,
      value: searchResultSet([{
        fileName: "deep-link",
        lineNumber: 4,
        lineText: "ファイルツリーのフォルダ開閉、リンク解決、検索確認です。",
        path: "deep-link.md"
      }])
    });
    await expect(searchWorkspace(workspacePath, "ファイル", "fullText")).resolves.toEqual({
      ok: true,
      value: searchResultSet([{
        fileName: "deep-link",
        lineNumber: 4,
        lineText: "ファイルツリーのフォルダ開閉、リンク解決、検索確認です。",
        path: "deep-link.md"
      }])
    });
  });

  it("ファイル名検索でファイル名に一致するノートを返す", async () => {
    const workspacePath = await createSearchWorkspace();

    await expect(searchWorkspace(workspacePath, "nested", "fileName")).resolves.toMatchObject({
      ok: true,
      value: { results: [{ fileName: "nested", lineNumber: null, path: "folder/nested.md" }] }
    });
  });

  it("ファイル名検索でaliasesに一致するノートを返す", async () => {
    const workspacePath = await createSearchWorkspace();

    await expect(searchWorkspace(workspacePath, "別名", "fileName")).resolves.toMatchObject({
      ok: true,
      value: { results: [{ fileName: "読書メモ", lineText: "alias: 別名メモ", path: "読書メモ.md" }] }
    });
  });

  it("タグ検索でfrontmatter tagsだけを対象にする", async () => {
    const workspacePath = await createSearchWorkspace();

    await expect(searchWorkspace(workspacePath, "#資料", "tag")).resolves.toMatchObject({
      ok: true,
      value: { results: [
        { fileName: "読書メモ", path: "読書メモ.md" }
      ] }
    });
  });

  it("正規表現検索と無効な正規表現エラーに対応する", async () => {
    const workspacePath = await createSearchWorkspace();

    const result = await searchWorkspace(workspacePath, "^# ", "regex");

    expect(result).toMatchObject({ ok: true });
    expect(result.ok ? result.value.results : []).toContainEqual({
      fileName: "読書メモ",
      lineNumber: 7,
      lineText: "# 読書メモ",
      path: "読書メモ.md"
    });
    await expect(searchWorkspace(workspacePath, "[", "regex")).resolves.toMatchObject({
      ok: false,
      error: { code: "SEARCH_REGEX_INVALID" }
    });
  });

  it("フロントマターフィルターで構造的に絞り込む", async () => {
    const workspacePath = await createSearchWorkspace();

    await expect(searchWorkspace(workspacePath, "draft", "frontmatter", "status")).resolves.toEqual({
      ok: true,
      value: searchResultSet([{
        fileName: "読書メモ",
        lineNumber: null,
        lineText: "status: draft",
        path: "読書メモ.md"
      }])
    });
  });

  it("フロントマターの配列フィールドも絞り込める", async () => {
    const workspacePath = await createSearchWorkspace();

    await expect(searchWorkspace(workspacePath, "自分", "frontmatter", "author")).resolves.toMatchObject({
      ok: true,
      value: { results: [{ fileName: "読書メモ", path: "読書メモ.md" }] }
    });
  });

  it("検索結果が多い場合は500件で打ち切る", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-search-limit-"));
    temporaryPaths.push(workspacePath);

    await Promise.all(
      Array.from({ length: workspaceSearchMaxResults + 1 }, (_, index) =>
        writeFile(path.join(workspacePath, `note-${index}.md`), "needle", "utf8")
      )
    );

    const result = await searchWorkspace(workspacePath, "needle", "fullText");

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.value.results).toHaveLength(workspaceSearchMaxResults);
    expect(result.value.truncated).toBe(true);
  });

  it("2MiBを超えるMarkdownは検索対象から外す", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-search-large-"));
    temporaryPaths.push(workspacePath);
    await writeFile(path.join(workspacePath, "large.md"), `${"x".repeat(workspaceSearchMaxFileBytes + 1)}needle`, "utf8");
    await writeFile(path.join(workspacePath, "small.md"), "needle", "utf8");

    const result = await searchWorkspace(workspacePath, "needle", "fullText");

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.value.results).toEqual([{
      fileName: "small",
      lineNumber: 1,
      lineText: "needle",
      path: "small.md"
    }]);
    expect(result.value.skippedLargeFiles).toBe(1);
  });

  async function createSearchWorkspace(): Promise<string> {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-search-"));
    temporaryPaths.push(workspacePath);
    await mkdir(path.join(workspacePath, "folder"));
    await writeFile(
      path.join(workspacePath, "読書メモ.md"),
      "---\naliases: [別名メモ]\ntags: [資料]\nstatus: draft\nauthor: [自分, 編集者]\n---\n# 読書メモ\n本文ドラフト",
      "utf8"
    );
    await writeFile(path.join(workspacePath, "folder", "nested.md"), "#資料\n別本文", "utf8");
    await writeFile(
      path.join(workspacePath, "deep-link.md"),
      "---\ntags: [links]\n---\nファイルツリーのフォルダ開閉、リンク解決、検索確認です。",
      "utf8"
    );
    await writeFile(path.join(workspacePath, "image.txt"), "ドラフト", "utf8");

    return workspacePath;
  }
});

function searchResultSet(results: unknown[]) {
  return { results, skippedLargeFiles: 0, truncated: false };
}
