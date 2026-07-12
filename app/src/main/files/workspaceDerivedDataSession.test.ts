import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { readWorkspaceAliases } from "./aliases";
import { readWorkspaceTags } from "./tags";
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
    expect(statCount).toBe(1);
    expect(refreshed.fileIndex.records.map((record) => record.path)).toEqual(["note.md", "other.md"]);
    expect(refreshed.fileIndex.records.find((record) => record.path === "note.md")?.lines).toEqual(["# Updated", ""]);
  });

  it("検索用のファイルサイズ上限が異なる要求は別スナップショットとして扱う", async () => {
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

    expect(allFiles).not.toBe(searchLimited);
    expect(readCount).toBe(2);
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

    expect(limitedSnapshot.fileIndex.records.find((record) => record.path === "large.md")?.searchable).toBe(false);
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
});
