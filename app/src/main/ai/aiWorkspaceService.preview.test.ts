import { writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("./openAIResponsesClient", () => ({
  runOpenAIWorkspaceTurn: vi.fn()
}));

vi.mock("./codexAppServerClient", () => ({
  readCodexAIWorkspaceUsage: vi.fn(async () => null),
  runCodexAIWorkspaceTurn: vi.fn()
}));

vi.mock("./openAIKeyStore", () => ({
  hasOpenAIAPIKey: vi.fn(async () => true),
  readOpenAIAPIKey: vi.fn(async () => "sk-test-openai-key")
}));

import { previewAIWorkspaceMessage } from "./aiWorkspaceService";
import { computeAIWorkspaceIndexSourceHash } from "./aiWorkspaceIndex";
import { runOpenAIWorkspaceTurn } from "./openAIResponsesClient";
import {
  context,
  createOperation,
  setupAIWorkspaceServiceTest,
  workspacePath,
  writeData
} from "./aiWorkspaceServiceTestHelpers";

setupAIWorkspaceServiceTest();

describe("previewAIWorkspaceMessage", () => {
  it("returns Markdown references for Japanese messages before calling OpenAI API", async () => {
    await writeFile(path.join(workspacePath, "README.md"), "# 認証\nログイン仕様", "utf8");

    const result = await previewAIWorkspaceMessage(context(), { message: "認証について整理して" });

    expect(result.ok).toBe(true);
    expect(runOpenAIWorkspaceTurn).not.toHaveBeenCalled();
    if (result.ok) {
      expect(result.value.requiresExternalAI).toBe(true);
      expect(result.value.references).toEqual([
        expect.objectContaining({ path: "README.md", preview: "# 認証" })
      ]);
    }
  });

  it("includes the active Markdown file for current-file messages", async () => {
    await writeFile(path.join(workspacePath, "current.md"), "# Current\n開いているファイル", "utf8");
    await writeFile(path.join(workspacePath, "other.md"), "# Other\n別ファイル", "utf8");

    const result = await previewAIWorkspaceMessage(context(), {
      activeFilePath: "current.md",
      message: "このファイルを整理して"
    });

    expect(result.ok).toBe(true);
    expect(runOpenAIWorkspaceTurn).not.toHaveBeenCalled();
    if (result.ok) {
      expect(result.value.requiresExternalAI).toBe(true);
      expect(result.value.references[0]).toEqual(expect.objectContaining({
        path: "current.md",
        preview: "# Current"
      }));
    }
  });

  it("uses small active Markdown content even when the current file is missing from the index", async () => {
    await writeData({
      index: {
        chunks: [],
        indexedAt: new Date().toISOString(),
        skippedLargeFiles: [],
        sourceHash: await computeAIWorkspaceIndexSourceHash(workspacePath),
        unreadableFiles: []
      }
    });

    const result = await previewAIWorkspaceMessage(context(), {
      activeFileContent: "# Unsaved\nnew draft",
      activeFilePath: "missing.md",
      message: "このファイルを整理して"
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.references[0]).toEqual(expect.objectContaining({
        path: "missing.md",
        preview: "# Unsaved"
      }));
    }
  });

  it("does not send oversized active Markdown content as a partial current-file reference", async () => {
    await writeData({
      index: {
        chunks: [],
        indexedAt: new Date().toISOString(),
        skippedLargeFiles: [],
        sourceHash: await computeAIWorkspaceIndexSourceHash(workspacePath),
        unreadableFiles: []
      }
    });

    const result = await previewAIWorkspaceMessage(context(), {
      activeFileContent: "x".repeat(2 * 1024 * 1024 + 1),
      activeFilePath: "large.md",
      message: "このファイルを整理して"
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.references).toEqual([]);
    }
  });

  it("does not include invalid active file paths as current-file references", async () => {
    await writeData({
      index: {
        chunks: [],
        indexedAt: new Date().toISOString(),
        skippedLargeFiles: [],
        sourceHash: await computeAIWorkspaceIndexSourceHash(workspacePath),
        unreadableFiles: []
      }
    });

    const result = await previewAIWorkspaceMessage(context(), {
      activeFileContent: "# Outside\nshould not be referenced",
      activeFilePath: "../outside.md",
      message: "このファイルを整理して"
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.references).toEqual([]);
    }
  });

  it("rebuilds a stale AI index before previewing Markdown references", async () => {
    await writeFile(path.join(workspacePath, "README.md"), "# New Topic\nfresh content", "utf8");
    await writeData({
      index: {
        chunks: [{
          content: "# Old Topic",
          embedding: [],
          endLine: 1,
          path: "README.md",
          startLine: 1
        }],
        indexedAt: "2026-05-30T00:00:00.000Z",
        skippedLargeFiles: [],
        sourceHash: "stale",
        unreadableFiles: []
      }
    });

    const result = await previewAIWorkspaceMessage(context(), { message: "fresh content" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.references).toEqual([
        expect.objectContaining({ path: "README.md", preview: "# New Topic" })
      ]);
    }
  });

  it("treats natural language apply commands as ordinary AI conversation", async () => {
    await writeData({
      operations: [createOperation("update", "draft.md", "# Draft\nupdated")]
    });

    const result = await previewAIWorkspaceMessage(context(), { message: "それ反映して" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.requiresExternalAI).toBe(true);
      expect(result.value.references).toEqual([]);
    }
  });

  it("treats hold-later commands as ordinary AI conversation", async () => {
    await writeData({
      operations: [createOperation("update", "draft.md", "# Draft\nupdated")]
    });

    const result = await previewAIWorkspaceMessage(context(), { message: "反映はまだしない" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.requiresExternalAI).toBe(true);
      expect(result.value.references).toEqual([]);
    }
  });

  it("treats natural language revert commands as ordinary AI conversation", async () => {
    await writeData({
      operations: [{
        ...createOperation("update", "draft.md", "# Draft\nupdated"),
        baseContent: "# Draft\nold",
        status: "applied"
      }]
    });

    const result = await previewAIWorkspaceMessage(context(), { message: "さっきの変更を戻して" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.requiresExternalAI).toBe(true);
      expect(result.value.references).toEqual([]);
    }
  });
});
