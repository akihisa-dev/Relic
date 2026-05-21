import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { applySearchAndReplace, replaceInCard, searchAndReplace } from "./replace";

describe("replaceInCard", () => {
  const temporaryPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryPaths.splice(0).map((p) => rm(p, { force: true, recursive: true }))
    );
  });

  it("文字列を置換して件数を返す", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-replace-"));
    temporaryPaths.push(ws);

    await writeFile(path.join(ws, "note.md"), "foo bar foo", "utf8");

    const result = await replaceInCard(ws, "note.md", "foo", "baz", false);

    expect(result).toEqual({ ok: true, value: { count: 2 } });
    await expect(readFile(path.join(ws, "note.md"), "utf8")).resolves.toBe("baz bar baz");
  });

  it("一致なしの場合はカードを変更せず件数0を返す", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-replace-"));
    temporaryPaths.push(ws);

    await writeFile(path.join(ws, "note.md"), "hello world", "utf8");

    const result = await replaceInCard(ws, "note.md", "xyz", "abc", false);

    expect(result).toEqual({ ok: true, value: { count: 0 } });
    await expect(readFile(path.join(ws, "note.md"), "utf8")).resolves.toBe("hello world");
  });

  it("正規表現で置換できる", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-replace-"));
    temporaryPaths.push(ws);

    await writeFile(path.join(ws, "note.md"), "2024-01-01 と 2024-12-31", "utf8");

    const result = await replaceInCard(ws, "note.md", "\\d{4}-\\d{2}-\\d{2}", "[DATE]", true);

    expect(result).toEqual({ ok: true, value: { count: 2 } });
    await expect(readFile(path.join(ws, "note.md"), "utf8")).resolves.toBe("[DATE] と [DATE]");
  });

  it("無効な正規表現はエラーを返す", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-replace-"));
    temporaryPaths.push(ws);

    await writeFile(path.join(ws, "note.md"), "test", "utf8");

    const result = await replaceInCard(ws, "note.md", "[invalid", "ok", true);

    expect(result).toMatchObject({ ok: false });
  });
});

describe("searchAndReplace", () => {
  const temporaryPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryPaths.splice(0).map((p) => rm(p, { force: true, recursive: true }))
    );
  });

  it("カードブック内の一致行を一覧にする", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-replace-"));
    temporaryPaths.push(ws);

    await writeFile(path.join(ws, "a.md"), "hello world\nfoo bar", "utf8");
    await writeFile(path.join(ws, "b.md"), "hello again", "utf8");

    const result = await searchAndReplace(ws, "hello", "hi", false);

    expect(result.ok).toBe(true);

    if (!result.ok) return;

    expect(result.value).toHaveLength(2);
    expect(result.value[0].lineText).toContain("hello world");
    expect(result.value[0].newLineText).toContain("hi world");
  });
});

describe("applySearchAndReplace", () => {
  const temporaryPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryPaths.splice(0).map((p) => rm(p, { force: true, recursive: true }))
    );
  });

  it("全カードに置換を適用して件数を返す", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-replace-"));
    temporaryPaths.push(ws);
    await mkdir(path.join(ws, "sub"));

    await writeFile(path.join(ws, "a.md"), "foo bar", "utf8");
    await writeFile(path.join(ws, "sub", "b.md"), "foo baz", "utf8");

    const result = await applySearchAndReplace(ws, "foo", "qux", false);

    expect(result).toEqual({ ok: true, value: { count: 2 } });
    await expect(readFile(path.join(ws, "a.md"), "utf8")).resolves.toBe("qux bar");
    await expect(readFile(path.join(ws, "sub", "b.md"), "utf8")).resolves.toBe("qux baz");
  });
});
