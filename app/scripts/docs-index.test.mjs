import { describe, expect, it } from "vitest";

import {
  catalogEndMarker,
  catalogStartMarker,
  parseTrackedFiles,
  renderTree,
  validateIndexContent,
} from "./docs-index.mjs";

function indexWithCatalog(links, extra = "") {
  return [
    "# 文書索引",
    "",
    extra,
    catalogStartMarker,
    ...links.map((link) => `- [文書](${link})`),
    catalogEndMarker,
    "",
  ].join("\n");
}

describe("docs-index", () => {
  it("NUL区切りのGit追跡ファイルを空白を保って解析する", () => {
    expect(parseTrackedFiles("docs/z file.md\0AGENTS.md\0")).toEqual([
      "AGENTS.md",
      "docs/z file.md",
    ]);
  });

  it("ディレクトリを先にしたMarkdownツリーを描画する", () => {
    expect(renderTree(["README.md", "docs/INDEX.md", "docs/project/overview.md"])).toBe([
      "- `docs/`",
      "  - `project/`",
      "    - `overview.md`",
      "  - `INDEX.md`",
      "- `README.md`",
    ].join("\n"));
  });

  it("存在して追跡されている正本文書の完全なカタログを受理する", () => {
    const tracked = ["AGENTS.md", "docs/INDEX.md", "docs/development.md"];
    const content = indexWithCatalog(["../AGENTS.md", "INDEX.md", "development.md"]);
    const existing = new Set(tracked);

    expect(validateIndexContent(content, tracked, {
      pathExists: (repoPath) => existing.has(repoPath),
    })).toEqual([]);
  });

  it("リンク切れ、未追跡リンク、掲載漏れ、重複を報告する", () => {
    const tracked = [
      "AGENTS.md",
      "docs/INDEX.md",
      "docs/development.md",
      "docs/project/overview.md",
    ];
    const content = indexWithCatalog(
      ["../AGENTS.md", "INDEX.md", "INDEX.md", "development.md"],
      "[未追跡](ghost.md)\n[リンク切れ](missing.md)",
    );
    const existing = new Set([...tracked, "docs/ghost.md"]);
    const errors = validateIndexContent(content, tracked, {
      pathExists: (repoPath) => existing.has(repoPath),
    });

    expect(errors).toContain("リンク先がGitで追跡されていません: ghost.md -> docs/ghost.md");
    expect(errors).toContain("リンク先が存在しません: missing.md -> docs/missing.md");
    expect(errors).toContain("正本文書カタログに重複があります: docs/INDEX.md (2件)");
    expect(errors).toContain("正本文書カタログに掲載されていません: docs/project/overview.md");
  });

  it("カタログマーカーの不足を報告する", () => {
    const errors = validateIndexContent("# 文書索引", [], { pathExists: () => false });

    expect(errors).toEqual([
      "正本文書カタログの開始・終了マーカーは1組必要です（start=0, end=0）。",
    ]);
  });
});
