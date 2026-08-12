import { mkdtemp, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { readWorkspaceAliases } from "./aliases";
import { readWorkspaceTags } from "./tags";
import {
  aliasesForRecord,
  chartEntriesForRecord,
  frontmatterForRecord,
  inspectedFrontmatterForRecord,
  markdownContentForRecord,
  tagsForRecord
} from "./workspaceDerivedData";
import { WorkspaceDerivedDataSession } from "./workspaceDerivedDataSession";

const temporaryPaths: string[] = [];

async function createWorkspace(): Promise<string> {
  const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-derived-session-"));
  temporaryPaths.push(workspacePath);
  await writeFile(
    path.join(workspacePath, "note.md"),
    [
      "---",
      "tags:",
      "  - 資料",
      "aliases:",
      "  - ノート別名",
      "---",
      "# Note"
    ].join("\n"),
    "utf8"
  );
  return workspacePath;
}

describe("WorkspaceDerivedDataSession", () => {
  afterEach(async () => {
    await Promise.all(temporaryPaths.splice(0).map((target) =>
      rm(target, { force: true, recursive: true })
    ));
  });

  it("同じワークスペースへの同時要求で同じ読み取りPromiseを共有する", async () => {
    const workspacePath = await createWorkspace();
    const session = new WorkspaceDerivedDataSession(() => 1000);
    let readCount = 0;

    const request = {
      filePaths: ["note.md"],
      operations: {
        readFile: async (filePath: string) => {
          readCount += 1;
          await new Promise((resolve) => setTimeout(resolve, 10));
          return readFile(filePath, "utf8");
        },
        stat
      },
      workspaceId: "ws-1",
      workspacePath
    };

    const [first, second] = await Promise.all([
      session.getSnapshot(request),
      session.getSnapshot(request)
    ]);

    expect(first).toBe(second);
    expect(readCount).toBe(1);
  });

  it("初回読込が失敗した場合は直後の再要求で読み直す", async () => {
    const workspacePath = await createWorkspace();
    const session = new WorkspaceDerivedDataSession(() => 1000);
    let failInitialRead = true;
    const request = {
      filePaths: ["note.md"],
      operations: {
        readFile: (filePath: string) => readFile(filePath, "utf8"),
        get stat() {
          if (failInitialRead) {
            failInitialRead = false;
            throw new Error("initial read failed");
          }
          return stat;
        }
      },
      workspaceId: "ws-1",
      workspacePath
    };

    await expect(session.getSnapshot(request)).rejects.toThrow("initial read failed");
    await expect(session.getSnapshot(request)).resolves.toMatchObject({
      fileIndex: { records: [{ path: "note.md", readStatus: "ok" }] }
    });
  });

  it("明示的な破棄後は次の要求でMarkdownを読み直す", async () => {
    const workspacePath = await createWorkspace();
    const session = new WorkspaceDerivedDataSession(() => 1000);
    let readCount = 0;

    const request = {
      filePaths: ["note.md"],
      operations: {
        readFile: async (filePath: string) => {
          readCount += 1;
          return readFile(filePath, "utf8");
        },
        stat
      },
      workspaceId: "ws-1",
      workspacePath
    };

    await session.getSnapshot(request);
    session.invalidate("ws-1");
    await session.getSnapshot(request);

    expect(readCount).toBe(2);
  });

  it("変更パスが既知の場合は対象ファイルだけを再読込する", async () => {
    const workspacePath = await createWorkspace();
    await writeFile(path.join(workspacePath, "other.md"), "# Other\n", "utf8");
    const session = new WorkspaceDerivedDataSession(() => 1000);
    let readCount = 0;
    let statCount = 0;
    const request = {
      filePaths: ["note.md", "other.md"],
      operations: {
        readFile: async (filePath: string) => {
          readCount += 1;
          return readFile(filePath, "utf8");
        },
        stat: async (filePath: string) => {
          statCount += 1;
          return stat(filePath);
        }
      },
      workspaceId: "ws-1",
      workspacePath
    };

    await session.getSnapshot(request);
    readCount = 0;
    statCount = 0;
    await writeFile(path.join(workspacePath, "note.md"), "# Updated\n", "utf8");

    session.invalidate("ws-1", ["note.md"]);
    const refreshed = await session.getSnapshot(request);

    expect(readCount).toBe(1);
    expect(statCount).toBe(2);
    expect(refreshed.fileIndex.records.map((record) => record.path)).toEqual(["note.md", "other.md"]);
    expect(refreshed.fileIndex.records.find((record) => record.path === "note.md")?.lines).toEqual(["# Updated", ""]);
  });

  it("変更パスはsizeとmtimeが同じでも永続cacheを使わず本文を再読込する", async () => {
    const workspacePath = await createWorkspace();
    const notePath = path.join(workspacePath, "note.md");
    const cachePath = path.join(workspacePath, "cache", "index.json");
    await writeFile(notePath, "old!", "utf8");
    const fixedTime = new Date("2026-01-02T00:00:00.000Z");
    await utimes(notePath, fixedTime, fixedTime);
    const session = new WorkspaceDerivedDataSession(() => 1000);
    let readCount = 0;
    const request = {
      cachePath,
      filePaths: ["note.md"],
      operations: {
        readFile: async (filePath: string) => {
          readCount += 1;
          return readFile(filePath, "utf8");
        },
        stat
      },
      workspaceId: "ws-1",
      workspacePath
    };
    await session.getSnapshot(request);
    readCount = 0;
    await writeFile(notePath, "new!", "utf8");
    await utimes(notePath, fixedTime, fixedTime);

    session.invalidate("ws-1", ["note.md"]);
    const refreshed = await session.getSnapshot(request);

    expect(readCount).toBe(1);
    expect(refreshed.fileIndex.records[0]?.lines).toEqual(["new!"]);
    expect(refreshed.fileIndex.records[0]?.contentHash).not.toBeUndefined();
  });

  it("増分更新の失敗後も直後の再要求で最新スナップショットを再構築する", async () => {
    const workspacePath = await createWorkspace();
    const session = new WorkspaceDerivedDataSession(() => 1000);
    let failRefresh = false;
    const request = {
      filePaths: ["note.md"],
      operations: {
        readFile: (filePath: string) => readFile(filePath, "utf8"),
        get stat() {
          if (failRefresh) throw new Error("incremental refresh failed");
          return stat;
        }
      },
      workspaceId: "ws-1",
      workspacePath
    };

    await session.getSnapshot(request);
    await writeFile(path.join(workspacePath, "note.md"), "# Recovered\n", "utf8");
    failRefresh = true;
    session.invalidate("ws-1", ["note.md"]);

    await expect(session.getSnapshot(request)).rejects.toThrow("incremental refresh failed");
    failRefresh = false;
    const recovered = await session.getSnapshot(request);

    expect(recovered.fileIndex.records.find((record) => record.path === "note.md")?.lines)
      .toEqual(["# Recovered", ""]);
  });

  it("同じパスの連続更新で解析キャッシュを最新1世代だけ保持する", async () => {
    const workspacePath = await createWorkspace();
    const session = new WorkspaceDerivedDataSession(() => 1000);
    const request = {
      filePaths: ["note.md"],
      operations: {
        readFile: (filePath: string) => readFile(filePath, "utf8"),
        stat
      },
      workspaceId: "ws-1",
      workspacePath
    };
    const cacheSizes = (snapshot: Awaited<ReturnType<typeof session.getSnapshot>>) => ({
      aliases: snapshot.parseCache.aliases.size,
      chartEntries: snapshot.parseCache.chartEntries.size,
      content: snapshot.parseCache.content.size,
      frontmatter: snapshot.parseCache.frontmatter.size,
      frontmatterInspection: snapshot.parseCache.frontmatterInspection.size,
      tags: snapshot.parseCache.tags.size
    });
    const populateParseCache = (snapshot: Awaited<ReturnType<typeof session.getSnapshot>>) => {
      const record = snapshot.fileIndex.records.find((item) => item.path === "note.md");
      if (!record) throw new Error("note.md record is missing");
      markdownContentForRecord(record, snapshot.parseCache);
      frontmatterForRecord(record, snapshot.parseCache);
      inspectedFrontmatterForRecord(record, snapshot.parseCache);
      tagsForRecord(record, snapshot.parseCache);
      aliasesForRecord(record, snapshot.parseCache);
      chartEntriesForRecord(record, snapshot.parseCache);
      snapshot.parseCache.backlinksByTarget = new Map([["note.md", []]]);
      return record;
    };

    const first = await session.getSnapshot(request);
    populateParseCache(first);
    expect(cacheSizes(first)).toEqual({
      aliases: 1,
      chartEntries: 1,
      content: 1,
      frontmatter: 1,
      frontmatterInspection: 1,
      tags: 1
    });

    for (const version of [2, 3]) {
      await writeFile(
        path.join(workspacePath, "note.md"),
        [
          "---",
          "tags:",
          `  - 資料-${version}`,
          "aliases:",
          `  - ノート別名-${version}`,
          "---",
          `# Note ${version}`
        ].join("\n"),
        "utf8"
      );
      session.invalidate("ws-1", ["note.md"]);
      const refreshed = await session.getSnapshot(request);
      expect(refreshed.parseCache.backlinksByTarget).toBeNull();
      const record = populateParseCache(refreshed);

      expect(cacheSizes(refreshed)).toEqual({
        aliases: 1,
        chartEntries: 1,
        content: 1,
        frontmatter: 1,
        frontmatterInspection: 1,
        tags: 1
      });
      expect(tagsForRecord(record, refreshed.parseCache)).toEqual([`資料-${version}`]);
      expect(aliasesForRecord(record, refreshed.parseCache)).toEqual([`ノート別名-${version}`]);
      expect(markdownContentForRecord(record, refreshed.parseCache)).toContain(`# Note ${version}`);
    }
  });

  it("検索用のファイルサイズ上限は同じsnapshotを単調に再利用する", async () => {
    const workspacePath = await createWorkspace();
    const session = new WorkspaceDerivedDataSession(() => 1000);
    let readCount = 0;
    const operations = {
      readFile: async (filePath: string) => {
        readCount += 1;
        return readFile(filePath, "utf8");
      },
      stat
    };

    const allFiles = await session.getSnapshot({
      filePaths: ["note.md"],
      maxSearchFileBytes: Number.MAX_SAFE_INTEGER,
      operations,
      workspaceId: "ws-1",
      workspacePath
    });
    const searchLimited = await session.getSnapshot({
      filePaths: ["note.md"],
      maxSearchFileBytes: 1024,
      operations,
      workspaceId: "ws-1",
      workspacePath
    });

    expect(allFiles).toBe(searchLimited);
    expect(readCount).toBe(1);
  });

  it("派生データ取得時に maxSearchFileBytes を渡すと上限内の再読込判定が効く", async () => {
    const workspacePath = await createWorkspace();
    await writeFile(path.join(workspacePath, "large.md"), `# Large\n${"x".repeat(64)}`, "utf8");
    const session = new WorkspaceDerivedDataSession(() => 1000);
    let readCount = 0;

    await session.getSnapshot({
      filePaths: ["large.md"],
      maxSearchFileBytes: 8,
      operations: {
        async readFile(filePath: string) {
          readCount += 1;
          return readFile(filePath, "utf8");
        },
        stat
      },
      workspaceId: "ws-1",
      workspacePath
    });

    expect(readCount).toBe(0);
  });

  it("既存fileIndexが渡された場合でも、サイズ上限変更時は検索用本文整合性で再取得する", async () => {
    const workspacePath = await createWorkspace();
    await writeFile(path.join(workspacePath, "large.md"), `# Large\n${"x".repeat(64)}`, "utf8");
    const session = new WorkspaceDerivedDataSession(() => 1000);

    const fullSnapshot = await session.getSnapshot({
      filePaths: ["large.md"],
      maxSearchFileBytes: Number.MAX_SAFE_INTEGER,
      operations: {
        readFile: (filePath: string) => readFile(filePath, "utf8"),
        stat
      },
      workspaceId: "ws-1",
      workspacePath
    });

    let readCount = 0;
    const limitedSnapshot = await session.getSnapshot({
      filePaths: ["large.md"],
      fileIndex: fullSnapshot.fileIndex,
      maxSearchFileBytes: 8,
      operations: {
        async readFile() {
          readCount += 1;
          return "";
        },
        stat
      },
      workspaceId: "ws-1",
      workspacePath
    });

    expect(limitedSnapshot.fileIndex.records.find((record) => record.path === "large.md")?.searchable).toBe(true);
    expect(readCount).toBe(0);
  });

  it("共有スナップショットでタグと別名の連続読み取りを再走査しない", async () => {
    const workspacePath = await createWorkspace();
    const session = new WorkspaceDerivedDataSession(() => 1000);
    let readCount = 0;
    const operations = {
      readFile: async (filePath: string) => {
        readCount += 1;
        return readFile(filePath, "utf8");
      },
      stat
    };
    const snapshot = await session.getSnapshot({
      filePaths: ["note.md"],
      operations,
      workspaceId: "ws-1",
      workspacePath
    });

    await expect(readWorkspaceTags(workspacePath, {
      fileIndex: snapshot.fileIndex,
      parseCache: snapshot.parseCache
    })).resolves.toEqual({
      ok: true,
      value: [{ count: 1, tag: "資料" }]
    });
    await expect(readWorkspaceAliases(workspacePath, {
      fileIndex: snapshot.fileIndex,
      parseCache: snapshot.parseCache
    })).resolves.toEqual({
      ok: true,
      value: { "note.md": ["ノート別名"] }
    });

    expect(readCount).toBe(1);
  });

  it("2MiB相当のprime後は不足するlarge本文だけをupgradeする", async () => {
    const workspacePath = await createWorkspace();
    await writeFile(path.join(workspacePath, "small.md"), "# Small\nok", "utf8");
    await writeFile(
      path.join(workspacePath, "large.md"),
      `---\naliases: [大きな別名]\n---\n# Large\n${"x".repeat(64)}`,
      "utf8"
    );
    const session = new WorkspaceDerivedDataSession(() => 1000);
    let readCount = 0;
    const operations = {
      readFile: async (filePath: string) => {
        readCount += 1;
        return readFile(filePath, "utf8");
      },
      stat
    };

    const prime = await session.getSnapshot({
      filePaths: ["large.md", "small.md"],
      maxSearchFileBytes: 16,
      operations,
      workspaceId: "ws-1",
      workspacePath
    });
    expect(prime.fileIndex.records.find((record) => record.path === "large.md")?.searchable).toBe(false);

    const upgraded = await session.getSnapshot({
      filePaths: ["large.md", "small.md"],
      maxSearchFileBytes: Number.MAX_SAFE_INTEGER,
      operations,
      workspaceId: "ws-1",
      workspacePath
    });

    expect(upgraded.fileIndex.records.find((record) => record.path === "large.md")?.searchable).toBe(true);
    expect(readCount).toBe(2);

    await expect(readWorkspaceAliases(workspacePath, {
      fileIndex: upgraded.fileIndex,
      parseCache: upgraded.parseCache
    })).resolves.toEqual({
      ok: true,
      value: { "large.md": ["大きな別名"] }
    });
    expect(readCount).toBe(2);
  });

  it("無効化後に完了した旧世代snapshotを公開しない", async () => {
    const workspacePath = await createWorkspace();
    const session = new WorkspaceDerivedDataSession(() => 1000);
    let releaseRead!: () => void;
    const readGate = new Promise<void>((resolve) => { releaseRead = resolve; });
    const request = {
      filePaths: ["note.md"],
      operations: {
        readFile: async (filePath: string) => {
          await readGate;
          return readFile(filePath, "utf8");
        },
        stat
      },
      workspaceId: "ws-1",
      workspacePath
    };
    const stale = session.getSnapshot(request);
    session.invalidate("ws-1");
    releaseRead();

    await expect(stale).rejects.toThrow("generation is stale");
    await expect(session.getSnapshot(request)).resolves.toMatchObject({
      fileIndex: { records: [{ path: "note.md", readStatus: "ok" }] }
    });
  });

  it("初回読込中の変更を旧Promiseの連鎖にせず最新snapshotへ反映する", async () => {
    const workspacePath = await createWorkspace();
    const session = new WorkspaceDerivedDataSession(() => 1000);
    let readCount = 0;
    let releaseFirst!: () => void;
    let releaseSecond!: () => void;
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const secondGate = new Promise<void>((resolve) => { releaseSecond = resolve; });
    const request = {
      filePaths: ["note.md"],
      operations: {
        readFile: async (filePath: string) => {
          readCount += 1;
          if (readCount === 1) {
            const content = await readFile(filePath, "utf8");
            await firstGate;
            return content;
          }
          await secondGate;
          return readFile(filePath, "utf8");
        },
        stat
      },
      workspaceId: "ws-1",
      workspacePath
    };

    const stale = session.getSnapshot(request);
    for (let attempt = 0; attempt < 10 && readCount < 1; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    await writeFile(path.join(workspacePath, "note.md"), "# Updated\n", "utf8");
    session.invalidate("ws-1", ["note.md"]);
    const latest = session.getSnapshot(request);
    for (let attempt = 0; attempt < 10 && readCount < 2; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    releaseSecond();
    const snapshot = await latest;
    releaseFirst();

    await expect(stale).rejects.toThrow("generation is stale");
    expect(snapshot.fileIndex.records[0]?.lines).toEqual(["# Updated", ""]);
    expect(readCount).toBe(2);
  });

  it("upgrade失敗時もlow snapshotを保持し、high要求を再試行できる", async () => {
    const workspacePath = await createWorkspace();
    await writeFile(path.join(workspacePath, "large.md"), `# Large\n${"x".repeat(64)}`, "utf8");
    const session = new WorkspaceDerivedDataSession(() => 1000);
    let failUpgrade = false;
    const request = {
      filePaths: ["large.md"],
      maxSearchFileBytes: 8,
      operations: {
        readFile: async (filePath: string) => {
          return readFile(filePath, "utf8");
        },
        get stat() {
          if (failUpgrade) throw new Error("upgrade failed");
          return stat;
        }
      },
      workspaceId: "ws-1",
      workspacePath
    };
    const low = await session.getSnapshot(request);
    expect(low.fileIndex.records[0]?.searchable).toBe(false);

    failUpgrade = true;
    await expect(session.getSnapshot({
      ...request,
      maxSearchFileBytes: Number.MAX_SAFE_INTEGER
    })).rejects.toThrow("upgrade failed");
    await expect(session.getSnapshot(request)).resolves.toBe(low);

    failUpgrade = false;
    const high = await session.getSnapshot({
      ...request,
      maxSearchFileBytes: Number.MAX_SAFE_INTEGER
    });
    expect(high.fileIndex.records[0]?.searchable).toBe(true);
  });

  it("pending readはTTLとsession上限で重複開始しない", async () => {
    const workspacePath = await createWorkspace();
    await writeFile(path.join(workspacePath, "other.md"), "# Other", "utf8");
    let now = 0;
    let releaseRead!: () => void;
    const readGate = new Promise<void>((resolve) => { releaseRead = resolve; });
    let readCount = 0;
    const session = new WorkspaceDerivedDataSession(() => now, 10, 1);
    const request = {
      filePaths: ["note.md"],
      operations: {
        readFile: async (filePath: string) => {
          readCount += 1;
          await readGate;
          return readFile(filePath, "utf8");
        },
        stat
      },
      workspaceId: "ws-1",
      workspacePath
    };
    const first = session.getSnapshot(request);
    now = 100;
    const second = session.getSnapshot(request);
    expect(second).toBe(first);
    const other = session.getSnapshot({
      ...request,
      filePaths: ["other.md"]
    });
    expect(session.size()).toBe(2);
    releaseRead();
    await first;
    await other;
    expect(readCount).toBe(2);
  });

  it("settled snapshotはTTL後に破棄され、同じkeyを増殖させない", async () => {
    const workspacePath = await createWorkspace();
    let now = 0;
    const session = new WorkspaceDerivedDataSession(() => now, 10, 4);
    const request = {
      filePaths: ["note.md"],
      operations: { readFile: (filePath: string) => readFile(filePath, "utf8"), stat },
      workspaceId: "ws-1",
      workspacePath
    };

    const first = await session.getSnapshot(request);
    expect(session.size()).toBe(1);
    now = 11;
    const second = await session.getSnapshot(request);

    expect(second).not.toBe(first);
    expect(session.size()).toBe(1);
  });
});
