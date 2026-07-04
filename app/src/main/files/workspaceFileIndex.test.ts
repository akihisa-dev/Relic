import { mkdir, mkdtemp, readFile, rm, stat as readStat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { getWorkspaceFileIndexCachePath, readWorkspaceFileIndex } from "./workspaceFileIndex";

describe("readWorkspaceFileIndex", () => {
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

  it("Markdownファイル一覧と行単位テキストを作る", async () => {
    const workspacePath = await createWorkspace();
    await writeFile(path.join(workspacePath, "note.md"), "# Note\n本文", "utf8");
    await writeFile(path.join(workspacePath, "extra.md"), "# Extra\n本文", "utf8");
    await writeFile(path.join(workspacePath, "ignored.txt"), "# ignored", "utf8");

    const index = await readWorkspaceFileIndex(workspacePath);

    expect(index.entries.map(({ kind, name, path: filePath, readStatus }) => ({
      kind,
      name,
      path: filePath,
      readStatus
    }))).toEqual([
      { kind: "markdown", name: "extra", path: "extra.md", readStatus: "ok" },
      { kind: "markdown", name: "note", path: "note.md", readStatus: "ok" }
    ]);
    expect(index.records.find((record) => record.path === "note.md")?.lines).toEqual(["# Note", "本文"]);
    expect(index.records.find((record) => record.path === "extra.md")?.lines).toEqual(["# Extra", "本文"]);
  });

  it("大文字のMarkdown拡張子を持つファイルも検索インデックスに含める", async () => {
    const workspacePath = await createWorkspace();
    await writeFile(path.join(workspacePath, "note.MD"), "# Note\nneedle", "utf8");

    const index = await readWorkspaceFileIndex(workspacePath);

    expect(index.entries).toMatchObject([
      {
        kind: "markdown",
        name: "note",
        path: "note.MD",
        readStatus: "ok"
      }
    ]);
    expect(index.records.find((record) => record.path === "note.MD")?.lines).toEqual([
      "# Note",
      "needle"
    ]);
  });

  it("Markdownだけをインデックス対象にする", async () => {
    const workspacePath = await createWorkspace();
    await writeFile(path.join(workspacePath, "note.md"), "# Title", "utf8");
    await writeFile(path.join(workspacePath, "ignored.txt"), "# Ignored", "utf8");

    const index = await readWorkspaceFileIndex(workspacePath);

    expect(index.entries.map((entry) => entry.path)).toEqual(["note.md"]);
  });

  it("キャッシュは本文行を保存して未変更ファイルの全文再読込を避ける", async () => {
    const workspacePath = await createWorkspace();
    const userDataPath = await createWorkspace("relic-index-user-data-");
    const cachePath = getWorkspaceFileIndexCachePath(userDataPath, "workspace_1");
    await writeFile(path.join(workspacePath, "note.md"), "needle\n本文", "utf8");

    await readWorkspaceFileIndex(workspacePath, { cachePath });
    const cacheRaw = await readFile(cachePath, "utf8");
    const cache = JSON.parse(cacheRaw);

    expect(cache.records[0].lines).toEqual(["needle", "本文"]);

    let readCount = 0;
    const index = await readWorkspaceFileIndex(workspacePath, {
      cachePath,
      operations: {
        async readFile(filePath) {
          readCount += 1;
          return readFile(filePath, "utf8");
        },
        stat: readStat
      }
    });

    expect(index.records.find((record) => record.path === "note.md")?.lines).toEqual(["needle", "本文"]);
    expect(index.stats.cachedContentHitCount).toBe(1);
    expect(readCount).toBe(0);
  });

  it("size/mtimeが変わった本文変更を検知して再生成する", async () => {
    const workspacePath = await createWorkspace();
    const userDataPath = await createWorkspace("relic-index-user-data-");
    const cachePath = getWorkspaceFileIndexCachePath(userDataPath, "workspace_1");
    const notePath = path.join(workspacePath, "note.md");
    await writeFile(notePath, "AAAAB", "utf8");

    await readWorkspaceFileIndex(workspacePath, { cachePath });

    await writeFile(notePath, "BBBBA\nchanged", "utf8");

    let readCount = 0;
    const index = await readWorkspaceFileIndex(workspacePath, {
      cachePath,
      operations: {
        async readFile(filePath) {
          readCount += 1;
          return readFile(filePath, "utf8");
        },
        readHead: async () => {
          return "";
        },
        stat: readStat
      }
    });

    expect(index.records.find((record) => record.path === "note.md")?.lines).toEqual(["BBBBA", "changed"]);
    expect(readCount).toBe(1);
  });

  it("検索本文が不要な場合は未変更ファイルを本文再読込せずキャッシュから一覧を返す", async () => {
    const workspacePath = await createWorkspace();
    const userDataPath = await createWorkspace("relic-index-user-data-");
    const cachePath = getWorkspaceFileIndexCachePath(userDataPath, "workspace_1");
    await writeFile(path.join(workspacePath, "note.md"), "needle", "utf8");

    await readWorkspaceFileIndex(workspacePath, { cachePath });

    let readCount = 0;
    const index = await readWorkspaceFileIndex(workspacePath, {
      cachePath,
      includeSearchContent: false,
      operations: {
        async readFile(filePath) {
          readCount += 1;
          return readFile(filePath, "utf8");
        },
        stat: readStat
      }
    });

    expect(index.entries).toMatchObject([{
      kind: "markdown",
      name: "note",
      path: "note.md",
      readStatus: "ok"
    }]);
    expect(index.records.find((record) => record.path === "note.md")?.lines).toEqual([]);
    expect(readCount).toBe(0);
  });

  it("全文が不要な読み取り後でも、キャッシュの本文を消さず再利用できる", async () => {
    const workspacePath = await createWorkspace();
    const userDataPath = await createWorkspace("relic-index-user-data-");
    const cachePath = getWorkspaceFileIndexCachePath(userDataPath, "workspace_1");
    const notePath = path.join(workspacePath, "note.md");
    await writeFile(notePath, "needle\n本文", "utf8");

    await readWorkspaceFileIndex(workspacePath, { cachePath });

    let readCount = 0;
    const noSearchContent = await readWorkspaceFileIndex(workspacePath, {
      cachePath,
      includeSearchContent: false,
      operations: {
        async readFile(filePath) {
          readCount += 1;
          return readFile(filePath, "utf8");
        },
        stat: readStat
      }
    });

    expect(noSearchContent.records.find((record) => record.path === "note.md")?.lines).toEqual([]);
    expect(readCount).toBe(0);

    const cacheRawAfterNoSearch = await readFile(cachePath, "utf8");
    expect(JSON.parse(cacheRawAfterNoSearch).records[0].lines).toEqual(["needle", "本文"]);

    readCount = 0;
    const index = await readWorkspaceFileIndex(workspacePath, {
      cachePath,
      operations: {
        async readFile(filePath) {
          readCount += 1;
          return readFile(filePath, "utf8");
        },
        stat: readStat
      }
    });

    expect(index.records.find((record) => record.path === "note.md")?.lines).toEqual(["needle", "本文"]);
    expect(readCount).toBe(0);
  });

  it("本文なしキャッシュは全文読み取り時に本文行を再保存する", async () => {
    const workspacePath = await createWorkspace();
    const userDataPath = await createWorkspace("relic-index-user-data-");
    const cachePath = getWorkspaceFileIndexCachePath(userDataPath, "workspace_1");
    const notePath = path.join(workspacePath, "note.md");
    await writeFile(notePath, "needle\n本文", "utf8");

    await readWorkspaceFileIndex(workspacePath, { cachePath });
    const cacheRaw = await readFile(cachePath, "utf8");
    const cache = JSON.parse(cacheRaw);
    cache.records[0].lines = [];
    await writeFile(cachePath, `${JSON.stringify(cache, null, 2)}\n`, "utf8");

    const index = await readWorkspaceFileIndex(workspacePath, { cachePath });

    expect(index.records.find((record) => record.path === "note.md")?.lines).toEqual(["needle", "本文"]);

    const cacheRawAfterRead = await readFile(cachePath, "utf8");
    expect(JSON.parse(cacheRawAfterRead).records[0].lines).toEqual(["needle", "本文"]);
  });

  it("旧バージョンキャッシュは安全に再生成される", async () => {
    const workspacePath = await createWorkspace();
    const userDataPath = await createWorkspace("relic-index-user-data-");
    const cachePath = getWorkspaceFileIndexCachePath(userDataPath, "workspace_1");
    await mkdir(path.dirname(cachePath), { recursive: true });
    await writeFile(path.join(workspacePath, "note.md"), "current", "utf8");
    await writeFile(
      cachePath,
      JSON.stringify({
        version: 2,
        records: [{
          kind: "markdown",
          path: "note.md",
          name: "note",
          mtimeMs: 0,
          size: 1,
          readStatus: "ok",
          searchable: true,
          lines: ["stale"]
        }]
      })
    );

    const index = await readWorkspaceFileIndex(workspacePath, {
      cachePath,
      operations: {
        readFile: (filePath) => readFile(filePath, "utf8"),
        readHead: async () => "",
        stat: readStat
      }
    });

    const cacheRaw = await readFile(cachePath, "utf8");
    const cache = JSON.parse(cacheRaw);

    expect(index.records.find((record) => record.path === "note.md")?.lines).toEqual(["current"]);
    expect(cache.version).toBe(5);
    expect(cache.records[0].lines).toEqual(["current"]);
  });

  it("大きすぎるMarkdownは全文検索用本文を持たない", async () => {
    const workspacePath = await createWorkspace();
    await writeFile(path.join(workspacePath, "large-note.md"), `# Large\n${"x".repeat(64)}`, "utf8");

    const index = await readWorkspaceFileIndex(workspacePath, {
      maxSearchFileBytes: 8,
      operations: {
        readFile: async () => {
          throw new Error("large file should not be fully read");
        }
      }
    });

    expect(index.records).toMatchObject([{
      kind: "markdown",
      lines: [],
      path: "large-note.md",
      searchable: false
    }]);
  });

  it("全量読み取り済みキャッシュがあっても現在のサイズ上限を超えるMarkdownは本文を読まない", async () => {
    const workspacePath = await createWorkspace();
    const userDataPath = await createWorkspace("relic-index-user-data-");
    const cachePath = getWorkspaceFileIndexCachePath(userDataPath, "workspace_1");
    await writeFile(path.join(workspacePath, "large-note.md"), `# Large\n${"x".repeat(64)}`, "utf8");

    await readWorkspaceFileIndex(workspacePath, {
      cachePath,
      maxSearchFileBytes: Number.MAX_SAFE_INTEGER
    });

    const index = await readWorkspaceFileIndex(workspacePath, {
      cachePath,
      maxSearchFileBytes: 8,
      operations: {
        async readFile() {
          throw new Error("large file should not be fully read");
        }
      }
    });

    expect(index.records).toMatchObject([{
      kind: "markdown",
      lines: [],
      path: "large-note.md",
      searchable: false
    }]);
  });

  it("サイズ上限で本文なしだったキャッシュも必要になれば全量読み取りへ更新する", async () => {
    const workspacePath = await createWorkspace();
    const userDataPath = await createWorkspace("relic-index-user-data-");
    const cachePath = getWorkspaceFileIndexCachePath(userDataPath, "workspace_1");
    await writeFile(path.join(workspacePath, "large-note.md"), `# Large\n${"x".repeat(64)}`, "utf8");

    await readWorkspaceFileIndex(workspacePath, {
      cachePath,
      maxSearchFileBytes: 8
    });

    let readCount = 0;
    const index = await readWorkspaceFileIndex(workspacePath, {
      cachePath,
      maxSearchFileBytes: Number.MAX_SAFE_INTEGER,
      operations: {
        async readFile(filePath) {
          readCount += 1;
          return readFile(filePath, "utf8");
        },
        stat: readStat
      }
    });

    expect(index.records.find((record) => record.path === "large-note.md")).toMatchObject({
      lines: ["# Large", "x".repeat(64)],
      searchable: true
    });
    expect(readCount).toBe(1);
  });

  it("fileTreeを渡すと、その木からMarkdownパスを抽出して対象を限定できる", async () => {
    const workspacePath = await createWorkspace();
    await writeFile(path.join(workspacePath, "note.md"), "# Note\n", "utf8");
    await writeFile(path.join(workspacePath, "skip.md"), "# Skip\n", "utf8");

    const index = await readWorkspaceFileIndex(workspacePath, {
      fileTree: [{ name: "note", path: "note.md", type: "file" }]
    });

    expect(index.entries.map(({ path: filePath }) => filePath)).toEqual(["note.md"]);
    expect(index.records).toHaveLength(1);
  });

  it("markdown path一覧を渡すと、その一覧だけを対象に索引化できる", async () => {
    const workspacePath = await createWorkspace();
    await writeFile(path.join(workspacePath, "note.md"), "# Note\n", "utf8");
    await writeFile(path.join(workspacePath, "skip.md"), "# Skip\n", "utf8");

    const index = await readWorkspaceFileIndex(workspacePath, {
      filePaths: ["skip.md"]
    });

    expect(index.entries.map(({ path: filePath }) => filePath)).toEqual(["skip.md"]);
    expect(index.records).toHaveLength(1);
  });

  it("読めないMarkdownがあっても全体を壊さない", async () => {
    const workspacePath = await createWorkspace();
    await writeFile(path.join(workspacePath, "blocked.md"), "needle", "utf8");
    await writeFile(path.join(workspacePath, "visible.md"), "needle", "utf8");

    const index = await readWorkspaceFileIndex(workspacePath, {
      operations: {
        async readFile(filePath) {
          if (filePath.endsWith("blocked.md")) {
            throw Object.assign(new Error("Permission denied"), { code: "EACCES" });
          }

          return readFile(filePath, "utf8");
        },
        stat: readStat
      }
    });

    expect(index.entries.map((entry) => ({ path: entry.path, readStatus: entry.readStatus }))).toEqual([
      { path: "blocked.md", readStatus: "unreadable" },
      { path: "visible.md", readStatus: "ok" }
    ]);
  });

  it("ワークスペース外を指すシンボリックリンクはMarkdown一覧に含めない", async () => {
    const workspacePath = await createWorkspace();
    const outsidePath = await createWorkspace("relic-index-outside-");
    await writeFile(path.join(outsidePath, "outside.md"), "outside", "utf8");
    await symlink(path.join(outsidePath, "outside.md"), path.join(workspacePath, "linked.md"));

    const index = await readWorkspaceFileIndex(workspacePath);

    expect(index.entries).toEqual([]);
  });

  async function createWorkspace(prefix = "relic-index-"): Promise<string> {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), prefix));
    temporaryPaths.push(workspacePath);
    await mkdir(workspacePath, { recursive: true });
    return workspacePath;
  }
});
