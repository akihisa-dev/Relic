import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { readCardbookTags } from "./tags";

describe("readCardbookTags", () => {
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

  it("カードブック内Markdownのfrontmatter tagsだけを集計する", async () => {
    const cardbookPath = await mkdtemp(path.join(os.tmpdir(), "relic-tags-"));
    temporaryPaths.push(cardbookPath);
    await mkdir(path.join(cardbookPath, "cardFolder"));
    await writeFile(path.join(cardbookPath, "a.md"), "---\ntags: [小説, 資料]\n---\n#小説", "utf8");
    await writeFile(path.join(cardbookPath, "cardFolder", "b.md"), "#資料 #キャラ/主人公", "utf8");
    await writeFile(path.join(cardbookPath, "image.txt"), "#無視", "utf8");

    await expect(readCardbookTags(cardbookPath)).resolves.toEqual({
      ok: true,
      value: [
        { count: 1, tag: "資料" },
        { count: 1, tag: "小説" }
      ]
    });
  });
});
