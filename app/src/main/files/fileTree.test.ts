import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { readWorkspaceFileTree } from "./fileTree";

describe("readWorkspaceFileTree", () => {
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

  it("カードフォルダとMarkdownカードだけをカードブック相対パスで返す", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-tree-"));
    temporaryPaths.push(workspacePath);

    await mkdir(path.join(workspacePath, "notes"));
    await writeFile(path.join(workspacePath, "index.md"), "# Index", "utf8");
    await writeFile(path.join(workspacePath, "notes", "idea.md"), "# Idea", "utf8");
    await writeFile(path.join(workspacePath, "notes", "image.png"), "", "utf8");

    await expect(readWorkspaceFileTree(workspacePath)).resolves.toEqual([
      {
        children: [
          {
            name: "idea",
            path: "notes/idea.md",
            type: "file"
          }
        ],
        name: "notes",
        path: "notes",
        type: "folder"
      },
      {
        name: "index",
        path: "index.md",
        type: "file"
      }
    ]);
  });
});
