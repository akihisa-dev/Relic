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

  it("未変更Markdownはキャッシュ済みaliasesを再利用する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-aliases-cache-"));
    temporaryPaths.push(workspacePath);
    await writeFile(path.join(workspacePath, "cached.md"), "---\naliases: Cached\n---", "utf8");

    let readCount = 0;
    const operations = {
      async readFile(filePath: string, encoding: BufferEncoding) {
        readCount += 1;
        return readFile(filePath, encoding);
      }
    };

    await expect(readWorkspaceAliases(workspacePath, operations)).resolves.toEqual({
      ok: true,
      value: { "cached.md": ["Cached"] }
    });
    await expect(readWorkspaceAliases(workspacePath, operations)).resolves.toEqual({
      ok: true,
      value: { "cached.md": ["Cached"] }
    });

    expect(readCount).toBe(1);
  });
});

describe("extractAliases", () => {
  it("フロントマターのaliasesを別名として読む", () => {
    expect(extractAliases("---\naliases:\n  - a\n  - α\n---\n# A")).toEqual(["a", "α"]);
  });

  it("文字列のaliasesも1件の別名として読む", () => {
    expect(extractAliases("---\naliases: Alpha\n---\n# A")).toEqual(["Alpha"]);
  });

  it("非文字列aliasesを暗黙に文字列化しない", () => {
    expect(extractAliases([
      "---",
      "aliases:",
      "  - Alpha",
      "  - 123",
      "  - { name: Beta }",
      "  - Gamma",
      "---",
      "# A"
    ].join("\n"))).toEqual(["Alpha", "Gamma"]);
  });

  it("aliasesの1ファイルあたり件数と1件の長さを制限する", () => {
    const aliases = Array.from({ length: 70 }, (_, index) => `  - Alias${index + 1}`).join("\n");
    const tooLong = "x".repeat(257);

    const result = extractAliases(`---\naliases:\n  - ${tooLong}\n${aliases}\n---\n# A`);

    expect(result).toHaveLength(64);
    expect(result[0]).toBe("Alias1");
    expect(result.at(-1)).toBe("Alias64");
    expect(result).not.toContain(tooLong);
  });
});
