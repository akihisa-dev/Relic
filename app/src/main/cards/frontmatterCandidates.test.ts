import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { readFrontmatterValueCandidates } from "./frontmatterCandidates";

describe("readFrontmatterValueCandidates", () => {
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

  it("カードブック内Markdownのプロパティ値を候補として集める", async () => {
    const cardbookPath = await mkdtemp(path.join(os.tmpdir(), "relic-frontmatter-candidates-"));
    temporaryPaths.push(cardbookPath);
    await mkdir(path.join(cardbookPath, "cardFolder"));
    await writeFile(path.join(cardbookPath, "a.md"), "---\nstatus: draft\ntags: [小説, 資料]\npublish: true\n---\n本文", "utf8");
    await writeFile(path.join(cardbookPath, "cardFolder", "b.md"), "---\nstatus: review\n締切: 2026-05-10\nreviewer:\nnested:\n  key: value\n---\n本文", "utf8");
    await writeFile(path.join(cardbookPath, "ignored.txt"), "---\nstatus: ignored\n---\n本文", "utf8");

    await expect(readFrontmatterValueCandidates(cardbookPath)).resolves.toEqual({
      ok: true,
      value: {
        nested: [],
        publish: ["true"],
        reviewer: [],
        status: ["draft", "review"],
        tags: ["資料", "小説"],
        締切: ["2026-05-10"]
      }
    });
  });
});
