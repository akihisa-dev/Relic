import { chmod, mkdir, mkdtemp, readdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  applySearchAndReplace,
  replaceInFile,
  searchAndReplace,
  searchAndReplacePreviewMaxResults
} from "./replace";
import { regexMaxLineLength, regexMaxPatternLength } from "./regexSafety";

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

  it.runIf(process.platform !== "win32")("単一置換後も既存Markdownのmodeを保持する", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-replace-mode-"));
    temporaryPaths.push(ws);
    const notePath = path.join(ws, "note.md");

    await writeFile(notePath, "foo", "utf8");
    await chmod(notePath, 0o600);
    await replaceInFile(ws, "note.md", "foo", "bar", false);

    expect((await stat(notePath)).mode & 0o777).toBe(0o600);
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

  it("重すぎる可能性がある正規表現置換は実行前に拒否する", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-replace-"));
    temporaryPaths.push(ws);

    await writeFile(path.join(ws, "note.md"), "aaaaaaaaaaaaaaaa!", "utf8");

    await expect(replaceInFile(ws, "note.md", "(a+)+$", "ok", true)).resolves.toMatchObject({
      error: expect.objectContaining({ code: "REGEX_TOO_COMPLEX" }),
      ok: false
    });
    await expect(replaceInFile(ws, "note.md", "a".repeat(regexMaxPatternLength + 1), "ok", true)).resolves.toMatchObject({
      error: expect.objectContaining({ code: "REGEX_TOO_COMPLEX" }),
      ok: false
    });
    await expect(readFile(path.join(ws, "note.md"), "utf8")).resolves.toBe("aaaaaaaaaaaaaaaa!");
  });

  it("正規表現置換では長すぎる行を含むファイルを変更しない", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-replace-"));
    temporaryPaths.push(ws);

    await writeFile(path.join(ws, "note.md"), `${"a".repeat(regexMaxLineLength + 1)}\nneedle`, "utf8");

    const result = await replaceInFile(ws, "note.md", "needle", "ok", true);

    expect(result).toMatchObject({
      error: expect.objectContaining({ code: "REGEX_TARGET_TOO_LONG" }),
      ok: false
    });
    await expect(readFile(path.join(ws, "note.md"), "utf8")).resolves.toBe(`${"a".repeat(regexMaxLineLength + 1)}\nneedle`);
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

  it("本文内で空文字に一致する正規表現は置換せずエラーを返す", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-replace-"));
    temporaryPaths.push(ws);

    await writeFile(path.join(ws, "note.md"), "needle", "utf8");

    const result = await replaceInFile(ws, "note.md", "(?=needle)", "bar", true);

    expect(result).toMatchObject({
      error: expect.objectContaining({ code: "REPLACE_REGEX_EMPTY_MATCH" }),
      ok: false
    });
    await expect(readFile(path.join(ws, "note.md"), "utf8")).resolves.toBe("needle");
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

  it("本文内で空文字に一致する正規表現プレビューはエラーを返す", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-replace-"));
    temporaryPaths.push(ws);

    await writeFile(path.join(ws, "note.md"), "needle", "utf8");

    const result = await searchAndReplace(ws, "(?=needle)", "bar", true);

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

    expect(result.value.matches).toHaveLength(2);
    expect(result.value.fileSnapshots).toEqual([
      { contentHash: expect.any(String), path: "a.md" },
      { contentHash: expect.any(String), path: "b.md" }
    ]);
    expect(result.value.skippedUnreadableFiles).toEqual([]);
    expect(result.value.truncated).toBe(false);
    expect(result.value.matches[0].lineText).toContain("hello world");
    expect(result.value.matches[0].newLineText).toContain("hi world");
  });

  it("読めないMarkdownファイルを置換プレビュー結果に反映する", async () => {
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
      value: {
        fileSnapshots: [
          { contentHash: expect.any(String), path: "visible.md" }
        ],
        matches: [
          {
            lineNumber: 1,
            lineText: "hello visible",
            newLineText: "hi visible",
            path: "visible.md"
          }
        ],
        skippedUnreadableFiles: ["blocked.md"],
        truncated: false
      }
    });
  });

  it("置換プレビューではワークスペース外を指すシンボリックリンクを対象に含めない", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-replace-"));
    const outside = await mkdtemp(path.join(os.tmpdir(), "relic-replace-outside-"));
    temporaryPaths.push(ws, outside);

    await writeFile(path.join(ws, "visible.md"), "foo visible", "utf8");
    await writeFile(path.join(outside, "outside.md"), "foo outside", "utf8");
    await symlink(path.join(outside, "outside.md"), path.join(ws, "linked.md"));

    const result = await searchAndReplace(ws, "foo", "bar", false);

    expect(result).toEqual({
      ok: true,
      value: {
        fileSnapshots: [
          { contentHash: expect.any(String), path: "visible.md" }
        ],
        matches: [
          {
            lineNumber: 1,
            lineText: "foo visible",
            newLineText: "bar visible",
            path: "visible.md"
          }
        ],
        skippedUnreadableFiles: [],
        truncated: false
      }
    });
    await expect(readFile(path.join(outside, "outside.md"), "utf8")).resolves.toBe("foo outside");
  });

  it("置換プレビューの一致件数を上限で打ち切る", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-replace-"));
    temporaryPaths.push(ws);

    await writeFile(
      path.join(ws, "many.md"),
      Array.from({ length: searchAndReplacePreviewMaxResults + 1 }, () => "hello").join("\n"),
      "utf8"
    );

    const result = await searchAndReplace(ws, "hello", "hi", false);

    expect(result.ok).toBe(true);

    if (!result.ok) return;

    expect(result.value.matches).toHaveLength(searchAndReplacePreviewMaxResults);
    expect(result.value.fileSnapshots).toEqual([
      { contentHash: expect.any(String), path: "many.md" }
    ]);
    expect(result.value.truncated).toBe(true);
    expect(result.value.skippedUnreadableFiles).toEqual([]);
  });

  it("表示上限後も全一致ファイルのスナップショットを集めて一括置換できる", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-replace-"));
    temporaryPaths.push(ws);

    await writeFile(
      path.join(ws, "a.md"),
      Array.from({ length: searchAndReplacePreviewMaxResults }, () => "hello").join("\n"),
      "utf8"
    );
    await writeFile(path.join(ws, "b.md"), "hello after limit", "utf8");

    const preview = await searchAndReplace(ws, "hello", "hi", false);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;

    expect(preview.value.matches).toHaveLength(searchAndReplacePreviewMaxResults);
    expect(preview.value.truncated).toBe(true);
    expect(preview.value.fileSnapshots).toEqual([
      { contentHash: expect.any(String), path: "a.md" },
      { contentHash: expect.any(String), path: "b.md" }
    ]);

    const result = await applySearchAndReplace(
      ws,
      "hello",
      "hi",
      false,
      undefined,
      preview.value.fileSnapshots
    );

    expect(result).toEqual({
      ok: true,
      value: { count: searchAndReplacePreviewMaxResults + 1, skippedUnreadableFiles: [] }
    });
    await expect(readFile(path.join(ws, "b.md"), "utf8")).resolves.toBe("hi after limit");
  });

  it("表示上限後の一致ファイルが変更された場合も一括置換を止める", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-replace-"));
    temporaryPaths.push(ws);
    const afterLimitPath = path.join(ws, "b.md");

    await writeFile(
      path.join(ws, "a.md"),
      Array.from({ length: searchAndReplacePreviewMaxResults }, () => "hello").join("\n"),
      "utf8"
    );
    await writeFile(afterLimitPath, "hello before", "utf8");

    const preview = await searchAndReplace(ws, "hello", "hi", false);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;

    await writeFile(afterLimitPath, "hello changed", "utf8");
    const result = await applySearchAndReplace(
      ws,
      "hello",
      "hi",
      false,
      undefined,
      preview.value.fileSnapshots
    );

    expect(result).toMatchObject({
      error: { code: "REPLACE_PREVIEW_STALE" },
      ok: false
    });
    await expect(readFile(afterLimitPath, "utf8")).resolves.toBe("hello changed");
  });

  it("置換プレビューの本文読み込みを並列数制限付きで行う", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-replace-"));
    temporaryPaths.push(ws);

    for (let index = 0; index < 12; index += 1) {
      await writeFile(path.join(ws, `note-${index}.md`), "hello", "utf8");
    }

    let activeReads = 0;
    let maxActiveReads = 0;
    const result = await searchAndReplace(ws, "hello", "hi", false, {
      async readFile(filePath, encoding) {
        activeReads += 1;
        maxActiveReads = Math.max(maxActiveReads, activeReads);
        await new Promise((resolve) => setTimeout(resolve, 10));

        try {
          return await readFile(filePath, encoding);
        } finally {
          activeReads -= 1;
        }
      }
    });

    expect(result.ok).toBe(true);
    expect(maxActiveReads).toBeLessThanOrEqual(8);
  });

  it("通常文字列の置換プレビューでも置換後テキストの$記法を文字どおり表示する", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-replace-"));
    temporaryPaths.push(ws);

    await writeFile(path.join(ws, "note.md"), "foo", "utf8");

    const result = await searchAndReplace(ws, "foo", "$&-$1", false);

    expect(result).toEqual({
      ok: true,
      value: {
        fileSnapshots: [
          { contentHash: expect.any(String), path: "note.md" }
        ],
        matches: [{
          lineNumber: 1,
          lineText: "foo",
          newLineText: "$&-$1",
          path: "note.md"
        }],
        skippedUnreadableFiles: [],
        truncated: false
      }
    });
  });

  it("正規表現置換プレビューでは長すぎる行を含むファイルを拒否する", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-replace-"));
    temporaryPaths.push(ws);

    await writeFile(path.join(ws, "note.md"), `${"a".repeat(regexMaxLineLength + 1)}\nneedle`, "utf8");

    const result = await searchAndReplace(ws, "needle", "ok", true);

    expect(result).toMatchObject({
      error: expect.objectContaining({ code: "REGEX_TARGET_TOO_LONG" }),
      ok: false
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

    expect(result).toEqual({ ok: true, value: { count: 2, skippedUnreadableFiles: [] } });
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

    expect(result).toEqual({ ok: true, value: { count: 2, skippedUnreadableFiles: [] } });
    await expect(readFile(path.join(ws, "a.md"), "utf8")).resolves.toBe("$&");
    await expect(readFile(path.join(ws, "b.md"), "utf8")).resolves.toBe("$&");
  });

  it("プレビュー後に対象ファイルが変更された場合は一括置換を止める", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-replace-"));
    temporaryPaths.push(ws);

    const notePath = path.join(ws, "note.md");
    await writeFile(notePath, "foo before", "utf8");

    const preview = await searchAndReplace(ws, "foo", "bar", false);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;

    await writeFile(notePath, "foo changed", "utf8");
    const result = await applySearchAndReplace(
      ws,
      "foo",
      "bar",
      false,
      undefined,
      preview.value.fileSnapshots
    );

    expect(result).toMatchObject({
      error: expect.objectContaining({ code: "REPLACE_PREVIEW_STALE" }),
      ok: false
    });
    await expect(readFile(notePath, "utf8")).resolves.toBe("foo changed");
  });

  it("プレビュー後に対象ファイルが変わっていない場合は検証付きで一括置換できる", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-replace-"));
    temporaryPaths.push(ws);

    const notePath = path.join(ws, "note.md");
    await writeFile(notePath, "foo before", "utf8");

    const preview = await searchAndReplace(ws, "foo", "bar", false);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;

    const result = await applySearchAndReplace(
      ws,
      "foo",
      "bar",
      false,
      undefined,
      preview.value.fileSnapshots
    );

    expect(result).toEqual({ ok: true, value: { count: 1, skippedUnreadableFiles: [] } });
    await expect(readFile(notePath, "utf8")).resolves.toBe("bar before");
  });

  it("読めないMarkdownファイルを一括置換結果に反映する", async () => {
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

    expect(result).toEqual({ ok: true, value: { count: 1, skippedUnreadableFiles: ["blocked.md"] } });
    await expect(readFile(path.join(ws, "blocked.md"), "utf8")).resolves.toBe("foo blocked");
    await expect(readFile(path.join(ws, "visible.md"), "utf8")).resolves.toBe("bar visible");
  });

  it("一括置換ではワークスペース外を指すシンボリックリンクを書き換えない", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-replace-"));
    const outside = await mkdtemp(path.join(os.tmpdir(), "relic-replace-outside-"));
    temporaryPaths.push(ws, outside);

    await writeFile(path.join(ws, "visible.md"), "foo visible", "utf8");
    await writeFile(path.join(outside, "outside.md"), "foo outside", "utf8");
    await symlink(path.join(outside, "outside.md"), path.join(ws, "linked.md"));

    const result = await applySearchAndReplace(ws, "foo", "bar", false);

    expect(result).toEqual({ ok: true, value: { count: 1, skippedUnreadableFiles: [] } });
    await expect(readFile(path.join(ws, "visible.md"), "utf8")).resolves.toBe("bar visible");
    await expect(readFile(path.join(outside, "outside.md"), "utf8")).resolves.toBe("foo outside");
  });

  it("一括置換の途中で書き込みに失敗した場合は書き込み済みファイルを元に戻す", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-replace-"));
    temporaryPaths.push(ws);

    const firstPath = path.join(ws, "a.md");
    const secondPath = path.join(ws, "b.md");
    let writeCount = 0;

    await writeFile(firstPath, "foo first", "utf8");
    await writeFile(secondPath, "foo second", "utf8");

    const result = await applySearchAndReplace(ws, "foo", "bar", false, {
      readFile,
      async writeTextFile(filePath, content) {
        writeCount += 1;
        if (writeCount === 2) {
          throw new Error("disk full");
        }

        await writeFile(filePath, content, "utf8");
      }
    });

    expect(result).toMatchObject({
      error: expect.objectContaining({ code: "REPLACE_FAILED" }),
      ok: false
    });
    await expect(readFile(firstPath, "utf8")).resolves.toBe("foo first");
    await expect(readFile(secondPath, "utf8")).resolves.toBe("foo second");
  });

  it("一括置換のロールバック中に外部変更がある場合は上書きしない", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-replace-"));
    temporaryPaths.push(ws);

    const firstPath = path.join(ws, "a.md");
    const secondPath = path.join(ws, "b.md");
    let writeCount = 0;

    await writeFile(firstPath, "foo first", "utf8");
    await writeFile(secondPath, "foo second", "utf8");

    const result = await applySearchAndReplace(ws, "foo", "bar", false, {
      readFile,
      async writeTextFile(filePath, content) {
        writeCount += 1;
        if (writeCount === 2) {
          await writeFile(firstPath, "external change", "utf8");
          throw new Error("disk full");
        }

        await writeFile(filePath, content, "utf8");
      }
    });

    expect(result).toMatchObject({
      error: expect.objectContaining({ code: "REPLACE_FAILED" }),
      ok: false
    });
    await expect(readFile(firstPath, "utf8")).resolves.toBe("external change");
    await expect(readFile(secondPath, "utf8")).resolves.toBe("foo second");
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

  it("一括置換でも本文内で空文字に一致する正規表現は書き換えない", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-replace-"));
    temporaryPaths.push(ws);

    await writeFile(path.join(ws, "a.md"), "safe", "utf8");
    await writeFile(path.join(ws, "b.md"), "needle", "utf8");

    const result = await applySearchAndReplace(ws, "(?=needle)", "bar", true);

    expect(result).toMatchObject({
      error: expect.objectContaining({ code: "REPLACE_REGEX_EMPTY_MATCH" }),
      ok: false
    });
    await expect(readFile(path.join(ws, "a.md"), "utf8")).resolves.toBe("safe");
    await expect(readFile(path.join(ws, "b.md"), "utf8")).resolves.toBe("needle");
  });

  it("一括正規表現置換では長すぎる行を含むファイルがある場合に書き換えない", async () => {
    const ws = await mkdtemp(path.join(os.tmpdir(), "relic-replace-"));
    temporaryPaths.push(ws);

    await writeFile(path.join(ws, "safe.md"), "needle", "utf8");
    await writeFile(path.join(ws, "long.md"), `${"a".repeat(regexMaxLineLength + 1)}\nneedle`, "utf8");

    const result = await applySearchAndReplace(ws, "needle", "ok", true);

    expect(result).toMatchObject({
      error: expect.objectContaining({ code: "REGEX_TARGET_TOO_LONG" }),
      ok: false
    });
    await expect(readFile(path.join(ws, "safe.md"), "utf8")).resolves.toBe("needle");
    await expect(readFile(path.join(ws, "long.md"), "utf8")).resolves.toBe(`${"a".repeat(regexMaxLineLength + 1)}\nneedle`);
  });
});
