import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { readWorkspaceGraph } from "./workspaceGraph";

describe("readWorkspaceGraph", () => {
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

  it("Markdownファイル、リンク、未解決リンク、タグをグラフ化する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-graph-"));
    temporaryPaths.push(workspacePath);
    await mkdir(path.join(workspacePath, "folder"));
    await writeFile(path.join(workspacePath, "A.md"), "---\ntags: [project]\n---\n[[B]]\n[Folder](folder/C.md)\n[[Missing]]", "utf8");
    await writeFile(path.join(workspacePath, "B.md"), "# B", "utf8");
    await writeFile(path.join(workspacePath, "folder", "C.md"), "# C", "utf8");

    const result = await readWorkspaceGraph(workspacePath);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "A.md", label: "A", type: "file" }),
      expect.objectContaining({ id: "B.md", label: "B", type: "file" }),
      expect.objectContaining({ id: "folder/C.md", label: "C", type: "file" }),
      expect.objectContaining({ id: "Missing.md", label: "Missing", type: "unresolved" }),
      expect.objectContaining({ id: "#project", label: "#project", type: "tag" })
    ]));
    expect(result.value.links).toEqual(expect.arrayContaining([
      { count: 1, source: "A.md", target: "B.md", type: "link" },
      { count: 1, source: "A.md", target: "folder/C.md", type: "link" },
      { count: 1, source: "A.md", target: "Missing.md", type: "link" },
      { count: 1, source: "A.md", target: "#project", type: "tag" }
    ]));
    expect(result.value.nodes.find((node) => node.id === "A.md")).toMatchObject({ linkCount: 4 });
    expect(result.value.nodes.find((node) => node.id === "B.md")).toMatchObject({ backlinkCount: 1 });
  });
});
