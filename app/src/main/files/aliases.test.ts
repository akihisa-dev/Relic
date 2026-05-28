import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { extractAliases, readWorkspaceAliases } from "./aliases";

describe("readWorkspaceAliases", () => {
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

  it("読めないMarkdownファイルはスキップして別名一覧を続行する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-aliases-unreadable-"));
    temporaryPaths.push(workspacePath);
    await writeFile(path.join(workspacePath, "blocked.md"), "---\naliases: Hidden\n---", "utf8");
    await writeFile(path.join(workspacePath, "visible.md"), "---\naliases: Visible\n---", "utf8");

    await expect(readWorkspaceAliases(workspacePath, {
      async readFile(filePath, encoding) {
        if (path.basename(filePath) === "blocked.md") {
          throw Object.assign(new Error("Permission denied"), { code: "EACCES" });
        }

        return readFile(filePath, encoding);
      }
    })).resolves.toEqual({
      ok: true,
      value: {
        "visible.md": ["Visible"]
      }
    });
  });
});

describe("extractAliases", () => {
  it("フロントマターのaliasesを別名として読む", () => {
    expect(extractAliases("---\naliases:\n  - a\n  - α\n---\n# A")).toEqual(["a", "α"]);
  });

  it("文字列のaliasesも1件の別名として読む", () => {
    expect(extractAliases("---\naliases: Alpha\n---\n# A")).toEqual(["Alpha"]);
  });
});
