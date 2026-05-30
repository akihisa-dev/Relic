import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildAIWorkspaceIndex, searchAIWorkspaceChunks, tokenizeSearchText } from "./aiWorkspaceIndex";
import { workspaceSearchMaxFileBytes } from "../files/search";

let workspacePath = "";

beforeEach(async () => {
  workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-ai-workspace-"));
});

afterEach(async () => {
  await rm(workspacePath, { force: true, recursive: true });
});

describe("buildAIWorkspaceIndex", () => {
  it("indexes all readable Markdown files in the workspace", async () => {
    await mkdir(path.join(workspacePath, "docs"), { recursive: true });
    await writeFile(path.join(workspacePath, "README.md"), "# Relic\nAI Workspace", "utf8");
    await writeFile(path.join(workspacePath, "docs", "notes.md"), "# Notes\n共同編集", "utf8");
    await writeFile(path.join(workspacePath, "image.png"), "ignored", "utf8");

    const index = await buildAIWorkspaceIndex(workspacePath);

    expect(new Set(index.chunks.map((chunk) => chunk.path))).toEqual(new Set(["README.md", "docs/notes.md"]));
    expect(index.skippedLargeFiles).toEqual([]);
    expect(index.unreadableFiles).toEqual([]);
  });

  it("skips large Markdown files", async () => {
    await writeFile(path.join(workspacePath, "large.md"), "x".repeat(workspaceSearchMaxFileBytes + 1), "utf8");
    await writeFile(path.join(workspacePath, "small.md"), "needle", "utf8");

    const index = await buildAIWorkspaceIndex(workspacePath);

    expect(index.chunks.map((chunk) => chunk.path)).toEqual(["small.md"]);
    expect(index.skippedLargeFiles).toEqual([{
      path: "large.md",
      reason: "大きいMarkdownのためAI参照から除外しました。"
    }]);
  });
});

describe("searchAIWorkspaceChunks", () => {
  it("returns matching chunks first", () => {
    const chunks = [
      { content: "alpha", endLine: 1, path: "a.md", startLine: 1 },
      { content: "target target", endLine: 1, path: "b.md", startLine: 1 },
      { content: "target", endLine: 1, path: "c.md", startLine: 1 }
    ];

    expect(searchAIWorkspaceChunks(chunks, "target").map((chunk) => chunk.path)).toEqual(["b.md", "c.md"]);
  });

  it("matches Japanese natural language queries against Markdown terms", () => {
    const chunks = [
      { content: "# 認証\nログイン仕様", endLine: 2, path: "auth.md", startLine: 1 },
      { content: "# 画面\nテーマ設定", endLine: 2, path: "theme.md", startLine: 1 }
    ];

    expect(searchAIWorkspaceChunks(chunks, "認証について整理して").map((chunk) => chunk.path)).toEqual(["auth.md"]);
  });
});

describe("tokenizeSearchText", () => {
  it("keeps full tokens and adds Japanese ngrams", () => {
    expect(tokenizeSearchText("認証について整理して")).toEqual(
      expect.arrayContaining(["認証について整理して", "認証"])
    );
  });
});
