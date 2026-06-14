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

  it("Markdownファイル一覧とDiagram判定と行単位テキストを作る", async () => {
    const workspacePath = await createWorkspace();
    await writeFile(path.join(workspacePath, "note.md"), "# Note\n本文", "utf8");
    await writeFile(path.join(workspacePath, "relationship.md"), "---\ntype: relationship\n---\n\nnodes: []\nlines: []", "utf8");
    await writeFile(path.join(workspacePath, "free.md"), "---\ntype: free-drawing\n---\n\nnodes: []\nlines: []", "utf8");
    await writeFile(path.join(workspacePath, "why.md"), "---\ntype: why-tree\n---\n\nlabels:\n  root: ルート\n  node: ノード\n  fact: メモ\n  solution: 関連項目\n  action: アクション\nphenomenon:\n  title: 問題\n  facts: []\n  solutions: []\n  actions: []", "utf8");
    await writeFile(path.join(workspacePath, "ignored.txt"), "---\ntype: relationship\n---", "utf8");

    const index = await readWorkspaceFileIndex(workspacePath);

    expect(index.entries.map(({ kind, name, path: filePath, readStatus }) => ({
      kind,
      name,
      path: filePath,
      readStatus
    }))).toEqual([
      { kind: "diagram", name: "free", path: "free.md", readStatus: "ok" },
      { kind: "markdown", name: "note", path: "note.md", readStatus: "ok" },
      { kind: "diagram", name: "relationship", path: "relationship.md", readStatus: "ok" },
      { kind: "diagram", name: "why", path: "why.md", readStatus: "ok" }
    ]);
    expect(index.records.find((record) => record.path === "note.md")?.lines).toEqual(["# Note", "本文"]);
    expect(index.records.find((record) => record.path === "relationship.md")?.lines).toEqual([
      "---",
      "type: relationship",
      "---",
      "",
      "nodes: []",
      "lines: []"
    ]);
  });

  it("Diagram判定はフロントマターtypeだけを見て、type: mapは扱わない", async () => {
    const workspacePath = await createWorkspace();
    await writeFile(path.join(workspacePath, "not-diagram.md"), "# Title\ntype: relationship", "utf8");
    await writeFile(path.join(workspacePath, "old-map.md"), "type: map\nnodes: []", "utf8");
    await writeFile(path.join(workspacePath, "diagram.md"), "---\ntype: why-tree\n---\nphenomenon:\n  title: 問題", "utf8");

    const index = await readWorkspaceFileIndex(workspacePath);

    expect(index.entries.find((entry) => entry.path === "not-diagram.md")?.kind).toBe("markdown");
    expect(index.entries.find((entry) => entry.path === "old-map.md")?.kind).toBe("markdown");
    expect(index.entries.find((entry) => entry.path === "diagram.md")?.kind).toBe("diagram");
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

  it("大きすぎるMarkdownは全文検索用本文を持たず先頭部分だけでDiagram判定する", async () => {
    const workspacePath = await createWorkspace();
    await writeFile(path.join(workspacePath, "large-diagram.md"), `---\ntype: relationship\n---\n${"x".repeat(64)}`, "utf8");

    const index = await readWorkspaceFileIndex(workspacePath, {
      maxSearchFileBytes: 8,
      operations: {
        readFile: async () => {
          throw new Error("large file should not be fully read");
        }
      }
    });

    expect(index.records).toMatchObject([{
      kind: "diagram",
      lines: [],
      path: "large-diagram.md",
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
