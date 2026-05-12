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
    await writeFile(path.join(workspacePath, "A.md"), "---\ntags: [資料]\n---\n[[B]]\n[[folder/C]]\n[see B](B.md)", "utf8");
    await writeFile(path.join(workspacePath, "B.md"), "[[folder/C]]\n[[Missing]]", "utf8");
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
});
