import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

  it("ワークスペース内Markdownのフロントマター値を候補として集める", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-frontmatter-candidates-"));
    temporaryPaths.push(workspacePath);
    await mkdir(path.join(workspacePath, "folder"));
    await writeFile(path.join(workspacePath, "a.md"), "---\nstatus: draft\ntags: [小説, 資料]\npublish: true\n---\n本文", "utf8");
    await writeFile(path.join(workspacePath, "folder", "b.md"), "---\nstatus: review\n締切: 2026-05-10\nreviewer:\nnested:\n  key: value\n---\n本文", "utf8");
    await writeFile(path.join(workspacePath, "ignored.txt"), "---\nstatus: ignored\n---\n本文", "utf8");

    await expect(readFrontmatterValueCandidates(workspacePath)).resolves.toEqual({
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

  it("読めないMarkdownファイルはスキップしてフロントマター候補集計を続行する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-frontmatter-candidates-"));
    temporaryPaths.push(workspacePath);
    await writeFile(path.join(workspacePath, "blocked.md"), "---\nstatus: hidden\n---", "utf8");
    await writeFile(path.join(workspacePath, "visible.md"), "---\nstatus: visible\n---", "utf8");

    await expect(
      readFrontmatterValueCandidates(workspacePath, {
        async readFile(filePath, encoding) {
          if (path.basename(filePath) === "blocked.md") {
            throw Object.assign(new Error("Permission denied"), { code: "EACCES" });
          }

          return readFile(filePath, encoding);
        }
      })
    ).resolves.toEqual({
      ok: true,
      value: {
        status: ["visible"]
      }
    });
  });
});
