import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { readFrontmatterValueCandidates } from "./frontmatterCandidates";
import { readWorkspaceFileIndex } from "./workspaceFileIndex";

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

  it("既に読み取ったWorkspaceFileIndexから候補値を集計する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-frontmatter-candidates-index-"));
    temporaryPaths.push(workspacePath);
    await writeFile(path.join(workspacePath, "note.md"), "---\nstatus: draft\n---", "utf8");
    const fileIndex = await readWorkspaceFileIndex(workspacePath);

    await expect(readFrontmatterValueCandidates(workspacePath, {
      fileIndex,
      operations: {
        async readFile() {
          throw new Error("file should not be reread");
        }
      }
    })).resolves.toEqual({
      ok: true,
      value: {
        status: ["draft"]
      }
    });
  });

  it("Markdown読み込みの同時実行数に上限を設ける", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-frontmatter-candidates-concurrency-"));
    temporaryPaths.push(workspacePath);
    for (let index = 0; index < 12; index += 1) {
      await writeFile(path.join(workspacePath, `note-${index}.md`), `---\nstatus: value-${index}\n---`, "utf8");
    }

    let activeReads = 0;
    let maxActiveReads = 0;

    await expect(
      readFrontmatterValueCandidates(workspacePath, {
        async readFile(filePath, encoding) {
          activeReads += 1;
          maxActiveReads = Math.max(maxActiveReads, activeReads);
          await new Promise((resolve) => setTimeout(resolve, 5));
          try {
            return await readFile(filePath, encoding);
          } finally {
            activeReads -= 1;
          }
        }
      })
    ).resolves.toMatchObject({ ok: true });

    expect(maxActiveReads).toBeLessThanOrEqual(8);
  });
});
