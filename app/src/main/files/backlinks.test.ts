import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { readBacklinks } from "./backlinks";

describe("readBacklinks", () => {
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

  it("対象ファイルを参照しているMarkdownファイルを一覧にする", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-backlinks-"));
    temporaryPaths.push(workspacePath);
    await mkdir(path.join(workspacePath, "folder"));
    await writeFile(path.join(workspacePath, "target.md"), "# Target", "utf8");
    await writeFile(path.join(workspacePath, "source.md"), "[[target]]\n[[target|もう一度]]", "utf8");
    await writeFile(path.join(workspacePath, "folder", "nested.md"), "[[../target]]", "utf8");
    await writeFile(path.join(workspacePath, "ignored.md"), "```md\n[[target]]\n```", "utf8");

    await expect(readBacklinks(workspacePath, "target.md")).resolves.toEqual({
      ok: true,
      value: [
        { count: 1, sourceName: "nested", sourcePath: "folder/nested.md" },
        { count: 2, sourceName: "source", sourcePath: "source.md" }
      ]
    });
  });

  it("aliases経由のリンクもバックリンクとして扱う", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-backlinks-"));
    temporaryPaths.push(workspacePath);
    await writeFile(path.join(workspacePath, "A.md"), "---\naliases: [a, α]\n---\n# A", "utf8");
    await writeFile(path.join(workspacePath, "source.md"), "[[a]]\n[[α]]", "utf8");

    await expect(readBacklinks(workspacePath, "A.md")).resolves.toEqual({
      ok: true,
      value: [
        { count: 2, sourceName: "source", sourcePath: "source.md" }
      ]
    });
  });

  it("読めない参照元Markdownファイルはスキップしてバックリンク集計を続行する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-backlinks-"));
    temporaryPaths.push(workspacePath);
    await writeFile(path.join(workspacePath, "target.md"), "# Target", "utf8");
    await writeFile(path.join(workspacePath, "blocked.md"), "[[target]]", "utf8");
    await writeFile(path.join(workspacePath, "visible.md"), "[[target]]", "utf8");

    await expect(readBacklinks(workspacePath, "target.md", {
      async readFile(filePath, encoding) {
        if (path.basename(filePath) === "blocked.md") {
          throw Object.assign(new Error("Permission denied"), { code: "EACCES" });
        }

        return readFile(filePath, encoding);
      }
    })).resolves.toEqual({
      ok: true,
      value: [
        { count: 1, sourceName: "visible", sourcePath: "visible.md" }
      ]
    });
  });

  it("Markdown以外とワークスペース外への参照を拒否する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-backlinks-"));
    temporaryPaths.push(workspacePath);

    await expect(readBacklinks(workspacePath, "image.png")).resolves.toMatchObject({
      ok: false
    });
    await expect(readBacklinks(workspacePath, "../outside.md")).resolves.toMatchObject({
      ok: false
    });
  });
});
