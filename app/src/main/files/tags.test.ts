import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { readWorkspaceTags } from "./tags";
import { readWorkspaceFileIndex } from "./workspaceFileIndex";

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

  it("ワークスペース内Markdownのfrontmatter tagsだけを集計する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-tags-"));
    temporaryPaths.push(workspacePath);
    await mkdir(path.join(workspacePath, "folder"));
    await writeFile(path.join(workspacePath, "a.md"), "---\ntags: [小説, 資料]\n---\n#小説", "utf8");
    await writeFile(path.join(workspacePath, "folder", "b.md"), "#資料 #キャラ/主人公", "utf8");
    await writeFile(path.join(workspacePath, "image.txt"), "#無視", "utf8");

    await expect(readWorkspaceTags(workspacePath)).resolves.toEqual({
      ok: true,
      value: [
        { count: 1, tag: "資料" },
        { count: 1, tag: "小説" }
      ]
    });
  });

  it("読めないMarkdownファイルはスキップしてタグ集計を続行する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-tags-unreadable-"));
    temporaryPaths.push(workspacePath);
    await writeFile(path.join(workspacePath, "blocked.md"), "---\ntags: [読めない]\n---", "utf8");
    await writeFile(path.join(workspacePath, "visible.md"), "---\ntags: [資料]\n---", "utf8");

    await expect(readWorkspaceTags(workspacePath, {
      async readFile(filePath, encoding) {
        if (path.basename(filePath) === "blocked.md") {
          throw Object.assign(new Error("Permission denied"), { code: "EACCES" });
        }

        return readFile(filePath, encoding);
      }
    })).resolves.toEqual({
      ok: true,
      value: [
        { count: 1, tag: "資料" }
      ]
    });
  });

  it("既に読み取ったWorkspaceFileIndexからタグを集計する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-tags-index-"));
    temporaryPaths.push(workspacePath);
    await writeFile(path.join(workspacePath, "note.md"), "---\ntags: [資料]\n---", "utf8");
    const fileIndex = await readWorkspaceFileIndex(workspacePath);

    await expect(readWorkspaceTags(workspacePath, {
      fileIndex,
      operations: {
        async readFile() {
          throw new Error("file should not be reread");
        }
      }
    })).resolves.toEqual({
      ok: true,
      value: [
        { count: 1, tag: "資料" }
      ]
    });
  });

  it("Markdown読み込みの同時実行数に上限を設ける", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-tags-concurrency-"));
    temporaryPaths.push(workspacePath);
    for (let index = 0; index < 12; index += 1) {
      await writeFile(path.join(workspacePath, `note-${index}.md`), `---\ntags: [tag-${index}]\n---`, "utf8");
    }

    let activeReads = 0;
    let maxActiveReads = 0;

    await expect(readWorkspaceTags(workspacePath, {
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
    })).resolves.toMatchObject({ ok: true });

    expect(maxActiveReads).toBeLessThanOrEqual(8);
  });
});
