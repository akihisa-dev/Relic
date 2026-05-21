import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { searchCardbook } from "./search";

describe("searchCardbook", () => {
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
    const cardbookPath = await createSearchCardbook();

    await expect(searchCardbook(cardbookPath, "ドラフト", "fullText")).resolves.toEqual({
      ok: true,
      value: [
        {
          cardName: "読書メモ",
          lineNumber: 8,
          lineText: "本文ドラフト",
          path: "読書メモ.md"
        }
      ]
    });
  });

  it("全文検索で本文中の日本語部分一致を返す", async () => {
    const cardbookPath = await createSearchCardbook();

    await expect(searchCardbook(cardbookPath, "カードツリー", "fullText")).resolves.toEqual({
      ok: true,
      value: [
        {
          cardName: "deep-link",
          lineNumber: 4,
          lineText: "カードツリーのカードフォルダ開閉、リンク解決、検索確認です。",
          path: "deep-link.md"
        }
      ]
    });
    await expect(searchCardbook(cardbookPath, "カード", "fullText")).resolves.toEqual({
      ok: true,
      value: [
        {
          cardName: "deep-link",
          lineNumber: 4,
          lineText: "カードツリーのカードフォルダ開閉、リンク解決、検索確認です。",
          path: "deep-link.md"
        }
      ]
    });
  });

  it("カード名検索でカード名に一致するノートを返す", async () => {
    const cardbookPath = await createSearchCardbook();

    await expect(searchCardbook(cardbookPath, "nested", "cardName")).resolves.toMatchObject({
      ok: true,
      value: [{ cardName: "nested", lineNumber: null, path: "cardFolder/nested.md" }]
    });
  });

  it("カード名検索でaliasesに一致するノートを返す", async () => {
    const cardbookPath = await createSearchCardbook();

    await expect(searchCardbook(cardbookPath, "別名", "cardName")).resolves.toMatchObject({
      ok: true,
      value: [{ cardName: "読書メモ", lineText: "alias: 別名メモ", path: "読書メモ.md" }]
    });
  });

  it("タグ検索でfrontmatter tagsだけを対象にする", async () => {
    const cardbookPath = await createSearchCardbook();

    await expect(searchCardbook(cardbookPath, "#資料", "tag")).resolves.toMatchObject({
      ok: true,
      value: [
        { cardName: "読書メモ", path: "読書メモ.md" }
      ]
    });
  });

  it("正規表現検索と無効な正規表現エラーに対応する", async () => {
    const cardbookPath = await createSearchCardbook();

    const result = await searchCardbook(cardbookPath, "^# ", "regex");

    expect(result).toMatchObject({ ok: true });
    expect(result.ok ? result.value : []).toContainEqual({
      cardName: "読書メモ",
      lineNumber: 7,
      lineText: "# 読書メモ",
      path: "読書メモ.md"
    });
    await expect(searchCardbook(cardbookPath, "[", "regex")).resolves.toMatchObject({
      ok: false,
      error: { code: "SEARCH_REGEX_INVALID" }
    });
  });

  it("プロパティフィルターで構造的に絞り込む", async () => {
    const cardbookPath = await createSearchCardbook();

    await expect(searchCardbook(cardbookPath, "draft", "frontmatter", "status")).resolves.toEqual({
      ok: true,
      value: [
        {
          cardName: "読書メモ",
          lineNumber: null,
          lineText: "status: draft",
          path: "読書メモ.md"
        }
      ]
    });
  });

  it("プロパティの配列フィールドも絞り込める", async () => {
    const cardbookPath = await createSearchCardbook();

    await expect(searchCardbook(cardbookPath, "自分", "frontmatter", "author")).resolves.toMatchObject({
      ok: true,
      value: [{ cardName: "読書メモ", path: "読書メモ.md" }]
    });
  });

  async function createSearchCardbook(): Promise<string> {
    const cardbookPath = await mkdtemp(path.join(os.tmpdir(), "relic-search-"));
    temporaryPaths.push(cardbookPath);
    await mkdir(path.join(cardbookPath, "cardFolder"));
    await writeFile(
      path.join(cardbookPath, "読書メモ.md"),
      "---\naliases: [別名メモ]\ntags: [資料]\nstatus: draft\nauthor: [自分, 編集者]\n---\n# 読書メモ\n本文ドラフト",
      "utf8"
    );
    await writeFile(path.join(cardbookPath, "cardFolder", "nested.md"), "#資料\n別本文", "utf8");
    await writeFile(
      path.join(cardbookPath, "deep-link.md"),
      "---\ntags: [links]\n---\nカードツリーのカードフォルダ開閉、リンク解決、検索確認です。",
      "utf8"
    );
    await writeFile(path.join(cardbookPath, "image.txt"), "ドラフト", "utf8");

    return cardbookPath;
  }
});
