import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { readWorkspaceTags } from "./tags";

describe("readWorkspaceTags", () => {
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

  it("ワークスペース内Markdownの本文タグとfrontmatter tagsを集計する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-tags-"));
    temporaryPaths.push(workspacePath);
    await mkdir(path.join(workspacePath, "folder"));
    await writeFile(path.join(workspacePath, "a.md"), "---\ntags: [小説, 資料]\n---\n#小説", "utf8");
    await writeFile(path.join(workspacePath, "folder", "b.md"), "#資料 #キャラ/主人公", "utf8");
    await writeFile(path.join(workspacePath, "image.txt"), "#無視", "utf8");

    await expect(readWorkspaceTags(workspacePath)).resolves.toEqual({
      ok: true,
      value: [
        { count: 1, tag: "キャラ/主人公" },
        { count: 2, tag: "資料" },
        { count: 1, tag: "小説" }
      ]
    });
  });
});
