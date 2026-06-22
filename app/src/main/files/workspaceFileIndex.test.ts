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

  it("キャッシュは本文行を保存しない", async () => {
    const workspacePath = await createWorkspace();
    const userDataPath = await createWorkspace("relic-index-user-data-");
    const cachePath = getWorkspaceFileIndexCachePath(userDataPath, "workspace_1");
    await writeFile(path.join(workspacePath, "note.md"), "needle", "utf8");

    await readWorkspaceFileIndex(workspacePath, { cachePath });
    const cacheRaw = await readFile(cachePath, "utf8");
    const cache = JSON.parse(cacheRaw);

    expect(cache.records[0]).not.toHaveProperty("lines");
  });

  it("size/mtimeが一致しても本文変更を検知して再生成する", async () => {
    const workspacePath = await createWorkspace();
    const userDataPath = await createWorkspace("relic-index-user-data-");
    const cachePath = getWorkspaceFileIndexCachePath(userDataPath, "workspace_1");
    const notePath = path.join(workspacePath, "note.md");
    await writeFile(notePath, "AAAAB", "utf8");

    await readWorkspaceFileIndex(workspacePath, { cachePath });

    const originalStat = await readStat(notePath);
    await writeFile(notePath, "BBBBA", "utf8");

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
        async stat() {
          return originalStat;
        }
      }
    });

    expect(index.records.find((record) => record.path === "note.md")?.lines).toEqual(["BBBBA"]);
    expect(readCount).toBe(2);
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
    expect(cache.version).toBe(4);
    expect(cache.records[0]).not.toHaveProperty("lines");
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
