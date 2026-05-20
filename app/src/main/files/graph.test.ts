import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { readWorkspaceGraph } from "./graph";

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

  it("Markdownファイルをノード、wikiリンクをエッジとして読む", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-graph-"));
    temporaryPaths.push(workspacePath);
    await mkdir(path.join(workspacePath, "folder"));
    await writeFile(path.join(workspacePath, "A.md"), "---\ntags: [資料]\n---\n[[B Alias]]\n[[folder/C]]\n[see B](B.md)", "utf8");
    await writeFile(path.join(workspacePath, "B.md"), "---\naliases: [B Alias]\n---\n[[folder/C]]\n[[Missing]]", "utf8");
    await writeFile(path.join(workspacePath, "folder", "C.md"), "[A](../A.md)", "utf8");
    await writeFile(path.join(workspacePath, "note.txt"), "[[A]]", "utf8");

    await expect(readWorkspaceGraph(workspacePath)).resolves.toEqual({
      ok: true,
      value: {
        edges: [
          { sourcePath: "A.md", targetPath: "B.md" },
          { sourcePath: "A.md", targetPath: "folder/C.md" },
          { sourcePath: "B.md", targetPath: "folder/C.md" },
          { sourcePath: "folder/C.md", targetPath: "A.md" }
        ],
        nodes: [
          { folder: "", name: "A", path: "A.md", tags: ["資料"] },
          { folder: "", name: "B", path: "B.md", tags: [] },
          { folder: "folder", name: "C", path: "folder/C.md", tags: [] }
        ]
      }
    });
  });

  it("同じファイル状態では生成結果を再利用し、変更後は再生成する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-graph-cache-"));
    temporaryPaths.push(workspacePath);
    await writeFile(path.join(workspacePath, "A.md"), "[[B]]", "utf8");
    await writeFile(path.join(workspacePath, "B.md"), "", "utf8");

    const first = await readWorkspaceGraph(workspacePath);
    const cached = await readWorkspaceGraph(workspacePath);

    expect(first.ok).toBe(true);
    expect(cached.ok).toBe(true);
    if (!first.ok || !cached.ok) return;
    expect(cached.value).toBe(first.value);
    expect(cached.value.edges).toEqual([{ sourcePath: "A.md", targetPath: "B.md" }]);

    await writeFile(path.join(workspacePath, "A.md"), "[[Gamma]]\nupdated", "utf8");
    await writeFile(path.join(workspacePath, "Gamma.md"), "", "utf8");

    const updated = await readWorkspaceGraph(workspacePath);

    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.value).not.toBe(first.value);
    expect(updated.value.edges).toEqual([{ sourcePath: "A.md", targetPath: "Gamma.md" }]);
  });
});
