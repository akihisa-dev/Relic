import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { readCardbookCardTree } from "./cardTree";

describe("readCardbookCardTree", () => {
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
    const cardbookPath = await mkdtemp(path.join(os.tmpdir(), "relic-tree-"));
    temporaryPaths.push(cardbookPath);

    await mkdir(path.join(cardbookPath, "notes"));
    await writeFile(path.join(cardbookPath, "index.md"), "# Index", "utf8");
    await writeFile(path.join(cardbookPath, "notes", "idea.md"), "# Idea", "utf8");
    await writeFile(path.join(cardbookPath, "notes", "image.png"), "", "utf8");

    await expect(readCardbookCardTree(cardbookPath)).resolves.toEqual([
      {
        children: [
          {
            name: "idea",
            path: "notes/idea.md",
            type: "card"
          }
        ],
        name: "notes",
        path: "notes",
        type: "cardFolder"
      },
      {
        name: "index",
        path: "index.md",
        type: "card"
      }
    ]);
  });
});
