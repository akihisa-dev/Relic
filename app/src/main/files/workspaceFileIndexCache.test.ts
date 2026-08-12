import { mkdir, mkdtemp, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  bumpWorkspaceFileIndexCacheGeneration,
  parseCachedWorkspaceFileIndex,
  transitionWorkspaceFileIndexCacheOwner,
  workspaceFileIndexCacheVersion,
  writeCachedWorkspaceFileIndexRecords
} from "./workspaceFileIndexCache";
import { readWorkspaceFileIndex } from "./workspaceFileIndex";
import {
  maxWorkspaceFileIndexAggregateLineBytes,
  maxWorkspaceFileIndexLinesPerRecord
} from "./workspaceFileIndexTypes";

describe("workspaceFileIndexCache", () => {
  const temporaryPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(temporaryPaths.splice(0).map((target) => rm(target, { force: true, recursive: true })));
  });

  it("現行versionの有効なレコードを解析する", () => {
    const records = parseCachedWorkspaceFileIndex(JSON.stringify({
      records: [{
        contentHash: "hash",
        kind: "markdown",
        lines: ["# Note"],
        mtimeMs: 1,
        name: "note",
        path: "note.md",
        readStatus: "ok",
        searchable: true,
        size: 6
      }],
      version: workspaceFileIndexCacheVersion
    }));

    expect(records).toMatchObject([{ kind: "markdown", path: "note.md", lines: ["# Note"] }]);
  });

  it("旧versionと壊れたJSONを拒否する", () => {
    expect(parseCachedWorkspaceFileIndex(JSON.stringify({ records: [], version: 1 }))).toBeNull();
    expect(parseCachedWorkspaceFileIndex("{" )).toBeNull();
  });

  it("不正なレコードだけを除外する", () => {
    const records = parseCachedWorkspaceFileIndex(JSON.stringify({
      records: [{ kind: "markdown", path: "missing-fields.md" }],
      version: workspaceFileIndexCacheVersion
    }));

    expect(records).toEqual([]);
  });

  it("cache recordのkind/path/数値と行budgetを厳密に検証する", () => {
    const valid = {
      contentHash: "hash",
      kind: "markdown",
      lines: ["ok"],
      mtimeMs: 1,
      name: "note",
      path: "note.md",
      readStatus: "ok",
      searchable: true,
      size: 2
    };
    const records = parseCachedWorkspaceFileIndex(JSON.stringify({
      records: [
        valid,
        { ...valid, kind: "diagram" },
        { ...valid, path: "../outside.md" },
        { ...valid, size: Number.MAX_SAFE_INTEGER + 1 },
        { ...valid, lines: Array.from({ length: maxWorkspaceFileIndexLinesPerRecord + 1 }, () => "x") },
        { ...valid, lines: ["x".repeat(maxWorkspaceFileIndexAggregateLineBytes)] }
      ],
      version: workspaceFileIndexCacheVersion
    }));

    expect(records).toEqual([expect.objectContaining({ path: "note.md" })]);
  });

  it("同一本文のlow後着writeでhigh本文行を劣化させない", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-cache-race-"));
    temporaryPaths.push(workspacePath);
    const cachePath = path.join(workspacePath, "index.json");
    await writeFile(path.join(workspacePath, "large.md"), `# Large\n${"x".repeat(64)}`, "utf8");

    const operations = {
      mkdir,
      readCache: (filePath: string) => readFile(filePath, "utf8"),
      readFile: (filePath: string) => readFile(filePath, "utf8"),
      readHead: async (filePath: string, byteLength: number) => (await readFile(filePath, "utf8")).slice(0, byteLength),
      stat,
      writeCache: async (filePath: string, content: string) => {
        const parsed = JSON.parse(content) as { records: Array<{ lines: string[] }> };
        if (parsed.records.some((record) => record.lines.length === 0)) {
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        await writeFile(filePath, content, "utf8");
      }
    };

    await Promise.all([
      readWorkspaceFileIndex(workspacePath, {
        cachePath,
        maxSearchFileBytes: 8,
        operations
      }),
      readWorkspaceFileIndex(workspacePath, {
        cachePath,
        maxSearchFileBytes: Number.MAX_SAFE_INTEGER,
        operations
      })
    ]);

    const cache = JSON.parse(await readFile(cachePath, "utf8")) as {
      records: Array<{ lines: string[]; searchable: boolean }>;
    };
    expect(cache.records).toMatchObject([{ searchable: true, lines: ["# Large", "x".repeat(64)] }]);
  });

  it("relink先が同じpath・size・mtimeでも旧ownerの本文行を再利用しない", async () => {
    const parentPath = await mkdtemp(path.join(os.tmpdir(), "relic-cache-owner-read-"));
    temporaryPaths.push(parentPath);
    const oldWorkspacePath = path.join(parentPath, "old");
    const newWorkspacePath = path.join(parentPath, "new");
    const cachePath = path.join(parentPath, "cache", "index.json");
    await mkdir(oldWorkspacePath);
    await mkdir(newWorkspacePath);
    const oldFilePath = path.join(oldWorkspacePath, "note.md");
    const newFilePath = path.join(newWorkspacePath, "note.md");
    await writeFile(oldFilePath, "old!", "utf8");
    await writeFile(newFilePath, "new!", "utf8");
    const fixedTime = new Date("2026-01-01T00:00:00.000Z");
    await utimes(oldFilePath, fixedTime, fixedTime);
    await utimes(newFilePath, fixedTime, fixedTime);

    await readWorkspaceFileIndex(oldWorkspacePath, { cachePath });
    await transitionWorkspaceFileIndexCacheOwner(cachePath, newWorkspacePath);
    const index = await readWorkspaceFileIndex(newWorkspacePath, { cachePath });

    expect(index.records[0]?.lines).toEqual(["new!"]);
    expect(index.stats.cachedContentHitCount).toBe(0);
    expect(index.stats.readFileCount).toBe(1);
    expect(JSON.parse(await readFile(cachePath, "utf8"))).toMatchObject({
      ownerPath: newWorkspacePath,
      records: [{ lines: ["new!"] }]
    });
  });

  it("partial writeで対象外recordを保持し、古いgenerationを拒否する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-cache-merge-"));
    temporaryPaths.push(workspacePath);
    const cachePath = path.join(workspacePath, "index.json");
    const operations = {
      mkdir,
      readCache: (filePath: string) => readFile(filePath, "utf8"),
      readFile: async () => "",
      readHead: async () => "",
      stat,
      writeCache: (filePath: string, content: string) => writeFile(filePath, content, "utf8")
    };
    const record = (filePath: string, lines: string[], headHash: string) => ({
      contentHash: `full-${filePath}`,
      headHash,
      kind: "markdown" as const,
      lines,
      mtimeMs: 1,
      name: filePath.replace(".md", ""),
      path: filePath,
      readStatus: "ok" as const,
      searchable: true,
      size: lines.join("\n").length
    });

    await writeCachedWorkspaceFileIndexRecords(
      cachePath,
      [record("a.md", ["a"], "head-a"), record("b.md", ["b"], "head-b")],
      new Map(),
      operations,
      { completeSnapshot: true, generation: 2, ownerPath: "/workspace/new" }
    );
    await writeCachedWorkspaceFileIndexRecords(
      cachePath,
      [record("a.md", ["a2"], "head-a2")],
      new Map(),
      operations,
      { completeSnapshot: false, generation: 2, ownerPath: "/workspace/new" }
    );
    await writeCachedWorkspaceFileIndexRecords(
      cachePath,
      [record("a.md", ["stale"], "head-stale")],
      new Map(),
      operations,
      { completeSnapshot: true, generation: 1, ownerPath: "/workspace/old" }
    );

    const records = parseCachedWorkspaceFileIndex(await readFile(cachePath, "utf8"));
    expect(records?.map((item) => item.path)).toEqual(["a.md", "b.md"]);
    expect(records?.find((item) => item.path === "a.md")?.lines).toEqual(["a2"]);
  });

  it("新しいgenerationのpartial writeでも対象外recordを保持する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-cache-generation-"));
    temporaryPaths.push(workspacePath);
    const cachePath = path.join(workspacePath, "index.json");
    const operations = {
      mkdir,
      readCache: (filePath: string) => readFile(filePath, "utf8"),
      readFile: async () => "",
      readHead: async () => "",
      stat,
      writeCache: (filePath: string, content: string) => writeFile(filePath, content, "utf8")
    };
    const record = (filePath: string, lines: string[], headHash: string) => ({
      contentHash: `full-${filePath}-${lines.join("")}`,
      headHash,
      kind: "markdown" as const,
      lines,
      mtimeMs: 1,
      name: filePath.replace(".md", ""),
      path: filePath,
      readStatus: "ok" as const,
      searchable: true,
      size: lines.join("\n").length
    });

    await writeCachedWorkspaceFileIndexRecords(
      cachePath,
      [record("a.md", ["a"], "head-a"), record("b.md", ["b"], "head-b")],
      new Map(),
      operations,
      { completeSnapshot: true, generation: 1, ownerPath: "/workspace" }
    );
    await writeCachedWorkspaceFileIndexRecords(
      cachePath,
      [record("a.md", ["a2"], "head-a2")],
      new Map(),
      operations,
      { completeSnapshot: false, generation: 2, ownerPath: "/workspace" }
    );

    const records = parseCachedWorkspaceFileIndex(await readFile(cachePath, "utf8"));
    expect(records?.map((item) => item.path)).toEqual(["a.md", "b.md"]);
    expect(records?.find((item) => item.path === "a.md")?.lines).toEqual(["a2"]);
  });

  it("relink後の新owner cacheを旧ownerの後着writeから保護する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-cache-relink-"));
    temporaryPaths.push(workspacePath);
    const cachePath = path.join(workspacePath, "index.json");
    const operations = {
      mkdir,
      readCache: (filePath: string) => readFile(filePath, "utf8"),
      readFile: async () => "",
      readHead: async () => "",
      stat,
      writeCache: (filePath: string, content: string) => writeFile(filePath, content, "utf8")
    };
    const record = (filePath: string, owner: string) => ({
      contentHash: owner,
      headHash: owner,
      kind: "markdown" as const,
      lines: [owner],
      mtimeMs: 1,
      name: filePath.replace(".md", ""),
      path: filePath,
      readStatus: "ok" as const,
      searchable: true,
      size: owner.length
    });

    await writeCachedWorkspaceFileIndexRecords(
      cachePath,
      [record("note.md", "old")],
      new Map(),
      operations,
      { completeSnapshot: true, generation: 0, ownerPath: "/workspace/old" }
    );
    const nextGeneration = await transitionWorkspaceFileIndexCacheOwner(
      cachePath,
      "/workspace/new",
      operations
    );
    const newOwnerWrite = writeCachedWorkspaceFileIndexRecords(
      cachePath,
      [record("note.md", "new")],
      new Map(),
      operations,
      { completeSnapshot: true, generation: nextGeneration, ownerPath: "/workspace/new" }
    );
    const staleOldWrite = writeCachedWorkspaceFileIndexRecords(
      cachePath,
      [record("note.md", "stale")],
      new Map(),
      operations,
      { completeSnapshot: true, generation: 0, ownerPath: "/workspace/old" }
    );
    await Promise.all([newOwnerWrite, staleOldWrite]);

    const cache = JSON.parse(await readFile(cachePath, "utf8")) as {
      generation: number;
      ownerPath: string;
      records: Array<{ lines: string[] }>;
    };
    expect(cache).toMatchObject({
      generation: nextGeneration,
      ownerPath: "/workspace/new",
      records: [{ lines: ["new"] }]
    });
  });

  it("owner切替中に開始した旧ownerの遅延readが新owner cacheを上書きしない", async () => {
    const parentPath = await mkdtemp(path.join(os.tmpdir(), "relic-cache-owner-late-read-"));
    temporaryPaths.push(parentPath);
    const oldWorkspacePath = path.join(parentPath, "old");
    const newWorkspacePath = path.join(parentPath, "new");
    const cachePath = path.join(parentPath, "cache", "index.json");
    await mkdir(oldWorkspacePath);
    await mkdir(newWorkspacePath);
    const oldFilePath = path.join(oldWorkspacePath, "note.md");
    const newFilePath = path.join(newWorkspacePath, "note.md");
    await writeFile(oldFilePath, "old!", "utf8");
    await writeFile(newFilePath, "new!", "utf8");
    const fixedTime = new Date("2026-01-03T00:00:00.000Z");
    await utimes(oldFilePath, fixedTime, fixedTime);
    await utimes(newFilePath, fixedTime, fixedTime);

    await readWorkspaceFileIndex(oldWorkspacePath, { cachePath });

    let releaseStat!: () => void;
    let signalStatStarted!: () => void;
    const statStarted = new Promise<void>((resolve) => {
      signalStatStarted = resolve;
    });
    const statGate = new Promise<void>((resolve) => {
      releaseStat = resolve;
    });
    let firstStat = true;
    const delayedOldReadOperations = {
      mkdir,
      readCache: (filePath: string) => readFile(filePath, "utf8"),
      readFile: (filePath: string) => readFile(filePath, "utf8"),
      readHead: async (filePath: string, byteLength: number) =>
        (await readFile(filePath, "utf8")).slice(0, byteLength),
      stat: async (filePath: string) => {
        if (firstStat) {
          firstStat = false;
          signalStatStarted();
          await statGate;
        }
        return stat(filePath);
      },
      writeCache: (filePath: string, content: string) => writeFile(filePath, content, "utf8")
    };

    const oldRead = readWorkspaceFileIndex(oldWorkspacePath, {
      cachePath,
      operations: delayedOldReadOperations
    });
    await statStarted;

    const nextGeneration = await transitionWorkspaceFileIndexCacheOwner(
      cachePath,
      newWorkspacePath,
      delayedOldReadOperations
    );
    expect(nextGeneration).toBe(1);
    releaseStat();
    const oldIndex = await oldRead;
    expect(oldIndex.records[0]?.lines).toEqual(["old!"]);

    const newIndex = await readWorkspaceFileIndex(newWorkspacePath, { cachePath });
    expect(newIndex.records[0]?.lines).toEqual(["new!"]);
    expect(JSON.parse(await readFile(cachePath, "utf8"))).toMatchObject({
      generation: nextGeneration,
      ownerPath: newWorkspacePath,
      records: [{ lines: ["new!"] }]
    });
  });

  it("再起動前の高い永続世代から新owner世代を発行して旧owner後着writeを拒否する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-cache-persisted-generation-"));
    temporaryPaths.push(workspacePath);
    const cachePath = path.join(workspacePath, "index.json");
    const operations = {
      mkdir,
      readCache: (filePath: string) => readFile(filePath, "utf8"),
      readFile: async () => "",
      readHead: async () => "",
      stat,
      writeCache: (filePath: string, content: string) => writeFile(filePath, content, "utf8")
    };
    const record = (owner: string) => ({
      contentHash: owner,
      headHash: owner,
      kind: "markdown" as const,
      lines: [owner],
      mtimeMs: 1,
      name: "note",
      path: "note.md",
      readStatus: "ok" as const,
      searchable: true,
      size: owner.length
    });
    await writeFile(cachePath, `${JSON.stringify({
      generation: 5,
      ownerPath: "/workspace/old",
      records: [record("old")],
      version: workspaceFileIndexCacheVersion
    }, null, 2)}\n`, "utf8");

    const nextGeneration = await transitionWorkspaceFileIndexCacheOwner(
      cachePath,
      "/workspace/new",
      operations
    );
    expect(nextGeneration).toBe(6);
    await writeCachedWorkspaceFileIndexRecords(
      cachePath,
      [record("new")],
      new Map(),
      operations,
      { completeSnapshot: true, generation: nextGeneration, ownerPath: "/workspace/new" }
    );
    await writeCachedWorkspaceFileIndexRecords(
      cachePath,
      [record("stale")],
      new Map(),
      operations,
      { completeSnapshot: true, generation: 5, ownerPath: "/workspace/old" }
    );

    expect(JSON.parse(await readFile(cachePath, "utf8"))).toMatchObject({
      generation: 6,
      ownerPath: "/workspace/new",
      records: [{ lines: ["new"] }]
    });
  });

  it("メモリ上のcache generation更新後は旧in-flight writeを拒否する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-cache-stale-generation-"));
    temporaryPaths.push(workspacePath);
    const cachePath = path.join(workspacePath, "index.json");
    const operations = {
      mkdir,
      readCache: (filePath: string) => readFile(filePath, "utf8"),
      readFile: async () => "",
      readHead: async () => "",
      stat,
      writeCache: (filePath: string, content: string) => writeFile(filePath, content, "utf8")
    };
    bumpWorkspaceFileIndexCacheGeneration(cachePath);
    await writeCachedWorkspaceFileIndexRecords(
      cachePath,
      [{
        contentHash: "stale",
        headHash: "stale",
        kind: "markdown",
        lines: ["stale"],
        mtimeMs: 1,
        name: "note",
        path: "note.md",
        readStatus: "ok",
        searchable: true,
        size: 5
      }],
      new Map(),
      operations,
      { completeSnapshot: true, generation: 0, ownerPath: "/workspace/old" }
    );

    await expect(readFile(cachePath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });
});
