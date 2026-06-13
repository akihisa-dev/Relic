import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
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

  it("Markdownファイル一覧とMap判定と行単位テキストを作る", async () => {
    const workspacePath = await createWorkspace();
    await writeFile(path.join(workspacePath, "note.md"), "# Note\n本文", "utf8");
    await writeFile(path.join(workspacePath, "map.md"), "type: map\n\nnodes: []\nlines: []", "utf8");
    await writeFile(path.join(workspacePath, "ignored.txt"), "type: map", "utf8");

    const index = await readWorkspaceFileIndex(workspacePath);

    expect(index.entries.map(({ kind, name, path: filePath, readStatus }) => ({
      kind,
      name,
      path: filePath,
      readStatus
    }))).toEqual([
      { kind: "map", name: "map", path: "map.md", readStatus: "ok" },
      { kind: "markdown", name: "note", path: "note.md", readStatus: "ok" }
    ]);
    expect(index.records.find((record) => record.path === "note.md")?.lines).toEqual(["# Note", "本文"]);
    expect(index.records.find((record) => record.path === "map.md")?.lines).toEqual([
      "type: map",
      "",
      "nodes: []",
      "lines: []"
    ]);
  });

  it("Map判定は先頭行だけを見る", async () => {
    const workspacePath = await createWorkspace();
    await writeFile(path.join(workspacePath, "not-map.md"), "# Title\ntype: map", "utf8");
    await writeFile(path.join(workspacePath, "map.md"), "type: map\nnodes: []", "utf8");

    const index = await readWorkspaceFileIndex(workspacePath);

    expect(index.entries.find((entry) => entry.path === "not-map.md")?.kind).toBe("markdown");
    expect(index.entries.find((entry) => entry.path === "map.md")?.kind).toBe("map");
  });

  it("変更されていないファイルは保存済みの控えを再利用する", async () => {
    const workspacePath = await createWorkspace();
    const userDataPath = await createWorkspace("relic-index-user-data-");
    const cachePath = getWorkspaceFileIndexCachePath(userDataPath, "workspace_1");
    await writeFile(path.join(workspacePath, "note.md"), "needle", "utf8");

    await readWorkspaceFileIndex(workspacePath, { cachePath });

    const index = await readWorkspaceFileIndex(workspacePath, {
      cachePath,
      operations: {
        async readFile(filePath) {
          if (filePath.endsWith("note.md")) {
            throw new Error("unchanged file should be reused from cache");
          }

          return readFile(filePath, "utf8");
        }
      }
    });

    expect(index.records.find((record) => record.path === "note.md")?.lines).toEqual(["needle"]);
  });

  it("大きすぎるMarkdownは全文検索用本文を持たず先頭行だけでMap判定する", async () => {
    const workspacePath = await createWorkspace();
    await writeFile(path.join(workspacePath, "large-map.md"), `type: map\n${"x".repeat(64)}`, "utf8");

    const index = await readWorkspaceFileIndex(workspacePath, {
      maxSearchFileBytes: 8,
      operations: {
        readFile: async () => {
          throw new Error("large file should not be fully read");
        }
      }
    });

    expect(index.records).toMatchObject([{
      kind: "map",
      lines: [],
      path: "large-map.md",
      searchable: false
    }]);
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
        stat
      }
    });

    expect(index.entries.map((entry) => ({ path: entry.path, readStatus: entry.readStatus }))).toEqual([
      { path: "blocked.md", readStatus: "unreadable" },
      { path: "visible.md", readStatus: "ok" }
    ]);
  });

  async function createWorkspace(prefix = "relic-index-"): Promise<string> {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), prefix));
    temporaryPaths.push(workspacePath);
    await mkdir(workspacePath, { recursive: true });
    return workspacePath;
  }
});
