import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildAIWorkspaceIndex,
  computeAIWorkspaceIndexSourceHash,
  createLocalEmbedding,
  searchAIWorkspaceChunks,
  tokenizeSearchText
} from "./aiWorkspaceIndex";
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
    await writeFile(path.join(workspacePath, "README.md"), "# Relic\nCowork", "utf8");
    await writeFile(path.join(workspacePath, "docs", "notes.md"), "# Notes\n共同編集", "utf8");
    await writeFile(path.join(workspacePath, "image.png"), "ignored", "utf8");

    const index = await buildAIWorkspaceIndex(workspacePath);

    expect(new Set(index.chunks.map((chunk) => chunk.path))).toEqual(new Set(["README.md", "docs/notes.md"]));
    expect(index.chunks.every((chunk) => chunk.embedding.length > 0)).toBe(true);
    expect(index.sourceHash).toBe(await computeAIWorkspaceIndexSourceHash(workspacePath));
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

  it("changes the source hash when Markdown files change", async () => {
    await writeFile(path.join(workspacePath, "note.md"), "old", "utf8");
    const before = await computeAIWorkspaceIndexSourceHash(workspacePath);

    await writeFile(path.join(workspacePath, "note.md"), "new content", "utf8");
    const after = await computeAIWorkspaceIndexSourceHash(workspacePath);

    expect(after).not.toBe(before);
  });
});

describe("searchAIWorkspaceChunks", () => {
  it("returns matching chunks first", () => {
    const chunks = [
      chunk("a.md", "alpha"),
      chunk("b.md", "target target"),
      chunk("c.md", "target")
    ];

    expect(searchAIWorkspaceChunks(chunks, "target").map((chunk) => chunk.path)).toEqual(["b.md", "c.md"]);
  });

  it("matches Japanese natural language queries against Markdown terms", () => {
    const chunks = [
      chunk("auth.md", "# 認証\nログイン仕様", 2),
      chunk("theme.md", "# 画面\nテーマ設定", 2)
    ];

    expect(searchAIWorkspaceChunks(chunks, "認証について整理して").map((chunk) => chunk.path)).toEqual(["auth.md"]);
  });
});

describe("createLocalEmbedding", () => {
  it("creates stable normalized local vectors", () => {
    expect(createLocalEmbedding("認証")).toEqual(createLocalEmbedding("認証"));
    expect(createLocalEmbedding("認証")).toHaveLength(64);
    expect(createLocalEmbedding("")).toEqual(Array.from({ length: 64 }, () => 0));
  });
});

function chunk(filePath: string, content: string, endLine = 1) {
  return {
    content,
    embedding: createLocalEmbedding(`${filePath}\n${content}`),
    endLine,
    path: filePath,
    startLine: 1
  };
}

describe("tokenizeSearchText", () => {
  it("keeps full tokens and adds Japanese ngrams", () => {
    expect(tokenizeSearchText("認証について整理して")).toEqual(
      expect.arrayContaining(["認証について整理して", "認証"])
    );
  });
});
