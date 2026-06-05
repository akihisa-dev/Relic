import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { applySearchAndReplace, replaceInFile, searchAndReplace } from "./replace";

describe("replaceInFile", () => {
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

    const result = await replaceInFile(ws, "note.md", "foo", "baz", false);

    expect(result).toEqual({ ok: true, value: { count: 2 } });
    await expect(readFile(path.join(ws, "note.md"), "utf8")).resolves.toBe("baz bar baz");
    await expect(readdir(ws)).resolves.toEqual(["note.md"]);
  });

  it("一致なしの場合はファイルを変更せず件数0を返す", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-replace-"));
    temporaryPaths.push(ws);

    await writeFile(path.join(ws, "note.md"), "hello world", "utf8");

    const result = await replaceInFile(ws, "note.md", "xyz", "abc", false);

    expect(result).toEqual({ ok: true, value: { count: 0 } });
    await expect(readFile(path.join(ws, "note.md"), "utf8")).resolves.toBe("hello world");
  });

  it("正規表現で置換できる", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-replace-"));
    temporaryPaths.push(ws);

    await writeFile(path.join(ws, "note.md"), "2024-01-01 と 2024-12-31", "utf8");

    const result = await replaceInFile(ws, "note.md", "\\d{4}-\\d{2}-\\d{2}", "[DATE]", true);

    expect(result).toEqual({ ok: true, value: { count: 2 } });
    await expect(readFile(path.join(ws, "note.md"), "utf8")).resolves.toBe("[DATE] と [DATE]");
  });

  it("通常文字列置換では置換後テキストの$記法を文字どおり扱う", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-replace-"));
    temporaryPaths.push(ws);

    await writeFile(path.join(ws, "note.md"), "foo foo", "utf8");

    const result = await replaceInFile(ws, "note.md", "foo", "$&-$1", false);

    expect(result).toEqual({ ok: true, value: { count: 2 } });
    await expect(readFile(path.join(ws, "note.md"), "utf8")).resolves.toBe("$&-$1 $&-$1");
  });

  it("正規表現置換ではキャプチャ参照を維持する", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-replace-"));
    temporaryPaths.push(ws);

    await writeFile(path.join(ws, "note.md"), "2026/06/05", "utf8");

    const result = await replaceInFile(ws, "note.md", "(\\d{4})/(\\d{2})/(\\d{2})", "$1-$2-$3", true);

    expect(result).toEqual({ ok: true, value: { count: 1 } });
    await expect(readFile(path.join(ws, "note.md"), "utf8")).resolves.toBe("2026-06-05");
  });

  it("無効な正規表現はエラーを返す", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-replace-"));
    temporaryPaths.push(ws);

    await writeFile(path.join(ws, "note.md"), "test", "utf8");

    const result = await replaceInFile(ws, "note.md", "[invalid", "ok", true);

    expect(result).toMatchObject({ ok: false });
  });

  it("空文字に一致する正規表現は置換せずエラーを返す", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-replace-"));
    temporaryPaths.push(ws);

    await writeFile(path.join(ws, "note.md"), "foo", "utf8");

    const result = await replaceInFile(ws, "note.md", "(?=foo)", "bar", true);

    expect(result).toMatchObject({
      error: expect.objectContaining({ code: "REPLACE_REGEX_EMPTY_MATCH" }),
      ok: false
    });
    await expect(readFile(path.join(ws, "note.md"), "utf8")).resolves.toBe("foo");
  });

  it("空文字に一致する正規表現プレビューはエラーを返す", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-replace-"));
    temporaryPaths.push(ws);

    await writeFile(path.join(ws, "note.md"), "foo", "utf8");

    const result = await searchAndReplace(ws, "^", "bar", true);

    expect(result).toMatchObject({
      error: expect.objectContaining({ code: "REPLACE_REGEX_EMPTY_MATCH" }),
      ok: false
    });
  });

  it("実体がワークスペース外のシンボリックリンクは置換しない", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-replace-"));
    const outside = await mkdtemp(path.join(os.tmpdir(), "relic-replace-outside-"));
    temporaryPaths.push(ws, outside);

    await writeFile(path.join(outside, "outside.md"), "foo", "utf8");
    await symlink(path.join(outside, "outside.md"), path.join(ws, "linked.md"));

    const result = await replaceInFile(ws, "linked.md", "foo", "bar", false);

    expect(result).toMatchObject({
      error: expect.objectContaining({ code: "WORKSPACE_PATH_OUTSIDE" }),
      ok: false
    });
    await expect(readFile(path.join(outside, "outside.md"), "utf8")).resolves.toBe("foo");
  });
});

describe("searchAndReplace", () => {
  const temporaryPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryPaths.splice(0).map((p) => rm(p, { force: true, recursive: true }))
    );
  });

  it("ワークスペース内の一致行を一覧にする", async () => {
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

  it("読めないMarkdownファイルはスキップして置換プレビューを続行する", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-replace-"));
    temporaryPaths.push(ws);

    await writeFile(path.join(ws, "blocked.md"), "hello blocked", "utf8");
    await writeFile(path.join(ws, "visible.md"), "hello visible", "utf8");

    const result = await searchAndReplace(ws, "hello", "hi", false, {
      async readFile(filePath, encoding) {
        if (path.basename(filePath) === "blocked.md") {
          throw Object.assign(new Error("Permission denied"), { code: "EACCES" });
        }

        return readFile(filePath, encoding);
      }
    });

    expect(result).toEqual({
      ok: true,
      value: [
        {
          lineNumber: 1,
          lineText: "hello visible",
          newLineText: "hi visible",
          path: "visible.md"
        }
      ]
    });
  });

  it("通常文字列の置換プレビューでも置換後テキストの$記法を文字どおり表示する", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-replace-"));
    temporaryPaths.push(ws);

    await writeFile(path.join(ws, "note.md"), "foo", "utf8");

    const result = await searchAndReplace(ws, "foo", "$&-$1", false);

    expect(result).toEqual({
      ok: true,
      value: [{
        lineNumber: 1,
        lineText: "foo",
        newLineText: "$&-$1",
        path: "note.md"
      }]
    });
  });
});

describe("applySearchAndReplace", () => {
  const temporaryPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryPaths.splice(0).map((p) => rm(p, { force: true, recursive: true }))
    );
  });

  it("全ファイルに置換を適用して件数を返す", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-replace-"));
    temporaryPaths.push(ws);
    await mkdir(path.join(ws, "sub"));

    await writeFile(path.join(ws, "a.md"), "foo bar", "utf8");
    await writeFile(path.join(ws, "sub", "b.md"), "foo baz", "utf8");

    const result = await applySearchAndReplace(ws, "foo", "qux", false);

    expect(result).toEqual({ ok: true, value: { count: 2 } });
    await expect(readFile(path.join(ws, "a.md"), "utf8")).resolves.toBe("qux bar");
    await expect(readFile(path.join(ws, "sub", "b.md"), "utf8")).resolves.toBe("qux baz");
    await expect(readdir(ws)).resolves.toEqual(["a.md", "sub"]);
    await expect(readdir(path.join(ws, "sub"))).resolves.toEqual(["b.md"]);
  });

  it("一括置換の通常文字列でも置換後テキストの$記法を文字どおり扱う", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-replace-"));
    temporaryPaths.push(ws);

    await writeFile(path.join(ws, "a.md"), "foo", "utf8");
    await writeFile(path.join(ws, "b.md"), "foo", "utf8");

    const result = await applySearchAndReplace(ws, "foo", "$&", false);

    expect(result).toEqual({ ok: true, value: { count: 2 } });
    await expect(readFile(path.join(ws, "a.md"), "utf8")).resolves.toBe("$&");
    await expect(readFile(path.join(ws, "b.md"), "utf8")).resolves.toBe("$&");
  });

  it("読めないMarkdownファイルはスキップして一括置換を続行する", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-replace-"));
    temporaryPaths.push(ws);

    await writeFile(path.join(ws, "blocked.md"), "foo blocked", "utf8");
    await writeFile(path.join(ws, "visible.md"), "foo visible", "utf8");

    const result = await applySearchAndReplace(ws, "foo", "bar", false, {
      async readFile(filePath, encoding) {
        if (path.basename(filePath) === "blocked.md") {
          throw Object.assign(new Error("Permission denied"), { code: "EACCES" });
        }

        return readFile(filePath, encoding);
      }
    });

    expect(result).toEqual({ ok: true, value: { count: 1 } });
    await expect(readFile(path.join(ws, "blocked.md"), "utf8")).resolves.toBe("foo blocked");
    await expect(readFile(path.join(ws, "visible.md"), "utf8")).resolves.toBe("bar visible");
  });

  it("一括置換でも空文字に一致する正規表現は書き換えない", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-replace-"));
    temporaryPaths.push(ws);

    await writeFile(path.join(ws, "a.md"), "foo", "utf8");
    await writeFile(path.join(ws, "b.md"), "foo", "utf8");

    const result = await applySearchAndReplace(ws, "(?=foo)", "bar", true);

    expect(result).toMatchObject({
      error: expect.objectContaining({ code: "REPLACE_REGEX_EMPTY_MATCH" }),
      ok: false
    });
    await expect(readFile(path.join(ws, "a.md"), "utf8")).resolves.toBe("foo");
    await expect(readFile(path.join(ws, "b.md"), "utf8")).resolves.toBe("foo");
  });
});
