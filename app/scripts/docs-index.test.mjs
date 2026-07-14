import { describe, expect, it } from "vitest";

import {
  catalogEndMarker,
  catalogStartMarker,
  parseTrackedFiles,
  renderTree,
  validateIndexContent,
  validateMarkdownDocuments,
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

  it("全Markdownの相対リンクと見出しanchorを検証する", () => {
    const tracked = ["README.md", "docs/guide.md"];
    const contents = new Map([
      ["README.md", "# 日本語\n\n[案内](docs/guide.md#使い方-pnpm-verify)\n"],
      ["docs/guide.md", "# 使い方 `pnpm verify`\n\n[戻る](../README.md#日本語)\n"],
    ]);
    expect(validateMarkdownDocuments(tracked, {
      pathExists: (repoPath) => contents.has(repoPath),
      readContent: (repoPath) => contents.get(repoPath),
    })).toEqual([]);
  });

  it("追跡ファイルを含むディレクトリへのリンクを受理する", () => {
    const tracked = ["README.md", "docs/features/guide.md"];
    const contents = new Map([
      ["README.md", "[機能一覧](docs/features)\n"],
      ["docs/features/guide.md", "# Guide\n"],
    ]);
    expect(validateMarkdownDocuments(tracked, {
      pathExists: (repoPath) => repoPath === "docs/features" || contents.has(repoPath),
      readContent: (repoPath) => contents.get(repoPath),
    })).toEqual([]);
  });

  it("全Markdownのリンク切れ・未追跡・存在しないanchorを報告する", () => {
    const tracked = ["README.md", "docs/guide.md"];
    const contents = new Map([
      ["README.md", [
        "# Guide",
        "[リンク切れ](docs/missing.md)",
        "[未追跡](docs/untracked.md)",
        "[見出しなし](docs/guide.md#missing)",
      ].join("\n")],
      ["docs/guide.md", "# Existing\n"],
      ["docs/untracked.md", "# Untracked\n"],
    ]);
    expect(validateMarkdownDocuments(tracked, {
      pathExists: (repoPath) => contents.has(repoPath),
      readContent: (repoPath) => contents.get(repoPath),
    })).toEqual([
      "README.md: リンク先が存在しません: docs/missing.md -> docs/missing.md",
      "README.md: リンク先がGitで追跡されていません: docs/untracked.md -> docs/untracked.md",
      "README.md: リンク先の見出しが存在しません: docs/guide.md#missing",
    ]);
  });

  it("code fence・inline code・HTML comment内の説明用リンクを無視する", () => {
    const tracked = ["README.md"];
    const content = [
      "# Guide",
      "`[inline](missing.md)`",
      "```md",
      "[fixture](missing.md)",
      "```",
      "<!-- [comment](missing.md) -->",
    ].join("\n");
    expect(validateMarkdownDocuments(tracked, {
      pathExists: () => false,
      readContent: () => content,
    })).toEqual([]);
  });
});
